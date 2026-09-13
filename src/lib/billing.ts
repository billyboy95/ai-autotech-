import { getCurrentOrganizationId } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export type OrganizationSubscription = {
  organization_id: string;
  status: string;
  plan_code: string | null;
  stripe_price_id: string | null;
  current_period_end: string | null;
};

export function hasActiveSubscription(status: string | null | undefined) {
  return status ? ACTIVE_SUBSCRIPTION_STATUSES.has(status) : false;
}

export async function getOrganizationSubscription() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("organization_id, status, plan_code, stripe_price_id, current_period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return (data as OrganizationSubscription | null) ?? null;
}

export async function getFeatureGate(_feature: "documents" | "pdfs") {
  void _feature;

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return { allowed: true, reason: null, subscription: null as OrganizationSubscription | null };
  }

  const subscription = await getOrganizationSubscription();
  const allowed = hasActiveSubscription(subscription?.status);

  return {
    allowed,
    reason: allowed ? null : "Start or reactivate a subscription to access this feature.",
    subscription,
  };
}
