"use server";

import { redirect } from "next/navigation";
import { getCurrentOrganizationId } from "@/lib/organization";
import { getStripe } from "@/lib/stripe";

export type BillingActionState = {
  ok: boolean;
  message: string;
};

export async function createCheckoutSession(
  _state: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const stripe = getStripe();
  const priceId = String(formData.get("price_id") ?? process.env.STRIPE_PRICE_ID ?? "");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!stripe || !priceId) {
    return { ok: false, message: "Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID before starting checkout." };
  }

  const organizationId = await getCurrentOrganizationId();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/command-centre?billing=success`,
    cancel_url: `${siteUrl}/command-centre?billing=cancelled`,
    metadata: {
      organization_id: organizationId ?? "",
    },
  });

  if (!session.url) {
    return { ok: false, message: "Stripe did not return a checkout URL." };
  }

  redirect(session.url);
}
