import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InboxBulkChrome } from "@/components/inbox/inbox-bulk";
import { InboxContactPanel } from "@/components/inbox/inbox-contact-panel";
import {
  bulkAssignNotice,
  bulkIdsInWorkspace,
  bulkReadNotice,
  bulkScopeKey,
  bulkStatusFor,
  bulkStatusLabel,
  bulkStatusNotice,
  inboxBulkActionsEnabled,
  membershipAssignedOnly,
  parseBulkConversationIds,
  planBulkAssign,
  selectableConversationIds,
  selectionForScope,
  toggleBulkId,
  BULK_CONVERSATION_LIMIT,
} from "@/lib/inbox/bulk";
import { InboxCollisionBanner, InboxQuickFrame, InboxQuickReplies } from "@/components/inbox/inbox-quick-ux";
import { InboxTeamStatsPanel } from "@/components/inbox/inbox-team-stats";
import { InboxWaMessageMeter, InboxWaMetering } from "@/components/inbox/inbox-wa-metering";
import { InboxWaReplyFields, InboxWaWindow } from "@/components/inbox/inbox-wa-window";
import {
  buildContactPanel,
  consentStatusLabel,
  inboxContactPanelEnabled,
  parseContactTags,
  planStageUpdate,
  sameTags,
} from "@/lib/inbox/contact-panel";
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
import {
  buildServiceMeters,
  countServiceSendsByConnection,
  freeServiceStartNote,
  inboxWaMeteringEnabled,
  meteringTimezone,
  monthKeyInZone,
  monthWindow,
  outboundWaMessageMeter,
  zonedMonthStart,
} from "@/lib/inbox/wa-metering";
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
    waMetering: data.waMeteringEnabled,
    teamStats: Boolean(data.teamStats),
    quickUx: data.quickUx,
    bulkActions: data.bulkActions,
    contactPanel: data.contactPanel,
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

test("WhatsApp metering stays off unless the flag is the string true", () => {
  assert.equal(inboxWaMeteringEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(inboxWaMeteringEnabled({ INBOX_WA_METERING_ENABLED: "" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxWaMeteringEnabled({ INBOX_WA_METERING_ENABLED: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxWaMeteringEnabled({ INBOX_WA_METERING_ENABLED: "yes" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxWaMeteringEnabled({ INBOX_WA_METERING_ENABLED: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxWaMeteringEnabled({ INBOX_WA_METERING_ENABLED: " true " } as NodeJS.ProcessEnv), true);
  const off = previewInbox({ waMetering: false, waWindow: true, id: "00000000-0000-4000-8000-000000000001" });
  assert.equal(off.waMeteringEnabled, false);
  assert.equal(off.sendingEnabled, false);
  assert.equal(off.waTimezone, "");
  assert.deepEqual(off.waMeters, []);
  assert.equal(off.serviceUsed, 12);
  assert.equal(off.waWindowEnabled, true);
  const hidden = renderToStaticMarkup(createElement(InboxWaMetering, {
    enabled: false,
    meters: [],
    currentConnectionId: off.thread?.connectionId ?? null,
  }));
  assert.equal(hidden, "");
  assert.equal(hidden.includes("inbox-wa-metering"), false);
  assert.equal(hidden.includes("12 / 1000"), false);
  assert.equal(hidden.includes("inbox-wa-message-meter"), false);
  const inbound = renderToStaticMarkup(createElement(InboxWaMessageMeter, {
    now: off.loadedAt,
    message: { direction: "in", channel: "whatsapp", waCategory: "service", costCents: 0 },
  }));
  assert.equal(inbound, "");
  const today = previewInbox({});
  assert.equal(today.waMeteringEnabled, false);
  assert.deepEqual(today.waMeters, []);
});

test("WhatsApp metering shows category, stored or estimated cost, and used / 1000", () => {
  const now = new Date("2026-10-15T10:00:00.000Z");
  const service = outboundWaMessageMeter(
    { direction: "out", channel: "whatsapp", waCategory: "service", costCents: 0 },
    now,
  );
  assert.equal(service?.source, "stored");
  assert.equal(service?.label, "WhatsApp · service · free");
  const stored = outboundWaMessageMeter(
    { direction: "out", channel: "whatsapp", waCategory: "marketing", costCents: 66 },
    now,
  );
  assert.equal(stored?.source, "stored");
  assert.equal(stored?.cents, 66);
  assert.equal(stored?.label, "WhatsApp · marketing · R0.66");
  const estimated = outboundWaMessageMeter(
    { direction: "out", channel: "whatsapp", waCategory: "utility", costCents: 0 },
    now,
  );
  assert.equal(estimated?.source, "estimated");
  assert.equal(estimated?.label, "WhatsApp · utility · est. R0.13");
  const auth = outboundWaMessageMeter(
    { direction: "out", channel: "whatsapp", waCategory: "authentication", costCents: 0 },
    now,
  );
  assert.equal(auth?.category, "authentication");
  assert.equal(auth?.label, "WhatsApp · authentication · est. R0.13");
  assert.equal(outboundWaMessageMeter({ direction: "out", channel: "whatsapp", waCategory: "", costCents: 66 }, now), null);
  assert.equal(outboundWaMessageMeter({ direction: "out", channel: "sms", waCategory: "service", costCents: 18 }, now), null);
  assert.equal(outboundWaMessageMeter({ direction: "in", channel: "whatsapp", waCategory: "service", costCents: 0 }, now), null);
  assert.equal(outboundWaMessageMeter({ direction: "out", channel: "whatsapp", waCategory: "marketing", costCents: Number.NaN }, now), null);

  const listed = previewInbox({ waMetering: true, multiNumber: true, waWindow: true });
  assert.equal(listed.sendingEnabled, false);
  assert.equal(listed.waMeteringEnabled, true);
  assert.equal(listed.waTimezone, "Africa/Johannesburg");
  assert.equal(listed.waWindowEnabled, true);
  const open = threadByName(listed, "Lerato Mokoena");
  assert.equal(open.sendingEnabled, false);
  assert.deepEqual(open.waMeters.map((meter) => [meter.label, meter.used, meter.allowance]), [
    ["Admissions · 0101", 12, 1000],
    ["Front desk · 0199", 0, 1000],
  ]);
  const panel = renderToStaticMarkup(createElement(InboxWaMetering, {
    enabled: true,
    meters: open.waMeters,
    currentConnectionId: open.thread?.connectionId ?? null,
  }));
  assert.match(panel, /data-testid="inbox-wa-metering"/);
  assert.match(panel, /Africa\/Johannesburg/);
  assert.match(panel, /Admissions · 0101 · 12 \/ 1000 free service messages · 2026-09/);
  assert.match(panel, /Front desk · 0199 · 0 \/ 1000 free service messages · 2026-09/);
  assert.match(panel, /data-current="true"/);
  assert.match(panel, /data-allowance="1000"/);
  assert.match(panel, /data-testid="inbox-wa-meter-note"/);
  assert.match(panel, /1 Oct 2026/);
  assert.match(panel, /Nothing is sent/);
  assert.equal(/graph\.facebook|api\.whatsapp/i.test(panel), false);
  const outbound = open.thread?.messages.find((message) => message.direction === "out");
  assert.ok(outbound);
  const chip = renderToStaticMarkup(createElement(InboxWaMessageMeter, { message: outbound, now: open.loadedAt }));
  assert.match(chip, /data-testid="inbox-wa-message-meter"/);
  assert.match(chip, /data-category="service"/);
  assert.match(chip, /data-source="stored"/);
  assert.match(chip, /WhatsApp · service · free/);
  const marketing = renderToStaticMarkup(createElement(InboxWaMessageMeter, {
    now: now.toISOString(),
    message: { direction: "out", channel: "whatsapp", waCategory: "marketing", costCents: 66 },
  }));
  assert.match(marketing, /data-source="stored"/);
  assert.match(marketing, /WhatsApp · marketing · R0\.66/);
  const utility = renderToStaticMarkup(createElement(InboxWaMessageMeter, {
    now: now.toISOString(),
    message: { direction: "out", channel: "whatsapp", waCategory: "utility", costCents: 0 },
  }));
  assert.match(utility, /data-source="estimated"/);
  assert.match(utility, /WhatsApp · utility · est\. R0\.13/);
  const blank = renderToStaticMarkup(createElement(InboxWaMessageMeter, {
    now: now.toISOString(),
    message: { direction: "out", channel: "whatsapp", waCategory: "", costCents: 0 },
  }));
  assert.equal(blank, "");
  const october = buildServiceMeters({
    numbers: [{ id: "line", label: "Workshop" }],
    counts: { line: 4 },
    timezone: "Africa/Johannesburg",
    now,
  });
  const octoberHtml = renderToStaticMarkup(createElement(InboxWaMetering, {
    enabled: true,
    meters: october,
    currentConnectionId: "line",
  }));
  assert.match(octoberHtml, /Workshop · 4 \/ 1000/);
  assert.equal(octoberHtml.includes("inbox-wa-meter-note"), false);
  assert.equal(freeServiceStartNote("2026-10"), "");
  const missing = buildServiceMeters({
    numbers: [{ id: "line", label: "Workshop" }],
    counts: null,
    timezone: "Africa/Johannesburg",
    now,
  });
  const missingHtml = renderToStaticMarkup(createElement(InboxWaMetering, {
    enabled: true,
    meters: missing,
    currentConnectionId: null,
  }));
  assert.match(missingHtml, /counter unavailable this month/);
  assert.equal(missingHtml.includes("0 / 1000"), false);
  const care = waCareState({
    enabled: true,
    threadChannel: "whatsapp",
    replyChannel: "whatsapp",
    messages: open.thread?.messages ?? [],
    now: new Date(open.loadedAt),
    template: null,
  });
  assert.equal(care.blocked, false);
  const closed = threadByName(listed, "Amina Patel");
  const closedCare = waCareState({
    enabled: true,
    threadChannel: "whatsapp",
    replyChannel: "whatsapp",
    messages: closed.thread?.messages ?? [],
    now: new Date(closed.loadedAt),
    template: null,
  });
  assert.equal(closedCare.blocked, true);
  assert.equal(closed.sendingEnabled, false);
});

test("the free service counter follows the calendar month in the org timezone", () => {
  assert.equal(meteringTimezone(""), "Africa/Johannesburg");
  assert.equal(meteringTimezone("Not/AZone"), "Africa/Johannesburg");
  assert.equal(meteringTimezone(" Pacific/Auckland "), "Pacific/Auckland");
  assert.equal(zonedMonthStart(2026, 11, "Africa/Johannesburg").toISOString(), "2026-10-31T22:00:00.000Z");
  assert.equal(monthKeyInZone(new Date("2026-10-31T22:00:00.000Z"), "Africa/Johannesburg"), "2026-11");
  assert.equal(monthKeyInZone(new Date("2026-10-31T21:59:00.000Z"), "Africa/Johannesburg"), "2026-10");
  const window = monthWindow(new Date("2026-11-15T12:00:00.000Z"), "Africa/Johannesburg");
  assert.equal(window.start, "2026-10-31T22:00:00.000Z");
  assert.equal(window.end, "2026-11-30T22:00:00.000Z");
  const row = {
    direction: "out",
    channel: "whatsapp",
    waCategory: "service",
    status: "sent",
    createdAt: "2026-10-31T22:00:00.000Z",
    connectionId: "n1",
  };
  const november = new Date("2026-11-15T12:00:00.000Z");
  const october = new Date("2026-10-15T12:00:00.000Z");
  assert.equal(countServiceSendsByConnection([row], { now: november, timezone: "Africa/Johannesburg" }).n1, 1);
  assert.equal(countServiceSendsByConnection([row], { now: october, timezone: "Africa/Johannesburg" }).n1, undefined);
  assert.equal(countServiceSendsByConnection([row], { now: october, timezone: "Atlantic/Reykjavik" }).n1, 1);
  assert.equal(countServiceSendsByConnection([row], { now: november, timezone: "Atlantic/Reykjavik" }).n1, undefined);
  const ignored = countServiceSendsByConnection([
    row,
    { ...row, direction: "in", createdAt: november.toISOString() },
    { ...row, waCategory: "marketing", createdAt: november.toISOString() },
    { ...row, status: "failed", createdAt: november.toISOString() },
    { ...row, channel: "sms", createdAt: november.toISOString() },
    { ...row, connectionId: null, createdAt: november.toISOString() },
    { ...row, connectionId: "n2", status: "held", createdAt: november.toISOString() },
    { ...row, connectionId: "n2", status: "queued", createdAt: november.toISOString() },
    { ...row, connectionId: "n2", status: "blocked_consent", createdAt: november.toISOString() },
  ], { now: november, timezone: "Africa/Johannesburg" });
  assert.equal(ignored.n1, 1);
  assert.equal(ignored.n2, 2);
});

test("metering UI is flag gated and does not send or call Meta", () => {
  const view = readFileSync(new URL("../../components/inbox/inbox-view.tsx", import.meta.url), "utf8");
  const load = readFileSync(new URL("./load.ts", import.meta.url), "utf8");
  assert.match(view, /enabled=\{data\.waMeteringEnabled\}/);
  assert.match(view, /data\.waMeteringEnabled \? <InboxWaMessageMeter/);
  assert.match(view, /message\.channel === "whatsapp" && !data\.waMeteringEnabled/);
  assert.match(view, /const blocked = Boolean\(care\?\.blocked\)/);
  assert.match(view, /meteringLive=\{data\.waMeteringEnabled\}/);
  assert.equal(view.includes("waMeteringEnabled &&"), false);
  const attach = load.indexOf("async function attachWaMeters");
  assert.ok(attach > 0);
  assert.match(load.slice(attach, attach + 400), /if \(!base\.waMeteringEnabled\) return/);
  const fn = load.slice(load.indexOf("async function loadWaServiceMeters"));
  assert.match(fn, /wa_service_sends_this_month/);
  assert.match(fn, /organizations/);
  assert.match(fn, /timezone/);
  assert.match(fn, /wa_category/);
  assert.equal(fn.includes(".insert("), false);
  assert.equal(fn.includes(".update("), false);
  assert.equal(fn.includes("sending_enabled"), false);
  const files = [
    "src/lib/inbox/wa-metering.ts",
    "src/components/inbox/inbox-wa-metering.tsx",
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

test("bulk actions stay off unless the flag is the string true", () => {
  assert.equal(inboxBulkActionsEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(inboxBulkActionsEnabled({ INBOX_BULK_ACTIONS_ENABLED: "" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxBulkActionsEnabled({ INBOX_BULK_ACTIONS_ENABLED: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxBulkActionsEnabled({ INBOX_BULK_ACTIONS_ENABLED: "yes" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxBulkActionsEnabled({ INBOX_BULK_ACTIONS_ENABLED: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxBulkActionsEnabled({ INBOX_BULK_ACTIONS_ENABLED: " true " } as NodeJS.ProcessEnv), true);
  const off = previewInbox({ bulkActions: false });
  const on = previewInbox({ bulkActions: true });
  assert.equal(off.bulkActions, false);
  assert.equal(on.bulkActions, true);
  assert.equal(off.sendingEnabled, false);
  assert.equal(on.sendingEnabled, false);
  assert.deepEqual(on.conversations, off.conversations);
  const props = {
    filter: on.filter,
    channel: on.channel,
    number: "",
    conversations: on.conversations,
    members: on.members,
    userId: on.userId,
    orgSlug: on.orgSlug,
    threadId: on.thread?.id ?? "",
    children: (item: { id: string; contactName: string }) => createElement("a", { href: `/thread/${item.id}` }, item.contactName),
  };
  const hidden = renderToStaticMarkup(createElement(InboxBulkChrome, { ...props, enabled: false }));
  assert.equal(hidden.includes("inbox-bulk"), false);
  assert.equal(hidden.includes("checkbox"), false);
  assert.equal(hidden.includes("Select "), false);
  const idle = renderToStaticMarkup(createElement(InboxBulkChrome, { ...props, enabled: true }));
  assert.equal(idle.match(/data-testid="inbox-bulk-select"/g)?.length, on.conversations.length);
  assert.equal(idle.includes("inbox-bulk-toolbar"), false);
  assert.equal(idle.includes("inbox-bulk-assign"), false);
  const ids = on.conversations.slice(0, 2).map((item) => item.id);
  const html = renderToStaticMarkup(createElement(InboxBulkChrome, { ...props, enabled: true, initialSelected: ids }));
  assert.match(html, /data-testid="inbox-bulk-toolbar"/);
  assert.match(html, /data-testid="inbox-bulk-assign"/);
  assert.match(html, /Assign selected/);
  assert.match(html, /data-testid="inbox-bulk-status"[^>]*data-status="closed"/);
  assert.match(html, />Close</);
  assert.match(html, /data-testid="inbox-bulk-read"/);
  assert.match(html, />Mark read</);
  assert.match(html, /Nothing is sent/);
  assert.equal(html.includes("Unassigned"), true);
  for (const id of ids) assert.match(html, new RegExp(`name="ids" value="${id}"`));
  const skipped = on.conversations[2]?.id ?? "";
  assert.equal(html.includes(`name="ids" value="${skipped}"`), false);
  assert.match(html, new RegExp(`Select ${on.conversations[0]?.contactName}`));
  const closedId = "00000000-0000-4000-8000-000000000099";
  const mixed = renderToStaticMarkup(createElement(InboxBulkChrome, {
    ...props,
    enabled: true,
    conversations: [
      on.conversations[0],
      { ...on.conversations[1], id: closedId, status: "closed", contactName: "Closed thread" },
    ],
    initialSelected: [on.conversations[0].id, closedId],
  }));
  assert.equal(mixed.includes("Select Closed thread"), false);
  assert.equal(mixed.includes(`name="ids" value="${closedId}"`), false);
  assert.match(mixed, />Close</);
});

test("bulk selection clears on filter changes and updates only workspace ids", () => {
  const open = bulkScopeKey({ filter: "open", channel: "", number: "" });
  const mine = bulkScopeKey({ filter: "mine", channel: "", number: "" });
  const channel = bulkScopeKey({ filter: "open", channel: "whatsapp", number: "" });
  const number = bulkScopeKey({ filter: "open", channel: "whatsapp", number: "preview-wa" });
  const selected = ["00000000-0000-4000-8000-000000000001"];
  assert.deepEqual(selectionForScope({ previousScope: open, nextScope: open, selected }), selected);
  assert.deepEqual(selectionForScope({ previousScope: open, nextScope: mine, selected }), []);
  assert.deepEqual(selectionForScope({ previousScope: open, nextScope: channel, selected }), []);
  assert.deepEqual(selectionForScope({ previousScope: channel, nextScope: number, selected }), []);
  const visible = [
    { id: "00000000-0000-4000-8000-000000000001", status: "open" },
    { id: "00000000-0000-4000-8000-000000000002", status: "pending" },
  ];
  const foreign = "00000000-0000-4000-8000-0000000000ee";
  const kept = bulkIdsInWorkspace([foreign, visible[1].id, visible[0].id, "not-an-id"], visible);
  assert.deepEqual(kept.ids, [visible[1].id, visible[0].id]);
  assert.deepEqual(kept.statuses, ["pending", "open"]);
  assert.deepEqual(selectableConversationIds([...visible, { id: foreign, status: "closed" }]), [visible[0].id, visible[1].id]);
  assert.equal(bulkStatusFor(["open", "pending"]), "closed");
  assert.equal(bulkStatusFor(["closed", "open"]), "closed");
  assert.equal(bulkStatusFor(["closed", "closed"]), "open");
  assert.equal(bulkStatusLabel("closed"), "Close");
  assert.equal(bulkStatusLabel("open"), "Reopen");
  const parsed = parseBulkConversationIds([`${visible[0].id}, ${visible[0].id}`, visible[1].id, "nope"]);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.ids, [visible[0].id, visible[1].id]);
  assert.equal(parseBulkConversationIds(["nope"]).ok, false);
  const many = Array.from({ length: BULK_CONVERSATION_LIMIT + 1 }, (_, index) => (
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
  ));
  assert.equal(parseBulkConversationIds(many).ok, false);
  const self = "00000000-0000-4000-8000-0000000000bb";
  const other = "00000000-0000-4000-8000-0000000000cc";
  assert.equal(membershipAssignedOnly([{ userId: self, role: "client_admin", assignedOnly: true }], self), false);
  assert.equal(membershipAssignedOnly([{ userId: self, role: "client_user", assignedOnly: true }], self), true);
  assert.deepEqual(planBulkAssign({ assignee: "", memberIds: [other], assignedOnly: false, userId: self }), { ok: true, assignee: null });
  assert.equal(planBulkAssign({ assignee: "", memberIds: [other], assignedOnly: true, userId: self }).ok, false);
  assert.deepEqual(planBulkAssign({ assignee: self, memberIds: [], assignedOnly: true, userId: self }), { ok: true, assignee: self });
  assert.equal(planBulkAssign({ assignee: other, memberIds: [other], assignedOnly: true, userId: self }).ok, false);
  assert.deepEqual(planBulkAssign({ assignee: other, memberIds: [other], assignedOnly: false, userId: self }), { ok: true, assignee: other });
  assert.equal(planBulkAssign({ assignee: foreign, memberIds: [other], assignedOnly: false, userId: self }).ok, false);
  assert.equal(bulkAssignNotice(2, other), "Assigned 2 conversations.");
  assert.equal(bulkAssignNotice(1, null), "Unassigned 1 conversation.");
  assert.equal(bulkAssignNotice(0, null), "No conversations in this workspace were updated.");
  assert.equal(bulkStatusNotice(2, "closed"), "Closed 2 conversations.");
  assert.equal(bulkStatusNotice(1, "open"), "Reopened 1 conversation.");
  assert.equal(bulkReadNotice(0), "Those conversations were already read.");
  assert.equal(bulkReadNotice(3), "Marked 3 conversations read.");
  assert.deepEqual(toggleBulkId([visible[0].id], visible[0].id, [visible[0].id, visible[1].id]), []);
  assert.deepEqual(toggleBulkId([], foreign, [visible[0].id]), []);
  const capped = toggleBulkId(many.slice(0, BULK_CONVERSATION_LIMIT), many[BULK_CONVERSATION_LIMIT], many);
  assert.equal(capped.length, BULK_CONVERSATION_LIMIT);
});

test("bulk inbox wiring reuses conversation updates and does not send", () => {
  const view = readFileSync(new URL("../../components/inbox/inbox-view.tsx", import.meta.url), "utf8");
  const load = readFileSync(new URL("./load.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../../app/actions/inbox.ts", import.meta.url), "utf8");
  assert.match(view, /data\.bulkActions \? \(/);
  assert.match(view, /assignAction=\{bulkAssignInbox\}/);
  assert.match(view, /statusAction=\{bulkSetInboxStatus\}/);
  assert.match(view, /readAction=\{bulkMarkInboxRead\}/);
  assert.match(view, /<InboxConversationCard key=\{item\.id\}/);
  assert.equal(view.includes("inbox-bulk-toolbar"), false);
  assert.match(load, /bulkActions: inboxBulkActionsEnabled\(\)/);
  const assign = actions.slice(actions.indexOf("export async function assignInboxConversation"), actions.indexOf("export async function setInboxStatus"));
  const status = actions.slice(actions.indexOf("export async function setInboxStatus"), actions.indexOf("export async function markInboxRead"));
  const read = actions.slice(actions.indexOf("export async function markInboxRead"), actions.indexOf("export async function bulkAssignInbox"));
  assert.match(assign, /conversationsUpdate\(/);
  assert.match(status, /conversationsUpdate\(/);
  assert.match(read, /conversationsUpdate\(/);
  const bulk = actions.slice(actions.indexOf("export async function bulkAssignInbox"), actions.indexOf("async function openChannelThread"));
  assert.match(bulk, /conversationsUpdate\(/);
  assert.match(bulk, /eq\("org_id", tenant\.active\.id\)/);
  const gate = bulk.indexOf("if (!inboxBulkActionsEnabled())");
  const client = bulk.indexOf("await createSupabaseServerClient()");
  assert.ok(gate >= 0 && client > gate);
  assert.equal(bulk.includes("crm_outbox"), false);
  assert.equal(bulk.includes("from(\"messages\")"), false);
  assert.equal(bulk.includes(".insert("), false);
  assert.equal(bulk.includes("sending_enabled"), false);
  const files = [
    "src/lib/inbox/bulk.ts",
    "src/components/inbox/inbox-bulk.tsx",
    "src/components/inbox/inbox-view.tsx",
    "src/app/actions/inbox.ts",
    "src/lib/inbox/preview.ts",
    "src/lib/inbox/load.ts",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|api\.whatsapp/i.test(text), false, file);
  }
});

test("the contact panel stays off unless the flag is the string true", () => {
  assert.equal(inboxContactPanelEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(inboxContactPanelEnabled({ INBOX_CONTACT_PANEL_ENABLED: "" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxContactPanelEnabled({ INBOX_CONTACT_PANEL_ENABLED: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxContactPanelEnabled({ INBOX_CONTACT_PANEL_ENABLED: "yes" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxContactPanelEnabled({ INBOX_CONTACT_PANEL_ENABLED: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxContactPanelEnabled({ INBOX_CONTACT_PANEL_ENABLED: " true " } as NodeJS.ProcessEnv), true);
  const off = previewInbox({ contactPanel: false });
  const on = previewInbox({ contactPanel: true });
  assert.equal(off.contactPanel, false);
  assert.equal(on.contactPanel, true);
  assert.equal(off.sendingEnabled, false);
  assert.equal(on.sendingEnabled, false);
  assert.equal(off.thread?.contact?.name, on.thread?.contact?.name);
  const noop = () => undefined;
  const hidden = renderToStaticMarkup(createElement(InboxContactPanel, {
    enabled: false,
    className: "aside",
    data: off,
    thread: off.thread,
    saveAction: noop,
    assignAction: noop,
  }));
  assert.equal(hidden.includes("inbox-contact-panel"), false);
  assert.equal(hidden.includes("Lerato"), false);
  assert.equal(hidden.includes("Save contact"), false);
  const lerato = on.thread?.contact;
  assert.ok(lerato);
  const model = buildContactPanel({ contact: lerato, consents: on.thread?.consents ?? [], channel: "whatsapp" });
  assert.equal(model.name, "Lerato Mokoena");
  assert.equal(model.address, "+27115550101");
  assert.equal(model.addressKind, "phone");
  assert.equal(model.stageLabel, "Enquiry");
  assert.deepEqual(model.tags, ["admissions"]);
  assert.equal(model.tagSource, "contact");
  assert.equal(model.channels.find((row) => row.channel === "sms")?.known, false);
  assert.equal(consentStatusLabel("opted_in"), "Opted in");
  assert.equal(consentStatusLabel("pending_review"), "pending_review");
  assert.equal(consentStatusLabel(""), "Unknown");
  const html = renderToStaticMarkup(createElement(InboxContactPanel, {
    enabled: true,
    className: "aside",
    data: on,
    thread: on.thread,
    saveAction: noop,
    assignAction: noop,
  }));
  assert.match(html, /data-testid="inbox-contact-panel"/);
  assert.match(html, /data-testid="inbox-contact-panel-toggle"/);
  assert.match(html, /lg:hidden/);
  assert.match(html, /data-testid="inbox-contact-name"/);
  assert.match(html, /Lerato Mokoena/);
  assert.match(html, /\+27115550101/);
  assert.match(html, /Stage: Enquiry/);
  assert.match(html, /admissions/);
  assert.match(html, /WhatsApp · service · Opted in/);
  assert.match(html, /WhatsApp · marketing · Opted out/);
  assert.match(html, /Email · marketing · Requested/);
  assert.match(html, /SMS · Unknown/);
  assert.match(html, /This panel does not change it/);
  assert.match(html, /Nothing is queued and no sequence starts/);
  assert.match(html, /data-testid="inbox-contact-stage"/);
  assert.match(html, /data-testid="inbox-contact-tags"/);
  assert.equal(html.includes("graph.facebook"), false);
  const amina = previewInbox({ contactPanel: true, id: "00000000-0000-4000-8000-000000000003" });
  const leadOnly = buildContactPanel({
    contact: amina.thread?.contact ?? null,
    consents: amina.thread?.consents ?? [],
    channel: "whatsapp",
  });
  assert.equal(leadOnly.tagSource, "lead");
  assert.deepEqual(leadOnly.tags, ["follow-up"]);
  assert.equal(leadOnly.stageLabel, "Contacted");
  const leadHtml = renderToStaticMarkup(createElement(InboxContactPanel, {
    enabled: true,
    className: "aside",
    data: amina,
    thread: amina.thread,
    saveAction: noop,
    assignAction: noop,
  }));
  assert.match(leadHtml, /follow-up/);
  assert.match(leadHtml, /From the linked lead/);
  assert.match(leadHtml, /Stage: Contacted/);
  assert.match(leadHtml, /WhatsApp · Unknown/);
  assert.match(leadHtml, /Email · Unknown/);
  const missing = buildContactPanel({ contact: null, consents: [], channel: "email" });
  assert.equal(missing.hasContact, false);
  assert.equal(missing.name, "");
  assert.equal(missing.stageLabel, "No linked lead");
  assert.deepEqual(missing.tags, []);
  assert.equal(missing.channels.every((row) => row.known === false), true);
  const blank = renderToStaticMarkup(createElement(InboxContactPanel, {
    enabled: true,
    className: "aside",
    data: on,
    thread: null,
    saveAction: noop,
    assignAction: noop,
  }));
  assert.match(blank, /No contact on this thread/);
  assert.equal(blank.includes("Save contact"), false);
  assert.equal(blank.includes("Lerato"), false);
  const unnamed = buildContactPanel({
    contact: { ...lerato, name: " ", email: "", phone: "", whatsapp: "", stage: "", leadId: "lead-1", tags: [], leadTags: [] },
    consents: [{ channel: "email", purpose: "", status: "" }],
    channel: "email",
  });
  assert.equal(unnamed.name, "Unknown");
  assert.equal(unnamed.addressKind, "none");
  assert.equal(unnamed.stageLabel, "Unknown");
  assert.equal(unnamed.channels.find((row) => row.channel === "email")?.lines[0]?.statusLabel, "Unknown");
  assert.equal(parseContactTags(" Admissions, admissions, , workshop ").ok, true);
  const parsed = parseContactTags(" Admissions, admissions, workshop ");
  if (parsed.ok) assert.deepEqual(parsed.tags, ["Admissions", "workshop"]);
  assert.equal(parseContactTags(Array.from({ length: 21 }, (_, index) => `tag${index}`).join(",")).ok, false);
  assert.equal(sameTags(["a"], ["a"]), true);
  assert.equal(sameTags(["a"], ["b"]), false);
  assert.deepEqual(planStageUpdate({ submitted: "Enquiry", current: "Enquiry", leadId: "lead-1" }), { ok: true, stage: null });
  assert.deepEqual(planStageUpdate({ submitted: "Contacted", current: "Enquiry", leadId: "lead-1" }), { ok: true, stage: "Contacted" });
  assert.equal(planStageUpdate({ submitted: "Not a stage", current: "Enquiry", leadId: "lead-1" }).ok, false);
  assert.equal(planStageUpdate({ submitted: "New", current: "", leadId: null }).ok, false);
  assert.deepEqual(planStageUpdate({ submitted: "", current: "", leadId: "lead-1" }), { ok: true, stage: null });
});

test("contact panel wiring reads consent and writes only the lead and contact rows", () => {
  const view = readFileSync(new URL("../../components/inbox/inbox-view.tsx", import.meta.url), "utf8");
  const load = readFileSync(new URL("./load.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../../app/actions/inbox.ts", import.meta.url), "utf8");
  assert.match(view, /data\.contactPanel \? \(/);
  assert.match(view, /<InboxContactPanel/);
  assert.match(view, /saveAction=\{saveInboxContactPanel\}/);
  assert.match(view, /assignAction=\{assignInboxConversation\}/);
  assert.match(view, /data-contact-panel=\{data\.contactPanel \? "on" : undefined\}/);
  assert.match(view, /Stage: \{thread\.contact\.stage \|\| "No lead stage"\}/);
  assert.match(load, /contactPanel: inboxContactPanelEnabled\(\)/);
  const threadLoad = load.slice(load.indexOf("async function loadThread"));
  const stageSelect = threadLoad.indexOf('select("stage")');
  const panelQuery = threadLoad.indexOf("if (contactPanel && contactRow?.lead_id)");
  assert.ok(stageSelect > 0);
  assert.ok(panelQuery > stageSelect);
  assert.match(threadLoad.slice(panelQuery, panelQuery + 400), /\.select\("tags"\)/);
  const save = actions.slice(actions.indexOf("export async function saveInboxContactPanel"), actions.indexOf("async function serviceCount"));
  const gate = save.indexOf("if (!inboxContactPanelEnabled())");
  const client = save.indexOf("await createSupabaseServerClient()");
  assert.ok(gate >= 0 && client > gate);
  assert.match(save, /from\("crm_contacts"\)/);
  assert.match(save, /from\("crm_leads"\)/);
  assert.match(save, /eq\("org_id", tenant\.active\.id\)/);
  assert.match(save, /assigned_only/);
  assert.equal(save.includes("contact_consents"), false);
  assert.equal(save.includes("from(\"messages\")"), false);
  assert.equal(save.includes("crm_outbox"), false);
  assert.equal(save.includes(".insert("), false);
  assert.equal(save.includes("sending_enabled"), false);
  const files = [
    "src/lib/inbox/contact-panel.ts",
    "src/components/inbox/inbox-contact-panel.tsx",
    "src/components/inbox/inbox-view.tsx",
    "src/app/actions/inbox.ts",
    "src/lib/inbox/preview.ts",
    "src/lib/inbox/load.ts",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|api\.whatsapp/i.test(text), false, file);
  }
});
