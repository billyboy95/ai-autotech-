/**
 * Quick replies, collision warning, and a narrow inbox layout.
 * Unset, blank, or any value other than the string true keeps today's inbox:
 * no quick-reply chips, no collision banner, and the desktop-first layout.
 * Quick replies only fill the composer. This module does not send, does not
 * call Meta, and does not turn sending_enabled on.
 * Canned replies are preview fixtures plus organizations.settings.inbox_quick_replies.
 * There is no new table. A dedicated inbox_quick_replies table is a follow-up.
 */

import type { InboxPresencePeer, InboxQuickReply } from "@/lib/inbox/types";

export const INBOX_QUICK_UX_FLAG = "INBOX_QUICK_UX_ENABLED";
export const INBOX_QUICK_REPLIES_KEY = "inbox_quick_replies";

const MAX_REPLIES = 8;
const MAX_LABEL = 32;
const MAX_BODY = 500;
const MAX_NAME = 80;
const REPLY_ID = /^[A-Za-z0-9_-]{1,40}$/;

/** In-memory defaults when a workspace has no inbox_quick_replies list yet. */
export const INBOX_QUICK_REPLIES_MEMORY: readonly InboxQuickReply[] = [
  {
    id: "hours",
    label: "Hours",
    body: "We are open Monday to Friday, 8am to 5pm. This reply is queued only and is not sent.",
  },
  {
    id: "callback",
    label: "Callback",
    body: "Thanks, a teammate will call you back. This reply stays in the outbox.",
  },
  {
    id: "booked",
    label: "Booked",
    body: "Your booking is noted. Nothing has been sent yet.",
  },
];

export function inboxQuickUxEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_QUICK_UX_FLAG] ?? "").trim().toLowerCase() === "true";
}

export function previewInboxPresence(openWaId: string, expiredWaId: string): InboxPresencePeer[] {
  return [
    {
      userId: "00000000-0000-4000-8000-0000000000cc",
      name: "Naledi Khumalo",
      state: "typing",
      conversationId: openWaId,
    },
    {
      userId: "00000000-0000-4000-8000-0000000000dd",
      name: "Sam Okonkwo",
      state: "viewing",
      conversationId: expiredWaId,
    },
  ];
}

/** Workspace list from organizations.settings. Empty when the key is missing or invalid. */
export function parseQuickReplies(settings: unknown): InboxQuickReply[] {
  const bag = asRecord(settings);
  const raw = bag[INBOX_QUICK_REPLIES_KEY] ?? bag.inboxQuickReplies;
  if (!Array.isArray(raw)) return [];
  const replies: InboxQuickReply[] = [];
  for (const item of raw) {
    if (replies.length >= MAX_REPLIES) break;
    const row = asRecord(item);
    const label = text(row.label).slice(0, MAX_LABEL);
    const body = text(row.body).slice(0, MAX_BODY);
    const rawId = text(row.id).slice(0, 40);
    if (!label || !body) continue;
    if (rawId && !REPLY_ID.test(rawId)) continue;
    replies.push({ id: rawId || `reply-${replies.length + 1}`, label, body });
  }
  return replies;
}

/** Org settings win. Otherwise the in-memory defaults. Never reads a new table. */
export function quickRepliesForWorkspace(settings: unknown): InboxQuickReply[] {
  const parsed = parseQuickReplies(settings);
  if (parsed.length > 0) return parsed;
  return INBOX_QUICK_REPLIES_MEMORY.map((item) => ({ ...item }));
}

/** Fills the composer. A blank reply is ignored. Repeating the same text does not duplicate it. */
export function insertQuickReply(current: string, reply: string) {
  const next = reply.trim();
  if (!next) return current;
  const trimmed = current.trim();
  if (!trimmed) return next;
  if (trimmed === next || current.trimEnd().endsWith(next)) return current;
  return `${current.replace(/\s+$/, "")}\n${next}`;
}

export function viewerPresenceName(userId: string | null, members: readonly { userId: string; role: string }[]) {
  if (!userId) return "Teammate";
  const role = members.find((member) => member.userId === userId)?.role.trim() ?? "";
  if (!role) return "Teammate";
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Payload for the existing inbox Realtime channel. No message body. */
export function presencePayload(input: {
  userId: string | null;
  name: string;
  conversationId: string;
  typing: boolean;
}): Record<string, string> | null {
  const userId = text(input.userId);
  const conversationId = text(input.conversationId);
  const name = text(input.name).slice(0, MAX_NAME);
  if (!userId || !conversationId || !name) return null;
  return {
    userId,
    name,
    conversationId,
    state: input.typing ? "typing" : "viewing",
  };
}

/**
 * Peers from channel.presenceState(). Names come from workspace membership, not the payload.
 * Unknown users and the current user are dropped.
 */
export function peersFromPresence(
  state: Record<string, readonly unknown[]>,
  selfId: string | null,
  conversationId: string,
  members: readonly { userId: string; role: string }[],
): InboxPresencePeer[] {
  if (!conversationId) return [];
  const allowed = new Map(members.map((member) => [member.userId, member]));
  const byUser = new Map<string, InboxPresencePeer>();
  for (const entries of Object.values(state)) {
    const list = Array.isArray(entries) ? entries : [];
    for (const entry of list) {
      const peer = parsePresence(entry);
      if (!peer || peer.conversationId !== conversationId) continue;
      if (!peer.userId || peer.userId === selfId) continue;
      if (!allowed.has(peer.userId)) continue;
      const named = { ...peer, name: viewerPresenceName(peer.userId, members) };
      const existing = byUser.get(peer.userId);
      if (!existing || (existing.state !== "typing" && named.state === "typing")) byUser.set(peer.userId, named);
    }
  }
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId));
}

/** "{Name} is viewing" or "{Name} is typing". Typing wins. Empty when nobody else is here. */
export function collisionBanner(peers: readonly InboxPresencePeer[], selfId: string | null, conversationId: string) {
  const others = peers.filter((peer) => {
    if (!conversationId || peer.conversationId !== conversationId) return false;
    if (selfId && peer.userId === selfId) return false;
    if (peer.state !== "viewing" && peer.state !== "typing") return false;
    return Boolean(peer.name.trim());
  });
  if (!others.length) return "";
  const person = others.find((peer) => peer.state === "typing") ?? others[0];
  return `${person.name} is ${person.state}`;
}

export function inboxQuickClasses(enabled: boolean) {
  if (!enabled) {
    return {
      shell: "grid gap-4",
      columns: "grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]",
      filters: "flex flex-wrap gap-2",
      chip: "inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold",
      list: "grid gap-2",
      thread: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
      aside: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
      compose: "flex flex-wrap gap-2",
      channelField: "grid gap-1 text-xs font-semibold text-slate-500",
      field: "grid min-w-40 flex-1 gap-1 text-xs font-semibold text-slate-500",
      bubble: "max-w-[36rem] rounded-xl px-3 py-2 text-sm",
      messageList: "grid max-h-[28rem] gap-2 overflow-y-auto",
      replyForm: "grid gap-2 border-t border-slate-100 pt-3",
      replySelect: "h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900",
      numberForm: "flex flex-wrap items-end gap-2",
      numberSelect: "h-9 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800",
      showButton: "h-9 rounded-full bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200",
    };
  }
  return {
    shell: "grid min-w-0 gap-4 max-lg:overflow-x-hidden",
    columns: "grid min-w-0 items-start gap-4 max-lg:grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_280px]",
    filters: "flex flex-wrap gap-2 max-lg:w-full max-lg:min-w-0 max-lg:max-w-full max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:overscroll-x-contain max-lg:pb-1",
    chip: "inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold max-lg:h-11 max-lg:min-h-11 max-lg:shrink-0 max-lg:px-4",
    list: "grid min-w-0 gap-2",
    thread: "min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
    aside: "min-w-0 break-words rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
    compose: "flex flex-wrap gap-2 max-lg:w-full max-lg:min-w-0",
    channelField: "grid min-w-0 gap-1 text-xs font-semibold text-slate-500 max-lg:w-full",
    field: "grid min-w-0 max-w-full flex-1 gap-1 text-xs font-semibold text-slate-500 max-lg:w-full lg:min-w-40",
    bubble: "max-w-[36rem] break-words rounded-xl px-3 py-2 text-sm max-lg:max-w-full",
    messageList: "grid max-h-[28rem] min-w-0 gap-2 overflow-y-auto",
    replyForm: "grid min-w-0 gap-2 border-t border-slate-100 pt-3",
    replySelect: "h-10 max-w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 max-lg:h-11",
    numberForm: "flex flex-wrap items-end gap-2 max-lg:w-full max-lg:min-w-0 max-lg:max-w-full",
    numberSelect: "h-9 max-w-full rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 max-lg:h-11",
    showButton: "h-9 rounded-full bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 max-lg:h-11 max-lg:min-h-11 max-lg:px-4",
  };
}

function parsePresence(value: unknown): InboxPresencePeer | null {
  const row = asRecord(value);
  const userId = text(row.userId ?? row.user_id);
  const name = text(row.name).slice(0, MAX_NAME);
  const conversationId = text(row.conversationId ?? row.conversation_id);
  const state = text(row.state);
  if (!userId || !name || !conversationId) return null;
  if (state !== "viewing" && state !== "typing") return null;
  return { userId, name, state, conversationId };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
