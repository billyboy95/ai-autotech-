import { botsInBundle, bundleBySlug, templateBySlug, type CatalogBot } from "@/lib/bots/catalog";
import { DEPARTMENT_LABELS, type AgentDepartment } from "@/lib/bots/catalog-data";

export const SETUP_STAGES = ["idea", "starting", "running"] as const;
export type SetupStage = (typeof SETUP_STAGES)[number];

export const SETUP_GOALS = ["leads", "sales", "content", "admin"] as const;
export type SetupGoal = (typeof SETUP_GOALS)[number];

export const SETUP_TEAM_SIZES = ["solo", "2-5", "6-20", "20+"] as const;
export type SetupTeamSize = (typeof SETUP_TEAM_SIZES)[number];

export const SETUP_CHANNELS = [
  "whatsapp",
  "email",
  "phone",
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "website",
  "walk-in",
] as const;
export type SetupChannel = (typeof SETUP_CHANNELS)[number];

/** Answers from the Lead Agent interview. Free text stays in `business` and is only used to pick a template. */
export type SetupAnswers = {
  business: string;
  stage: SetupStage;
  budgetCents: number;
  goals: SetupGoal[];
  teamSize: SetupTeamSize;
  channels: SetupChannel[];
};

export type RecommendedAgent = {
  slug: string;
  name: string;
  department: string;
  why: string;
  monthlyPriceCents: number;
};

export type TeamRecommendation = {
  templateSlug: string;
  templateName: string;
  agents: RecommendedAgent[];
  separateTotalCents: number;
  monthlyPriceCents: number;
  savingCents: number;
  savingPercent: number;
  currency: "ZAR";
  pricePlaceholder: true;
};

export type AuditRecommendationInput = {
  industry?: string;
  answers?: Record<string, unknown>;
  recommendedAgents?: { department?: string; agent?: string; count?: number }[];
  companySize?: string;
};

/** Used when an audit does not include a monthly budget. The full team is still recommended. */
export const DEFAULT_AUDIT_BUDGET_CENTS = 500_000;

const TEMPLATE_MATCHES: { slug: string; needles: string[] }[] = [
  { slug: "faceless-youtube", needles: ["faceless youtube", "youtube"] },
  { slug: "facebook-community", needles: ["facebook"] },
  { slug: "tiktok-reels", needles: ["tiktok", "reels"] },
  { slug: "podcast", needles: ["podcast"] },
  { slug: "personal-brand", needles: ["personal brand", "founder-led", "founder"] },
  { slug: "ai-automation-agency", needles: ["automation agency", "ai agency", "aiautotech"] },
  { slug: "healthcare-clinic", needles: ["clinic", "healthcare", "dental", "medical", "patient"] },
  { slug: "fashion-brand", needles: ["clothing", "fashion", "apparel"] },
  { slug: "restaurant-food", needles: ["restaurant", "cafe", "food"] },
  { slug: "real-estate", needles: ["real estate", "property", "realtor"] },
  { slug: "education-school", needles: ["school", "education", "academy", "admissions"] },
  { slug: "beauty-salon", needles: ["salon", "spa", "beauty"] },
  { slug: "fitness-gym", needles: ["gym", "fitness"] },
  { slug: "legal-services", needles: ["legal", "lawyer", "attorney", "accountant"] },
  { slug: "trades-home", needles: ["plumb", "electric", "trades", "home service"] },
  { slug: "automotive", needles: ["automotive", "mechanic", "workshop", "car "] },
  { slug: "ecommerce-store", needles: ["ecommerce", "online store", "shopify"] },
  { slug: "agency-consulting", needles: ["consulting", "agency"] },
];

const GOAL_WORDS: Record<SetupGoal, string[]> = {
  leads: ["lead", "enquiry", "inquiry", "booking"],
  sales: ["sale", "revenue", "deal"],
  content: ["content", "video", "youtube", "social", "post", "podcast", "tiktok"],
  admin: ["admin", "inbox", "paperwork", "ops", "operation", "manual", "reminder"],
};

const GOAL_DEPARTMENTS: Record<SetupGoal, AgentDepartment[]> = {
  leads: ["sales", "booking", "ads"],
  sales: ["sales", "ecommerce", "ads"],
  content: ["content", "social", "branding", "ads"],
  admin: ["admin", "operations", "finance", "booking", "onboarding"],
};

export function teamPrice(amounts: number[]) {
  const separateTotalCents = amounts.reduce((sum, amount) => sum + amount, 0);
  if (amounts.length <= 1) {
    return { separateTotalCents, monthlyPriceCents: separateTotalCents, savingCents: 0, savingPercent: 0 };
  }
  const savingCents = Math.round(separateTotalCents * 0.2);
  const monthlyPriceCents = separateTotalCents - savingCents;
  const savingPercent = separateTotalCents === 0 ? 0 : Math.round((savingCents * 100) / separateTotalCents);
  return { separateTotalCents, monthlyPriceCents, savingCents, savingPercent };
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "";
  if (Array.isArray(value)) return value.map((item) => textOf(item)).filter(Boolean).join(" ");
  return "";
}

function parseBudgetCents(value: unknown) {
  const raw = textOf(value).replace(/[^\d.]/g, "");
  if (!raw) return DEFAULT_AUDIT_BUDGET_CENTS;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return DEFAULT_AUDIT_BUDGET_CENTS;
  if (amount >= 100_000) return Math.round(amount);
  return Math.round(amount * 100);
}

function parseStage(value: string): SetupStage {
  const text = value.toLowerCase();
  if (text.includes("idea")) return "idea";
  if (text.includes("start")) return "starting";
  return "running";
}

function parseTeamSize(value: string): SetupTeamSize {
  const text = value.toLowerCase();
  if (text.includes("solo") || text === "1" || text.includes("just me")) return "solo";
  const digits = Number(text.replace(/[^\d]/g, ""));
  if (Number.isFinite(digits) && digits > 0) {
    if (digits <= 1) return "solo";
    if (digits <= 5) return "2-5";
    if (digits <= 20) return "6-20";
    return "20+";
  }
  if (text.includes("20")) return "20+";
  if (text.includes("6")) return "6-20";
  return "2-5";
}

function parseChannels(blob: string): SetupChannel[] {
  return SETUP_CHANNELS.filter((channel) => blob.includes(channel));
}

function parseGoals(blob: string): SetupGoal[] {
  const goals = SETUP_GOALS.filter((goal) => GOAL_WORDS[goal].some((word) => blob.includes(word)));
  return goals.length ? goals : ["leads"];
}

/** Maps a public audit payload onto the Lead Agent interview. Ignores name, email, phone, and company. */
export function auditToSetup(input: AuditRecommendationInput): SetupAnswers {
  const answers = input.answers ?? {};
  const agentBlob = (input.recommendedAgents ?? []).map((agent) => `${agent.department ?? ""} ${agent.agent ?? ""}`).join(" ");
  const blob = [
    input.industry,
    textOf(answers.business),
    textOf(answers.businessType),
    textOf(answers.industry),
    textOf(answers.goal),
    textOf(answers.goals),
    textOf(answers.pain),
    textOf(answers.channels),
    textOf(answers.stage),
    agentBlob,
  ].join(" ").toLowerCase();
  const business = [input.industry, textOf(answers.businessType), textOf(answers.business), textOf(answers.industry)]
    .map((item) => (item ?? "").trim())
    .filter(Boolean)
    .join(" ") || "business";
  return {
    business,
    stage: parseStage(textOf(answers.stage || answers.businessStage)),
    budgetCents: parseBudgetCents(answers.budget ?? answers.budgetZar ?? answers.monthlyBudget ?? answers.budgetPerMonth),
    goals: parseGoals(blob),
    teamSize: parseTeamSize(textOf(answers.teamSize) || input.companySize || ""),
    channels: parseChannels(blob),
  };
}

function departmentScore(department: string, goals: SetupGoal[]) {
  return goals.reduce((sum, goal) => sum + (GOAL_DEPARTMENTS[goal].includes(department as AgentDepartment) ? 3 : 0), 0);
}

function matchTemplate(business: string) {
  const text = ` ${business.toLowerCase()} `;
  return TEMPLATE_MATCHES.find((rule) => rule.needles.some((needle) => text.includes(needle)))?.slug ?? null;
}

function fallbackTemplate(answers: SetupAnswers) {
  const ranked = TEMPLATE_MATCHES.map((rule) => {
    const bots = botsInBundle(bundleBySlug(rule.slug));
    const score = bots.reduce((sum, bot) => sum + departmentScore(bot.department, answers.goals), 0);
    return { slug: rule.slug, score };
  }).sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug));
  return ranked[0]?.slug ?? "healthcare-clinic";
}

function whyFor(bot: CatalogBot, templateName: string) {
  const department = DEPARTMENT_LABELS[bot.department as AgentDepartment] ?? bot.department;
  return `${bot.name} covers ${department.toLowerCase()} on the ${templateName} team. ${bot.description}`;
}

function toAgent(bot: CatalogBot, templateName: string): RecommendedAgent {
  return {
    slug: bot.slug,
    name: bot.name,
    department: bot.department,
    why: whyFor(bot, templateName),
    monthlyPriceCents: bot.monthlyPriceCents,
  };
}

/**
 * The full team for the matched business. Rules only: no model call.
 * Every agent in the template is included. Nothing is held back for later.
 */
export function recommendTeam(answers: SetupAnswers): TeamRecommendation {
  const templateSlug = matchTemplate(answers.business) ?? fallbackTemplate(answers);
  const template = templateBySlug(templateSlug);
  const bundle = bundleBySlug(templateSlug);
  const bots = botsInBundle(bundle);
  const price = teamPrice(bots.map((bot) => bot.monthlyPriceCents));
  return {
    templateSlug,
    templateName: template.name,
    agents: bots.map((bot) => toAgent(bot, template.name)),
    separateTotalCents: price.separateTotalCents,
    monthlyPriceCents: price.monthlyPriceCents,
    savingCents: price.savingCents,
    savingPercent: price.savingPercent,
    currency: "ZAR",
    pricePlaceholder: true,
  };
}

export type ExplanationPolisher = (
  messages: { role: "system" | "user" | "assistant"; content: string }[],
) => Promise<{ ok: boolean; text?: string }>;

/** Rewrites explanation sentences only. Slugs, order, and prices stay as recommendTeam returned them. */
export async function polishRecommendationExplanations(
  recommendation: TeamRecommendation,
  complete: ExplanationPolisher,
): Promise<TeamRecommendation> {
  const originals = recommendation.agents.map((agent) => agent.why);
  if (!originals.length) return recommendation;
  const result = await complete([
    {
      role: "system",
      content: "Rewrite each explanation as one plain sentence. Return a JSON array of strings with the same length and the same order. Do not add prices, people, phone numbers, or any instruction to send a message.",
    },
    { role: "user", content: JSON.stringify(originals) },
  ]);
  if (!result.ok || !result.text) return recommendation;
  const start = result.text.indexOf("[");
  const end = result.text.lastIndexOf("]");
  if (start < 0 || end <= start) return recommendation;
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text.slice(start, end + 1));
  } catch {
    return recommendation;
  }
  if (!Array.isArray(parsed) || parsed.length !== originals.length) return recommendation;
  if (!parsed.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 400)) return recommendation;
  const lines = parsed as string[];
  return {
    ...recommendation,
    agents: recommendation.agents.map((agent, index) => ({ ...agent, why: lines[index].trim() })),
  };
}
