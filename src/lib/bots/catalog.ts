export {
  BOT_CATEGORIES,
  BOT_ENGINES,
  BOT_STATUSES,
  type AgentTouches,
  type BotCategory,
  type BotConfig,
  type BotEngine,
  type BotHours,
  type BotStatus,
  type CatalogBot,
  type CatalogBundle,
  type SetupQuestion,
  type TeamTemplate,
  type TemplatePipeline,
  type TemplateStage,
  type TemplateWorkflow,
} from "@/lib/bots/catalog-types";

export {
  AGENT_DEPARTMENTS,
  BOT_BUNDLES,
  BOT_CATALOG,
  DEPARTMENT_LABELS,
  DEPARTMENT_LEADS,
  EDUCATION_ADMISSIONS_PIPELINE,
  INDUSTRIES,
  INDUSTRY_LABELS,
  TEAM_TEMPLATES,
  type AgentDepartment,
  type Industry,
} from "@/lib/bots/catalog-data";

import { BOT_BUNDLES, BOT_CATALOG, TEAM_TEMPLATES } from "@/lib/bots/catalog-data";
import type { CatalogBundle } from "@/lib/bots/catalog-types";

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
