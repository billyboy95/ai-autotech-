import { NextResponse } from "next/server";
import { acceptShopifyWebhook } from "@/lib/shopify/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shopify webhook stub for orders, customers, and checkouts.
 * Point the shop's webhook at POST /api/shopify/webhook.
 * The handler records the event on the matching workspace store.
 * It does not call the Shopify Admin API.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const result = await acceptShopifyWebhook({
    raw,
    topic: request.headers.get("x-shopify-topic") ?? "",
    shopDomain: request.headers.get("x-shopify-shop-domain") ?? "",
    hmac: request.headers.get("x-shopify-hmac-sha256") ?? "",
  });
  return NextResponse.json(result.body, { status: result.status });
}
