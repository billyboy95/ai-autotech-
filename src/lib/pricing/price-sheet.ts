/**
 * CRM price sheet. Every rand amount, hour, and percent lives here.
 * All figures are ZAR and exclude VAT. Placeholder until Billy says publish.
 * Change prices here, then apply the next pricing migration. Do not edit older migration files.
 */

export const PRICE_PLACEHOLDER = true as const;
export const PRICES_EXCLUDE_VAT = true as const;
export const PRICE_CURRENCY = "ZAR" as const;

/** R299/mo. Covers the CRM, the Lead Agent, and a small computer-time pool. */
export const PLATFORM_FEE_CENTS = 29_900;
export const PLATFORM_INCLUDED_HOURS = 2;

export const AGENT_TIERS = {
  starter: { label: "Starter", cents: 69_900, hours: 5 },
  pro: { label: "Pro", cents: 149_900, hours: 12 },
  always_on: { label: "Always-On", cents: 499_900, hours: 40 },
} as const;

export type AgentTier = keyof typeof AGENT_TIERS;

/** Lead Agent sits on the platform fee. It is not billed as its own agent. */
export const INCLUDED_AGENT = {
  label: "Included",
  cents: 0,
  hours: 0,
  note: "Lead Agent is part of the platform fee and is not billed separately.",
} as const;

export type CatalogTier = AgentTier | "included";

export const DEFAULT_AGENT_TIER: AgentTier = "starter";

/** Department default. A slug in AGENT_TIER_OVERRIDE wins. */
export const DEPARTMENT_TIER: Record<string, AgentTier> = {
  sales: "pro",
  ads: "pro",
  content: "pro",
};

/**
 * Named catalogue rows Billy priced directly.
 * Inbound Lead is the Lead Agent (included). The others keep their tier.
 */
export const AGENT_TIER_OVERRIDE: Record<string, CatalogTier> = {
  "inbound-lead": "included",
  "outbound-sales": "pro",
  onboarding: "starter",
  ads: "pro",
  "social-posting": "starter",
  receptionist: "always_on",
  "support-replies": "always_on",
};

export const TOPUP_CENTS = 79_900;
export const TOPUP_HOURS = 10;

/** Claude/GPT-class models use the hour pool this many times faster. Bring your own key to skip that. */
export const PREMIUM_MODEL_MULTIPLIER = 2.5;
export const PREMIUM_MODEL_NOTE =
  "Premium models use the hour pool 2.5× faster. Bring your own key to skip that.";

/** WhatsApp, SMS, and email sends are billed at 1.5× provider cost. Not part of the monthly total. */
export const SEND_MARKUP_MULTIPLIER = 1.5;
export const SEND_MARKUP_PERCENT = Math.round((SEND_MARKUP_MULTIPLIER - 1) * 100);

/** Suggested once-off fees. Not part of the monthly total. */
export const SETUP_LINES = {
  quick_start: { key: "setup_quick_start", label: "Quick Start", cents: 250_000 },
  team_setup: { key: "setup_team_setup", label: "Team Setup", cents: 499_900 },
} as const;

export const DEFAULT_SETUP_FEE_CENTS = 0;
export const SETUP_FEE_BY_TEMPLATE: Record<string, number> = {};

/** Plans the billing screen and the plans table share. Legacy starter/growth/scale stay out. */
export const CRM_PLANS = [
  {
    code: "platform",
    name: "Platform",
    priceCents: PLATFORM_FEE_CENTS,
    interval: "month" as const,
    hours: PLATFORM_INCLUDED_HOURS,
  },
  {
    code: "agent_starter",
    name: "Agent Starter",
    priceCents: AGENT_TIERS.starter.cents,
    interval: "month" as const,
    hours: AGENT_TIERS.starter.hours,
  },
  {
    code: "agent_pro",
    name: "Agent Pro",
    priceCents: AGENT_TIERS.pro.cents,
    interval: "month" as const,
    hours: AGENT_TIERS.pro.hours,
  },
  {
    code: "agent_always_on",
    name: "Agent Always-On",
    priceCents: AGENT_TIERS.always_on.cents,
    interval: "month" as const,
    hours: AGENT_TIERS.always_on.hours,
  },
] as const;

export const LEGACY_PLAN_CODES = ["starter", "growth", "scale"] as const;

export function isLegacyPlanCode(code: string) {
  return (LEGACY_PLAN_CODES as readonly string[]).includes(code);
}

export function tierForAgent(slug: string, department: string): CatalogTier {
  return AGENT_TIER_OVERRIDE[slug] ?? DEPARTMENT_TIER[department] ?? DEFAULT_AGENT_TIER;
}

export function tierLabel(tier: string) {
  if (tier === "included") return INCLUDED_AGENT.label;
  if (tier in AGENT_TIERS) return AGENT_TIERS[tier as AgentTier].label;
  return tier;
}

export function tierPriceCents(tier: CatalogTier) {
  return tier === "included" ? INCLUDED_AGENT.cents : AGENT_TIERS[tier].cents;
}

export function tierHours(tier: CatalogTier) {
  return tier === "included" ? INCLUDED_AGENT.hours : AGENT_TIERS[tier].hours;
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

export function discountedAgentTotal(agentSubtotalCents: number, agentCount: number) {
  const discountPercent = teamDiscountPercent(agentCount);
  const savingCents = Math.round((agentSubtotalCents * discountPercent) / 100);
  return {
    discountPercent,
    savingCents,
    agentTotalCents: agentSubtotalCents - savingCents,
  };
}

export function setupFeeCents(templateSlug: string) {
  return SETUP_FEE_BY_TEMPLATE[templateSlug] ?? DEFAULT_SETUP_FEE_CENTS;
}

export type PricedAgent = { cents: number; hours: number };

/**
 * One monthly total: platform fee + agent prices − team discount.
 * An included Lead Agent counts toward the team size and adds R0.
 * Top-up, model multiplier, send markup, and the setup lines stay outside that total.
 */
export function quoteAgents(agents: PricedAgent[], templateSlug = "") {
  const agentCount = agents.length;
  const agentSubtotalCents = agents.reduce((sum, agent) => sum + agent.cents, 0);
  const discount = discountedAgentTotal(agentSubtotalCents, agentCount);
  const platformFeeCents = PLATFORM_FEE_CENTS;
  const pooledHours = PLATFORM_INCLUDED_HOURS + agents.reduce((sum, agent) => sum + agent.hours, 0);
  return {
    agentCount,
    agentSubtotalCents,
    discountPercent: discount.discountPercent,
    savingCents: discount.savingCents,
    agentTotalCents: discount.agentTotalCents,
    platformFeeCents,
    monthlyTotalCents: platformFeeCents + discount.agentTotalCents,
    pooledHours,
    setupFeeCents: setupFeeCents(templateSlug),
    setupLines: [
      { ...SETUP_LINES.quick_start },
      { ...SETUP_LINES.team_setup },
    ],
    topupCents: TOPUP_CENTS,
    topupHours: TOPUP_HOURS,
    premiumModelMultiplier: PREMIUM_MODEL_MULTIPLIER,
    premiumModelNote: PREMIUM_MODEL_NOTE,
    sendMarkupMultiplier: SEND_MARKUP_MULTIPLIER,
    sendMarkupPercent: SEND_MARKUP_PERCENT,
    pricePlaceholder: PRICE_PLACEHOLDER,
    pricesExcludeVat: PRICES_EXCLUDE_VAT,
    currency: PRICE_CURRENCY,
  };
}
