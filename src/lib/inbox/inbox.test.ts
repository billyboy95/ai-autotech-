import assert from "node:assert/strict";
import test from "node:test";
import { previewInbox } from "@/lib/inbox/preview";
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

test("a branded eastc host keeps the preview inbox inside EASTC", () => {
  const open = previewInbox({});
  assert.equal(open.conversations.some((item) => item.contactName === "Thabo Ndlovu"), true);
  const eastc = previewInbox({ brandSlug: "eastc" });
  assert.deepEqual(eastc.conversations.map((item) => item.contactName), ["Lerato Mokoena"]);
  assert.equal(JSON.stringify(eastc).includes("Ndlovu"), false);
  const zentrix = previewInbox({ brandSlug: "zentrix" });
  assert.deepEqual(zentrix.conversations, []);
});
