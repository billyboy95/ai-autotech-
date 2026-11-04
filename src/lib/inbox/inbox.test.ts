import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InboxTeamStatsPanel } from "@/components/inbox/inbox-team-stats";
import { previewInbox } from "@/lib/inbox/preview";
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

test("a branded eastc host keeps the preview inbox inside EASTC", () => {
  const open = previewInbox({});
  assert.equal(open.conversations.some((item) => item.contactName === "Thabo Ndlovu"), true);
  const eastc = previewInbox({ brandSlug: "eastc" });
  assert.deepEqual(eastc.conversations.map((item) => item.contactName), ["Lerato Mokoena"]);
  assert.equal(JSON.stringify(eastc).includes("Ndlovu"), false);
  const zentrix = previewInbox({ brandSlug: "zentrix" });
  assert.deepEqual(zentrix.conversations, []);
});
