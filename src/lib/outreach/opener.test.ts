import assert from "node:assert/strict";
import test from "node:test";
import { flushOutbox } from "@/lib/automation/flush";
import { createInitialState } from "@/lib/automation/engine";
import type { OutboxMessage, OutboxStatus } from "@/lib/automation/types";
import { canMoveTo, prospectFromRow, summariseFunnel } from "@/lib/outreach/funnel";
import { isStaleQueuedMarketing, openerGivesAdvice, OPENER_TEMPLATE_KEY, planOpener, renderBrokerOpener } from "@/lib/outreach/opener";

const base = {
  stage: "not_contacted",
  doNotContact: false,
  email: "info@reef.example",
  contactName: "Thabo Nkosi",
  business: "Reef Insurance Brokers",
  hook: "Since 1983",
  suppressed: false,
  optedOut: false,
  marketingOptIn: false,
  existingCustomer: false,
  duplicate: false,
};

function message(status: OutboxStatus, id: string): OutboxMessage {
  return {
    id,
    leadId: "",
    prospectId: "prospect-1",
    templateKey: status === "draft" ? OPENER_TEMPLATE_KEY : "ack_email",
    channel: "email",
    toAddress: "person@example.co.za",
    subject: "Hi",
    body: "Hello",
    status,
    scheduledFor: "2026-09-26T07:00:00.000Z",
    sentAt: null,
    provider: "outbox",
    providerId: "",
    error: "",
    waLink: "",
    category: "marketing",
    costUsd: null,
    costZar: null,
    costCategory: "",
    purpose: status === "draft" ? "consent_request" : "marketing",
    createdAt: "2026-09-26T07:00:00.000Z",
  };
}

test("opener names the person and the business and does not give advice", () => {
  const rendered = renderBrokerOpener({ contactName: "Thabo Nkosi", business: "Reef Insurance Brokers", hook: "Since 1983" });
  assert.match(rendered.body, /Thabo/);
  assert.match(rendered.body, /Reef Insurance Brokers/);
  assert.match(rendered.body, /Since 1983/);
  assert.match(rendered.body, /not insurance advice/);
  assert.match(rendered.body, /Reply STOP/);
  assert.match(rendered.subject, /not insurance advice/);
  assert.equal(openerGivesAdvice(rendered.body), false);
  assert.equal(openerGivesAdvice("I recommend this policy and the premium you should buy"), true);
});

test("planner writes a non-delivering draft and blocks do-not-contact", () => {
  const draft = planOpener(base);
  assert.equal(draft.action, "draft");
  if (draft.action !== "draft") return;
  assert.equal(draft.status, "draft");
  assert.equal(draft.purpose, "consent_request");
  assert.notEqual(draft.status, "queued");
  assert.notEqual(draft.status, "approved");

  const optedIn = planOpener({ ...base, marketingOptIn: true });
  assert.equal(optedIn.action, "draft");
  if (optedIn.action === "draft") assert.equal(optedIn.purpose, "marketing");

  assert.deepEqual(planOpener({ ...base, doNotContact: true }), { action: "skip", reason: "dnc" });
  assert.equal(planOpener({ ...base, email: "" }).action, "skip");
  assert.equal(planOpener({ ...base, suppressed: true }).action, "block");
  assert.equal(planOpener({ ...base, optedOut: true }).action, "block");
  assert.equal(planOpener({ ...base, stage: "sent" }).action, "skip");
  assert.equal(canMoveTo({ doNotContact: true, stage: "not_contacted" }, "outreach_queued"), false);
});

test("an opener queued stage is not counted as sent", () => {
  const queued = prospectFromRow({ id: "q", business: "Q", stage: "outreach_queued", email: "a@b.co" });
  assert.equal(queued.stage, "outreach_queued");
  const summary = summariseFunnel([queued]);
  assert.equal(summary.queued, 1);
  assert.equal(summary.steps.find((step) => step.stage === "sent")?.reached, 0);
  assert.equal(summary.steps.find((step) => step.stage === "not_contacted")?.current, 0);
});

test("flush does not deliver drafts when the send switch is on", async () => {
  let calls = 0;
  const state = createInitialState({
    outbox: [message("draft", "draft-1"), message("queued", "queued-1")],
  });
  const flushed = await flushOutbox(state, new Date("2026-09-26T08:00:00.000Z"), { AUTOMATION_SEND_ENABLED: "true" }, async () => {
    calls += 1;
    return { status: "sent", provider: "resend", providerId: "x", waLink: "", error: "", body: "Hello" };
  });
  assert.equal(calls, 1);
  assert.equal(flushed.outbox.find((item) => item.id === "draft-1")?.status, "draft");
  assert.equal(flushed.outbox.find((item) => item.id === "queued-1")?.status, "sent");
});

test("flush does not deliver a draft-only outbox even when sending is on", async () => {
  let calls = 0;
  const state = createInitialState({ outbox: [message("draft", "draft-only")] });
  const flushed = await flushOutbox(
    state,
    new Date("2026-09-26T08:00:00.000Z"),
    { AUTOMATION_SEND_ENABLED: "true", RESEND_API_KEY: "re_test" },
    async () => {
      calls += 1;
      return { status: "sent", provider: "resend", providerId: "x", waLink: "", error: "" };
    },
  );
  assert.equal(calls, 0);
  assert.equal(flushed.outbox[0].status, "draft");
});

test("stale cancel matches queued marketing only", () => {
  assert.equal(isStaleQueuedMarketing({ status: "queued", purpose: "MARKETING", category: "" }), true);
  assert.equal(isStaleQueuedMarketing({ status: "queued", purpose: "service", category: "marketing" }), true);
  assert.equal(isStaleQueuedMarketing({ status: "queued", purpose: "service", category: "service" }), false);
  assert.equal(isStaleQueuedMarketing({ status: "draft", purpose: "marketing", category: "marketing" }), false);
  assert.equal(isStaleQueuedMarketing({ status: "approved", purpose: "marketing", category: "marketing" }), false);
  assert.equal(isStaleQueuedMarketing({ status: "cancelled", purpose: "marketing", category: "marketing" }), false);
});
