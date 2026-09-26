import assert from "node:assert/strict";
import test from "node:test";
import { importProspectCsv } from "@/lib/automation/campaigns";
import { deliverMessage } from "@/lib/automation/send";
import { applyInbound, captureLead, createInitialState, runCron } from "@/lib/automation/engine";
import { buildReport } from "@/lib/automation/report";
import { publishDuePosts, publishPost, queueSocialPost, recordClick, resolvePublicRedirect } from "@/lib/automation/social";

const csv = [
  "name,business,niche,website,phone,email,opening line",
  "Thabo Molefe,Ndlovu Dental,dental,https://ndlovu.example,0825550101,thabo@ndlovu.example,\"Your front desk is still copying WhatsApp into a notebook.\"",
].join("\n");

test("sms stays queued and does not call a provider while sending is off", async () => {
  let calls = 0;
  const result = await deliverMessage(
    { channel: "sms", to: "0825550101", subject: "", body: "Hello from AI AutoTech" },
    { AUTOMATION_SEND_ENABLED: "false", BULKSMS_TOKEN_ID: "id", BULKSMS_TOKEN_SECRET: "secret" },
    async () => {
      calls += 1;
      return new Response("[]", { status: 201 });
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.status, "queued");
  assert.match(result.waLink, /^sms:\+27/);
});

test("sms does not call a provider when sending is on but no account is configured", async () => {
  let calls = 0;
  const result = await deliverMessage(
    { channel: "sms", to: "0825550101", subject: "", body: "Hello" },
    { AUTOMATION_SEND_ENABLED: "true" },
    async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.status, "failed");
  assert.match(result.error, /BULKSMS_TOKEN_ID/);
});

test("campaign csv queues whatsapp then email and sms, and a reply enters the pipeline", () => {
  const start = new Date("2026-09-26T08:00:00.000Z");
  const imported = importProspectCsv(createInitialState(), csv, start);
  assert.equal(imported.error, "");
  assert.equal(imported.count, 1);
  assert.equal(imported.state.leads.length, 0);
  assert.equal(imported.state.outbox.filter((message) => message.channel === "whatsapp").length, 1);
  assert.equal(imported.state.prospects[0]?.status, "in_sequence");

  const later = runCron(imported.state, new Date("2026-09-29T12:00:00.000Z"));
  const channels = later.outbox.map((message) => message.channel).sort();
  assert.deepEqual(channels, ["email", "sms", "whatsapp"]);
  assert.equal(later.leads.length, 0);

  const replied = applyInbound(later, { type: "reply.received", email: "thabo@ndlovu.example", text: "Yes, let's talk" }, new Date("2026-09-29T12:05:00.000Z"));
  const lead = replied.leads.find((item) => item.email === "thabo@ndlovu.example");
  assert.equal(lead?.stage, "Contacted");
  assert.equal(lead?.source, "outbound_campaign");
  assert.ok(replied.activities.some((item) => item.leadId === lead?.id && item.kind === "channel_touch" && item.metadata.channel === "sms"));
  assert.ok(replied.activities.some((item) => item.leadId === lead?.id && item.kind === "attribution"));
  const report = buildReport(replied, new Date("2026-09-29T12:05:00.000Z"), false);
  assert.ok(report.attribution.some((row) => row.source === "outbound_campaign" && row.leads === 1));
});

test("a booking moves a prospect to Audit booked", () => {
  const start = new Date("2026-09-26T08:00:00.000Z");
  const imported = importProspectCsv(createInitialState(), csv, start);
  const booked = applyInbound(
    imported.state,
    { type: "booking.created", email: "thabo@ndlovu.example", startsAt: "2026-10-02T08:00:00.000Z" },
    start,
  );
  assert.equal(booked.leads[0]?.stage, "Audit booked");
  assert.equal(booked.prospects[0]?.status, "booked");
});

test("social posts stay queued with copy text and do not call Meta or LinkedIn while sending is off", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  };
  let state = queueSocialPost(
    createInitialState(),
    {
      platform: "facebook",
      body: "Book a short audit this week.",
      utmSource: "facebook",
      utmCampaign: "spring-audit",
      scheduledFor: "2026-09-26T08:00:00.000Z",
    },
    { NEXT_PUBLIC_SITE_URL: "https://ai-autotech-crm.vercel.app" },
  );
  state = await publishDuePosts(state, new Date("2026-09-26T09:00:00.000Z"), { AUTOMATION_SEND_ENABLED: "false", META_PAGE_ID: "1", META_PAGE_ACCESS_TOKEN: "token" }, fetchImpl);
  assert.equal(calls, 0);
  assert.equal(state.socialPosts[0]?.status, "queued");
  assert.match(state.socialPosts[0]?.copyText || "", /Copy and post/);
  assert.match(state.socialPosts[0]?.copyText || "", /utm_campaign=spring-audit/);

  const instagram = state.socialPosts[0];
  const blocked = await publishPost(
    { ...instagram, platform: "instagram", mediaUrl: "" },
    { AUTOMATION_SEND_ENABLED: "true", META_IG_USER_ID: "ig", META_PAGE_ACCESS_TOKEN: "token" },
    fetchImpl,
  );
  assert.equal(calls, 0);
  assert.equal(blocked.status, "failed");
  assert.match(blocked.error, /image URL/);
});

test("a tracked social click is attributed when that campaign becomes a lead", () => {
  const now = new Date("2026-09-26T10:00:00.000Z");
  const clicked = recordClick(
    createInitialState(),
    { utmSource: "facebook", utmCampaign: "spring-audit", utmMedium: "social", destination: "https://aiautotech.co.za/audit", postId: "post_1" },
    now,
  );
  const captured = captureLead(
    clicked,
    { id: "lead-social", name: "Lerato", phone: "0825550199", email: "lerato@example.co.za", source: "website_contact", utmSource: "facebook", campaign: "spring-audit" },
    now,
  );
  const lead = captured.leads.find((item) => item.id === "lead-social");
  assert.equal(captured.clicks[0]?.leadId, lead?.id);
  assert.ok(captured.activities.some((item) => item.kind === "attribution" && item.title === "Social click became this lead" && item.body.includes("facebook") && item.body.includes("spring-audit")));
  const report = buildReport(captured, now, false);
  assert.ok(report.attribution.some((row) => row.source === "facebook" && row.campaign === "spring-audit" && row.leads === 1));
});

test("public redirect allowlist rejects other hosts", () => {
  assert.equal(resolvePublicRedirect("https://evil.example/phish", {}), null);
  assert.equal(resolvePublicRedirect("http://aiautotech.co.za/audit", {}), null);
  assert.equal(resolvePublicRedirect("//aiautotech.co.za", {}), null);
  assert.match(resolvePublicRedirect("https://aiautotech.co.za/audit", {}) || "", /^https:\/\/aiautotech\.co\.za\/audit/);
  assert.match(resolvePublicRedirect("/audit", { NEXT_PUBLIC_SITE_URL: "https://aiautotech.co.za" }) || "", /^https:\/\/aiautotech\.co\.za\/audit/);
  assert.match(
    resolvePublicRedirect("https://cal.com/ai-autotech/audit", {}, ["https://cal.com/ai-autotech/audit"]) || "",
    /^https:\/\/cal\.com\//,
  );
});
