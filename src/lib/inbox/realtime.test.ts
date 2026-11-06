import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyInboxRealtimeChange,
  attachInboxRealtime,
  inboxRealtimeEnabled,
  liveInboxFromData,
  liveUnreadCount,
  type InboxRealtimeBinding,
  type InboxRealtimeChange,
  type InboxRealtimeTable,
  type RealtimePayload,
  type RealtimeSocket,
} from "@/lib/inbox/realtime";

const EASTC = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const AGENCY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const CONV = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const AT = "2026-11-05T11:00:00.000Z";

test("realtime stays off unless the flag is the exact string true", () => {
  assert.equal(inboxRealtimeEnabled({} as NodeJS.ProcessEnv), false);
  for (const value of ["", " ", "True", "TRUE", "1", "yes", "false", "on"]) {
    assert.equal(inboxRealtimeEnabled({ INBOX_REALTIME_ENABLED: value }), false);
  }
  assert.equal(inboxRealtimeEnabled({ INBOX_REALTIME_ENABLED: " true " }), true);
  assert.equal(inboxRealtimeEnabled({ INBOX_REALTIME_ENABLED: "true" }), true);
  assert.equal(liveUnreadCount(false, 4), null);
  assert.equal(liveUnreadCount(true, 0), null);
  assert.equal(liveUnreadCount(true, 4), 4);
});

test("flag off does not open a realtime subscription", () => {
  const client = fakeSocket();
  const attached = attachInboxRealtime({
    enabled: false,
    orgId: EASTC,
    preview: false,
    supabaseConfigured: true,
    client,
    onChange() {
      throw new Error("flag off must not deliver a row");
    },
  });
  assert.equal(attached.subscribed, false);
  assert.equal(client.opened, 0);
  const preview = attachInboxRealtime({
    enabled: true,
    orgId: EASTC,
    preview: true,
    supabaseConfigured: true,
    client,
    onChange() {
      throw new Error("preview must not subscribe");
    },
  });
  const unconfigured = attachInboxRealtime({
    enabled: true,
    orgId: EASTC,
    preview: false,
    supabaseConfigured: false,
    client,
    onChange() {
      throw new Error("missing Supabase must not subscribe");
    },
  });
  assert.equal(preview.subscribed, false);
  assert.equal(unconfigured.subscribed, false);
  assert.equal(client.opened, 0);
});

test("flag on applies an inbound fixture in one org and ignores the other", () => {
  const client = fakeSocket();
  const seen: InboxRealtimeChange[] = [];
  const attached = attachInboxRealtime({
    enabled: true,
    orgId: EASTC,
    preview: false,
    supabaseConfigured: true,
    client,
    onChange(change) {
      seen.push(change);
    },
  });
  assert.equal(attached.subscribed, true);
  assert.equal(client.names[0], `inbox-live-${EASTC}`);
  assert.deepEqual(client.tables, ["conversations", "messages"]);
  assert.deepEqual(client.filters, [`org_id=eq.${EASTC}`, `org_id=eq.${EASTC}`]);

  client.emit("messages", {
    eventType: "INSERT",
    new: {
      org_id: AGENCY,
      id: "msg-leak",
      conversation_id: CONV,
      direction: "in",
      body: "Other workspace",
      status: "received",
      channel: "whatsapp",
      created_at: AT,
    },
    old: null,
  });
  assert.equal(seen.length, 0);

  client.emit("messages", {
    eventType: "INSERT",
    new: {
      org_id: EASTC,
      id: "msg-in",
      conversation_id: CONV,
      direction: "in",
      body: "Is the bay free tomorrow?",
      status: "received",
      channel: "whatsapp",
      created_at: AT,
    },
    old: null,
  });
  client.emit("conversations", {
    eventType: "UPDATE",
    new: {
      org_id: EASTC,
      id: CONV,
      channel: "whatsapp",
      status: "open",
      assigned_user_id: null,
      unread_count: 2,
      last_message_at: AT,
      wa_window_expires_at: "2026-11-06T11:00:00.000Z",
    },
    old: { org_id: EASTC, id: CONV },
  });

  let state = liveInboxFromData({
    orgId: EASTC,
    filter: "open",
    channel: "",
    userId: "user-1",
    assignedOnly: false,
    conversations: [{
      id: CONV,
      channel: "whatsapp",
      status: "open",
      assignedUserId: null,
      unread: 1,
      lastMessageAt: "2026-11-05T10:00:00.000Z",
      windowExpiresAt: null,
      contactName: "Lerato Mokoena",
      preview: "Earlier note",
    }],
    thread: {
      id: CONV,
      status: "open",
      windowExpiresAt: null,
      messages: [],
    },
  });
  for (const change of seen) {
    const applied = applyInboxRealtimeChange(state, change);
    assert.equal(applied.accepted, true);
    assert.equal(applied.sends, false);
    assert.equal(applied.outbox, false);
    assert.equal(applied.consentChanged, false);
    assert.equal(applied.assignmentWritten, false);
    state = applied.state;
  }
  assert.equal(state.conversations[0]?.unread, 2);
  assert.equal(state.conversations[0]?.preview, "Is the bay free tomorrow?");
  assert.equal(state.conversations[0]?.contactName, "Lerato Mokoena");
  assert.equal(state.messages.at(-1)?.body, "Is the bay free tomorrow?");
  assert.equal(state.messages.at(-1)?.direction, "in");
  assert.equal(state.messages.some((item) => item.body === "Other workspace"), false);
  assert.equal(liveUnreadCount(true, state.conversations[0]?.unread ?? 0), 2);

  const leaked = applyInboxRealtimeChange(state, {
    table: "messages",
    event: "INSERT",
    orgId: AGENCY,
    row: {
      id: "msg-direct",
      conversation_id: CONV,
      org_id: AGENCY,
      direction: "in",
      body: "Should not land",
      status: "received",
    },
  });
  assert.equal(leaked.accepted, false);
  assert.equal(leaked.state, state);
  assert.equal(leaked.sends, false);
  assert.equal(leaked.outbox, false);
  attached.detach();
  assert.equal(client.subscribed, false);
});

test("a new inbound thread shows up from the message and the conversation row", () => {
  const fresh = liveInboxFromData({
    orgId: EASTC,
    filter: "open",
    channel: "",
    userId: "user-1",
    assignedOnly: false,
    conversations: [],
    thread: null,
  });
  const messaged = applyInboxRealtimeChange(fresh, {
    table: "messages",
    event: "INSERT",
    orgId: EASTC,
    row: {
      id: "msg-new",
      org_id: EASTC,
      conversation_id: CONV,
      direction: "in",
      body: "New enquiry",
      status: "received",
      channel: "sms",
      created_at: AT,
    },
  });
  assert.equal(messaged.sends, false);
  assert.equal(messaged.state.conversations.length, 0);
  const listed = applyInboxRealtimeChange(messaged.state, {
    table: "conversations",
    event: "INSERT",
    orgId: EASTC,
    row: {
      id: CONV,
      org_id: EASTC,
      channel: "sms",
      status: "open",
      assigned_user_id: null,
      unread_count: 1,
      last_message_at: AT,
    },
  });
  assert.equal(listed.accepted, true);
  assert.equal(listed.outbox, false);
  assert.equal(listed.assignmentWritten, false);
  assert.equal(listed.state.conversations.length, 1);
  assert.equal(listed.state.conversations[0]?.preview, "New enquiry");
  assert.equal(listed.state.conversations[0]?.unread, 1);
  assert.equal(listed.state.conversations[0]?.contactName, "New message");
  const otherOrg = applyInboxRealtimeChange(listed.state, {
    table: "conversations",
    event: "INSERT",
    orgId: AGENCY,
    row: {
      id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      org_id: AGENCY,
      channel: "sms",
      status: "open",
      unread_count: 9,
    },
  });
  assert.equal(otherOrg.accepted, false);
  assert.equal(otherOrg.state.conversations.length, 1);
});

test("an outbound held message updates the open thread and does not send", () => {
  const state = liveInboxFromData({
    orgId: EASTC,
    filter: "open",
    channel: "whatsapp",
    userId: "user-1",
    assignedOnly: false,
    conversations: [{
      id: CONV,
      channel: "whatsapp",
      status: "open",
      assignedUserId: "user-1",
      unread: 0,
      lastMessageAt: AT,
      windowExpiresAt: null,
      contactName: "Lerato Mokoena",
      preview: "",
    }],
    thread: { id: CONV, status: "open", windowExpiresAt: null, messages: [] },
  });
  const applied = applyInboxRealtimeChange(state, {
    table: "messages",
    event: "INSERT",
    orgId: EASTC,
    row: {
      id: "msg-out",
      org_id: EASTC,
      conversation_id: CONV,
      direction: "out",
      body: "Held in the outbox.",
      status: "held",
      channel: "whatsapp",
      created_at: AT,
    },
  });
  assert.equal(applied.sends, false);
  assert.equal(applied.outbox, false);
  assert.equal(applied.state.messages[0]?.status, "held");
  assert.notEqual(applied.state.messages[0]?.status, "sent");
  assert.equal(applied.state.conversations[0]?.unread, 0);
});

test("a closed conversation leaves the open list without writing assignment", () => {
  const state = liveInboxFromData({
    orgId: EASTC,
    filter: "open",
    channel: "",
    userId: "user-1",
    assignedOnly: false,
    conversations: [{
      id: CONV,
      channel: "sms",
      status: "open",
      assignedUserId: null,
      unread: 3,
      lastMessageAt: AT,
      windowExpiresAt: null,
      contactName: "Thabo Ndlovu",
      preview: "Please call",
    }],
    thread: { id: CONV, status: "open", windowExpiresAt: null, messages: [] },
  });
  const applied = applyInboxRealtimeChange(state, {
    table: "conversations",
    event: "UPDATE",
    orgId: EASTC,
    row: {
      id: CONV,
      org_id: EASTC,
      channel: "sms",
      status: "closed",
      assigned_user_id: "user-2",
      unread_count: 0,
      last_message_at: AT,
    },
  });
  assert.equal(applied.assignmentWritten, false);
  assert.equal(applied.consentChanged, false);
  assert.equal(applied.state.conversations.length, 0);
  assert.equal(applied.state.threadStatus, "closed");
});

test("the live module and the inbox page do not send or call Meta", () => {
  const realtime = readFileSync(new URL("./realtime.ts", import.meta.url), "utf8");
  const view = readFileSync(new URL("../../components/inbox/inbox-view.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../../app/command-centre/inbox/page.tsx", import.meta.url), "utf8");
  for (const source of [realtime, view, page]) {
    assert.equal(source.includes("graph.facebook.com"), false);
    assert.equal(source.includes("crm_outbox"), false);
    assert.equal(/sending_enabled\s*=\s*true/i.test(source), false);
  }
  assert.match(page, /realtimeEnabled=\{inboxRealtimeEnabled\(\)\}/);
  assert.match(view, /if \(!realtimeEnabled \|\| data\.preview\) return/);
  assert.match(view, /attachInboxRealtime/);
});

function fakeSocket() {
  const bindings: Array<{
    name: string;
    tables: InboxRealtimeTable[];
    filters: string[];
    listeners: Map<InboxRealtimeTable, (payload: RealtimePayload) => void>;
    subscribed: boolean;
  }> = [];
  const client: RealtimeSocket & {
    opened: number;
    names: string[];
    tables: InboxRealtimeTable[];
    filters: string[];
    subscribed: boolean;
    emit: (table: InboxRealtimeTable, payload: RealtimePayload) => void;
  } = {
    opened: 0,
    names: [],
    tables: [],
    filters: [],
    subscribed: false,
    channel(name) {
      this.opened += 1;
      this.names.push(name);
      const binding = {
        name,
        tables: [] as InboxRealtimeTable[],
        filters: [] as string[],
        listeners: new Map<InboxRealtimeTable, (payload: RealtimePayload) => void>(),
        subscribed: false,
      };
      bindings.push(binding);
      const api: InboxRealtimeBinding = {
        on: (table, filter, listener) => {
          binding.tables.push(table);
          binding.filters.push(filter);
          binding.listeners.set(table, listener);
          client.tables.push(table);
          client.filters.push(filter);
        },
        subscribe: () => {
          binding.subscribed = true;
          client.subscribed = true;
        },
        unsubscribe: () => {
          binding.subscribed = false;
          client.subscribed = false;
        },
      };
      return api;
    },
    emit(table, payload) {
      const binding = bindings[0];
      binding?.listeners.get(table)?.(payload);
    },
  };
  return client;
}
