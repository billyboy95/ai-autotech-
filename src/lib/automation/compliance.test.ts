import assert from "node:assert/strict";
import test from "node:test";
import { importProspectCsv } from "@/lib/automation/campaigns";
import { deliverMessage } from "@/lib/automation/send";
import { changedBy } from "@/lib/automation/diff";
import { applyInbound, captureLead, createInitialState, setMarketingConsent } from "@/lib/automation/engine";
import { flushOutbox } from "@/lib/automation/flush";
import { WHATSAPP_MARKETING_USD, WHATSAPP_SERVICE_USD, quoteSendCost } from "@/lib/automation/compliance";

const csv = [
  "name,business,niche,website,phone,email,opening line",
  "Thabo Molefe,Ndlovu Dental,dental,https://ndlovu.example,0825550101,thabo@ndlovu.example,Your front desk is still copying WhatsApp.",
].join("\n");

const cloudEnv = {
  AUTOMATION_SEND_ENABLED: "true",
  WHATSAPP_TOKEN: "token",
  WHATSAPP_PHONE_NUMBER_ID: "100",
};

test("changed rows are the only ones a save should write", () => {
  const before = [
    { id: "a", name: "Amina" },
    { id: "b", name: "Billy" },
  ];
  const after = [
    { id: "a", name: "Amina" },
    { id: "b", name: "Bongi" },
    { id: "c", name: "Chris" },
  ];
  assert.deepEqual(
    changedBy(before, after, (item) => item.id).map((item) => item.id),
    ["b", "c"],
  );
});

test("marketing messages carry sender identity and an opt-out", () => {
  const imported = importProspectCsv(createInitialState(), csv, new Date("2026-09-26T08:00:00.000Z"));
  const whatsapp = imported.state.outbox.find((message) => message.channel === "whatsapp");
  assert.equal(whatsapp?.category, "marketing");
  assert.match(whatsapp?.body || "", /AI AutoTech/);
  assert.match(whatsapp?.body || "", /Reply STOP to opt out/);
  assert.equal(imported.state.prospects[0]?.marketingConsent, false);
});

test("a service acknowledgement does not require marketing consent", () => {
  const captured = captureLead(
    createInitialState(),
    { id: "lead-1", name: "Amina", phone: "0820000001", email: "amina@example.co.za", source: "website_contact" },
    new Date("2026-09-26T08:00:00.000Z"),
  );
  const ack = captured.outbox.find((message) => message.templateKey === "ack_whatsapp");
  assert.equal(ack?.category, "service");
  assert.equal(captured.leads[0]?.marketingConsent, false);
  assert.doesNotMatch(ack?.body || "", /Reply STOP to opt out/);
});

test("suppression and missing marketing consent do not call the provider", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ messages: [{ id: "wamid" }] }), { status: 200 });
  };
  const suppressed = await deliverMessage(
    { channel: "whatsapp", to: "0820000001", subject: "", body: "Your audit is tomorrow", category: "service", suppressed: true },
    cloudEnv,
    fetchImpl,
  );
  assert.equal(calls, 0);
  assert.equal(suppressed.status, "blocked");
  assert.match(suppressed.error, /opted out/);

  const marketing = await deliverMessage(
    { channel: "whatsapp", to: "0820000001", subject: "", body: "Book an audit", category: "marketing", marketingConsent: false },
    cloudEnv,
    fetchImpl,
  );
  assert.equal(calls, 0);
  assert.equal(marketing.status, "blocked");
  assert.match(marketing.error, /opt-in/);
  assert.match(marketing.body || "", /Reply STOP to opt out/);
});

test("flush blocks a campaign send when consent is missing and sends after opt-in", async () => {
  const start = new Date("2026-09-26T08:00:00.000Z");
  const imported = importProspectCsv(createInitialState(), csv, start);
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
  };
  const deliver = (message: Parameters<typeof deliverMessage>[0], env: Parameters<typeof deliverMessage>[1]) =>
    deliverMessage(message, env, fetchImpl);
  const blocked = await flushOutbox(imported.state, start, cloudEnv, deliver);
  assert.equal(calls, 0);
  assert.equal(blocked.outbox.find((message) => message.channel === "whatsapp")?.status, "blocked");

  const consented = setMarketingConsent(imported.state, { prospectId: imported.state.prospects[0]?.id }, true, start);
  const sent = await flushOutbox(consented, start, cloudEnv, deliver);
  assert.equal(calls, 1);
  const whatsapp = sent.outbox.find((message) => message.channel === "whatsapp");
  assert.equal(whatsapp?.status, "sent");
  assert.equal(whatsapp?.costUsd, WHATSAPP_MARKETING_USD);
  assert.equal(whatsapp?.costCategory, "whatsapp_marketing");
  assert.equal(whatsapp?.costZar, null);
});

test("WhatsApp service is free for the first 1000 sends from 1 Oct 2026 and charged after that", () => {
  const on = new Date("2026-10-01T06:00:00.000Z");
  const before = new Date("2026-09-30T18:00:00.000Z");
  const free = quoteSendCost({
    channel: "whatsapp",
    provider: "whatsapp_cloud",
    category: "service",
    status: "sent",
    sentAt: on,
    serviceSendsThisMonth: 999,
    env: {},
  });
  const paid = quoteSendCost({
    channel: "whatsapp",
    provider: "whatsapp_cloud",
    category: "service",
    status: "sent",
    sentAt: on,
    serviceSendsThisMonth: 1000,
    env: {},
  });
  const early = quoteSendCost({
    channel: "whatsapp",
    provider: "whatsapp_cloud",
    category: "service",
    status: "sent",
    sentAt: before,
    serviceSendsThisMonth: 1000,
    env: {},
  });
  const link = quoteSendCost({
    channel: "whatsapp",
    provider: "wa.me",
    category: "service",
    status: "queued",
    sentAt: on,
    serviceSendsThisMonth: 5000,
    env: {},
  });
  assert.equal(free.costUsd, 0);
  assert.equal(free.costCategory, "whatsapp_service_free");
  assert.equal(paid.costUsd, WHATSAPP_SERVICE_USD);
  assert.equal(paid.costCategory, "whatsapp_service");
  assert.equal(early.costUsd, 0);
  assert.equal(link.costUsd, 0);
  assert.equal(link.costCategory, "wa.me");

  const rand = quoteSendCost({
    channel: "whatsapp",
    provider: "whatsapp_cloud",
    category: "marketing",
    status: "sent",
    sentAt: on,
    serviceSendsThisMonth: 0,
    env: { WHATSAPP_USDZAR: "18" },
  });
  assert.equal(rand.costZar, Math.round(WHATSAPP_MARKETING_USD * 18 * 100) / 100);
});

test("STOP suppresses the address and does not create a pipeline lead", () => {
  const start = new Date("2026-09-26T08:00:00.000Z");
  const imported = importProspectCsv(createInitialState(), csv, start);
  const stopped = applyInbound(imported.state, { type: "reply.received", email: "thabo@ndlovu.example", text: "STOP" }, start);
  assert.equal(stopped.leads.length, 0);
  assert.equal(stopped.prospects[0]?.status, "stopped");
  assert.ok(stopped.suppressions.some((item) => item.address === "thabo@ndlovu.example"));
  assert.ok(stopped.suppressions.some((item) => item.address === "27825550101"));
  assert.ok(stopped.outbox.every((message) => message.status === "cancelled"));
});
