/**
 * Live inbox list and unread counts for /command-centre/inbox.
 * Off unless INBOX_REALTIME_ENABLED is the exact string true after trim.
 * True, TRUE, 1, yes, blank, and unset stay off.
 * With the flag off, nothing here subscribes and no extra unread badge is produced.
 * With the flag on, conversation and message changes for one organisation update
 * the list and the open thread. Unread numbers come from conversations.unread_count.
 * This module does not insert a queue row, does not call a provider, and does not
 * write consent or assignment.
 */

import { acceptRealtimeRow, matchesInboxList, realtimeOrgFilter, type InboxFilter } from "@/lib/inbox/rules";
import type { InboxListItem, InboxMessage } from "@/lib/inbox/types";

export const INBOX_REALTIME_FLAG = "INBOX_REALTIME_ENABLED";

const TABLES = ["conversations", "messages"] as const;
export type InboxRealtimeTable = (typeof TABLES)[number];

export function inboxRealtimeEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_REALTIME_FLAG] ?? "").trim() === "true";
}

/** The extra badge is absent unless the flag is on. Zero stays hidden. */
export function liveUnreadCount(enabled: boolean, unread: number) {
  if (!enabled) return null;
  if (!Number.isFinite(unread) || unread <= 0) return null;
  return Math.floor(unread);
}

export type RealtimePayload = {
  eventType: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

export type InboxRealtimeBinding = {
  on: (table: InboxRealtimeTable, filter: string, listener: (payload: RealtimePayload) => void) => void;
  subscribe: () => void;
  unsubscribe: () => void;
};

export type RealtimeSocket = {
  channel: (name: string) => InboxRealtimeBinding;
};

export type InboxRealtimeChange = {
  table: InboxRealtimeTable;
  event: "INSERT" | "UPDATE" | "DELETE";
  orgId: string;
  row: Record<string, unknown>;
};

export type LiveInboxState = {
  orgId: string;
  filter: InboxFilter;
  channelFilter: string;
  userId: string | null;
  assignedOnly: boolean;
  conversations: InboxListItem[];
  threadId: string | null;
  threadStatus: string | null;
  threadWindow: string | null;
  messages: InboxMessage[];
  previews: Record<string, { body: string; at: string }>;
};

export type RealtimeApplyResult = {
  state: LiveInboxState;
  accepted: boolean;
  sends: false;
  outbox: false;
  consentChanged: false;
  assignmentWritten: false;
};

export function liveInboxFromData(input: {
  orgId: string;
  filter: InboxFilter;
  channel: string;
  userId: string | null;
  assignedOnly: boolean;
  conversations: InboxListItem[];
  thread: { id: string; status: string; windowExpiresAt: string | null; messages: InboxMessage[] } | null;
}): LiveInboxState {
  return {
    orgId: input.orgId,
    filter: input.filter,
    channelFilter: input.channel,
    userId: input.userId,
    assignedOnly: input.assignedOnly,
    conversations: input.conversations.map((item) => ({ ...item })),
    threadId: input.thread?.id ?? null,
    threadStatus: input.thread?.status ?? null,
    threadWindow: input.thread?.windowExpiresAt ?? null,
    messages: input.thread?.messages.map((item) => ({ ...item })) ?? [],
    previews: {},
  };
}

/**
 * Opens one org-scoped channel. Returns subscribed false without calling the
 * socket when the flag is off, the inbox is a preview, or Supabase is unset.
 */
export function attachInboxRealtime(input: {
  enabled: boolean;
  orgId: string;
  preview: boolean;
  supabaseConfigured: boolean;
  client: RealtimeSocket | null;
  onChange: (change: InboxRealtimeChange) => void;
}) {
  if (!input.enabled || input.preview || !input.supabaseConfigured || !input.client) {
    return { subscribed: false, detach() {} };
  }
  let filter = "";
  try {
    filter = realtimeOrgFilter(input.orgId);
  } catch {
    return { subscribed: false, detach() {} };
  }
  const binding = input.client.channel(`inbox-live-${input.orgId.toLowerCase()}`);
  for (const table of TABLES) {
    binding.on(table, filter, (payload) => {
      const change = changeFromPayload(input.orgId, table, payload);
      if (!change) return;
      input.onChange(change);
    });
  }
  binding.subscribe();
  return {
    subscribed: true,
    detach() {
      binding.unsubscribe();
    },
  };
}

export function applyInboxRealtimeChange(state: LiveInboxState, change: InboxRealtimeChange): RealtimeApplyResult {
  const refused: RealtimeApplyResult = {
    state,
    accepted: false,
    sends: false,
    outbox: false,
    consentChanged: false,
    assignmentWritten: false,
  };
  if (!acceptRealtimeRow(state.orgId, change.orgId)) return refused;
  if (change.table === "conversations") return applyConversation(state, change);
  return applyMessage(state, change);
}

function changeFromPayload(sessionOrgId: string, table: InboxRealtimeTable, payload: RealtimePayload): InboxRealtimeChange | null {
  const event = payload.eventType === "DELETE" ? "DELETE" : payload.eventType === "UPDATE" ? "UPDATE" : payload.eventType === "INSERT" ? "INSERT" : null;
  if (!event) return null;
  const row = recordWithKeys(event === "DELETE" ? payload.old : payload.new) ?? recordWithKeys(payload.old);
  if (!row) return null;
  const orgId = typeof row.org_id === "string" ? row.org_id : "";
  if (!acceptRealtimeRow(sessionOrgId, orgId)) return null;
  return { table, event, orgId, row };
}

function applyConversation(state: LiveInboxState, change: InboxRealtimeChange): RealtimeApplyResult {
  const id = text(change.row.id);
  if (!id) return refused(state);
  if (change.event === "DELETE") {
    return accepted({
      ...state,
      conversations: state.conversations.filter((item) => item.id !== id),
    });
  }
  const previous = state.conversations.find((item) => item.id === id);
  const pending = state.previews[id];
  const drafted = conversationFromRow(change.row, previous);
  const next = {
    ...drafted,
    preview: drafted.preview || pending?.body || "",
    lastMessageAt: drafted.lastMessageAt || pending?.at || null,
  };
  const rest = state.conversations.filter((item) => item.id !== id);
  const conversations = visible(state, next) ? [next, ...rest].sort(byRecent).slice(0, 100) : rest;
  const onThread = state.threadId === id;
  return accepted({
    ...state,
    conversations,
    threadStatus: onThread ? next.status : state.threadStatus,
    threadWindow: onThread ? next.windowExpiresAt : state.threadWindow,
  });
}

function applyMessage(state: LiveInboxState, change: InboxRealtimeChange): RealtimeApplyResult {
  const id = text(change.row.id);
  const conversationId = text(change.row.conversation_id);
  if (!id || !conversationId) return refused(state);
  const preview = text(change.row.body).slice(0, 180);
  const at = text(change.row.created_at) || new Date(0).toISOString();
  const previews = preview
    ? { ...state.previews, [conversationId]: { body: preview, at } }
    : state.previews;
  const conversations = state.conversations.map((item) => {
    if (item.id !== conversationId) return item;
    return {
      ...item,
      preview: preview || item.preview,
      lastMessageAt: at || item.lastMessageAt,
    };
  }).sort(byRecent);
  if (state.threadId !== conversationId) {
    return accepted({ ...state, conversations, previews });
  }
  if (change.event === "DELETE") {
    return accepted({
      ...state,
      conversations,
      previews,
      messages: state.messages.filter((item) => item.id !== id),
    });
  }
  const message = messageFromRow(change.row);
  if (!message) return refused(state);
  const existing = state.messages.some((item) => item.id === message.id);
  const messages = existing
    ? state.messages.map((item) => (item.id === message.id ? message : item))
    : [...state.messages, message];
  messages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return accepted({ ...state, conversations, previews, messages });
}

function conversationFromRow(row: Record<string, unknown>, previous: InboxListItem | undefined): InboxListItem {
  return {
    id: text(row.id),
    channel: text(row.channel) || previous?.channel || "whatsapp",
    status: text(row.status) || previous?.status || "open",
    assignedUserId: "assigned_user_id" in row
      ? (row.assigned_user_id ? String(row.assigned_user_id) : null)
      : previous?.assignedUserId ?? null,
    connectionId: "channel_connection_id" in row
      ? (row.channel_connection_id ? String(row.channel_connection_id) : null)
      : previous?.connectionId ?? null,
    unread: "unread_count" in row ? unreadCount(row.unread_count) : previous?.unread ?? 0,
    lastMessageAt: "last_message_at" in row
      ? (row.last_message_at ? String(row.last_message_at) : null)
      : previous?.lastMessageAt ?? null,
    windowExpiresAt: "wa_window_expires_at" in row
      ? (row.wa_window_expires_at ? String(row.wa_window_expires_at) : null)
      : previous?.windowExpiresAt ?? null,
    snoozedUntil: "snoozed_until" in row
      ? (row.snoozed_until ? String(row.snoozed_until) : null)
      : previous?.snoozedUntil ?? null,
    snoozeLabel: previous?.snoozeLabel ?? null,
    contactName: previous?.contactName || "New message",
    preview: previous?.preview || "",
    phone: previous?.phone ?? "",
    email: previous?.email ?? "",
    tags: previous?.tags ?? [],
    leadTags: previous?.leadTags ?? [],
  };
}

function messageFromRow(row: Record<string, unknown>): InboxMessage | null {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    direction: row.direction === "out" ? "out" : "in",
    body: text(row.body),
    status: text(row.status) || "received",
    channel: text(row.channel),
    waCategory: text(row.wa_category),
    costCents: Number(row.cost_cents || 0),
    providerMessageId: text(row.provider_message_id),
    createdAt: text(row.created_at),
    media: [],
  };
}

function visible(state: LiveInboxState, item: InboxListItem) {
  if (state.assignedOnly && item.assignedUserId !== state.userId) return false;
  return matchesInboxList({
    status: item.status,
    assignedUserId: item.assignedUserId,
    channel: item.channel,
    filter: state.filter,
    channelFilter: state.channelFilter,
    userId: state.userId,
  });
}

function byRecent(a: InboxListItem, b: InboxListItem) {
  return Date.parse(b.lastMessageAt || "") - Date.parse(a.lastMessageAt || "");
}

function accepted(state: LiveInboxState): RealtimeApplyResult {
  return { state, accepted: true, sends: false, outbox: false, consentChanged: false, assignmentWritten: false };
}

function refused(state: LiveInboxState): RealtimeApplyResult {
  return { state, accepted: false, sends: false, outbox: false, consentChanged: false, assignmentWritten: false };
}

function recordWithKeys(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) return null;
  return value;
}

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function unreadCount(value: unknown) {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count);
}
