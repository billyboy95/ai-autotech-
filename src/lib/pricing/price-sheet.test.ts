import assert from "node:assert/strict";
import test from "node:test";
import { BOT_CATALOG, BOT_BUNDLES } from "@/lib/bots/catalog";
import {
  AGENT_TIERS,
  CRM_PLANS,
  PLATFORM_FEE_CENTS,
  PLATFORM_INCLUDED_HOURS,
  PREMIUM_MODEL_MULTIPLIER,
  PRICE_PLACEHOLDER,
  PRICES_EXCLUDE_VAT,
  SEND_MARKUP_MULTIPLIER,
  SETUP_LINES,
  TOPUP_CENTS,
  TOPUP_HOURS,
  agentMonthlyCents,
  quoteAgents,
  teamDiscountPercent,
  tierForAgent,
  tierHours,
  tierPriceCents,
} from "@/lib/pricing/price-sheet";

test("discount tiers and the monthly total come from the price sheet", () => {
  assert.equal(PRICE_PLACEHOLDER, true);
  assert.equal(PLATFORM_FEE_CENTS, 29_900);
  assert.equal(PLATFORM_INCLUDED_HOURS, 2);
  assert.equal(AGENT_TIERS.starter.cents, 69_900);
  assert.equal(AGENT_TIERS.starter.hours, 5);
  assert.equal(AGENT_TIERS.pro.cents, 149_900);
  assert.equal(AGENT_TIERS.pro.hours, 12);
  assert.equal(AGENT_TIERS.always_on.cents, 499_900);
  assert.equal(AGENT_TIERS.always_on.hours, 40);
  assert.equal(TOPUP_CENTS, 79_900);
  assert.equal(TOPUP_HOURS, 10);
  assert.equal(PREMIUM_MODEL_MULTIPLIER, 2.5);
  assert.equal(SEND_MARKUP_MULTIPLIER, 1.5);
  assert.equal(PRICES_EXCLUDE_VAT, true);
  assert.equal(SETUP_LINES.quick_start.cents, 250_000);
  assert.equal(SETUP_LINES.team_setup.cents, 499_900);
  assert.equal(CRM_PLANS[0]?.code, "platform");
  assert.equal(CRM_PLANS[0]?.priceCents, PLATFORM_FEE_CENTS);
  assert.deepEqual(CRM_PLANS.map((plan) => plan.priceCents), [29_900, 69_900, 149_900, 499_900]);
  assert.equal(tierForAgent("inbound-lead", "sales"), "included");
  assert.equal(agentMonthlyCents("inbound-lead", "sales"), 0);
  assert.equal(tierForAgent("outbound-sales", "sales"), "pro");
  assert.equal(tierForAgent("onboarding", "onboarding"), "starter");
  assert.equal(tierForAgent("ads", "ads"), "pro");
  assert.equal(tierForAgent("social-posting", "social"), "starter");
  assert.equal(teamDiscountPercent(1), 0);
  assert.equal(teamDiscountPercent(2), 0);
  assert.equal(teamDiscountPercent(3), 10);
  assert.equal(teamDiscountPercent(4), 10);
  assert.equal(teamDiscountPercent(5), 15);
  assert.equal(teamDiscountPercent(9), 15);
  assert.equal(teamDiscountPercent(10), 20);

  const agents = [
    { cents: AGENT_TIERS.starter.cents, hours: AGENT_TIERS.starter.hours },
    { cents: AGENT_TIERS.pro.cents, hours: AGENT_TIERS.pro.hours },
    { cents: AGENT_TIERS.always_on.cents, hours: AGENT_TIERS.always_on.hours },
  ];
  const quote = quoteAgents(agents, "healthcare-clinic");
  const subtotal = agents.reduce((sum, agent) => sum + agent.cents, 0);
  const saving = Math.round((subtotal * 10) / 100);
  assert.equal(quote.discountPercent, 10);
  assert.equal(quote.agentSubtotalCents, subtotal);
  assert.equal(quote.savingCents, saving);
  assert.equal(quote.agentTotalCents, subtotal - saving);
  assert.equal(quote.monthlyTotalCents, PLATFORM_FEE_CENTS + quote.agentTotalCents);
  assert.equal(quote.pooledHours, PLATFORM_INCLUDED_HOURS + 5 + 12 + 40);
  assert.equal(quote.pricePlaceholder, true);
  assert.equal(quote.topupCents, TOPUP_CENTS);
  assert.equal(quote.sendMarkupMultiplier, SEND_MARKUP_MULTIPLIER);
  assert.equal(quote.setupLines[0]?.cents, SETUP_LINES.quick_start.cents);
  assert.equal(quote.setupLines[1]?.cents, SETUP_LINES.team_setup.cents);
  assert.equal(quote.pricesExcludeVat, true);
  assert.ok(quote.monthlyTotalCents > AGENT_TIERS.always_on.cents);
  assert.ok(quote.agentTotalCents < subtotal);

  const pair = quoteAgents([
    { cents: AGENT_TIERS.pro.cents, hours: 12 },
    { cents: AGENT_TIERS.starter.cents, hours: 5 },
  ]);
  assert.equal(pair.discountPercent, 0);
  assert.equal(pair.agentTotalCents, pair.agentSubtotalCents);
  assert.equal(pair.monthlyTotalCents, PLATFORM_FEE_CENTS + pair.agentSubtotalCents);
});

test("every catalogue agent has a tier and every niche template uses the team discount", () => {
  for (const bot of BOT_CATALOG) {
    assert.equal(bot.tier, tierForAgent(bot.slug, bot.department));
    assert.equal(bot.monthlyPriceCents, tierPriceCents(bot.tier));
    assert.equal(bot.includedHours, tierHours(bot.tier));
    assert.equal(bot.pricePlaceholder, true);
  }
  for (const bundle of BOT_BUNDLES) {
    const quote = quoteAgents(bundle.botSlugs.map((slug) => {
      const bot = BOT_CATALOG.find((item) => item.slug === slug);
      if (!bot) throw new Error(slug);
      return { cents: bot.monthlyPriceCents, hours: bot.includedHours };
    }), bundle.slug);
    assert.equal(bundle.discountPercent, quote.discountPercent);
    assert.equal(bundle.bundlePriceCents, quote.agentTotalCents);
    assert.equal(bundle.pricePlaceholder, true);
  }
});
