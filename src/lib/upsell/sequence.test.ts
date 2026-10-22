import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MEMBERSHIP_UPSELL_STAGE } from "@/lib/upsell/stage";
import { planMembershipUpsell, upsellSendDecision } from "@/lib/upsell/sequence";

test("a paying services client gets a draft membership sequence and nothing is sent", () => {
  const plan = planMembershipUpsell({
    now: new Date("2026-10-22T08:00:00.000Z"),
    quoteId: "quote-1",
    firstName: "Aya",
    packageName: "Website build",
    email: "aya@example.com",
    phone: "0820000000",
  });
  assert.equal(plan.stage, MEMBERSHIP_UPSELL_STAGE);
  assert.equal(plan.stage, "membership upsell");
  assert.equal(plan.willSend, false);
  assert.equal(plan.sent, false);
  assert.equal(plan.queued, false);
  assert.deepEqual(
    plan.drafts.map((item) => `${item.step}:${item.channel}`),
    ["day0:email", "day0:whatsapp", "day2:email", "day2:whatsapp", "day5:email", "day5:whatsapp"],
  );
  assert.equal(plan.drafts.every((item) => item.status === "draft"), true);
  assert.match(plan.drafts[0]?.body || "", /R299/);
  assert.match(plan.drafts[0]?.body || "", /R699/);
  assert.match(plan.drafts[0]?.body || "", /exclude VAT/);
  assert.match(plan.drafts[0]?.body || "", /Willem@aiautotech\.co\.za/);
  assert.match(plan.drafts[0]?.body || "", /has not been sent/);

  assert.match(upsellSendDecision({ sendingEnabled: false, env: {} }).reason, /sending_enabled/);
  assert.equal(upsellSendDecision({ sendingEnabled: false, env: { AUTOMATION_SEND_ENABLED: "true" } }).sent, false);
  assert.match(upsellSendDecision({ sendingEnabled: true, env: {} }).reason, /AUTOMATION_SEND_ENABLED/);
  const both = upsellSendDecision({ sendingEnabled: true, env: { AUTOMATION_SEND_ENABLED: "true" } });
  assert.equal(both.sent, false);
  assert.equal(both.queued, false);
  assert.equal(both.drafted, true);
});

test("the upsell migration inserts drafts only", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261115120000_income_streams.sql", import.meta.url), "utf8");
  assert.match(sql, /check \(status = 'draft'\)/);
  assert.match(sql, /'membership upsell'/);
  assert.equal(/status,\s*'queued'|status,\s*'sent'/i.test(sql), false);
});
