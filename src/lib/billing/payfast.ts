import type { EnvLike } from "@/lib/automation/channels";
import { applyBillingEvent, type BillingBook } from "@/lib/billing/book";
import {
  PAYFAST_SANDBOX_MERCHANT_ID,
  PAYFAST_SANDBOX_PROCESS_URL,
  assertSandboxMerchant,
  assertSandboxPaymentUrl,
  isBillingSandboxEnabled,
  payfastMerchantId,
  sandboxAdhocUrl,
} from "@/lib/billing/flag";
import { parsePayfastBody, payfastSignature } from "@/lib/billing/signature";
import type {
  BillingOrg,
  BillingPlan,
  BillingProvider,
  CheckoutResult,
  OrgSubscription,
  ProviderCallResult,
  WebhookRequest,
  WebhookResult,
} from "@/lib/billing/types";

const CHECKOUT_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "email_address",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "subscription_type",
  "billing_date",
  "recurring_amount",
  "frequency",
  "cycles",
];

function refused(message: string): CheckoutResult {
  return {
    provider: "payfast",
    sandbox: true,
    charged: false,
    mode: "disabled",
    actionUrl: null,
    fields: null,
    message,
  };
}

function callResult(ok: boolean, message: string, reference: string | null = null): ProviderCallResult {
  return {
    ok,
    provider: "payfast",
    sandbox: true,
    charged: false,
    simulated: true,
    dispatched: false,
    message,
    reference,
  };
}

function zar(cents: number) {
  return (cents / 100).toFixed(2);
}

function randsToCents(value: string) {
  const [whole, frac = ""] = value.trim().split(".");
  const cents = `${frac}00`.slice(0, 2);
  return Number(whole || "0") * 100 + Number(cents);
}

function billingDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function verifyPayfastItn(fields: Record<string, string>, order: string[], env: EnvLike = process.env) {
  const merchant = fields.merchant_id || "";
  if (merchant !== PAYFAST_SANDBOX_MERCHANT_ID) {
    return { ok: false as const, error: "PayFast ITN merchant is not the sandbox merchant. No charge was applied." };
  }
  if (fields.custom_str3 !== "sandbox") {
    return { ok: false as const, error: "PayFast ITN is not marked sandbox. No charge was applied." };
  }
  const signature = fields.signature || "";
  if (!signature) return { ok: false as const, error: "PayFast ITN is missing a signature." };
  const expected = payfastSignature(fields, order.filter((key) => key !== "signature"), String(env.PAYFAST_PASSPHRASE ?? ""));
  if (expected !== signature) return { ok: false as const, error: "PayFast ITN signature was rejected." };
  assertSandboxMerchant(env);
  return { ok: true as const };
}

export function createPayfastProvider(book: BillingBook, env: EnvLike = process.env): BillingProvider {
  return {
    name: "payfast",
    createCheckout(org: BillingOrg, plan: BillingPlan): CheckoutResult {
      if (!isBillingSandboxEnabled(env)) {
        return refused("Billing sandbox is off. Set BILLING_SANDBOX=true. No charge was sent.");
      }
      const merchant = payfastMerchantId(env);
      if (merchant && merchant !== PAYFAST_SANDBOX_MERCHANT_ID) {
        return refused("Refusing PayFast checkout because PAYFAST_MERCHANT_ID is not sandbox merchant 10000100. No charge was sent.");
      }
      if (!merchant || !String(env.PAYFAST_MERCHANT_KEY ?? "").trim()) {
        return refused("Add PAYFAST_MERCHANT_ID=10000100 and the PayFast sandbox merchant key. No charge was sent.");
      }
      if (plan.currency !== "ZAR" || plan.priceCents < 0) {
        return refused("Plans are billed in ZAR cents. No charge was sent.");
      }
      assertSandboxPaymentUrl(PAYFAST_SANDBOX_PROCESS_URL);
      const site = String(env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
      const fields: Record<string, string> = {
        merchant_id: PAYFAST_SANDBOX_MERCHANT_ID,
        merchant_key: String(env.PAYFAST_MERCHANT_KEY).trim(),
        return_url: `${site}/command-centre/billing?billing=return`,
        cancel_url: `${site}/command-centre/billing?billing=cancel`,
        notify_url: `${site}/api/webhooks/payfast`,
        name_first: org.name.slice(0, 100) || "Workspace",
        email_address: org.email || "sandbox@example.com",
        m_payment_id: `sub_${org.id}_${plan.code}`,
        amount: zar(plan.priceCents),
        item_name: plan.name,
        item_description: `${plan.name} workspace subscription`,
        custom_str1: org.id,
        custom_str2: plan.code,
        custom_str3: "sandbox",
        subscription_type: "1",
        billing_date: billingDate(new Date()),
        recurring_amount: zar(plan.priceCents),
        frequency: plan.interval === "year" ? "6" : "3",
        cycles: "0",
      };
      fields.signature = payfastSignature(fields, CHECKOUT_ORDER, String(env.PAYFAST_PASSPHRASE ?? ""));
      return {
        provider: "payfast",
        sandbox: true,
        charged: false,
        mode: "form",
        actionUrl: PAYFAST_SANDBOX_PROCESS_URL,
        fields,
        message: "PayFast sandbox subscription form. subscription_type=1. Nothing has been charged.",
      };
    },
    handleWebhook(req: WebhookRequest): WebhookResult {
      const parsed = req.fields ? { fields: req.fields, order: Object.keys(req.fields) } : parsePayfastBody(req.rawBody || "");
      const verified = verifyPayfastItn(parsed.fields, parsed.order, env);
      if (!verified.ok) {
        return {
          ok: false,
          duplicate: false,
          provider: "payfast",
          providerEventId: parsed.fields.pf_payment_id || null,
          orgId: parsed.fields.custom_str1 || null,
          status: null,
          sandbox: true,
          charged: false,
          sendingEnabled: false,
          message: verified.error,
        };
      }
      const paymentStatus = String(parsed.fields.payment_status || "").toUpperCase();
      const status = paymentStatus === "COMPLETE" || paymentStatus === "FAILED" || paymentStatus === "CANCELLED" || paymentStatus === "PENDING"
        ? paymentStatus
        : undefined;
      const amountCents = parsed.fields.amount_gross ? randsToCents(parsed.fields.amount_gross) : undefined;
      try {
        const applied = applyBillingEvent(book, {
          provider: "payfast",
          providerEventId: parsed.fields.pf_payment_id,
          orgId: parsed.fields.custom_str1,
          type: "itn",
          payload: {
            sandbox: true,
            paymentStatus: status === "CANCELLED" ? "FAILED" : status,
            planCode: parsed.fields.custom_str2,
            amountCents,
            token: parsed.fields.token,
            occurredAt: parsed.fields.occurred_at,
          },
        });
        book.subscriptions = applied.book.subscriptions;
        book.events = applied.book.events;
        book.orgs = applied.book.orgs;
        book.outbox = applied.book.outbox;
        return {
          ok: true,
          duplicate: applied.duplicate,
          provider: "payfast",
          providerEventId: parsed.fields.pf_payment_id,
          orgId: parsed.fields.custom_str1,
          status: applied.status,
          sandbox: true,
          charged: false,
          sendingEnabled: false,
          message: applied.duplicate ? "Duplicate PayFast ITN ignored." : "PayFast sandbox ITN applied. No charge was sent by this app.",
        };
      } catch (error) {
        return {
          ok: false,
          duplicate: false,
          provider: "payfast",
          providerEventId: parsed.fields.pf_payment_id || null,
          orgId: parsed.fields.custom_str1 || null,
          status: null,
          sandbox: true,
          charged: false,
          sendingEnabled: false,
          message: error instanceof Error ? error.message : "PayFast ITN was rejected.",
        };
      }
    },
    cancel(sub: OrgSubscription): ProviderCallResult {
      if (sub.provider !== "payfast") return callResult(false, "This subscription is not PayFast. No charge was sent.");
      const existing = book.subscriptions.find((item) => item.orgId === sub.orgId);
      if (existing) existing.status = "cancelled";
      return callResult(true, "Cancellation recorded in the sandbox book. PayFast was not called.", sub.providerToken);
    },
    chargeAdhoc(sub: OrgSubscription, cents: number): ProviderCallResult {
      if (!isBillingSandboxEnabled(env)) {
        return callResult(false, "Billing sandbox is off. No ad-hoc charge was sent.");
      }
      try {
        assertSandboxMerchant(env);
      } catch (error) {
        return callResult(false, error instanceof Error ? error.message : "Sandbox merchant check failed.");
      }
      if (cents <= 0) return callResult(false, "Ad-hoc amount must be a positive number of cents. No charge was sent.");
      if (!sub.providerToken) return callResult(false, "No PayFast subscription token. No charge was sent.");
      if (sub.status === "suspended" || sub.status === "cancelled") {
        return callResult(false, "This subscription cannot take an ad-hoc charge. No charge was sent.");
      }
      assertSandboxPaymentUrl(sandboxAdhocUrl(sub.providerToken));
      return callResult(
        true,
        "Sandbox ad-hoc charge was not sent to PayFast. Usage is stored as an invoice line.",
        `sandbox-adhoc-${sub.orgId}-${cents}`,
      );
    },
  };
}
