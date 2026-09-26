import { withOrg } from "@/server/workers/with-org";

export async function recordStripeSubscription(input: {
  organizationId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: string | null;
}) {
  return withOrg(input.organizationId, "organization_id").from("subscriptions").upsert(
    {
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      status: input.status,
      current_period_end: input.currentPeriodEnd,
    },
    { onConflict: "organization_id" },
  );
}
