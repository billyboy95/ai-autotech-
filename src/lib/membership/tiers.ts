import { AGENT_TIERS, PLATFORM_FEE_CENTS, PRICES_EXCLUDE_VAT } from "@/lib/pricing/price-sheet";

/**
 * Published AIOS prices from the live site.
 * Platform R299/mo. Agents from R699/mo. VAT excluded.
 * These are not service-catalogue placeholders.
 */
export const MEMBERSHIP_TIERS = [
  {
    code: "platform",
    name: "Platform",
    priceCents: PLATFORM_FEE_CENTS,
    summary: "CRM, Lead Agent, and a small computer-time pool.",
  },
  {
    code: "agent_starter",
    name: "Agent Starter",
    priceCents: AGENT_TIERS.starter.cents,
    summary: "Agents from R699 per month. Starter includes 5 hours.",
  },
  {
    code: "agent_pro",
    name: "Agent Pro",
    priceCents: AGENT_TIERS.pro.cents,
    summary: "Pro agent. 12 hours.",
  },
  {
    code: "agent_always_on",
    name: "Agent Always-On",
    priceCents: AGENT_TIERS.always_on.cents,
    summary: "Always-On agent. 40 active hours.",
  },
] as const;

export type MembershipTierCode = (typeof MEMBERSHIP_TIERS)[number]["code"];

export const MEMBERSHIP_PRICES_EXCLUDE_VAT = PRICES_EXCLUDE_VAT;

export function membershipTier(code: string) {
  return MEMBERSHIP_TIERS.find((item) => item.code === code) ?? null;
}
