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
  /** Answers collected in setup. Only the questions this agent asks are stored. */
  setup?: Record<string, string>;
};

export type SetupQuestion = {
  id: string;
  label: string;
  kind: "text" | "choice";
  options?: string[];
};

export type AgentTouches = {
  pipelines: string[];
  inbox: boolean;
  tasks: boolean;
  calendar: boolean;
  reviews: boolean;
  reportsTo: string;
};

export type CatalogBot = {
  slug: string;
  name: string;
  category: BotCategory;
  department: string;
  description: string;
  monthlyPriceCents: number;
  tier: "starter" | "pro" | "always_on" | "included";
  includedHours: number;
  currency: "ZAR";
  pricePlaceholder: true;
  capabilities: string[];
  defaultConfig: BotConfig;
  engine: BotEngine;
  active: true;
  touches: AgentTouches;
  setupQuestions: SetupQuestion[];
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
  industry: string | null;
  department: string | null;
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
  industry: string | null;
  department: string | null;
  bots: { slug: string; config: BotConfig }[];
  pipelines: TemplatePipeline[];
  workflows: TemplateWorkflow[];
};
