import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { EnvLike } from "@/lib/automation/channels";
import { applyBillingEvent, applyDunning, emptyBook, monthlyUsageReport, usageTotalCents, type BillingBook } from "@/lib/billing/book";
import { PAYFAST_SANDBOX_PROCESS_URL, assertSandboxPaymentUrl, sandboxAdhocUrl } from "@/lib/billing/flag";
import { createPayfastProvider } from "@/lib/billing/payfast";
import { billingProvider } from "@/lib/billing/providers";
import { payfastSignature } from "@/lib/billing/signature";
import type { BillingPlan } from "@/lib/billing/types";

const ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const STARTER: BillingPlan = { code: "starter", name: "Starter", priceCents: 49900, interval: "month", currency: "ZAR" };
const SANDBOX_ENV: EnvLike = {
  BILLING_SANDBOX: "true",
  PAYFAST_MERCHANT_ID: "10000100",
  PAYFAST_MERCHANT_KEY: "sandbox-key",
  PAYFAST_PASSPHRASE: "",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

function book(): BillingBook {
  return {
    ...emptyBook([{ code: "starter", priceCents: 49900 }]),
    orgs: [{ id: ORG, status: "active", sendingEnabled: false }],
    outbox: [
      { id: "queued", orgId: ORG, status: "queued" },
      { id: "approved", orgId: ORG, status: "approved" },
      { id: "sent", orgId: ORG, status: "sent" },
    ],
  };
}

function signedItn(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    merchant_id: "10000100",
    pf_payment_id: "pf-1",
    payment_status: "COMPLETE",
    amount_gross: "499.00",
    custom_str1: ORG,
    custom_str2: "starter",
    custom_str3: "sandbox",
    token: "sandbox-token-1",
    occurred_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
  const order = Object.keys(fields);
  fields.signature = payfastSignature(fields, order, "");
  return fields;
}

test("PayFast sandbox ITN activates the workspace and a duplicate is ignored", () => {
  const state = book();
  const provider = createPayfastProvider(state, SANDBOX_ENV);
  const first = provider.handleWebhook({ fields: signedItn() });
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  assert.equal(first.status, "active");
  assert.equal(first.charged, false);
  assert.equal(first.sendingEnabled, false);
  assert.equal(state.subscriptions[0]?.status, "active");
  assert.equal(state.subscriptions[0]?.providerToken, "sandbox-token-1");
  assert.equal(state.subscriptions[0]?.sandbox, true);
  assert.equal(state.orgs[0]?.sendingEnabled, false);

  const second = provider.handleWebhook({ fields: signedItn({ payment_status: "FAILED" }) });
  assert.equal(second.duplicate, true);
  assert.equal(second.charged, false);
  assert.equal(state.subscriptions[0]?.status, "active");
  assert.equal(state.events.length, 1);
});

test("a failed charge becomes past_due and suspended after 7 days, and the outbox holds", () => {
  const state = book();
  const failed = applyBillingEvent(state, {
    provider: "payfast",
    providerEventId: "pf-fail",
    orgId: ORG,
    type: "itn",
    payload: {
      sandbox: true,
      paymentStatus: "FAILED",
      planCode: "starter",
      occurredAt: "2026-09-01T00:00:00.000Z",
    },
  });
  assert.equal(failed.status, "past_due");
  assert.equal(failed.book.subscriptions[0]?.pastDueAt, "2026-09-01T00:00:00.000Z");
  assert.equal(failed.book.outbox.find((row) => row.id === "queued")?.status, "queued");

  const day6 = applyDunning(failed.book, new Date("2026-09-07T00:00:00.000Z"));
  assert.equal(day6.subscriptions[0]?.status, "past_due");
  assert.equal(day6.outbox.find((row) => row.id === "queued")?.status, "queued");

  const day7 = applyDunning(failed.book, new Date("2026-09-08T00:00:00.000Z"));
  assert.equal(day7.subscriptions[0]?.status, "suspended");
  assert.equal(day7.orgs[0]?.status, "suspended");
  assert.equal(day7.orgs[0]?.sendingEnabled, false);
  assert.equal(day7.outbox.find((row) => row.id === "queued")?.status, "held");
  assert.equal(day7.outbox.find((row) => row.id === "approved")?.status, "held");
  assert.equal(day7.outbox.find((row) => row.id === "sent")?.status, "sent");
});

test("monthly usage report matches the ledger sum with rate-card markup", () => {
  const cards = [
    { orgId: null, meter: "sms", markupMultiplier: 1 },
    { orgId: null, meter: "email", markupMultiplier: 1 },
    { orgId: ORG, meter: "sms", markupMultiplier: 2 },
    { orgId: null, meter: "wa_utility", markupMultiplier: 1.5 },
  ];
  const ledger = [
    { orgId: ORG, meter: "sms", quantity: 3, unitCostCents: 18, occurredAt: "2026-09-02T00:00:00.000Z" },
    { orgId: ORG, meter: "email", quantity: 4, unitCostCents: 1, occurredAt: "2026-09-03T00:00:00.000Z" },
    { orgId: ORG, meter: "wa_utility", quantity: 1, unitCostCents: 13, occurredAt: "2026-09-04T00:00:00.000Z" },
    { orgId: "other", meter: "sms", quantity: 9, unitCostCents: 18, occurredAt: "2026-09-02T00:00:00.000Z" },
    { orgId: ORG, meter: "sms", quantity: 100, unitCostCents: 18, occurredAt: "2026-08-01T00:00:00.000Z" },
  ];
  const lines = monthlyUsageReport({
    orgId: ORG,
    from: "2026-09-01T00:00:00.000Z",
    to: "2026-10-01T00:00:00.000Z",
    ledger,
    cards,
  });
  const manual = [
    { meter: "email", quantity: 4, amountCents: Math.round(4 * 1 * 1) },
    { meter: "sms", quantity: 3, amountCents: Math.round(3 * 18 * 2) },
    { meter: "wa_utility", quantity: 1, amountCents: Math.round(1 * 13 * 1.5) },
  ];
  assert.deepEqual(lines, manual);
  assert.equal(usageTotalCents(lines), 108 + 4 + 20);
});

test("checkout, ad-hoc, and stubs never call a payment host", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("fetch should not run");
  };
  try {
    const state = book();
    const payfast = createPayfastProvider(state, SANDBOX_ENV);
    const checkout = payfast.createCheckout({ id: ORG, name: "EASTC", email: "billing@eastc.example" }, STARTER);
    assert.equal(checkout.mode, "form");
    assert.equal(checkout.actionUrl, PAYFAST_SANDBOX_PROCESS_URL);
    assert.equal(checkout.fields?.subscription_type, "1");
    assert.equal(checkout.fields?.custom_str3, "sandbox");
    assert.equal(checkout.charged, false);
    assert.equal(checkout.sandbox, true);

    payfast.handleWebhook({ fields: signedItn() });
    const sub = state.subscriptions[0];
    assert.ok(sub);
    const adhoc = payfast.chargeAdhoc(sub, 2500);
    assert.equal(adhoc.charged, false);
    assert.equal(adhoc.dispatched, false);
    assert.equal(adhoc.simulated, true);
    assert.match(sandboxAdhocUrl(sub.providerToken || "token"), /testing=true/);
    const cancelled = payfast.cancel(sub);
    assert.equal(cancelled.dispatched, false);
    assert.equal(state.subscriptions[0]?.status, "cancelled");

    const paystack = billingProvider("paystack", state);
    assert.equal(paystack.createCheckout({ id: ORG, name: "EASTC" }, STARTER).mode, "stub");
    assert.equal(paystack.chargeAdhoc(sub, 100).ok, false);
    const yoco = billingProvider("yoco", state);
    const link = yoco.createCheckout({ id: ORG, name: "EASTC" }, STARTER);
    assert.equal(link.mode, "link");
    assert.equal(link.actionUrl, null);
    assert.match(link.message, /once-off/i);
    assert.equal(yoco.chargeAdhoc(sub, 100).ok, false);
    assert.equal(yoco.cancel(sub).ok, false);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("sandbox stays off and live hosts are refused", () => {
  const state = book();
  const closed = createPayfastProvider(state, {});
  const checkout = closed.createCheckout({ id: ORG, name: "EASTC" }, STARTER);
  assert.equal(checkout.mode, "disabled");
  assert.equal(checkout.actionUrl, null);
  assert.equal(checkout.charged, false);

  const live = createPayfastProvider(state, { ...SANDBOX_ENV, PAYFAST_MERCHANT_ID: "99999999" });
  assert.equal(live.createCheckout({ id: ORG, name: "EASTC" }, STARTER).actionUrl, null);
  assert.throws(() => assertSandboxPaymentUrl("https://www.payfast.co.za/eng/process"), /non-sandbox/);
  assert.doesNotThrow(() => assertSandboxPaymentUrl(PAYFAST_SANDBOX_PROCESS_URL));
  assert.doesNotThrow(() => assertSandboxPaymentUrl(sandboxAdhocUrl("token")));

  const sql = readFileSync(new URL("../../../supabase/migrations/20261019120000_phase2f_billing.sql", import.meta.url), "utf8");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/www\.payfast\.co\.za/i.test(sql), false);
  assert.match(sql, /sandbox boolean not null default true/);
});
