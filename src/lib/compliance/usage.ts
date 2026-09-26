export const USAGE_METERS = ["sms", "wa_marketing", "wa_utility", "wa_service", "email", "ai_tokens"] as const;
export type UsageMeter = (typeof USAGE_METERS)[number];

/** ZAR cents. Matches the seeded agency rate card. */
export const DEFAULT_UNIT_COST_CENTS: Record<UsageMeter, number> = {
  sms: 18,
  wa_marketing: 66,
  wa_utility: 13,
  wa_service: 13,
  email: 1,
  ai_tokens: 0,
};

export type RateCard = {
  orgId: string | null;
  meter: UsageMeter;
  unitCostCents: number;
  markupMultiplier: number;
};

export type UsageEntry = {
  meter: UsageMeter;
  quantity: number;
  unitCostCents: number;
  unitPriceCents: number;
  costCents: number;
  sourceType: string;
  sourceId: string;
};

export function meterForSend(channel: string, purpose: string) {
  if (channel === "sms") return "sms" as const;
  if (channel === "email") return "email" as const;
  if (channel === "whatsapp" || channel === "facebook" || channel === "instagram") {
    if (purpose === "marketing" || purpose === "consent_request") return "wa_marketing" as const;
    return "wa_service" as const;
  }
  return "email" as const;
}

export function rateFor(cards: RateCard[], orgId: string | null, meter: UsageMeter) {
  const specific = orgId ? cards.find((card) => card.orgId === orgId && card.meter === meter) : undefined;
  const fallback = cards.find((card) => card.orgId == null && card.meter === meter);
  const card = specific ?? fallback;
  const unitCostCents = card?.unitCostCents ?? DEFAULT_UNIT_COST_CENTS[meter];
  const markup = card?.markupMultiplier ?? 1;
  const unitPriceCents = Math.round(unitCostCents * markup);
  return { unitCostCents, unitPriceCents };
}

/** A held or blocked send still records the rate-card cost. Nothing is charged to a provider. */
export function usageForSend(input: {
  orgId?: string | null;
  channel: string;
  purpose: string;
  sourceId: string;
  cards?: RateCard[];
  quantity?: number;
  sourceType?: string;
}): UsageEntry {
  const meter = meterForSend(input.channel, input.purpose);
  const quantity = input.quantity ?? 1;
  const rate = rateFor(input.cards ?? [], input.orgId ?? null, meter);
  return {
    meter,
    quantity,
    unitCostCents: rate.unitCostCents,
    unitPriceCents: rate.unitPriceCents,
    costCents: rate.unitCostCents * quantity,
    sourceType: input.sourceType ?? "outbox",
    sourceId: input.sourceId,
  };
}
