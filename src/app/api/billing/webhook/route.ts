import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook signature." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ received: true, warning: "Supabase admin client not configured." });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const object = event.data.object as {
      id: string;
      customer?: string;
      subscription?: string;
      status?: string;
      metadata?: { organization_id?: string };
      current_period_end?: number;
    };

    const organizationId = object.metadata?.organization_id;

    if (organizationId) {
      await supabase.from("subscriptions").upsert(
        {
          organization_id: organizationId,
          stripe_customer_id: typeof object.customer === "string" ? object.customer : null,
          stripe_subscription_id:
            typeof object.subscription === "string" ? object.subscription : object.id,
          status: object.status ?? "active",
          current_period_end: object.current_period_end
            ? new Date(object.current_period_end * 1000).toISOString()
            : null,
        },
        { onConflict: "organization_id" },
      );
    }
  }

  return NextResponse.json({ received: true });
}
