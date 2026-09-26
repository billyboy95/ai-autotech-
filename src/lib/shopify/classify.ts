export type ShopifyKind = "order" | "checkout" | "customer" | "ignore";

export type ShopifyClassification = {
  kind: ShopifyKind;
  shopifyId: string;
  email: string;
  totalCents: number;
  currency: string;
  financialStatus: string;
  stage: string;
  dealStatus: "open" | "won" | "lost";
  countsAsRevenue: boolean;
  abandoned: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function moneyToCents(value: unknown) {
  const amount = typeof value === "number" ? value : Number(text(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function classifyShopifyEvent(
  topic: string,
  payload: unknown,
  priorPaidOrders: number,
): ShopifyClassification | null {
  const body = asRecord(payload);
  const customer = asRecord(body.customer);
  const email = (text(body.email) || text(customer.email)).toLowerCase();
  const shopifyId = body.id === undefined || body.id === null ? "" : String(body.id);
  if (!shopifyId) return null;
  const currency = text(body.currency) || text(body.presentment_currency) || "ZAR";
  const totalCents = moneyToCents(body.total_price ?? body.total_price_set ?? body.subtotal_price ?? 0);
  const financialStatus = text(body.financial_status).toLowerCase();
  const paid = financialStatus === "paid" || financialStatus === "partially_paid" || financialStatus === "authorized";

  if (topic.startsWith("orders/")) {
    const repeat = priorPaidOrders > 0;
    return {
      kind: "order",
      shopifyId,
      email,
      totalCents,
      currency,
      financialStatus,
      stage: repeat ? "Repeat customer" : "Customer",
      dealStatus: paid ? "won" : "open",
      countsAsRevenue: paid,
      abandoned: false,
    };
  }

  if (topic.startsWith("checkouts/")) {
    if (body.completed_at) return null;
    return {
      kind: "checkout",
      shopifyId,
      email,
      totalCents,
      currency,
      financialStatus: "",
      stage: "Cart abandoned",
      dealStatus: "open",
      countsAsRevenue: false,
      abandoned: true,
    };
  }

  if (topic.startsWith("customers/")) {
    return {
      kind: "customer",
      shopifyId,
      email,
      totalCents: 0,
      currency,
      financialStatus: "",
      stage: "Subscriber",
      dealStatus: "open",
      countsAsRevenue: false,
      abandoned: false,
    };
  }

  return null;
}
