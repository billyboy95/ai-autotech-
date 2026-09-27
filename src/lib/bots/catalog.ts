export const BOT_CATEGORIES = ["sales", "marketing", "support", "ops"] as const;
export type BotCategory = (typeof BOT_CATEGORIES)[number];

export const BOT_ENGINES = ["workflows", "ai_reply", "outbox_draft", "calendar"] as const;
export type BotEngine = (typeof BOT_ENGINES)[number];

export const BOT_STATUSES = ["trial", "active", "paused", "cancelled"] as const;
export type BotStatus = (typeof BOT_STATUSES)[number];

export type BotHours = {
  timezone: string;
  start: string;
  end: string;
  days: number[];
};

export type BotConfig = {
  tone: string;
  workingHours: BotHours;
  pipeline: string;
  stage: string;
  channel: string;
};

export type CatalogBot = {
  slug: string;
  name: string;
  category: BotCategory;
  description: string;
  monthlyPriceCents: number;
  currency: "ZAR";
  pricePlaceholder: true;
  capabilities: string[];
  defaultConfig: BotConfig;
  engine: BotEngine;
  active: true;
};

export type CatalogBundle = {
  slug: string;
  name: string;
  description: string;
  botSlugs: string[];
  bundlePriceCents: number;
  discountPercent: number;
  currency: "ZAR";
  pricePlaceholder: true;
};

export type TemplateStage = {
  assetKey: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
};

export type TemplatePipeline = {
  assetKey: string;
  name: string;
  isDefault: boolean;
  stages: TemplateStage[];
};

export type TemplateWorkflow = {
  assetKey: string;
  name: string;
  triggerType: string;
  steps: { id: string; kind: "create_task"; title: string }[];
};

export type TeamTemplate = {
  slug: string;
  name: string;
  description: string;
  bundleSlug: string;
  bots: { slug: string; config: BotConfig }[];
  pipelines: TemplatePipeline[];
  workflows: TemplateWorkflow[];
};

const HOURS: BotHours = {
  timezone: "Africa/Johannesburg",
  start: "08:00",
  end: "17:00",
  days: [1, 2, 3, 4, 5],
};

function config(partial: Partial<BotConfig> & Pick<BotConfig, "tone" | "pipeline" | "stage" | "channel">): BotConfig {
  return { workingHours: HOURS, ...partial };
}

/** Placeholder ZAR prices, to be confirmed by Billy. */
export const BOT_CATALOG: CatalogBot[] = [
  {
    slug: "inbound-lead",
    name: "Inbound Lead",
    category: "sales",
    description: "Assigns a new lead and saves an AI reply draft. Nothing is sent.",
    monthlyPriceCents: 150_000,
    currency: "ZAR",
    pricePlaceholder: true,
    capabilities: ["assign-lead", "ai-draft", "workflow"],
    engine: "ai_reply",
    active: true,
    defaultConfig: config({
      tone: "warm and plain",
      pipeline: "pipeline:bot:sales-team",
      stage: "stage:bot:sales-team:new",
      channel: "whatsapp",
    }),
  },
  {
    slug: "outbound-sales",
    name: "Outbound Sales",
    category: "sales",
    description: "Drafts outreach after consent and suppression checks. Nothing is sent.",
    monthlyPriceCents: 200_000,
    currency: "ZAR",
    pricePlaceholder: true,
    capabilities: ["outbox-draft", "consent-check"],
    engine: "outbox_draft",
    active: true,
    defaultConfig: config({
      tone: "direct",
      pipeline: "pipeline:bot:sales-team",
      stage: "stage:bot:sales-team:contacted",
      channel: "whatsapp",
    }),
  },
  {
    slug: "onboarding",
    name: "Onboarding",
    category: "sales",
    description: "Creates onboarding tasks and a booking-link draft. Nothing is sent.",
    monthlyPriceCents: 100_000,
    currency: "ZAR",
    pricePlaceholder: true,
    capabilities: ["task", "calendar-link", "workflow"],
    engine: "calendar",
    active: true,
    defaultConfig: config({
      tone: "helpful",
      pipeline: "pipeline:bot:sales-team",
      stage: "stage:bot:sales-team:won",
      channel: "email",
    }),
  },
  {
    slug: "ads",
    name: "Ads",
    category: "marketing",
    description: "Drafts ad copy only. Nothing is published.",
    monthlyPriceCents: 180_000,
    currency: "ZAR",
    pricePlaceholder: true,
    capabilities: ["ad-copy-draft"],
    engine: "outbox_draft",
    active: true,
    defaultConfig: config({
      tone: "clear",
      pipeline: "pipeline:bot:marketing-team",
      stage: "stage:bot:marketing-team:draft",
      channel: "ads",
    }),
  },
  {
    slug: "social-posting",
    name: "Social Media Posting",
    category: "marketing",
    description: "Drafts social posts only. Nothing is published.",
    monthlyPriceCents: 120_000,
    currency: "ZAR",
    pricePlaceholder: true,
    capabilities: ["social-post-draft"],
    engine: "workflows",
    active: true,
    defaultConfig: config({
      tone: "friendly",
      pipeline: "pipeline:bot:marketing-team",
      stage: "stage:bot:marketing-team:idea",
      channel: "social",
    }),
  },
];

export const BOT_BUNDLES: CatalogBundle[] = [
  {
    slug: "sales-team",
    name: "Sales Team",
    description: "Inbound Lead, Outbound Sales, and Onboarding as one team.",
    botSlugs: ["inbound-lead", "outbound-sales", "onboarding"],
    bundlePriceCents: 360_000,
    discountPercent: 20,
    currency: "ZAR",
    pricePlaceholder: true,
  },
  {
    slug: "marketing-team",
    name: "Marketing Team",
    description: "Ads and Social Media Posting as one team.",
    botSlugs: ["ads", "social-posting"],
    bundlePriceCents: 240_000,
    discountPercent: 20,
    currency: "ZAR",
    pricePlaceholder: true,
  },
  {
    slug: "full-business",
    name: "Full Business",
    description: "Sales Team and Marketing Team together.",
    botSlugs: ["inbound-lead", "outbound-sales", "onboarding", "ads", "social-posting"],
    bundlePriceCents: 600_000,
    discountPercent: 20,
    currency: "ZAR",
    pricePlaceholder: true,
  },
];

const SALES_PIPELINE: TemplatePipeline = {
  assetKey: "pipeline:bot:sales-team",
  name: "Sales Team",
  isDefault: false,
  stages: [
    { assetKey: "stage:bot:sales-team:new", name: "New", position: 1, isWon: false, isLost: false },
    { assetKey: "stage:bot:sales-team:contacted", name: "Contacted", position: 2, isWon: false, isLost: false },
    { assetKey: "stage:bot:sales-team:qualified", name: "Qualified", position: 3, isWon: false, isLost: false },
    { assetKey: "stage:bot:sales-team:proposal", name: "Proposal", position: 4, isWon: false, isLost: false },
    { assetKey: "stage:bot:sales-team:won", name: "Won", position: 5, isWon: true, isLost: false },
    { assetKey: "stage:bot:sales-team:lost", name: "Lost", position: 6, isWon: false, isLost: true },
  ],
};

const MARKETING_PIPELINE: TemplatePipeline = {
  assetKey: "pipeline:bot:marketing-team",
  name: "Marketing Team",
  isDefault: false,
  stages: [
    { assetKey: "stage:bot:marketing-team:idea", name: "Idea", position: 1, isWon: false, isLost: false },
    { assetKey: "stage:bot:marketing-team:draft", name: "Draft", position: 2, isWon: false, isLost: false },
    { assetKey: "stage:bot:marketing-team:review", name: "Review", position: 3, isWon: false, isLost: false },
    { assetKey: "stage:bot:marketing-team:scheduled", name: "Scheduled", position: 4, isWon: false, isLost: false },
  ],
};

const SALES_WORKFLOWS: TemplateWorkflow[] = [
  {
    assetKey: "workflow:bot:inbound-assign",
    name: "Assign inbound lead",
    triggerType: "lead.created",
    steps: [{ id: "assign", kind: "create_task", title: "Assign the inbound lead" }],
  },
  {
    assetKey: "workflow:bot:onboarding-tasks",
    name: "Onboarding tasks",
    triggerType: "lead.stage_changed",
    steps: [{ id: "welcome", kind: "create_task", title: "Create the onboarding tasks" }],
  },
];

const MARKETING_WORKFLOWS: TemplateWorkflow[] = [
  {
    assetKey: "workflow:bot:ads-draft",
    name: "Draft ad copy",
    triggerType: "schedule.cron",
    steps: [{ id: "ad", kind: "create_task", title: "Draft the ad copy" }],
  },
  {
    assetKey: "workflow:bot:social-draft",
    name: "Draft social post",
    triggerType: "schedule.cron",
    steps: [{ id: "post", kind: "create_task", title: "Draft the social post" }],
  },
];

function botsFor(slugs: string[]) {
  return slugs.map((slug) => {
    const bot = botBySlug(slug);
    return { slug, config: bot.defaultConfig };
  });
}

export const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    slug: "sales-team",
    name: "Sales Team",
    description: "One click: inbound, outbound, and onboarding bots, the sales pipeline, and task workflows. Sending stays off.",
    bundleSlug: "sales-team",
    bots: botsFor(["inbound-lead", "outbound-sales", "onboarding"]),
    pipelines: [SALES_PIPELINE],
    workflows: SALES_WORKFLOWS,
  },
  {
    slug: "marketing-team",
    name: "Marketing Team",
    description: "One click: ads and social bots, the marketing pipeline, and draft workflows. Sending stays off.",
    bundleSlug: "marketing-team",
    bots: botsFor(["ads", "social-posting"]),
    pipelines: [MARKETING_PIPELINE],
    workflows: MARKETING_WORKFLOWS,
  },
  {
    slug: "full-business",
    name: "Full Business",
    description: "One click: every store bot, both pipelines, and the task workflows. Sending stays off.",
    bundleSlug: "full-business",
    bots: botsFor(["inbound-lead", "outbound-sales", "onboarding", "ads", "social-posting"]),
    pipelines: [SALES_PIPELINE, MARKETING_PIPELINE],
    workflows: [...SALES_WORKFLOWS, ...MARKETING_WORKFLOWS],
  },
];

export function botBySlug(slug: string) {
  const bot = BOT_CATALOG.find((item) => item.slug === slug);
  if (!bot) throw new Error(`unknown bot ${slug}`);
  return bot;
}

export function bundleBySlug(slug: string) {
  const bundle = BOT_BUNDLES.find((item) => item.slug === slug);
  if (!bundle) throw new Error(`unknown bundle ${slug}`);
  return bundle;
}

export function templateBySlug(slug: string) {
  const template = TEAM_TEMPLATES.find((item) => item.slug === slug);
  if (!template) throw new Error(`unknown bot template ${slug}`);
  return template;
}

export function botsInBundle(bundle: CatalogBundle) {
  return bundle.botSlugs.map((slug) => botBySlug(slug));
}
