import { emptyBook } from "@/lib/billing/book";
import { assertSandboxMerchant, isBillingSandboxEnabled } from "@/lib/billing/flag";
import { createPayfastProvider } from "@/lib/billing/payfast";
import type { CheckoutResult } from "@/lib/billing/types";
import { bundleBySlug, botBySlug, botsInBundle, type BotStatus } from "@/lib/bots/catalog";
import { allocateBundlePrice, assertBundleDiscount, lineAmountForBot } from "@/lib/bots/pricing";
import { PLATFORM_FEE_CENTS } from "@/lib/pricing/price-sheet";

export type BotBillingLine = {
  orgId: string;
  botSlug: string;
  bundleSlug: string | null;
  amountCents: number;
  currency: "ZAR";
  interval: "month";
  status: BotStatus;
  sandbox: true;
  charged: false;
  pricePlaceholder: true;
};

export type BotLedger = {
  subscriptions: { orgId: string }[];
  lines: BotBillingLine[];
};

const disabled = (message: string): CheckoutResult => ({
  provider: "payfast",
  sandbox: true,
  charged: false,
  mode: "disabled",
  actionUrl: null,
  fields: null,
  message,
});

function linesFor(orgId: string, botSlug: string | null, bundleSlug: string | null, status: BotStatus): BotBillingLine[] {
  if (bundleSlug) {
    const bundle = bundleBySlug(bundleSlug);
    const saving = assertBundleDiscount(bundle);
    return allocateBundlePrice(botsInBundle(bundle), saving.bundlePriceCents).map((share) => ({
      orgId,
      botSlug: share.slug,
      bundleSlug,
      amountCents: share.amountCents,
      currency: "ZAR",
      interval: "month",
      status,
      sandbox: true,
      charged: false,
      pricePlaceholder: true,
    }));
  }
  if (!botSlug) throw new Error("bot or bundle required");
  botBySlug(botSlug);
  return [{
    orgId,
    botSlug,
    bundleSlug: null,
    amountCents: lineAmountForBot(botSlug, null),
    currency: "ZAR",
    interval: "month",
    status,
    sandbox: true,
    charged: false,
    pricePlaceholder: true,
  }];
}

/**
 * Sandbox checkout for one bot or a team bundle.
 * The PayFast provider is the only checkout path. charged stays false.
 * org_subscriptions is not given a second row.
 */
export function openBotCheckout(input: {
  orgId: string;
  orgName: string;
  email?: string;
  botSlug?: string | null;
  bundleSlug?: string | null;
  intent: "trial" | "buy";
  env?: NodeJS.ProcessEnv;
}): { checkout: CheckoutResult; lines: BotBillingLine[] } {
  const env = input.env ?? process.env;
  if (!isBillingSandboxEnabled(env)) {
    return {
      checkout: disabled("Billing sandbox is off. Set BILLING_SANDBOX=true. No charge was sent."),
      lines: [],
    };
  }
  try {
    assertSandboxMerchant(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refusing a non-sandbox merchant. No charge was sent.";
    return { checkout: disabled(message), lines: [] };
  }

  const code = input.bundleSlug || input.botSlug || "bot";
  const name = input.bundleSlug ? bundleBySlug(input.bundleSlug).name : botBySlug(input.botSlug || "").name;
  const priced = linesFor(input.orgId, input.botSlug ?? null, input.bundleSlug ?? null, input.intent === "trial" ? "trial" : "active");
  const amountCents = priced.reduce((sum, line) => sum + line.amountCents, 0) + PLATFORM_FEE_CENTS;
  const checkout = createPayfastProvider(emptyBook(), env).createCheckout(
    { id: input.orgId, name: input.orgName, email: input.email, slug: code },
    { code, name, priceCents: amountCents, interval: "month", currency: "ZAR" },
  );
  if (checkout.sandbox !== true || checkout.charged !== false) {
    return { checkout: disabled("Checkout left the sandbox. No charge was sent."), lines: [] };
  }
  if (input.intent === "buy" && checkout.mode !== "form") {
    return { checkout, lines: [] };
  }
  return { checkout, lines: priced };
}

export function addSandboxBotLines(ledger: BotLedger, lines: BotBillingLine[]): BotLedger {
  const seen = new Set<string>();
  for (const sub of ledger.subscriptions) {
    if (seen.has(sub.orgId)) throw new Error("org_subscriptions stays one row per org");
    seen.add(sub.orgId);
  }
  const next = lines.reduce((current, line) => {
    if (line.sandbox !== true || line.charged !== false || line.currency !== "ZAR") {
      throw new Error("bot billing lines stay sandbox ZAR and are not charged");
    }
    const index = current.findIndex((item) => item.orgId === line.orgId && item.botSlug === line.botSlug);
    if (index === -1) return [...current, line];
    const existing = current[index];
    const updated = existing.status === "trial" ? { ...existing, amountCents: line.amountCents, bundleSlug: line.bundleSlug ?? existing.bundleSlug } : existing;
    return current.map((item, itemIndex) => (itemIndex === index ? updated : item));
  }, ledger.lines);
  return { subscriptions: ledger.subscriptions, lines: next };
}
