import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { classifyShopifyEvent, type ShopifyClassification } from "@/lib/shopify/classify";
import { verifyShopifyHmac } from "@/lib/shopify/hmac";
import { missingTenantTable, parseSettings } from "@/lib/tenant/rows";

type StoreHit = {
  id: string;
  orgId: string;
  orgSlug: string;
  webhookSecret: string;
};

export type WebhookResult = {
  status: number;
  body: { ok: boolean; error?: string; workspace?: string; stage?: string; revenue?: boolean };
};

async function findStore(shopDomain: string): Promise<StoreHit | "missing-table" | "unconfigured" | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return "unconfigured";
  const { data, error } = await supabase
    .from("workspace_shopify_stores")
    .select("id, org_id, organizations(slug, settings)")
    .eq("myshopify_domain", shopDomain.toLowerCase())
    .maybeSingle();
  if (error) {
    if (missingTenantTable(error)) return "missing-table";
    throw new Error(error.message);
  }
  if (!data) return null;
  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  const settings = parseSettings(org?.settings);
  return {
    id: String(data.id),
    orgId: String(data.org_id),
    orgSlug: String(org?.slug ?? ""),
    webhookSecret: settings.shopify.webhookSecret,
  };
}

async function priorPaidOrders(orgId: string, email: string, shopifyId: string) {
  if (!email) return 0;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("workspace_shopify_orders")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("email", email)
    .eq("counts_as_revenue", true)
    .neq("shopify_id", shopifyId);
  if (error) return 0;
  return count ?? 0;
}

async function stageId(orgId: string, name: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("workspace_pipeline_stages")
    .select("id, pipeline_id")
    .eq("org_id", orgId)
    .eq("name", name)
    .maybeSingle();
  return data ? { id: String(data.id), pipelineId: String(data.pipeline_id) } : null;
}

async function writeDeal(orgId: string, event: ShopifyClassification) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  const stage = await stageId(orgId, event.stage);
  const externalKey = `shopify:${event.kind}:${event.shopifyId}`;
  await supabase.from("workspace_deals").upsert(
    {
      org_id: orgId,
      pipeline_id: stage?.pipelineId ?? null,
      stage_id: stage?.id ?? null,
      title: event.email || `${event.kind} ${event.shopifyId}`,
      amount_cents: event.dealStatus === "open" ? event.totalCents : 0,
      status: event.dealStatus,
      external_key: externalKey,
    },
    { onConflict: "org_id,external_key" },
  );
}

async function writeEvent(store: StoreHit, event: ShopifyClassification) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  if (event.kind === "order") {
    const saved = await supabase.from("workspace_shopify_orders").upsert(
      {
        org_id: store.orgId,
        store_id: store.id,
        shopify_id: event.shopifyId,
        email: event.email,
        total_cents: event.totalCents,
        currency: event.currency,
        financial_status: event.financialStatus,
        stage: event.stage,
        counts_as_revenue: event.countsAsRevenue,
      },
      { onConflict: "org_id,shopify_id" },
    );
    if (saved.error) throw new Error(saved.error.message);
  } else if (event.kind === "checkout") {
    const saved = await supabase.from("workspace_shopify_checkouts").upsert(
      {
        org_id: store.orgId,
        store_id: store.id,
        shopify_id: event.shopifyId,
        email: event.email,
        total_cents: event.totalCents,
        currency: event.currency,
        abandoned: event.abandoned,
      },
      { onConflict: "org_id,shopify_id" },
    );
    if (saved.error) throw new Error(saved.error.message);
  } else if (event.kind === "customer") {
    const saved = await supabase.from("workspace_shopify_customers").upsert(
      {
        org_id: store.orgId,
        store_id: store.id,
        shopify_id: event.shopifyId,
        email: event.email,
      },
      { onConflict: "org_id,shopify_id" },
    );
    if (saved.error) throw new Error(saved.error.message);
  }
  await writeDeal(store.orgId, event);
}

/**
 * Inbound Shopify webhook. Verifies HMAC with the workspace secret and writes
 * the order, customer, or checkout into that workspace. Does not call Shopify.
 */
export async function acceptShopifyWebhook(input: {
  raw: string;
  topic: string;
  shopDomain: string;
  hmac: string;
}): Promise<WebhookResult> {
  const shop = input.shopDomain.trim().toLowerCase();
  if (!shop || !input.topic) {
    return { status: 400, body: { ok: false, error: "Shopify topic and shop domain are required." } };
  }
  const store = await findStore(shop);
  if (store === "unconfigured") {
    return { status: 503, body: { ok: false, error: "Shopify webhook storage is not configured. No Shopify API was called." } };
  }
  if (store === "missing-table") {
    return { status: 503, body: { ok: false, error: "Apply the Zentrix Shopify migration before accepting webhooks." } };
  }
  if (!store) return { status: 404, body: { ok: false, error: "No workspace store uses that myshopify domain." } };
  if (!store.webhookSecret) {
    return {
      status: 401,
      body: { ok: false, error: "Shopify webhook secret is not set for this workspace. No Shopify API was called." },
    };
  }
  if (!verifyShopifyHmac(input.raw, input.hmac, store.webhookSecret)) {
    return { status: 401, body: { ok: false, error: "Invalid Shopify signature." } };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(input.raw);
  } catch {
    return { status: 400, body: { ok: false, error: "JSON body required." } };
  }
  const email = typeof payload === "object" && payload && "email" in payload ? String((payload as { email?: unknown }).email ?? "") : "";
  const id = typeof payload === "object" && payload && "id" in payload ? String((payload as { id?: unknown }).id ?? "") : "";
  const prior = await priorPaidOrders(store.orgId, email.toLowerCase(), id);
  const event = classifyShopifyEvent(input.topic, payload, prior);
  if (!event) return { status: 200, body: { ok: true, workspace: store.orgSlug } };
  await writeEvent(store, event);
  return { status: 200, body: { ok: true, workspace: store.orgSlug, stage: event.stage, revenue: event.countsAsRevenue } };
}
