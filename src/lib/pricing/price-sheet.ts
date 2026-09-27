/**
 * Every rand amount, hour, and percent for the sandbox price sheet.
 * Placeholder until Billy signs off. Change prices here, then regenerate the SQL seed.
 */

export const PRICE_PLACEHOLDER = true as const;

/** R299/mo. Covers the CRM, the Lead Agent, and a 2-hour computer-time pool. */
export const PLATFORM_FEE_CENTS = 29_900;
export const PLATFORM_INCLUDED_HOURS = 2;

export const AGENT_TIERS = {
  starter: { label: "Starter", cents: 69_900, hours: 5 },
  pro: { label: "Pro", cents: 149_900, hours: 12 },
  always_on: { label: "Always-On", cents: 499_900, hours: 40 },
} as const;

export type AgentTier = keyof typeof AGENT_TIERS;

export const DEFAULT_AGENT_TIER: AgentTier = "starter";

/** Department default. A slug in AGENT_TIER_OVERRIDE wins. */
export const DEPARTMENT_TIER: Record<string, AgentTier> = {
  sales: "pro",
  ads: "pro",
  content: "pro",
};

export const AGENT_TIER_OVERRIDE: Record<string, AgentTier> = {
  receptionist: "always_on",
  "support-replies": "always_on",
};

export const TOPUP_CENTS = 79_900;
export const TOPUP_HOURS = 10;
/** Claude/GPT-class models use the hour pool this many times faster. Bring your own key to skip that. */
export const PREMIUM_MODEL_MULTIPLIER = 2.5;
/** Placeholder percent on WhatsApp, SMS, and email sends. Not part of the monthly total. */
export const SEND_MARKUP_PERCENT = 0;
/** Placeholder once-off fee. Per-template overrides replace this. Not part of the monthly total. */
export const DEFAULT_SETUP_FEE_CENTS = 0;
export const SETUP_FEE_BY_TEMPLATE: Record<string, number> = {};

export function tierForAgent(slug: string, department: string): AgentTier {
  return AGENT_TIER_OVERRIDE[slug] ?? DEPARTMENT_TIER[department] ?? DEFAULT_AGENT_TIER;
}

export function tierPriceCents(tier: AgentTier) {
  return AGENT_TIERS[tier].cents;
}

export function tierHours(tier: AgentTier) {
  return AGENT_TIERS[tier].hours;
}

export function agentMonthlyCents(slug: string, department: string) {
  return tierPriceCents(tierForAgent(slug, department));
}

export function agentIncludedHours(slug: string, department: string) {
  return tierHours(tierForAgent(slug, department));
}

/** 10% for 3–4 agents, 15% for 5–9, 20% for 10+. One or two agents stay full price. Hours are pooled, not discounted. */
export const TEAM_DISCOUNT_BANDS = [
  { key: "discount_3", minAgents: 3, percent: 10 },
  { key: "discount_5", minAgents: 5, percent: 15 },
  { key: "discount_10", minAgents: 10, percent: 20 },
] as const;

export function teamDiscountPercent(agentCount: number) {
  let percent = 0;
  for (const band of TEAM_DISCOUNT_BANDS) {
    if (agentCount >= band.minAgents) percent = band.percent;
  }
  return percent;
}

export function setupFeeCents(templateSlug: string) {
  return SETUP_FEE_BY_TEMPLATE[templateSlug] ?? DEFAULT_SETUP_FEE_CENTS;
}

export type PricedAgent = { cents: number; hours: number };

/**
 * One monthly total: platform fee + agent prices − team discount.
 * Top-up, model multiplier, send markup, and the setup fee stay outside that total.
 */
export function quoteAgents(agents: PricedAgent[], templateSlug = "") {
  const agentCount = agents.length;
  const agentSubtotalCents = agents.reduce((sum, agent) => sum + agent.cents, 0);
  const discountPercent = teamDiscountPercent(agentCount);
  const savingCents = Math.round((agentSubtotalCents * discountPercent) / 100);
  const agentTotalCents = agentSubtotalCents - savingCents;
  const platformFeeCents = PLATFORM_FEE_CENTS;
  const pooledHours = PLATFORM_INCLUDED_HOURS + agents.reduce((sum, agent) => sum + agent.hours, 0);
  return {
    agentCount,
    agentSubtotalCents,
    discountPercent,
    savingCents,
    agentTotalCents,
    platformFeeCents,
    monthlyTotalCents: platformFeeCents + agentTotalCents,
    pooledHours,
    setupFeeCents: setupFeeCents(templateSlug),
    topupCents: TOPUP_CENTS,
    topupHours: TOPUP_HOURS,
    premiumModelMultiplier: PREMIUM_MODEL_MULTIPLIER,
    sendMarkupPercent: SEND_MARKUP_PERCENT,
    pricePlaceholder: PRICE_PLACEHOLDER,
    currency: "ZAR" as const,
  };
}
