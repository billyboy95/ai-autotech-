import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InboxCollisionBanner, InboxQuickFrame, InboxQuickReplies } from "@/components/inbox/inbox-quick-ux";
import { InboxTeamStatsPanel } from "@/components/inbox/inbox-team-stats";
import { InboxWaReplyFields, InboxWaWindow } from "@/components/inbox/inbox-wa-window";
import { previewInbox } from "@/lib/inbox/preview";
import {
  collisionBanner,
  inboxQuickClasses,
  inboxQuickUxEnabled,
  insertQuickReply,
  parseQuickReplies,
  peersFromPresence,
  presencePayload,
  quickRepliesForWorkspace,
} from "@/lib/inbox/quick-ux";
import {
  displayPhoneFromConfig,
  inboxHref,
  inboxMultiNumberEnabled,
  matchesInboxNumber,
  parseInboxNumber,
  resolveInboxNumber,
  whatsappNumberParts,
} from "@/lib/inbox/numbers";
import { buildInboxTeamStats, inboxTeamStatsEnabled } from "@/lib/inbox/team-stats";
import { customerCareWindow, inboxWaWindowEnabled, waCareState, type WaWindowMessage } from "@/lib/inbox/wa-window";
import type { InboxData } from "@/lib/inbox/types";
import {
  acceptRealtimeRow,
  formatInboxCost,
  inboxCost,
  matchesInboxList,
  planInboxReply,
  planInboundThread,
  realtimeOrgFilter,
  serviceAllowanceLabel,
  whatsappComposeGate,
  whatsappWindowOpen,
  windowCountdown,
  windowExpiry,
} from "@/lib/inbox/rules";

const EASTC = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const AGENCY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const NOW = new Date("2026-10-15T10:00:00.000Z");
const BEFORE = new Date("2026-09-26T10:00:00.000Z");

test("free-form WhatsApp outside 24 hours is blocked with a use-template prompt", () => {
  const opened = new Date("2026-10-14T09:00:00.000Z");
  const expires = windowExpiry(opened);
  assert.equal(whatsappWindowOpen(expires, NOW), false);
  const blocked = whatsappComposeGate({ channel: "whatsapp", now: NOW, windowExpiresAt: expires, template: null });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.code, "use_template");
    assert.match(blocked.message, /use an approved template/i);
  }
  const reply = planInboxReply({
    now: NOW,
    sendingEnabled: false,
    channel: "whatsapp",
    body: "Hello outside the window",
    toAddress: "+27825550101",
    conversationId: "conv-1",
    contactId: "contact-1",
    leadId: "lead-1",
    connectionId: "conn-1",
    userId: "user-1",
    senderName: "EASTC",
    windowExpiresAt: expires,
    template: null,
    suppressed: false,
    consent: "opted_in",
    serviceSendsThisMonth: 0,
  });
  assert.equal(reply.ok, false);
  if (!reply.ok) assert.equal(reply.code, "use_template");
});

test("an approved WhatsApp template can be queued outside the window and stays in the outbox", () => {
  const inside = windowExpiry(NOW);
  assert.equal(whatsappWindowOpen(inside, new Date(NOW.getTime() + 60_000)), true);
  assert.equal(windowCountdown(inside, NOW), "24h 0m");
  const reply = planInboxReply({
    now: NOW,
    sendingEnabled: false,
    channel: "whatsapp",
    body: "ignored because the window is closed",
    toAddress: "+27825550101",
    conversationId: "conv-1",
    contactId: "contact-1",
    leadId: "lead-1",
    connectionId: "conn-1",
    userId: "user-1",
    senderName: "EASTC",
    windowExpiresAt: windowExpiry(new Date("2026-10-13T10:00:00.000Z")),
    template: {
      id: "tpl-1",
      channel: "whatsapp",
      name: "Enrolment follow-up",
      body: "Hi, here is the approved enrolment note.",
      subject: "",
      waCategory: "utility",
      approved: true,
    },
    suppressed: false,
    consent: "opted_in",
    serviceSendsThisMonth: 12,
  });
  assert.equal(reply.ok, true);
  if (!reply.ok) return;
  assert.equal(reply.outbox.status, "held");
  assert.equal(reply.outbox.provider, "outbox");
  assert.ok(reply.outbox.providerId);
  assert.equal(reply.message.providerMessageId, `outbox:${reply.outbox.id}`);
  assert.notEqual(reply.message.status, "sent");
  assert.equal(reply.message.body.includes("approved enrolment note"), true);
  assert.equal(formatInboxCost({ cents: reply.outbox.costCents, label: "utility" }), "utility · R0.13");
});

test("service messages are free until the monthly allowance is used from 1 Oct 2026", () => {
  const early = inboxCost({ channel: "whatsapp", waCategory: "service", now: BEFORE, serviceSendsThisMonth: 1000 });
  assert.deepEqual(early, { cents: 0, label: "service" });
  const free = inboxCost({ channel: "whatsapp", waCategory: "service", now: NOW, serviceSendsThisMonth: 999 });
  const paid = inboxCost({ channel: "whatsapp", waCategory: "service", now: NOW, serviceSendsThisMonth: 1000 });
  assert.equal(free.cents, 0);
  assert.equal(paid.cents, 13);
  assert.match(serviceAllowanceLabel({ now: BEFORE, used: 4, hasNumber: true }), /1 Oct 2026/);
  assert.match(serviceAllowanceLabel({ now: NOW, used: 12, hasNumber: true }), /12 of 1000/);
  assert.equal(formatInboxCost(inboxCost({ channel: "whatsapp", waCategory: "marketing", now: NOW, serviceSendsThisMonth: 0 })), "marketing · R0.66");
});

test("realtime filters are scoped to one organisation", () => {
  const eastc = realtimeOrgFilter(EASTC);
  const agency = realtimeOrgFilter(AGENCY);
  assert.equal(eastc, `org_id=eq.${EASTC}`);
  assert.notEqual(eastc, agency);
  assert.equal(acceptRealtimeRow(EASTC, AGENCY), false);
  assert.equal(acceptRealtimeRow(EASTC, EASTC.toUpperCase()), true);
  assert.equal(acceptRealtimeRow(EASTC, null), false);
  assert.throws(() => realtimeOrgFilter("not-an-org"), /organisation id/);
});

test("list filters keep open, mine, and unassigned apart from channel", () => {
  const mine = { status: "open", assignedUserId: "user-1", channel: "whatsapp", filter: "mine" as const, channelFilter: "", userId: "user-1" };
  assert.equal(matchesInboxList(mine), true);
  assert.equal(matchesInboxList({ ...mine, userId: "user-2" }), false);
  assert.equal(matchesInboxList({ ...mine, filter: "unassigned" }), false);
  assert.equal(matchesInboxList({ ...mine, filter: "open", channelFilter: "sms" }), false);
  assert.equal(matchesInboxList({ status: "closed", assignedUserId: null, channel: "sms", filter: "unassigned", channelFilter: "", userId: "user-1" }), false);
});

test("an inbound message feeds message.inbound and refreshes the WhatsApp window", () => {
  const planned = planInboundThread({
    now: NOW,
    channel: "whatsapp",
    body: "Is there space in the October intake?",
    providerMessageId: "wamid.1",
    stop: false,
    existing: { id: "conv-1", unreadCount: 2 },
  });
  assert.deepEqual(planned.events, ["message.inbound"]);
  assert.equal(planned.unreadCount, 3);
  assert.equal(planned.waWindowExpiresAt, windowExpiry(NOW));
  const stopped = planInboundThread({
    now: NOW,
    channel: "sms",
    body: "STOP",
    providerMessageId: "sms-1",
    stop: true,
    existing: null,
  });
  assert.deepEqual(stopped.events, ["message.inbound", "opt_out.received"]);
});

test("a suppressed reply is recorded as blocked_consent and is not sent", () => {
  const reply = planInboxReply({
    now: NOW,
    sendingEnabled: true,
    channel: "whatsapp",
    body: "Following up",
    toAddress: "+27825550101",
    conversationId: "conv-1",
    contactId: "contact-1",
    leadId: null,
    connectionId: null,
    userId: "user-1",
    senderName: "EASTC",
    windowExpiresAt: windowExpiry(NOW),
    template: null,
    suppressed: true,
    consent: "opted_out",
    serviceSendsThisMonth: 0,
  });
  assert.equal(reply.ok, true);
  if (!reply.ok) return;
  assert.equal(reply.outbox.status, "blocked_consent");
  assert.notEqual(reply.message.status, "sent");
  assert.equal(reply.outbox.provider, "outbox");
});

test("the WhatsApp number filter stays off unless the flag is the string true", () => {
  assert.equal(inboxMultiNumberEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(inboxMultiNumberEnabled({ INBOX_MULTI_NUMBER_ENABLED: "" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxMultiNumberEnabled({ INBOX_MULTI_NUMBER_ENABLED: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxMultiNumberEnabled({ INBOX_MULTI_NUMBER_ENABLED: "true" } as NodeJS.ProcessEnv), true);
  const today = previewInbox({ multiNumber: false, number: "preview-wa-desk" });
  assert.equal(today.multiNumber, false);
  assert.equal(today.number, "");
  assert.deepEqual(today.whatsappNumbers, []);
  assert.equal(today.sendingEnabled, false);
  assert.deepEqual(today.conversations.map((item) => item.contactName), [
    "Lerato Mokoena",
    "Thabo Ndlovu",
    "Amina Patel",
  ]);
  assert.equal(inboxHref({ multiNumber: false, number: "preview-wa-desk" }), "/command-centre/inbox");
});

test("a selected WhatsApp number filters the preview inbox and all numbers shows every thread", () => {
  const all = previewInbox({ multiNumber: true });
  assert.equal(all.multiNumber, true);
  assert.equal(all.number, "");
  assert.equal(all.sendingEnabled, false);
  assert.deepEqual(all.whatsappNumbers.map((item) => item.label), ["Admissions · 0101", "Front desk · 0199"]);
  assert.deepEqual(all.conversations.map((item) => item.contactName), [
    "Lerato Mokoena",
    "Thabo Ndlovu",
    "Amina Patel",
    "Sipho Dlamini",
  ]);
  const desk = previewInbox({ multiNumber: true, number: "preview-wa-desk" });
  assert.equal(desk.number, "preview-wa-desk");
  assert.deepEqual(desk.conversations.map((item) => item.contactName), ["Sipho Dlamini"]);
  assert.equal(desk.thread?.contact?.name, "Sipho Dlamini");
  assert.equal(desk.conversations[0]?.connectionId, "preview-wa-desk");
  const admissions = previewInbox({ multiNumber: true, number: "preview-wa" });
  assert.deepEqual(admissions.conversations.map((item) => item.contactName), ["Lerato Mokoena", "Amina Patel"]);
  const unknown = previewInbox({ multiNumber: true, number: "other-org-number" });
  assert.equal(unknown.number, "");
  assert.equal(unknown.conversations.length, all.conversations.length);
  assert.equal(inboxHref({ multiNumber: true, number: "preview-wa", channel: "whatsapp" }), "/command-centre/inbox?channel=whatsapp&number=preview-wa");
  assert.equal(inboxHref({ multiNumber: true, number: "", filter: "mine" }), "/command-centre/inbox?filter=mine");
});

test("number labels use the display name and the last four digits", () => {
  assert.deepEqual(whatsappNumberParts({ displayName: "Sales", identifier: "109876543210", displayPhone: "" }), {
    displayName: "Sales",
    last4: "3210",
    label: "Sales · 3210",
  });
  assert.equal(
    whatsappNumberParts({ displayName: "Front desk", identifier: "109876543210", displayPhone: "+27 82 555 0199" }).label,
    "Front desk · 0199",
  );
  assert.equal(whatsappNumberParts({ displayName: "", identifier: "109876543210" }).label, "WhatsApp · 3210");
  assert.equal(whatsappNumberParts({ displayName: "Placeholder", identifier: "placeholder" }).label, "Placeholder");
  assert.equal(displayPhoneFromConfig({ displayPhone: " +27115550101 " }), "+27115550101");
  assert.equal(displayPhoneFromConfig("{\"display_phone\":\"0825550101\"}"), "0825550101");
  assert.equal(parseInboxNumber("all"), "");
  assert.equal(parseInboxNumber("preview-wa"), "preview-wa");
  assert.equal(parseInboxNumber("bad id"), "");
  assert.equal(resolveInboxNumber("preview-wa", ["preview-wa"]), "preview-wa");
  assert.equal(resolveInboxNumber("other-org", ["preview-wa"]), "");
  assert.equal(matchesInboxNumber({ enabled: false, numberId: "preview-wa", channel: "whatsapp", connectionId: "other" }), true);
  assert.equal(matchesInboxNumber({ enabled: true, numberId: "preview-wa", channel: "sms", connectionId: "preview-wa" }), false);
  assert.equal(matchesInboxNumber({ enabled: true, numberId: "preview-wa", channel: "whatsapp", connectionId: "preview-wa" }), true);
});

test("the multi-number filter does not turn sending on or call Meta", () => {
  const files = [
    "src/lib/inbox/numbers.ts",
    "src/lib/inbox/load.ts",
    "src/lib/inbox/preview.ts",
    "src/components/inbox/inbox-view.tsx",
    "src/app/actions/inbox.ts",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|api\.whatsapp/i.test(text), false, file);
  }
});

test("team stats stay off unless the flag is the string true", () => {
  assert.equal(inboxTeamStatsEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(inboxTeamStatsEnabled({ INBOX_TEAM_STATS_ENABLED: "" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxTeamStatsEnabled({ INBOX_TEAM_STATS_ENABLED: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxTeamStatsEnabled({ INBOX_TEAM_STATS_ENABLED: "yes" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxTeamStatsEnabled({ INBOX_TEAM_STATS_ENABLED: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxTeamStatsEnabled({ INBOX_TEAM_STATS_ENABLED: " true " } as NodeJS.ProcessEnv), true);
  const off = previewInbox({ teamStats: false, multiNumber: false, number: "preview-wa-desk" });
  const on = previewInbox({ teamStats: true, multiNumber: false, number: "preview-wa-desk" });
  assert.equal(off.teamStats, null);
  assert.equal(off.sendingEnabled, false);
  assert.equal(on.sendingEnabled, false);
  assert.equal(on.multiNumber, false);
  assert.equal(on.number, "");
  assert.deepEqual(on.conversations, off.conversations);
  assert.deepEqual(on.conversations.map((item) => item.contactName), [
    "Lerato Mokoena",
    "Thabo Ndlovu",
    "Amina Patel",
  ]);
  const hidden = renderToStaticMarkup(createElement(InboxTeamStatsPanel, { stats: null }));
  assert.equal(hidden.includes("inbox-team-stats"), false);
  assert.equal(hidden.includes("Team stats"), false);
});

test("team stats render from the preview fixtures when the flag is on", () => {
  const data = previewInbox({ teamStats: true });
  const stats = data.teamStats;
  assert.ok(stats);
  assert.equal(data.sendingEnabled, false);
  assert.equal(stats.medianFirstResponseMs, 0);
  assert.equal(stats.repliedCount, 1);
  assert.equal(stats.awaitingFirstReply, 2);
  assert.equal(stats.openCount, 3);
  assert.deepEqual(stats.slaBreaches.map((item) => item.contactName), ["Amina Patel"]);
  assert.equal(stats.slaBreaches[0]?.ageMs, 26 * 60 * 60 * 1000);
  assert.deepEqual(stats.agents.map((agent) => ({ label: agent.label, assigned: agent.assigned, replies: agent.replies })), [
    { label: "You · client_admin", assigned: 1, replies: 1 },
    { label: "Unassigned", assigned: 2, replies: 0 },
  ]);
  const html = renderToStaticMarkup(createElement(InboxTeamStatsPanel, { stats }));
  assert.match(html, /data-testid="inbox-team-stats"/);
  assert.match(html, /inbox-first-response/);
  assert.match(html, />0m</);
  assert.match(html, /Amina Patel · open 26h 0m/);
  assert.match(html, /1 over 24h/);
  assert.match(html, /You · client_admin/);
  assert.match(html, /Unassigned/);
  assert.match(html, /Nothing is sent/);
  assert.equal(/graph\.facebook|api\.whatsapp/i.test(html), false);

  const desk = previewInbox({ teamStats: true, multiNumber: true, number: "preview-wa-desk" });
  assert.deepEqual(desk.conversations.map((item) => item.contactName), ["Sipho Dlamini"]);
  assert.equal(desk.teamStats?.medianFirstResponseMs, null);
  assert.equal(desk.teamStats?.awaitingFirstReply, 1);
  assert.deepEqual(desk.teamStats?.slaBreaches, []);
  assert.equal(desk.teamStats?.agents.some((agent) => agent.label === "Unassigned" && agent.assigned === 1), true);

  const mine = previewInbox({ teamStats: true, filter: "mine" });
  assert.deepEqual(mine.conversations.map((item) => item.contactName), ["Lerato Mokoena"]);
  assert.equal(mine.teamStats?.slaBreaches.length, 0);
  assert.equal(mine.teamStats?.awaitingFirstReply, 0);
});

test("first response ignores failed replies and SLA uses a 24 hour open age", () => {
  const start = new Date("2026-10-15T10:00:00.000Z");
  const now = new Date(start.getTime() + 40 * 60 * 1000);
  const stats = buildInboxTeamStats({
    now,
    conversations: [
      { id: "a", status: "open", assignedUserId: "user-1", contactName: "A", lastMessageAt: start.toISOString() },
      { id: "b", status: "open", assignedUserId: "user-2", contactName: "B", lastMessageAt: start.toISOString() },
      { id: "c", status: "open", assignedUserId: null, contactName: "C", lastMessageAt: new Date(start.getTime() - 25 * 3_600_000).toISOString() },
      { id: "closed", status: "closed", assignedUserId: "user-1", contactName: "Closed", lastMessageAt: start.toISOString() },
    ],
    messages: [
      { conversationId: "a", direction: "in", createdAt: start.toISOString(), status: "received", sentByUserId: null },
      { conversationId: "a", direction: "out", createdAt: new Date(start.getTime() + 5 * 60_000).toISOString(), status: "failed", sentByUserId: "user-9" },
      { conversationId: "a", direction: "out", createdAt: new Date(start.getTime() + 10 * 60_000).toISOString(), status: "held", sentByUserId: "user-1" },
      { conversationId: "b", direction: "out", createdAt: new Date(start.getTime() - 60_000).toISOString(), status: "sent", sentByUserId: "user-2" },
      { conversationId: "b", direction: "in", createdAt: start.toISOString(), status: "received", sentByUserId: null },
      { conversationId: "b", direction: "out", createdAt: new Date(start.getTime() + 30 * 60_000).toISOString(), status: "queued", sentByUserId: "user-2" },
      { conversationId: "c", direction: "in", createdAt: new Date(start.getTime() - 25 * 3_600_000).toISOString(), status: "received", sentByUserId: null },
      { conversationId: "c", direction: "out", createdAt: new Date(start.getTime() - 24 * 3_600_000).toISOString(), status: "cancelled", sentByUserId: "user-1" },
      { conversationId: "closed", direction: "out", createdAt: start.toISOString(), status: "sent", sentByUserId: "user-1" },
    ],
    members: [
      { userId: "user-1", role: "client_admin" },
      { userId: "user-2", role: "client_user" },
    ],
    userId: "user-1",
  });
  assert.equal(stats.medianFirstResponseMs, 20 * 60_000);
  assert.equal(stats.repliedCount, 2);
  assert.equal(stats.awaitingFirstReply, 1);
  assert.deepEqual(stats.slaBreaches.map((item) => item.contactName), ["C"]);
  assert.equal(stats.openCount, 3);
  assert.deepEqual(stats.agents.map((agent) => ({ label: agent.label, assigned: agent.assigned, replies: agent.replies })), [
    { label: "client_user · user-2", assigned: 1, replies: 2 },
    { label: "You · client_admin", assigned: 1, replies: 1 },
    { label: "Unassigned", assigned: 1, replies: 0 },
  ]);

  const young = buildInboxTeamStats({
    now: new Date(start.getTime() + 23 * 3_600_000),
    conversations: [{ id: "c", status: "open", assignedUserId: null, contactName: "New", lastMessageAt: start.toISOString() }],
    messages: [{ conversationId: "c", direction: "in", createdAt: start.toISOString(), status: "received", sentByUserId: null }],
    members: [],
    userId: null,
  });
  assert.equal(young.slaBreaches.length, 0);
  const due = buildInboxTeamStats({
    now: new Date(start.getTime() + 24 * 3_600_000),
    conversations: [{ id: "c", status: "open", assignedUserId: null, contactName: "New", lastMessageAt: start.toISOString() }],
    messages: [{ conversationId: "c", direction: "in", createdAt: start.toISOString(), status: "received", sentByUserId: null }],
    members: [],
    userId: null,
  });
  assert.equal(due.slaBreaches.length, 1);
});

test("the stats message query runs only when the team stats flag is on", () => {
  const load = readFileSync(new URL("./load.ts", import.meta.url), "utf8");
  const view = readFileSync(new URL("../../components/inbox/inbox-view.tsx", import.meta.url), "utf8");
  const gate = load.indexOf("if (inboxTeamStatsEnabled())");
  const call = load.indexOf("loadInboxTeamStats(");
  assert.ok(gate > 0);
  assert.ok(call > gate);
  assert.equal(load.slice(0, gate).includes("loadInboxTeamStats"), false);
  const fn = load.slice(load.indexOf("async function loadInboxTeamStats"));
  assert.match(fn, /\.from\("messages"\)/);
  assert.match(fn, /sent_by_user_id/);
  assert.match(view, /\{data\.teamStats \? <InboxTeamStatsPanel/);
  const files = ["src/lib/inbox/team-stats.ts", "src/lib/inbox/load.ts", "src/components/inbox/inbox-team-stats.tsx", "src/components/inbox/inbox-view.tsx"];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|api\.whatsapp/i.test(text), false, file);
  }
});

function replyFieldsBlocked(html: string) {
  const body = html.match(/data-testid="inbox-reply-body"[^>]*/)?.[0] ?? "";
  const button = html.match(/data-testid="inbox-queue-reply"[^>]*/)?.[0] ?? "";
  return /\sdisabled(?:=|"|\s|$)/.test(body) && /\sdisabled(?:=|"|\s|$)/.test(button);
}

function threadByName(data: InboxData, name: string) {
  const listed = data.conversations.find((item) => item.contactName === name);
  assert.ok(listed, name);
  return previewInbox({
    id: listed.id,
    waWindow: data.waWindowEnabled,
    teamStats: Boolean(data.teamStats),
    quickUx: data.quickUx,
    multiNumber: data.multiNumber,
    number: data.number,
    filter: data.filter,
    channel: data.channel,
  });
}

function careMarkup(data: InboxData, template: { approved: boolean; waCategory: string } | null = null) {
  const thread = data.thread;
  assert.ok(thread);
  const state = waCareState({
    enabled: data.waWindowEnabled,
    threadChannel: thread.channel,
    replyChannel: thread.channel,
    messages: thread.messages,
    now: new Date(data.loadedAt),
    template,
  });
  const fields = renderToStaticMarkup(createElement(InboxWaReplyFields, { blocked: state.blocked, body: "" }));
  const panel = state.visible && state.care
    ? renderToStaticMarkup(createElement(InboxWaWindow, {
        care: state.care,
        category: state.category,
        blocked: state.blocked,
        prompt: state.prompt,
      }))
    : "";
  return { state, html: `${panel}${fields}` };
}

test("the WhatsApp care window stays off unless the flag is the string true", () => {
  assert.equal(inboxWaWindowEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(inboxWaWindowEnabled({ INBOX_WA_WINDOW_ENABLED: "" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxWaWindowEnabled({ INBOX_WA_WINDOW_ENABLED: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxWaWindowEnabled({ INBOX_WA_WINDOW_ENABLED: "yes" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxWaWindowEnabled({ INBOX_WA_WINDOW_ENABLED: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxWaWindowEnabled({ INBOX_WA_WINDOW_ENABLED: " true " } as NodeJS.ProcessEnv), true);
  const off = previewInbox({ waWindow: false, id: "00000000-0000-4000-8000-000000000003" });
  assert.equal(off.waWindowEnabled, false);
  assert.equal(off.sendingEnabled, false);
  assert.equal(off.thread?.contact?.name, "Amina Patel");
  const view = careMarkup(off);
  assert.equal(view.state.visible, false);
  assert.equal(view.state.blocked, false);
  assert.equal(view.html.includes("inbox-wa-window"), false);
  assert.equal(view.html.includes("inbox-wa-template-gate"), false);
  assert.equal(view.html.includes("Customer care window"), false);
  assert.equal(view.html.includes("Use an approved template"), false);
  assert.equal(replyFieldsBlocked(view.html), false);
  assert.match(view.html, /data-testid="inbox-queue-reply"/);
  const today = previewInbox({});
  assert.equal(today.waWindowEnabled, false);
  assert.equal(today.teamStats, null);
  assert.equal(today.multiNumber, false);
  assert.equal(today.quickUx, false);
  assert.deepEqual(today.quickReplies, []);
  assert.deepEqual(today.presence, []);
});

test("an open preview WhatsApp thread shows the 24-hour countdown and keeps free-form queued", () => {
  const listed = previewInbox({ waWindow: true, teamStats: true, multiNumber: true });
  assert.equal(listed.sendingEnabled, false);
  assert.equal(listed.multiNumber, true);
  assert.ok(listed.teamStats);
  assert.deepEqual(listed.conversations.map((item) => item.contactName), [
    "Lerato Mokoena",
    "Thabo Ndlovu",
    "Amina Patel",
    "Sipho Dlamini",
  ]);
  const open = threadByName(listed, "Lerato Mokoena");
  assert.equal(open.waWindowEnabled, true);
  assert.equal(open.sendingEnabled, false);
  assert.equal(open.teamStats?.repliedCount, 1);
  const view = careMarkup(open);
  assert.equal(view.state.care?.open, true);
  assert.equal(view.state.care?.countdown, "24h 0m");
  assert.equal(view.state.blocked, false);
  assert.match(view.html, /data-testid="inbox-wa-window"/);
  assert.match(view.html, /data-window="open"/);
  assert.match(view.html, /data-freeform="open"/);
  assert.match(view.html, /Customer care window open\. Closes in 24h 0m/);
  assert.match(view.html, /Nothing is sent/);
  assert.match(view.html, /Message category: service \(placeholder\)\. Cost metering is not live yet\./);
  assert.equal(view.html.includes("inbox-wa-template-gate"), false);
  assert.equal(replyFieldsBlocked(view.html), false);
  assert.equal(/R\d/.test(view.html), false);
  assert.equal(/graph\.facebook|api\.whatsapp/i.test(view.html), false);
});

test("a closed preview WhatsApp thread blocks free-form until an approved template is chosen", () => {
  const listed = previewInbox({ waWindow: true });
  const closed = threadByName(listed, "Amina Patel");
  assert.equal(closed.sendingEnabled, false);
  const view = careMarkup(closed);
  assert.equal(view.state.care?.open, false);
  assert.equal(view.state.care?.inboundAt != null, true);
  assert.equal(view.state.blocked, true);
  assert.match(view.state.prompt, /use an approved template/i);
  assert.match(view.html, /data-window="closed"/);
  assert.match(view.html, /data-freeform="blocked"/);
  assert.match(view.html, /data-testid="inbox-wa-template-gate"/);
  assert.match(view.html, /24-hour window closed\. Use an approved template\./);
  assert.match(view.html, /Cost metering is not live yet/);
  assert.equal(replyFieldsBlocked(view.html), true);
  assert.equal(/R\d/.test(view.html), false);

  const approved = careMarkup(closed, { approved: true, waCategory: "utility" });
  assert.equal(approved.state.care?.open, false);
  assert.equal(approved.state.blocked, false);
  assert.equal(approved.state.prompt, "");
  assert.match(approved.html, /Message category: utility \(placeholder\)/);
  assert.equal(approved.html.includes("inbox-wa-template-gate"), false);
  assert.equal(replyFieldsBlocked(approved.html), false);

  const draft = careMarkup(closed, { approved: false, waCategory: "marketing" });
  assert.equal(draft.state.blocked, true);
  assert.match(draft.state.prompt, /not approved/i);
  assert.match(draft.html, /data-testid="inbox-wa-template-gate"/);
});

test("the care window follows the latest inbound WhatsApp message and stays closed with none", () => {
  const now = new Date("2026-10-15T10:00:00.000Z");
  const inbound = (createdAt: string, channel = "whatsapp"): WaWindowMessage => ({
    direction: "in",
    channel,
    createdAt,
    waCategory: "service",
  });
  const none = customerCareWindow([
    { direction: "out", channel: "whatsapp", createdAt: now.toISOString(), waCategory: "service" },
    inbound(new Date(now.getTime() - 60 * 60 * 1000).toISOString(), "sms"),
  ], now);
  assert.equal(none.open, false);
  assert.equal(none.inboundAt, null);
  assert.equal(none.expiresAt, null);
  const empty = waCareState({
    enabled: true,
    threadChannel: "whatsapp",
    replyChannel: "whatsapp",
    messages: [],
    now,
    template: null,
  });
  assert.equal(empty.visible, true);
  assert.equal(empty.blocked, true);
  assert.equal(empty.care?.inboundAt, null);
  const emptyHtml = renderToStaticMarkup(createElement(InboxWaWindow, {
    care: empty.care!,
    category: empty.category,
    blocked: empty.blocked,
    prompt: empty.prompt,
  }));
  assert.match(emptyHtml, /No inbound WhatsApp message yet/);
  assert.match(emptyHtml, /Use an approved template/);
  assert.match(emptyHtml, /data-freeform="blocked"/);

  const openedAt = new Date(now.getTime() - 23 * 60 * 60 * 1000);
  const staleAt = new Date(now.getTime() - 30 * 60 * 60 * 1000);
  const open = customerCareWindow([
    inbound(staleAt.toISOString()),
    { direction: "out", channel: "whatsapp", createdAt: now.toISOString() },
    inbound(openedAt.toISOString()),
  ], now);
  assert.equal(open.open, true);
  assert.equal(open.inboundAt, openedAt.toISOString());
  assert.equal(open.countdown, "1h 0m");

  const boundary = customerCareWindow([
    inbound(new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
  ], now);
  assert.equal(boundary.open, false);
  assert.equal(boundary.countdown, null);

  const sms = waCareState({
    enabled: true,
    threadChannel: "sms",
    replyChannel: "sms",
    messages: [inbound(now.toISOString(), "sms")],
    now,
    template: null,
  });
  assert.equal(sms.visible, false);
  assert.equal(sms.blocked, false);
});

test("the care window UI is wired to the flag and does not send or call Meta", () => {
  const view = readFileSync(new URL("../../components/inbox/inbox-view.tsx", import.meta.url), "utf8");
  const load = readFileSync(new URL("./load.ts", import.meta.url), "utf8");
  assert.match(view, /waCareState\(\{/);
  assert.match(view, /enabled: data\.waWindowEnabled/);
  assert.match(view, /care\?\.visible && care\.care \? \(/);
  assert.match(view, /<InboxWaReplyFields blocked=\{blocked\}/);
  assert.equal(view.includes("WhatsApp window closes in"), false);
  assert.match(load, /inboxWaWindowEnabled\(\)/);
  assert.equal(load.includes("wa_window_messages"), false);
  const files = [
    "src/lib/inbox/wa-window.ts",
    "src/components/inbox/inbox-wa-window.tsx",
    "src/components/inbox/inbox-view.tsx",
    "src/lib/inbox/preview.ts",
    "src/lib/inbox/load.ts",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|api\.whatsapp/i.test(text), false, file);
  }
  const rules = readFileSync(new URL("./wa-window.ts", import.meta.url), "utf8");
  assert.equal(rules.includes(".from("), false);
  assert.match(rules, /direction !== "in"/);
  assert.match(rules, /channel !== "whatsapp"/);
});

test("quick inbox UX stays off unless the flag is the string true", () => {
  assert.equal(inboxQuickUxEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(inboxQuickUxEnabled({ INBOX_QUICK_UX_ENABLED: "" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxQuickUxEnabled({ INBOX_QUICK_UX_ENABLED: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxQuickUxEnabled({ INBOX_QUICK_UX_ENABLED: "yes" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxQuickUxEnabled({ INBOX_QUICK_UX_ENABLED: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxQuickUxEnabled({ INBOX_QUICK_UX_ENABLED: " true " } as NodeJS.ProcessEnv), true);
  const off = previewInbox({ quickUx: false, waWindow: true, teamStats: true, multiNumber: true });
  assert.equal(off.quickUx, false);
  assert.equal(off.sendingEnabled, false);
  assert.equal(off.waWindowEnabled, true);
  assert.ok(off.teamStats);
  assert.equal(off.multiNumber, true);
  assert.deepEqual(off.quickReplies, []);
  assert.deepEqual(off.presence, []);
  assert.equal(JSON.stringify(off).includes("Naledi Khumalo"), false);
  assert.equal(JSON.stringify(off).includes("inbox_quick_replies"), false);
  const frame = renderToStaticMarkup(createElement(InboxQuickFrame, { enabled: false }, "thread"));
  const replies = renderToStaticMarkup(createElement(InboxQuickReplies, {
    replies: [],
    onInsert: () => undefined,
  }));
  const banner = renderToStaticMarkup(createElement(InboxCollisionBanner, { label: "" }));
  assert.equal(frame.includes("inbox-quick-layout"), false);
  assert.equal(frame.includes("data-stack"), false);
  assert.equal(frame.includes("max-lg:grid-cols-1"), false);
  assert.match(frame, /lg:grid-cols-\[280px_minmax\(0,1fr\)_280px\]/);
  assert.equal(replies, "");
  assert.equal(banner, "");
  assert.equal(inboxQuickClasses(false).shell, "grid gap-4");
  assert.equal(inboxQuickClasses(false).columns, "grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]");
  assert.equal(inboxQuickClasses(false).filters, "flex flex-wrap gap-2");
  assert.equal(inboxQuickClasses(false).chip, "inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold");
  const view = readFileSync(new URL("../../components/inbox/inbox-view.tsx", import.meta.url), "utf8");
  assert.match(view, /data\.quickUx \? \(/);
  assert.match(view, /<InboxQuickFrame enabled=\{data\.quickUx\}>/);
  assert.equal(view.includes("requestSubmit"), false);
  assert.equal(view.includes("sendInboxReply()"), false);
});

test("quick replies fill the composer and do not send", () => {
  const hours = "We are open Monday to Friday, 8am to 5pm. This reply is queued only and is not sent.";
  assert.equal(insertQuickReply("", hours), hours);
  assert.equal(insertQuickReply("   ", hours), hours);
  assert.equal(insertQuickReply("Thanks Lerato.", hours), `Thanks Lerato.\n${hours}`);
  assert.equal(insertQuickReply(hours, hours), hours);
  assert.equal(insertQuickReply(`Thanks\n${hours}`, hours), `Thanks\n${hours}`);
  assert.equal(insertQuickReply("Keep this", "  "), "Keep this");
  const custom = parseQuickReplies({
    inbox_quick_replies: [
      { id: "bad id", label: "Skip", body: "no" },
      { label: "Parts", body: "The part is in. This note is queued only." },
      { id: "eta", label: "ETA", body: "We will confirm a time. Nothing is sent yet." },
    ],
  });
  assert.deepEqual(custom.map((item) => item.label), ["Parts", "ETA"]);
  assert.equal(custom[0]?.id, "reply-1");
  assert.equal(quickRepliesForWorkspace({ inbox_quick_replies: [] }).some((item) => item.id === "hours"), true);
  assert.equal(quickRepliesForWorkspace({ inbox_quick_replies: custom }).length, 2);
  const on = previewInbox({ quickUx: true });
  assert.equal(on.sendingEnabled, false);
  assert.equal(on.quickReplies.some((item) => item.label === "Hours" && item.body === hours), true);
  let inserted = "";
  const html = renderToStaticMarkup(createElement(InboxQuickReplies, {
    replies: on.quickReplies,
    onInsert: (body) => {
      inserted = insertQuickReply(inserted, body);
    },
  }));
  assert.match(html, /data-testid="inbox-quick-replies"/);
  assert.match(html, /data-reply="hours"/);
  assert.match(html, /data-reply="callback"/);
  assert.match(html, /data-reply="booked"/);
  assert.match(html, /type="button"/);
  assert.equal(html.includes("type=\"submit\""), false);
  assert.match(html, /Nothing is sent/);
  assert.equal(/graph\.facebook|api\.whatsapp/i.test(html), false);
  const hoursReply = on.quickReplies.find((item) => item.id === "hours");
  assert.ok(hoursReply);
  inserted = insertQuickReply("", hoursReply.body);
  assert.equal(inserted, hours);
  assert.equal(inserted.includes("sent from WhatsApp"), false);
  const component = readFileSync(new URL("../../components/inbox/inbox-quick-ux.tsx", import.meta.url), "utf8");
  assert.match(component, /type="button"/);
  assert.match(component, /onInsert\(reply\.body\)/);
  assert.equal(component.includes("sendInboxReply"), false);
  const view = readFileSync(new URL("../../components/inbox/inbox-view.tsx", import.meta.url), "utf8");
  assert.match(view, /insertQuickReply\(current, reply\)/);
  assert.match(view, /action=\{sendInboxReply\}/);
});

test("a preview collision banner names who is viewing or typing", () => {
  const listed = previewInbox({ quickUx: true, waWindow: true, teamStats: true, multiNumber: true });
  assert.equal(listed.sendingEnabled, false);
  assert.equal(listed.waWindowEnabled, true);
  assert.ok(listed.teamStats);
  assert.equal(listed.multiNumber, true);
  const typingThread = threadByName(listed, "Lerato Mokoena");
  const typing = collisionBanner(typingThread.presence, typingThread.userId, typingThread.thread?.id ?? "");
  assert.equal(typing, "Naledi Khumalo is typing");
  const typingHtml = renderToStaticMarkup(createElement(InboxCollisionBanner, { label: typing }));
  assert.match(typingHtml, /data-testid="inbox-collision"/);
  assert.match(typingHtml, /Naledi Khumalo is typing/);
  const viewingThread = threadByName(listed, "Amina Patel");
  const viewing = collisionBanner(viewingThread.presence, viewingThread.userId, viewingThread.thread?.id ?? "");
  assert.equal(viewing, "Sam Okonkwo is viewing");
  const viewingHtml = renderToStaticMarkup(createElement(InboxCollisionBanner, { label: viewing }));
  assert.match(viewingHtml, /Sam Okonkwo is viewing/);
  const quiet = threadByName(listed, "Thabo Ndlovu");
  assert.equal(collisionBanner(quiet.presence, quiet.userId, quiet.thread?.id ?? ""), "");
  assert.equal(collisionBanner(listed.presence, listed.userId, "missing"), "");
  assert.equal(collisionBanner(listed.presence, "00000000-0000-4000-8000-0000000000cc", listed.thread?.id ?? ""), "");
  const self = "user-1";
  const live = peersFromPresence({
    [self]: [{ userId: self, name: "Spoofed", state: "typing", conversationId: "conv-1" }],
    outsider: [{ userId: "stranger", name: "Stranger", state: "viewing", conversationId: "conv-1" }],
    other: [{ userId: "user-2", name: "Fake name", state: "viewing", conversationId: "conv-2" }],
    teammate: [
      { userId: "user-2", name: "Fake name", state: "viewing", conversationId: "conv-1" },
      { userId: "user-2", name: "Fake name", state: "typing", conversationId: "conv-1" },
    ],
  }, self, "conv-1", [
    { userId: self, role: "client_admin" },
    { userId: "user-2", role: "client_user" },
  ]);
  assert.deepEqual(live, [{ userId: "user-2", name: "Client User", state: "typing", conversationId: "conv-1" }]);
  assert.equal(collisionBanner(live, self, "conv-1"), "Client User is typing");
  const payload = presencePayload({ userId: self, name: "Client Admin", conversationId: "conv-1", typing: true });
  assert.deepEqual(payload, { userId: self, name: "Client Admin", conversationId: "conv-1", state: "typing" });
  assert.equal(payload && "body" in payload, false);
  assert.equal(presencePayload({ userId: null, name: "Client Admin", conversationId: "conv-1", typing: false }), null);
  const sameStats = previewInbox({ teamStats: true, quickUx: false, multiNumber: false });
  assert.deepEqual(sameStats.teamStats, previewInbox({ teamStats: true, quickUx: true, multiNumber: false }).teamStats);
});

test("the narrow inbox layout stacks under the flag and keeps the desktop columns", () => {
  const off = inboxQuickClasses(false);
  const on = inboxQuickClasses(true);
  assert.equal(off.columns.includes("max-lg:grid-cols-1"), false);
  assert.match(on.columns, /max-lg:grid-cols-1/);
  assert.match(on.columns, /lg:grid-cols-\[280px_minmax\(0,1fr\)_280px\]/);
  assert.match(on.shell, /max-lg:overflow-x-hidden/);
  assert.match(on.filters, /max-lg:overflow-x-auto/);
  assert.match(on.filters, /max-lg:flex-nowrap/);
  assert.match(on.filters, /flex-wrap/);
  assert.match(on.chip, /max-lg:h-11/);
  assert.match(on.chip, /max-lg:min-h-11/);
  assert.match(on.field, /min-w-0/);
  assert.match(on.field, /max-lg:w-full/);
  assert.match(on.field, /lg:min-w-40/);
  assert.match(on.bubble, /break-words/);
  assert.match(on.bubble, /max-lg:max-w-full/);
  const narrow = renderToStaticMarkup(createElement(InboxQuickFrame, { enabled: true }, "List and thread"));
  assert.match(narrow, /data-testid="inbox-quick-layout"/);
  assert.match(narrow, /data-stack="narrow"/);
  assert.match(narrow, /data-desktop="three-column"/);
  assert.match(narrow, /max-lg:grid-cols-1/);
  assert.match(narrow, /lg:grid-cols-\[280px_minmax\(0,1fr\)_280px\]/);
  assert.match(narrow, /List and thread/);
  const wide = renderToStaticMarkup(createElement(InboxQuickFrame, { enabled: false }, "List and thread"));
  assert.equal(wide.includes("inbox-quick-layout"), false);
  assert.equal(wide.includes("max-lg:"), false);
  const view = readFileSync(new URL("../../components/inbox/inbox-view.tsx", import.meta.url), "utf8");
  const quick = readFileSync(new URL("./quick-ux.ts", import.meta.url), "utf8");
  const load = readFileSync(new URL("./load.ts", import.meta.url), "utf8");
  assert.match(view, /inboxQuickClasses\(data\.quickUx\)/);
  assert.match(view, /className=\{layout\.filters\}/);
  assert.match(view, /className=\{layout\.shell\}/);
  const gate = load.indexOf("if (inboxQuickUxEnabled())");
  const call = load.indexOf("loadQuickReplies(");
  assert.ok(gate > 0);
  assert.ok(call > gate);
  assert.equal(load.slice(0, gate).includes("loadQuickReplies"), false);
  const fn = load.slice(load.indexOf("async function loadQuickReplies"));
  assert.match(fn, /\.from\("organizations"\)/);
  assert.match(fn, /settings/);
  assert.equal(fn.includes(".insert("), false);
  assert.equal(fn.includes(".update("), false);
  assert.match(view, /channel\(`inbox-\$\{data\.orgId\}`\)/);
  assert.match(view, /presence", \{ event: "sync" \}/);
  assert.match(view, /channelName\.track\(payload\)/);
  assert.equal(quick.includes(".from("), false);
  const files = [
    "src/lib/inbox/quick-ux.ts",
    "src/components/inbox/inbox-quick-ux.tsx",
    "src/components/inbox/inbox-view.tsx",
    "src/lib/inbox/preview.ts",
    "src/lib/inbox/load.ts",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|api\.whatsapp/i.test(text), false, file);
  }
});

test("a branded eastc host keeps the preview inbox inside EASTC", () => {
  const open = previewInbox({});
  assert.equal(open.conversations.some((item) => item.contactName === "Thabo Ndlovu"), true);
  const eastc = previewInbox({ brandSlug: "eastc" });
  assert.deepEqual(eastc.conversations.map((item) => item.contactName), ["Lerato Mokoena"]);
  assert.equal(JSON.stringify(eastc).includes("Ndlovu"), false);
  const zentrix = previewInbox({ brandSlug: "zentrix" });
  assert.deepEqual(zentrix.conversations, []);
});
