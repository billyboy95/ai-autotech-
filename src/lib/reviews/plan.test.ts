import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createInitialState } from "@/lib/automation/engine";
import { flushOutbox } from "@/lib/automation/flush";
import type { OutboxMessage } from "@/lib/automation/types";
import { filterByRating, planPublicReview, planReviewRequest, reviewAggregate, reviewRequestConsentText } from "@/lib/reviews/plan";

const consent = reviewRequestConsentText("AI AutoTech Pty Ltd");

function request(overrides: Partial<Parameters<typeof planReviewRequest>[0]> = {}) {
  return planReviewRequest({
    channel: "sms",
    address: "0825551234",
    name: "Thabo",
    subject: "",
    body: "Hi {{name}}, please review {{sender}}: {{link}}",
    senderName: "AI AutoTech Pty Ltd",
    consent: true,
    consentText: consent,
    expectedConsentText: consent,
    existingConsent: "none",
    suppressed: false,
    ...overrides,
  });
}

test("a review request without consent does not produce an outbox draft", () => {
  const planned = request({ consent: false });
  assert.equal(planned.ok, false);
  if (!planned.ok) assert.match(planned.error, /Nothing was written to the outbox/);
  assert.equal("status" in planned, false);
});

test("an opted-out contact does not produce an outbox draft", () => {
  const planned = request({ existingConsent: "opted_out" });
  assert.equal(planned.ok, false);
  if (!planned.ok) assert.match(planned.error, /opted out/);
});

test("consent stores a draft that is not sent", () => {
  const planned = request();
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(planned.status, "draft");
  assert.equal(planned.sends, false);
  assert.equal(planned.address, "+27825551234");
  assert.match(planned.body, /\{\{link\}\}/);
  assert.match(planned.body, /reply STOP to opt out/);
  assert.equal(planned.body.includes("queued"), false);
});

test("a public review stores a rating and does not describe a send", () => {
  const missing = planPublicReview({ rating: "6", name: "Anele", comment: "Kind" });
  assert.equal(missing.ok, false);
  const planned = planPublicReview({ rating: "5", name: "Anele", comment: "Kind staff" });
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(planned.rating, 5);
  assert.equal("outbox" in planned, false);
});

test("rating filter and aggregate stay inside the workspace list", () => {
  const rows = [{ rating: 5 }, { rating: 2 }, { rating: 5 }];
  assert.equal(filterByRating(rows, "5").rows.length, 2);
  assert.equal(filterByRating(rows, "all").rating, null);
  assert.deepEqual(reviewAggregate(rows), { count: 3, average: 4 });
});

test("flush does not deliver a review-request draft", async () => {
  const message: OutboxMessage = {
    id: "rreq_test",
    leadId: "",
    prospectId: null,
    templateKey: "review_request",
    channel: "sms",
    toAddress: "+27825551234",
    subject: "",
    body: "Please review /r/rvwabc\nAI AutoTech Pty Ltd: reply STOP to opt out",
    status: "draft",
    scheduledFor: "2026-09-01T08:00:00.000Z",
    sentAt: null,
    provider: "outbox",
    providerId: "rreq_test",
    error: "Review request draft. Nothing was sent.",
    waLink: "",
    category: "marketing",
    costUsd: null,
    costZar: null,
    costCategory: "",
    purpose: "marketing",
    createdAt: "2026-09-01T08:00:00.000Z",
  };
  const state = createInitialState({ outbox: [message] });
  let delivered = 0;
  const flushed = await flushOutbox(state, new Date("2026-09-27T08:00:00.000Z"), { AUTOMATION_SEND_ENABLED: "true" }, async () => {
    delivered += 1;
    return { status: "sent", provider: "test", providerId: "x", error: "", waLink: "", body: message.body };
  });
  assert.equal(delivered, 0);
  assert.equal(flushed.outbox[0]?.status, "draft");
  const persist = readFileSync(new URL("../automation/persist.ts", import.meta.url), "utf8");
  assert.match(persist, /value === "draft"/);
});
