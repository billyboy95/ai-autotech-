import {
  AGENT_DEPARTMENTS,
  BOT_BUNDLES,
  BOT_CATALOG,
  DEPARTMENT_LABELS,
  TEAM_TEMPLATES,
  botBySlug,
  botsInBundle,
  type AgentTouches,
  type BotConfig,
} from "@/lib/bots/catalog";
import { allocateBundlePrice, bundleSaving } from "@/lib/bots/pricing";
import { tierLabel } from "@/lib/pricing/price-sheet";

export type StoreBotCard = {
  slug: string;
  name: string;
  category: string;
  department: string;
  description: string;
  monthlyPriceCents: number;
  tier: string;
  tierLabel: string;
  includedHours: number;
  pricePlaceholder: true;
  engine: string;
  installedStatus: string | null;
};

export type StoreBundleCard = {
  slug: string;
  name: string;
  description: string;
  botNames: string[];
  separateTotalCents: number;
  bundlePriceCents: number;
  savingPercent: number;
  pricePlaceholder: true;
};

export type StoreTemplateCard = {
  slug: string;
  name: string;
  description: string;
  industry: string | null;
  department: string | null;
};

export type BotStoreData = {
  preview: boolean;
  notice: string | null;
  canManage: boolean;
  canSeeAgency: boolean;
  orgSlug: string;
  departments: string[];
  bots: StoreBotCard[];
  bundles: StoreBundleCard[];
  templates: StoreTemplateCard[];
};

export type BotRunRow = {
  id: string;
  kind: string;
  status: string;
  summary: string;
  createdAt: string;
};

export type BotDetailData = {
  preview: boolean;
  notice: string | null;
  canManage: boolean;
  found: boolean;
  orgSlug: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  engine: string;
  pricePlaceholder: true;
  monthlyPriceCents: number;
  tier: string;
  tierLabel: string;
  includedHours: number;
  departmentLabel: string;
  touches: AgentTouches | null;
  config: BotConfig;
  runs: BotRunRow[];
};

export type AgencyBotRow = {
  orgName: string;
  orgSlug: string;
  botName: string;
  botSlug: string;
  status: string;
  mrrCents: number;
  sandbox: true;
};

export type AgencyBotData = {
  allowed: boolean;
  preview: boolean;
  notice: string | null;
  rows: AgencyBotRow[];
  totalMrrCents: number;
};

const PREVIEW_STATUS: Record<string, Record<string, string>> = {
  "ai-autotech": { "inbound-lead": "active", receptionist: "trial", "review-requests": "active" },
  eastc: { "inbound-lead": "trial", "outbound-sales": "trial", onboarding: "trial" },
  zentrix: { ads: "active", "social-posting": "active" },
};

export function previewInstalled(orgSlug: string, botSlug: string) {
  return PREVIEW_STATUS[orgSlug]?.[botSlug] ?? null;
}

export function previewBotStore(orgSlug: string, notice: string | null, canSeeAgency: boolean): BotStoreData {
  return {
    preview: true,
    notice: notice ?? "Preview workspace. Connect Supabase to save bots. Nothing is stored and nothing is sent.",
    canManage: false,
    canSeeAgency,
    orgSlug,
    departments: AGENT_DEPARTMENTS.filter((department) => BOT_CATALOG.some((bot) => bot.department === department)),
    bots: BOT_CATALOG.map((bot) => ({
      slug: bot.slug,
      name: bot.name,
      category: bot.category,
      department: bot.department,
      description: bot.description,
      monthlyPriceCents: bot.monthlyPriceCents,
      tier: bot.tier,
      tierLabel: tierLabel(bot.tier),
      includedHours: bot.includedHours,
      pricePlaceholder: true,
      engine: bot.engine,
      installedStatus: previewInstalled(orgSlug, bot.slug),
    })),
    bundles: BOT_BUNDLES.map((bundle) => {
      const saving = bundleSaving(bundle);
      return {
        slug: bundle.slug,
        name: bundle.name,
        description: bundle.description,
        botNames: botsInBundle(bundle).map((bot) => bot.name),
        separateTotalCents: saving.separateTotalCents,
        bundlePriceCents: saving.bundlePriceCents,
        savingPercent: saving.savingPercent,
        pricePlaceholder: true,
      };
    }),
    templates: TEAM_TEMPLATES.map((template) => ({
      slug: template.slug,
      name: template.name,
      description: template.description,
      industry: template.industry,
      department: template.department,
    })),
  };
}

export function previewBotDetail(orgSlug: string, slug: string, notice: string | null): BotDetailData {
  const bot = BOT_CATALOG.find((item) => item.slug === slug);
  if (!bot) {
    return {
      preview: true,
      notice: notice ?? "That bot is not in the catalogue.",
      canManage: false,
      found: false,
      orgSlug,
      slug,
      name: "Unknown bot",
      description: "",
      status: "cancelled",
      engine: "",
      pricePlaceholder: true,
      monthlyPriceCents: 0,
      tier: "",
      tierLabel: "",
      includedHours: 0,
      departmentLabel: "",
      touches: null,
      config: botBySlug("inbound-lead").defaultConfig,
      runs: [],
    };
  }
  const status = previewInstalled(orgSlug, slug) ?? "trial";
  return {
    preview: true,
    notice: notice ?? "Preview workspace. Connect Supabase to save this bot. Nothing is stored and nothing is sent.",
    canManage: false,
    found: true,
    orgSlug,
    slug: bot.slug,
    name: bot.name,
    description: bot.description,
    status,
    engine: bot.engine,
    pricePlaceholder: true,
    monthlyPriceCents: bot.monthlyPriceCents,
    tier: bot.tier,
    tierLabel: tierLabel(bot.tier),
    includedHours: bot.includedHours,
    departmentLabel: DEPARTMENT_LABELS[bot.department as keyof typeof DEPARTMENT_LABELS] || bot.department,
    touches: bot.touches,
    config: bot.defaultConfig,
    runs: [{
      id: `preview-${bot.slug}`,
      kind: bot.engine,
      status: "drafted",
      summary: `${bot.name} saved a draft. Nothing was sent.`,
      createdAt: "2026-09-01T08:00:00.000Z",
    }],
  };
}

function previewShares(bundleSlug: string) {
  const bundle = BOT_BUNDLES.find((item) => item.slug === bundleSlug);
  if (!bundle) return new Map<string, number>();
  const saving = bundleSaving(bundle);
  return new Map(allocateBundlePrice(botsInBundle(bundle), saving.bundlePriceCents).map((line) => [line.slug, line.amountCents]));
}

export function previewAgencyBots(): AgencyBotData {
  const eastc = previewShares("sales-team");
  const zentrix = previewShares("marketing-team");
  const source: [string, string, string, string, number][] = [
    ["EASTC", "eastc", "inbound-lead", "trial", eastc.get("inbound-lead") ?? 0],
    ["EASTC", "eastc", "outbound-sales", "trial", eastc.get("outbound-sales") ?? 0],
    ["EASTC", "eastc", "onboarding", "trial", eastc.get("onboarding") ?? 0],
    ["Zentrix Online", "zentrix", "ads", "active", zentrix.get("ads") ?? 0],
    ["Zentrix Online", "zentrix", "social-posting", "active", zentrix.get("social-posting") ?? 0],
  ];
  const rows: AgencyBotRow[] = source.map(([orgName, orgSlug, botSlug, status, mrr]) => ({
    orgName,
    orgSlug,
    botName: botBySlug(botSlug).name,
    botSlug,
    status,
    mrrCents: mrr,
    sandbox: true as const,
  }));
  return {
    allowed: true,
    preview: true,
    notice: "Preview figures. Sandbox MRR only. Nothing is charged.",
    rows,
    totalMrrCents: rows.reduce((sum, row) => sum + row.mrrCents, 0),
  };
}
