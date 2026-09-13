import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

type StripeMetadata = Record<string, string | undefined> | undefined;

type SubscriptionPayload = {
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id?: string | null;
  plan_code?: string | null;
  status: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  last_invoice_status?: string | null;
  updated_at: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asObject<T extends object>(value: unknown) {
  return typeof value === "object" && value !== null ? (value as T) : null;
}

async function resolveOrganizationId(
  supabase: SupabaseClient,
  metadata: StripeMetadata,
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
) {
  const fromMetadata = metadata?.organization_id;
  if (fromMetadata) {
    return fromMetadata;
  }

  const lookupColumn = stripeSubscriptionId ? "stripe_subscription_id" : stripeCustomerId ? "stripe_customer_id" : null;
  const lookupValue = stripeSubscriptionId ?? stripeCustomerId;

  if (!lookupColumn || !lookupValue) {
    return null;
  }

  const { data } = await supabase
    .from("subscriptions")
    .select("organization_id")
    .eq(lookupColumn, lookupValue)
    .maybeSingle();

  return data?.organization_id ?? null;
}

async function claimEvent(
  supabase: SupabaseClient,
  eventId: string,
  organizationId: string | null,
  eventType: string,
  payload: unknown,
) {
  const { error } = await supabase.from("billing_webhook_events").insert(
    {
      stripe_event_id: eventId,
      event_type: eventType,
      organization_id: organizationId,
      status: "processing",
      payload,
      processed_at: null,
    },
  );

  if (!error) {
    return { claimed: true as const };
  }

  if (error.code === "23505") {
    const { data: existing } = await supabase
      .from("billing_webhook_events")
      .select("status, created_at")
      .eq("stripe_event_id", eventId)
      .maybeSingle();

    if (existing?.status === "processed" || existing?.status === "ignored") {
      return { claimed: false as const };
    }

    const createdAt = existing?.created_at ? new Date(existing.created_at).getTime() : NaN;
    if (!Number.isNaN(createdAt) && Date.now() - createdAt < 60_000) {
      return { claimed: false as const };
    }

    const { data: reclaimed } = await supabase
      .from("billing_webhook_events")
      .update({
        status: "retrying",
        organization_id: organizationId,
        payload,
        processed_at: null,
      })
      .eq("stripe_event_id", eventId)
      .in("status", ["processing", "retrying"])
      .select("stripe_event_id");

    if (!reclaimed?.length) {
      return { claimed: false as const };
    }

    return { claimed: true as const };
  }

  throw new Error(error.message);
}

async function updateEventStatus(
  supabase: SupabaseClient,
  eventId: string,
  status: "processed" | "ignored",
  organizationId: string | null,
) {
  await supabase
    .from("billing_webhook_events")
    .update({
      status,
      organization_id: organizationId,
      processed_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", eventId);
}

async function upsertSubscription(supabase: SupabaseClient, payload: SubscriptionPayload) {
  await supabase.from("subscriptions").upsert(payload, { onConflict: "organization_id" });
}

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

  const payload = event;

  const object = event.data.object as {
    id: string;
    customer?: string | { id?: string };
    subscription?: string | { id?: string; items?: { data?: Array<{ price?: { id?: string } }> } };
    status?: string;
    metadata?: StripeMetadata;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
    payment_status?: string;
    lines?: { data?: Array<{ price?: { id?: string }; metadata?: StripeMetadata }> };
  };

  const customerObject = asObject<{ id?: string }>(object.customer);
  const subscriptionObject = asObject<{ id?: string; items?: { data?: Array<{ price?: { id?: string } }> } }>(
    object.subscription,
  );
  const stripeCustomerId = asString(object.customer) ?? customerObject?.id ?? null;
  const stripeSubscriptionId = asString(object.subscription) ?? subscriptionObject?.id ?? null;
  const organizationId = await resolveOrganizationId(
    supabase,
    object.metadata,
    stripeCustomerId,
    stripeSubscriptionId,
  );

  const claim = await claimEvent(supabase, event.id, organizationId, event.type, payload);
  if (!claim.claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      if (organizationId) {
        const { data: current } = await supabase
          .from("subscriptions")
          .select("status, current_period_end")
          .eq("organization_id", organizationId)
          .maybeSingle();
        const subscriptionDetails = stripeSubscriptionId
          ? ((await stripe.subscriptions.retrieve(stripeSubscriptionId)) as {
              status?: string;
              current_period_end?: number;
              items?: { data: Array<{ price?: { id?: string } }> };
            })
          : null;

        await upsertSubscription(supabase, {
          organization_id: organizationId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_price_id: subscriptionDetails?.items?.data[0]?.price?.id ?? null,
          plan_code: object.metadata?.plan_code ?? null,
          status: subscriptionDetails?.status ?? current?.status ?? "incomplete",
          current_period_end: subscriptionDetails?.current_period_end
            ? new Date(subscriptionDetails.current_period_end * 1000).toISOString()
            : current?.current_period_end ?? null,
          updated_at: new Date().toISOString(),
        });
      }
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      if (organizationId) {
        const { data: current } = await supabase
          .from("subscriptions")
          .select("status, plan_code, stripe_price_id, current_period_end, cancel_at_period_end")
          .eq("organization_id", organizationId)
          .maybeSingle();

        await upsertSubscription(supabase, {
          organization_id: organizationId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_price_id: current?.stripe_price_id ?? object.lines?.data?.[0]?.price?.id ?? null,
          plan_code: current?.plan_code ?? object.metadata?.plan_code ?? null,
          status: event.type === "invoice.paid" ? "active" : current?.status ?? "past_due",
          current_period_end: current?.current_period_end ?? null,
          cancel_at_period_end: Boolean(current?.cancel_at_period_end),
          last_invoice_status: event.type === "invoice.paid" ? "paid" : "payment_failed",
          updated_at: new Date().toISOString(),
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscriptionObject = event.data.object as {
        id: string;
        customer?: string | { id?: string };
        status?: string;
        metadata?: StripeMetadata;
        current_period_end?: number;
        cancel_at_period_end?: boolean;
        items?: { data?: Array<{ price?: { id?: string } }> };
      };

      if (organizationId) {
        const { data: current } = await supabase
          .from("subscriptions")
          .select("plan_code, last_invoice_status")
          .eq("organization_id", organizationId)
          .maybeSingle();

        await upsertSubscription(supabase, {
          organization_id: organizationId,
          stripe_customer_id:
            asString(subscriptionObject.customer) ??
            asObject<{ id?: string }>(subscriptionObject.customer)?.id ??
            null,
          stripe_subscription_id: subscriptionObject.id,
          stripe_price_id: subscriptionObject.items?.data?.[0]?.price?.id ?? null,
          plan_code: subscriptionObject.metadata?.plan_code ?? current?.plan_code ?? null,
          status: event.type === "customer.subscription.deleted" ? "canceled" : subscriptionObject.status ?? "active",
          current_period_end: subscriptionObject.current_period_end
            ? new Date(subscriptionObject.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: Boolean(subscriptionObject.cancel_at_period_end),
          last_invoice_status: current?.last_invoice_status ?? null,
          updated_at: new Date().toISOString(),
        });
      }
      break;
    }
    default: {
      await updateEventStatus(supabase, event.id, "ignored", organizationId);
      return NextResponse.json({ received: true, ignored: true });
    }
  }

  await updateEventStatus(supabase, event.id, "processed", organizationId);
  return NextResponse.json({ received: true });
}
