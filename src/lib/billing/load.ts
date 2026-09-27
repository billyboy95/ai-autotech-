import { isBillingSandboxEnabled, mockItnAllowed } from "@/lib/billing/flag";
import { billingBanner } from "@/lib/billing/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAgencyRole, type MembershipRole } from "@/lib/tenant/types";

export type BillingPlanView = {
  code: string;
  name: string;
  priceCents: number;
  interval: string;
};

export type BillingSubscriptionView = {
  status: string;
  planCode: string;
  provider: string;
  pastDueAt: string | null;
  currentPeriodEnd: string | null;
};

export type BillingPageModel = {
  orgId: string | null;
  orgName: string;
  slug: string;
  email: string;
  canManage: boolean;
  sandboxEnabled: boolean;
  mockItn: boolean;
  plans: BillingPlanView[];
  subscription: BillingSubscriptionView | null;
  usageLines: { meter: string; quantity: number; amountCents: number }[];
  usageTotalCents: number;
  readOnly: boolean;
  notice: string | null;
};

function missingRelation(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find");
}

function monthWindow(now = new Date()) {
  const label = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month] = label.split("-");
  const from = `${year}-${month}-01T00:00:00+02:00`;
  const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
  const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
  const to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+02:00`;
  return { from, to };
}

export async function loadBillingNote(orgId: string) {
  if (!orgId || orgId.startsWith("preview-")) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("org_subscriptions").select("status").eq("org_id", orgId).maybeSingle();
  if (error || !data?.status) return null;
  return billingBanner(String(data.status));
}

export async function loadBillingPage(input: {
  orgId: string | null;
  orgName: string;
  slug: string;
  email: string;
  role: MembershipRole | null;
  preview?: boolean;
}): Promise<BillingPageModel> {
  const canManage = input.role === "client_admin" || isAgencyRole(input.role);
  const base: BillingPageModel = {
    orgId: input.orgId,
    orgName: input.orgName,
    slug: input.slug,
    email: input.email,
    canManage,
    sandboxEnabled: isBillingSandboxEnabled(),
    mockItn: mockItnAllowed(),
    plans: [],
    subscription: null,
    usageLines: [],
    usageTotalCents: 0,
    readOnly: false,
    notice: input.preview ? "Preview only. Billing saves after the phase 2f migration is applied." : null,
  };
  if (!input.orgId || input.preview) return base;

  const supabase = await createSupabaseServerClient();
  const [plans, subscription] = await Promise.all([
    supabase.from("plans").select("code, name, price_cents, interval").order("price_cents"),
    supabase.from("org_subscriptions").select("status, plan_code, provider, past_due_at, current_period_end").eq("org_id", input.orgId).maybeSingle(),
  ]);
  if (plans.error && missingRelation(plans.error)) {
    return { ...base, notice: "Billing tables are not in this database yet. Apply step 13 in supabase/APPLY-ORDER.md. No charge was sent." };
  }
  if (!plans.error) {
    base.plans = (plans.data ?? []).map((row) => ({
      code: String(row.code),
      name: String(row.name),
      priceCents: Number(row.price_cents),
      interval: String(row.interval),
    }));
  }
  if (!subscription.error && subscription.data) {
    base.subscription = {
      status: String(subscription.data.status),
      planCode: String(subscription.data.plan_code),
      provider: String(subscription.data.provider),
      pastDueAt: subscription.data.past_due_at ? String(subscription.data.past_due_at) : null,
      currentPeriodEnd: subscription.data.current_period_end ? String(subscription.data.current_period_end) : null,
    };
    base.readOnly = base.subscription.status === "suspended";
  }
  if (canManage) {
    const window = monthWindow();
    const usage = await supabase.rpc("workspace_usage_report", {
      p_org: input.orgId,
      p_from: window.from,
      p_to: window.to,
    });
    if (!usage.error && Array.isArray(usage.data)) {
      base.usageLines = usage.data.map((row: { meter?: string; quantity?: number; amount_cents?: number }) => ({
        meter: String(row.meter || ""),
        quantity: Number(row.quantity || 0),
        amountCents: Number(row.amount_cents || 0),
      }));
      base.usageTotalCents = base.usageLines.reduce((sum, line) => sum + line.amountCents, 0);
    }
  }
  return base;
}
