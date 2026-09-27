import { bundleBySlug } from "@/lib/bots/catalog";
import { DEFAULT_AUDIT_BUDGET_CENTS, recommendTeam, SETUP_CHANNELS, SETUP_GOALS, type SetupAnswers, type SetupChannel, type SetupGoal, type TeamRecommendation } from "@/lib/bots/recommend";
import { PRICES_EXCLUDE_VAT, teamDiscountPercent } from "@/lib/pricing/price-sheet";

/** `start_recommended_sandbox_team` accepts at most this many catalogue agents. */
export const SANDBOX_TEAM_MAX = 8;

export const PHASED_TEAM_COPY = /start with (these )?(3|three)\b/i;

export const LEAD_ONBOARDING_INTRO =
  "Tell me the niche, the goals, the channels, the hours, and the tools you already use. I recommend the full team for that niche, then I ask each agent's setup questions before the next one. The monthly estimate is ZAR excluding VAT and stays a placeholder. Start this team records a sandbox trial at the team discount. No charge is sent. After that trial, connect accounts and import contacts. Nothing is sent.";

export const ONBOARDING_NICHES: { label: string; business: string; templateSlug: string }[] = [
  { label: "Clinic", business: "clinic", templateSlug: "healthcare-clinic" },
  { label: "Clothing brand", business: "clothing brand", templateSlug: "fashion-brand" },
  { label: "Restaurant", business: "restaurant", templateSlug: "restaurant-food" },
  { label: "Real estate", business: "real estate", templateSlug: "real-estate" },
  { label: "School", business: "school", templateSlug: "education-school" },
  { label: "Salon", business: "salon", templateSlug: "beauty-salon" },
  { label: "Gym", business: "gym", templateSlug: "fitness-gym" },
  { label: "Legal", business: "legal", templateSlug: "legal-services" },
  { label: "Trades", business: "trades", templateSlug: "trades-home" },
  { label: "Automotive", business: "automotive", templateSlug: "automotive" },
  { label: "Ecommerce", business: "ecommerce", templateSlug: "ecommerce-store" },
  { label: "Consulting", business: "consulting", templateSlug: "agency-consulting" },
  { label: "Faceless YouTube", business: "faceless youtube", templateSlug: "faceless-youtube" },
  { label: "Facebook page", business: "facebook page", templateSlug: "facebook-community" },
  { label: "TikTok", business: "tiktok", templateSlug: "tiktok-reels" },
  { label: "Podcast", business: "podcast", templateSlug: "podcast" },
  { label: "Personal brand", business: "personal brand", templateSlug: "personal-brand" },
  { label: "AI agency", business: "ai agency", templateSlug: "ai-automation-agency" },
];

export const CHANNEL_LABELS: Record<SetupChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  phone: "Phone",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  website: "Website",
  "walk-in": "Walk-in",
};

export const GOAL_LABELS: Record<SetupGoal, string> = {
  leads: "Leads",
  sales: "Sales",
  content: "Content",
  admin: "Admin load",
};

export type BusinessProfile = {
  niche: string;
  goals: SetupGoal[];
  channels: SetupChannel[];
  hours: string;
  tools: string;
};

export type OnboardingQuote = {
  currency: "ZAR";
  pricesExcludeVat: true;
  pricePlaceholder: true;
  sandbox: true;
  charged: false;
  platformFeeCents: number;
  agentSubtotalCents: number;
  discountPercent: number;
  agentTotalCents: number;
  monthlyTotalCents: number;
};

export function profileToSetup(profile: BusinessProfile): SetupAnswers {
  return {
    business: profile.niche.trim() || "business",
    stage: "starting",
    budgetCents: DEFAULT_AUDIT_BUDGET_CENTS,
    goals: profile.goals.length ? profile.goals : ["leads"],
    teamSize: "6-20",
    channels: profile.channels,
  };
}

export function quoteForTeam(recommendation: TeamRecommendation): OnboardingQuote {
  return {
    currency: "ZAR",
    pricesExcludeVat: PRICES_EXCLUDE_VAT,
    pricePlaceholder: true,
    sandbox: true,
    charged: false,
    platformFeeCents: recommendation.platformFeeCents,
    agentSubtotalCents: recommendation.separateTotalCents,
    discountPercent: recommendation.savingPercent,
    agentTotalCents: recommendation.agentTotalCents,
    monthlyTotalCents: recommendation.monthlyPriceCents,
  };
}

/** The matched industry template, in full. A tiny budget does not drop agents. */
export function recommendFullTeam(profile: BusinessProfile): TeamRecommendation {
  const recommendation = recommendTeam(profileToSetup(profile));
  const expected = bundleBySlug(recommendation.templateSlug).botSlugs;
  if (recommendation.agents.map((agent) => agent.slug).join("\n") !== expected.join("\n")) {
    throw new Error("full team required");
  }
  if (recommendation.agents.length < 1 || recommendation.agents.length > SANDBOX_TEAM_MAX) {
    throw new Error("full team required");
  }
  if (recommendation.savingPercent !== teamDiscountPercent(recommendation.agents.length)) {
    throw new Error("team discount mismatch");
  }
  if (recommendation.pricePlaceholder !== true) {
    throw new Error("price placeholder required");
  }
  return recommendation;
}

export function parseBusinessProfile(value: unknown): BusinessProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const niche = typeof row.niche === "string" ? row.niche.trim().slice(0, 200) : "";
  if (!niche) return null;
  const goals = Array.isArray(row.goals)
    ? row.goals.filter((item): item is SetupGoal => typeof item === "string" && (SETUP_GOALS as readonly string[]).includes(item))
    : [];
  const channels = Array.isArray(row.channels)
    ? row.channels.filter((item): item is SetupChannel => typeof item === "string" && (SETUP_CHANNELS as readonly string[]).includes(item))
    : [];
  if (!goals.length || !channels.length) return null;
  const hours = typeof row.hours === "string" ? row.hours.trim().slice(0, 80) : "";
  const tools = typeof row.tools === "string" ? row.tools.trim().slice(0, 500) : "";
  return { niche, goals, channels, hours, tools };
}

export function parseAgentAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const answers: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[a-z0-9-]{1,40}$/.test(key) || typeof item !== "string") continue;
    const text = item.trim().slice(0, 500);
    if (text) answers[key] = text;
    if (Object.keys(answers).length >= 80) break;
  }
  return answers;
}
