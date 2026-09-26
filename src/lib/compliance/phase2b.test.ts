import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { deliverMessage } from "@/lib/automation/send";
import { createInitialState } from "@/lib/automation/engine";
import { decideInbound } from "@/lib/channels/inbound";
import { signBody } from "@/lib/channels/webhook";
import { importConsentCampaign } from "@/lib/compliance/campaign-import";
import { DRAFT_PROSPECTS_FILE, loadDraftProspectCampaign } from "@/lib/compliance/draft-campaign";
import { eraseContact, type ContactRecord } from "@/lib/compliance/dsr";
import { isStopCommand } from "@/lib/compliance/stop";
import { usageForSend, type RateCard } from "@/lib/compliance/usage";

const csv = [
  "name,business,niche,website,phone,email,opening line,consent_basis",
  "Thabo Molefe,Ndlovu Dental,dental,https://ndlovu.example,0825550101,thabo@ndlovu.example,Your front desk copies WhatsApp,",
].join("\n");

test("a workspace connection is the only credential used for that send", async () => {
  let url = "";
  let authorization = "";
  const result = await deliverMessage(
    {
      channel: "whatsapp",
      to: "0825550101",
      subject: "",
      body: "Hello from EASTC",
      category: "service",
      marketingConsent: true,
      connection: {
        connectionId: "eastc-wa",
        provider: "meta_cloud",
        identifier: "EASTC_PHONE_ID",
        token: "eastc-token",
      },
    },
    { AUTOMATION_SEND_ENABLED: "true", WHATSAPP_TOKEN: "agency-token", WHATSAPP_PHONE_NUMBER_ID: "AGENCY_PHONE_ID" },
    async (input, init) => {
      url = String(input);
      const headers = init?.headers as { Authorization?: string } | undefined;
      authorization = headers?.Authorization || "";
      return new Response(JSON.stringify({ messages: [{ id: "wamid.EASTC" }] }), { status: 200 });
    },
  );
  assert.match(url, /EASTC_PHONE_ID/);
  assert.equal(url.includes("AGENCY_PHONE_ID"), false);
  assert.match(authorization, /eastc-token/);
  assert.equal(authorization.includes("agency-token"), false);
  assert.equal(result.providerId, "wamid.EASTC");
  assert.equal(result.connectionId, "eastc-wa");
});

test("send test style delivery stays a dry run while sending is off", async () => {
  let calls = 0;
  const result = await deliverMessage(
    {
      channel: "sms",
      to: "0825550101",
      subject: "",
      body: "Test",
      category: "service",
      connection: { connectionId: "sms-1", provider: "smsportal", identifier: "AIAuto", clientId: "id", apiSecret: "secret" },
    },
    { AUTOMATION_SEND_ENABLED: "false" },
    async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.status, "queued");
  assert.equal(result.provider, "dry_run");
});

test("csv import requires consent_basis and blocks a second consent request", () => {
  const start = new Date("2026-09-26T08:00:00.000Z");
  const first = importConsentCampaign(createInitialState(), csv, start);
  assert.equal(first.error, "");
  assert.equal(first.requested, 1);
  assert.equal(first.state.outbox.filter((message) => message.templateKey === "consent_request").length, 1);
  assert.equal(first.state.prospects[0]?.consentRequested, true);
  assert.equal(first.state.outbox.some((message) => message.templateKey.startsWith("campaign_")), false);

  const second = importConsentCampaign(first.state, csv, start);
  assert.equal(second.state.outbox.filter((message) => message.templateKey === "consent_request").length, 1);
  assert.equal(second.requested, 0);
  assert.ok(second.blocked >= 1);

  const missing = importConsentCampaign(createInitialState(), "name,email\nA,a@example.com\n", start);
  assert.match(missing.error, /consent_basis/);
});

test("an existing customer row can be marketed and a consented row is opted in", () => {
  const rows = [
    "name,business,niche,website,phone,email,opening line,consent_basis",
    "Amina,Amina Co,clinic,https://amina.example,0820000002,amina@example.co.za,Hello,existing_customer",
    "Chris,Chris Co,clinic,https://chris.example,0820000003,chris@example.co.za,Hello,consent",
  ].join("\n");
  const imported = importConsentCampaign(createInitialState(), rows, new Date("2026-09-26T08:00:00.000Z"));
  const amina = imported.state.prospects.find((prospect) => prospect.email.startsWith("amina"));
  const chris = imported.state.prospects.find((prospect) => prospect.email.startsWith("chris"));
  assert.equal(amina?.consentBasis, "existing_customer");
  assert.equal(chris?.marketingConsent, true);
  assert.ok(imported.state.outbox.some((message) => message.toAddress.includes("0820000002")));
  assert.equal(imported.requested, 0);
});

test("the East Rand file loads as a held draft for prospects that are not contacted", () => {
  const csvFile = readFileSync(DRAFT_PROSPECTS_FILE, "utf8");
  const loaded = loadDraftProspectCampaign(createInitialState(), csvFile, new Date("2026-09-26T08:00:00.000Z"));
  assert.equal(loaded.error, "");
  assert.ok(loaded.count >= 30);
  assert.equal(loaded.state.campaigns[0]?.status, "draft");
  assert.equal(loaded.state.campaigns[0]?.name, "East Rand prospects (draft)");
  assert.ok(loaded.state.prospects.every((prospect) => prospect.status === "not_contacted"));
  assert.ok(loaded.state.prospects.every((prospect) => prospect.outreachStatus === "not contacted"));
  assert.equal(loaded.state.outbox.length, 0);
  assert.ok(loaded.state.prospects.some((prospect) => prospect.business === "Kempton Smile"));
  const again = loadDraftProspectCampaign(loaded.state, csvFile, new Date("2026-09-26T09:00:00.000Z"));
  assert.equal(again.count, 0);
});

test("STOP keywords plan an opt-out and ordinary sentences do not", () => {
  for (const text of ["STOP", "UNSUBSCRIBE", "OPT OUT", "STOPALL", "stop all"]) {
    assert.equal(isStopCommand(text), true, text);
  }
  assert.equal(isStopCommand("please stop by the practice"), false);
});

test("a bad webhook signature is rejected and a valid one keeps the connection org", () => {
  const raw = JSON.stringify({ from: "+27825550101", body: "STOP", id: "in-1" });
  const connection = {
    id: "conn-eastc",
    orgId: "org-eastc",
    channel: "sms",
    provider: "smsportal",
    identifier: "EASTC",
    displayName: "EASTC SMS",
    senderName: "EASTC",
    secret: { webhookSecret: "eastc-hook" },
  };
  const rejected = decideInbound({
    provider: "smsportal",
    connection,
    rawBody: raw,
    signature: signBody("agency-hook", raw),
    sharedSecret: null,
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.status, 401);

  const accepted = decideInbound({
    provider: "smsportal",
    connection,
    rawBody: raw,
    signature: signBody("eastc-hook", raw),
    sharedSecret: null,
  });
  assert.equal(accepted.ok, true);
  if (accepted.ok && "orgId" in accepted) {
    assert.equal(accepted.orgId, "org-eastc");
    assert.ok(accepted.stop);
    assert.match(accepted.stop?.ack || "", /EASTC/);
  }
});

test("held sends still price cost_cents from the rate card", () => {
  const cards: RateCard[] = [
    { orgId: null, meter: "sms", unitCostCents: 18, markupMultiplier: 1 },
    { orgId: "eastc", meter: "sms", unitCostCents: 21, markupMultiplier: 2 },
  ];
  const held = usageForSend({ channel: "whatsapp", purpose: "marketing", sourceId: "held-1", cards });
  assert.equal(held.meter, "wa_marketing");
  assert.equal(held.costCents, 66);
  const eastc = usageForSend({ orgId: "eastc", channel: "sms", purpose: "marketing", sourceId: "held-2", cards });
  assert.equal(eastc.unitCostCents, 21);
  assert.equal(eastc.costCents, 21);
  assert.equal(eastc.unitPriceCents, 42);
});

test("erase anonymises the contact and suppresses every address", () => {
  const contact: ContactRecord = {
    id: "c1",
    orgId: "org",
    firstName: "Thabo",
    lastName: "Molefe",
    email: "thabo@ndlovu.example",
    phoneE164: "+27825550101",
    whatsappE164: "+27825550101",
    company: "Ndlovu Dental",
    tags: ["prospect"],
    custom: { note: "private" },
    leadId: null,
    clientId: null,
    erasedAt: null,
  };
  const erased = eraseContact(contact, new Date("2026-09-26T08:00:00.000Z"));
  assert.equal(erased.contact.firstName, "Erased");
  assert.equal(erased.contact.email, "");
  assert.equal(erased.contact.phoneE164, "");
  assert.equal(erased.contact.company, "");
  assert.deepEqual(erased.contact.custom, {});
  assert.equal(erased.dataRequest.type, "delete");
  assert.equal(erased.dataRequest.status, "completed");
  assert.ok(erased.suppressions.some((item) => item.channel === "email" && item.address === "thabo@ndlovu.example" && item.reason === "dsr_delete"));
  assert.ok(erased.suppressions.some((item) => item.channel === "whatsapp" && item.reason === "dsr_delete"));
});
