import { BOT_BUNDLES, BOT_CATALOG, TEAM_TEMPLATES } from "@/lib/bots/catalog-data";
import type { TeamTemplate } from "@/lib/bots/catalog-types";

function q(value: string) {
  return `$q$${value}$q$`;
}

function payloadOf(template: TeamTemplate) {
  return {
    version: 1,
    bots: template.bots.map((bot) => ({ slug: bot.slug, config: bot.config })),
    pipelines: template.pipelines.map((pipeline) => ({
      asset_key: pipeline.assetKey,
      name: pipeline.name,
      is_default: pipeline.isDefault,
      stages: pipeline.stages.map((stage) => ({
        asset_key: stage.assetKey,
        name: stage.name,
        position: stage.position,
        is_won: stage.isWon,
        is_lost: stage.isLost,
      })),
    })),
    workflows: template.workflows.map((workflow) => ({
      asset_key: workflow.assetKey,
      name: workflow.name,
      trigger_type: workflow.triggerType,
      trigger: {},
      steps: workflow.steps,
    })),
  };
}

/** SQL seed generated from src/lib/bots/catalog-data.ts. Placeholder prices, to be confirmed by Billy. */
export function agentSeedSql() {
  const bots = BOT_CATALOG.map((bot) => `    (
      ${q(bot.slug)}, ${q(bot.name)}, ${q(bot.category)}, ${q(bot.department)},
      ${q(bot.description)},
      ${bot.monthlyPriceCents}, 'ZAR', true,
      ${q(JSON.stringify(bot.capabilities))}::jsonb,
      ${q(JSON.stringify(bot.defaultConfig))}::jsonb,
      ${q(bot.engine)}, true
    )`).join(",\n");

  const bundles = BOT_BUNDLES.map((bundle) => `    (
      ${q(bundle.slug)}, ${q(bundle.name)},
      ${q(bundle.description)},
      ${bundle.bundlePriceCents}, ${bundle.discountPercent}, 'ZAR', true
    )`).join(",\n");

  const items = BOT_BUNDLES.flatMap((bundle) => bundle.botSlugs.map((slug, index) =>
    `      (${q(bundle.slug)}, ${q(slug)}, ${index + 1})`,
  )).join(",\n");

  const templates = TEAM_TEMPLATES.map((template) => `    (
      ${q(template.slug)}, ${q(template.name)},
      ${q(template.description)},
      ${q(template.bundleSlug)},
      ${template.industry ? q(template.industry) : "null"},
      ${template.department ? q(template.department) : "null"},
      ${q(JSON.stringify(payloadOf(template)))}::jsonb
    )`).join(",\n");

  return `-- Placeholder prices, to be confirmed by Billy.
-- Seed is generated from src/lib/bots/catalog-data.ts. Agents and bots are the same catalogue.
do $seed$
begin
  insert into public.bot_catalog (
    slug, name, category, department, description, monthly_price_cents, currency, price_placeholder,
    capabilities, default_config, engine, active
  ) values
${bots}
  on conflict (slug) do update set
    name = excluded.name,
    category = excluded.category,
    department = excluded.department,
    description = excluded.description,
    monthly_price_cents = excluded.monthly_price_cents,
    currency = excluded.currency,
    price_placeholder = true,
    capabilities = excluded.capabilities,
    default_config = excluded.default_config,
    engine = excluded.engine,
    active = excluded.active;

  insert into public.bot_bundles (slug, name, description, bundle_price_cents, discount_percent, currency, price_placeholder)
  values
${bundles}
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    bundle_price_cents = excluded.bundle_price_cents,
    discount_percent = excluded.discount_percent,
    price_placeholder = true;

  insert into public.bot_bundle_items (bundle_id, bot_slug, position)
  select b.id, item.bot_slug, item.position
  from public.bot_bundles b
  join (
    values
${items}
  ) as item(bundle_slug, bot_slug, position) on item.bundle_slug = b.slug
  on conflict (bundle_id, bot_slug) do nothing;

  insert into public.bot_templates (slug, name, description, bundle_slug, industry, department, payload)
  values
${templates}
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    bundle_slug = excluded.bundle_slug,
    industry = excluded.industry,
    department = excluded.department,
    payload = excluded.payload;
end
$seed$;
`;
}
