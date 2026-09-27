import { botBySlug, botsInBundle, bundleBySlug, type CatalogBundle, type CatalogBot } from "@/lib/bots/catalog";
import { discountedAgentTotal } from "@/lib/pricing/price-sheet";

export type BundleSaving = {
  separateTotalCents: number;
  maxBotCents: number;
  bundlePriceCents: number;
  savingCents: number;
  savingPercent: number;
};

/** Discount comes from the agent count. A stored bundle price is only a cache of that result. */
export function quotedBundlePrice(agentCount: number, separateTotalCents: number) {
  return discountedAgentTotal(separateTotalCents, agentCount);
}

export function bundleSaving(bundle: CatalogBundle, bots: CatalogBot[] = botsInBundle(bundle)): BundleSaving {
  const separateTotalCents = bots.reduce((sum, bot) => sum + bot.monthlyPriceCents, 0);
  const maxBotCents = bots.reduce((max, bot) => Math.max(max, bot.monthlyPriceCents), 0);
  const quoted = quotedBundlePrice(bots.length, separateTotalCents);
  return {
    separateTotalCents,
    maxBotCents,
    bundlePriceCents: quoted.agentTotalCents,
    savingCents: quoted.savingCents,
    savingPercent: quoted.discountPercent,
  };
}

export function assertBundleDiscount(bundle: CatalogBundle, bots: CatalogBot[] = botsInBundle(bundle)) {
  const saving = bundleSaving(bundle, bots);
  if (bundle.bundlePriceCents !== saving.bundlePriceCents || bundle.discountPercent !== saving.savingPercent) {
    throw new Error("bundle discount rule: stored price must follow the agent-count discount");
  }
  if (bots.length >= 3) {
    if (saving.bundlePriceCents <= saving.maxBotCents || saving.bundlePriceCents >= saving.separateTotalCents) {
      throw new Error("bundle discount rule: bundle total must be greater than the most expensive bot and less than the sum of its bots");
    }
  } else if (saving.bundlePriceCents !== saving.separateTotalCents) {
    throw new Error("bundle discount rule: a team under 3 agents has no discount");
  } else if (bots.length > 1 && saving.separateTotalCents > saving.maxBotCents && saving.bundlePriceCents <= saving.maxBotCents) {
    throw new Error("bundle discount rule: bundle total must be greater than the most expensive bot");
  }
  return saving;
}

/** Split a bundle price across bots in slug order. The last bot absorbs the remainder. */
export function allocateBundlePrice(bots: CatalogBot[], bundlePriceCents: number) {
  const ordered = [...bots].sort((left, right) => left.slug.localeCompare(right.slug));
  const separate = ordered.reduce((sum, bot) => sum + bot.monthlyPriceCents, 0);
  if (separate <= 0) throw new Error("bundle has no priced bots");
  const lastPriced = ordered.reduce((found, bot, index) => (bot.monthlyPriceCents > 0 ? index : found), -1);
  let running = 0;
  return ordered.map((bot, index) => {
    if (bot.monthlyPriceCents <= 0) return { slug: bot.slug, amountCents: 0 };
    const amountCents = index === lastPriced
      ? bundlePriceCents - running
      : Math.floor((bundlePriceCents * bot.monthlyPriceCents) / separate);
    running += amountCents;
    return { slug: bot.slug, amountCents };
  });
}

export function lineAmountForBot(slug: string, bundleSlug: string | null) {
  if (!bundleSlug) return botBySlug(slug).monthlyPriceCents;
  const bundle = bundleBySlug(bundleSlug);
  const saving = assertBundleDiscount(bundle);
  const share = allocateBundlePrice(botsInBundle(bundle), saving.bundlePriceCents).find((line) => line.slug === slug);
  if (!share) throw new Error(`bot ${slug} is not in ${bundleSlug}`);
  return share.amountCents;
}
