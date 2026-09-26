import { classifyShopifyEvent, type ShopifyClassification } from "@/lib/shopify/classify";
import { verifyShopifyHmac } from "@/lib/shopify/hmac";
import { missingTenantTable, parseSettings } from "@/lib/tenant/rows";
import { lookupRow, withOrg } from "@/server/workers/with-org";

export type WebhookResult = {
  status: number;
  body: { ok: boolean; error?: string; workspace?: string; stage?: string; revenue?: boolean };
};

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
  const found = await lookupRow("workspace_shopify_stores", "myshopify_domain", shop, "id, org_id");
  if (!found.configured) {
    return { status: 503, body: { ok: false, error: "Shopify webhook storage is not configured. No Shopify API was called." } };
  }
  if (found.error) {
    if (missingTenantTable(found.error)) {
      return { status: 503, body: { ok: false, error: "Apply the Zentrix Shopify migration before accepting webhooks." } };
    }
    throw new Error(found.error.message);
  }
  const store = found.data as { id?: string; org_id?: string } | null;
  if (!store?.id || !store.org_id) {
    return { status: 404, body: { ok: false, error: "No workspace store uses that myshopify domain." } };
  }
  const org = await withOrg(String(store.org_id), "id").from("organizations").select("slug, settings").maybeSingle();
  if (org.error) throw new Error(org.error.message);
  const orgRow = (org.data ?? {}) as { slug?: string; settings?: unknown };
  const secret = parseSettings(orgRow.settings).shopify.webhookSecret;
  if (!secret) {
    return {
      status: 401,
      body: { ok: false, error: "Shopify webhook secret is not set for this workspace. No Shopify API was called." },
    };
  }
  if (!verifyShopifyHmac(input.raw, input.hmac, secret)) {
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
  const prior = await priorPaidOrders(String(store.org_id), email.toLowerCase(), id);
  const event = classifyShopifyEvent(input.topic, payload, prior);
  if (!event) return { status: 200, body: { ok: true, workspace: String(orgRow.slug ?? "") } };
  await writeEvent(String(store.org_id), String(store.id), event);
  return { status: 200, body: { ok: true, workspace: String(orgRow.slug ?? ""), stage: event.stage, revenue: event.countsAsRevenue } };
}

async function priorPaidOrders(orgId: string, email: string, shopifyId: string) {
  if (!email) return 0;
  const { data, error } = await withOrg(orgId)
    .from("workspace_shopify_orders")
    .select("id")
    .eq("email", email)
    .eq("counts_as_revenue", true)
    .neq("shopify_id", shopifyId);
  if (error) return 0;
  return (data ?? []).length;
}

async function stageId(orgId: string, name: string) {
  const { data } = await withOrg(orgId).from("workspace_pipeline_stages").select("id, pipeline_id").eq("name", name).maybeSingle();
  const row = data as unknown as { id?: string; pipeline_id?: string } | null;
  return row?.id ? { id: String(row.id), pipelineId: String(row.pipeline_id) } : null;
}

async function writeEvent(orgId: string, storeId: string, event: ShopifyClassification) {
  const scope = withOrg(orgId);
  if (event.kind === "order") {
    const saved = await scope.from("workspace_shopify_orders").upsert(
      {
        store_id: storeId,
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
    const saved = await scope.from("workspace_shopify_checkouts").upsert(
      {
        store_id: storeId,
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
    const saved = await scope.from("workspace_shopify_customers").upsert(
      {
        store_id: storeId,
        shopify_id: event.shopifyId,
        email: event.email,
      },
      { onConflict: "org_id,shopify_id" },
    );
    if (saved.error) throw new Error(saved.error.message);
  }
  const stage = await stageId(orgId, event.stage);
  const deal = await scope.from("workspace_deals").upsert(
    {
      pipeline_id: stage?.pipelineId ?? null,
      stage_id: stage?.id ?? null,
      title: event.email || `${event.kind} ${event.shopifyId}`,
      amount_cents: event.dealStatus === "open" ? event.totalCents : 0,
      status: event.dealStatus,
      external_key: `shopify:${event.kind}:${event.shopifyId}`,
    },
    { onConflict: "org_id,external_key" },
  );
  if (deal.error) throw new Error(deal.error.message);
}
