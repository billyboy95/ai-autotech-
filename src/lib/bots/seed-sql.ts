import { BOT_BUNDLES, BOT_CATALOG, TEAM_TEMPLATES } from "@/lib/bots/catalog-data";
import type { TeamTemplate } from "@/lib/bots/catalog-types";
import {
  AGENT_TIERS,
  DEFAULT_SETUP_FEE_CENTS,
  PLATFORM_FEE_CENTS,
  PLATFORM_INCLUDED_HOURS,
  PREMIUM_MODEL_MULTIPLIER,
  SEND_MARKUP_PERCENT,
  TEAM_DISCOUNT_BANDS,
  TOPUP_CENTS,
  TOPUP_HOURS,
} from "@/lib/pricing/price-sheet";

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
      ${bundle.bundlePriceCents}, ${bundle.discountPercent > 0 ? bundle.discountPercent : "null"}, 'ZAR', true
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

  const sheet = [
    `('platform_fee', ${PLATFORM_FEE_CENTS}, ${PLATFORM_INCLUDED_HOURS}, null, true, 'Platform fee. CRM, Lead Agent, and the hour pool.')`,
    `('tier_starter', ${AGENT_TIERS.starter.cents}, ${AGENT_TIERS.starter.hours}, null, true, 'Starter agent.')`,
    `('tier_pro', ${AGENT_TIERS.pro.cents}, ${AGENT_TIERS.pro.hours}, null, true, 'Pro agent.')`,
    `('tier_always_on', ${AGENT_TIERS.always_on.cents}, ${AGENT_TIERS.always_on.hours}, null, true, 'Always-On agent. 24/7, active hours capped.')`,
    ...TEAM_DISCOUNT_BANDS.map((band) => `('${band.key}', null, ${band.minAgents}, ${band.percent}, true, 'Team discount from ${band.minAgents} agents.')`),
    `('topup_10h', ${TOPUP_CENTS}, ${TOPUP_HOURS}, null, true, 'Computer-time top-up.')`,
    `('premium_model_multiplier', null, ${PREMIUM_MODEL_MULTIPLIER}, null, true, 'Premium models use hours faster, or bring your own key.')`,
    `('send_markup', null, null, ${SEND_MARKUP_PERCENT}, true, 'Per-send markup on WhatsApp, SMS, and email.')`,
    `('setup_fee', ${DEFAULT_SETUP_FEE_CENTS}, null, null, true, 'Once-off setup fee. Per template in the price sheet.')`,
  ].map((row) => `    ${row}`).join(",\n");

  return `-- Placeholder prices, to be confirmed by Billy.
-- Seed is generated from src/lib/pricing/price-sheet.ts. Agents and bots are the same catalogue.
do $seed$
begin
  insert into public.pricing_sheet (key, amount_cents, quantity, percent, price_placeholder, note)
  values
${sheet}
  on conflict (key) do update set
    amount_cents = excluded.amount_cents,
    quantity = excluded.quantity,
    percent = excluded.percent,
    price_placeholder = true,
    note = excluded.note;

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
