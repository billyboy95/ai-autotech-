import { botBySlug, botsInBundle, bundleBySlug, type CatalogBundle, type CatalogBot } from "@/lib/bots/catalog";

export type BundleSaving = {
  separateTotalCents: number;
  maxBotCents: number;
  bundlePriceCents: number;
  savingCents: number;
  savingPercent: number;
};

export function quotedBundlePrice(bundle: Pick<CatalogBundle, "bundlePriceCents" | "discountPercent">, separateTotalCents: number) {
  if (bundle.bundlePriceCents != null) return bundle.bundlePriceCents;
  return Math.round(separateTotalCents * (100 - bundle.discountPercent) / 100);
}

export function bundleSaving(bundle: CatalogBundle, bots: CatalogBot[] = botsInBundle(bundle)): BundleSaving {
  const separateTotalCents = bots.reduce((sum, bot) => sum + bot.monthlyPriceCents, 0);
  const maxBotCents = bots.reduce((max, bot) => Math.max(max, bot.monthlyPriceCents), 0);
  const bundlePriceCents = quotedBundlePrice(bundle, separateTotalCents);
  const savingCents = separateTotalCents - bundlePriceCents;
  const savingPercent = separateTotalCents === 0 ? 0 : Math.round((savingCents * 100) / separateTotalCents);
  return { separateTotalCents, maxBotCents, bundlePriceCents, savingCents, savingPercent };
}

export function assertBundleDiscount(bundle: CatalogBundle, bots: CatalogBot[] = botsInBundle(bundle)) {
  const saving = bundleSaving(bundle, bots);
  if (saving.bundlePriceCents <= saving.maxBotCents || saving.bundlePriceCents >= saving.separateTotalCents) {
    throw new Error("bundle discount rule: bundle total must be greater than the most expensive bot and less than the sum of its bots");
  }
  return saving;
}

/** Split a bundle price across bots in slug order. The last bot absorbs the remainder. */
export function allocateBundlePrice(bots: CatalogBot[], bundlePriceCents: number) {
  const ordered = [...bots].sort((left, right) => left.slug.localeCompare(right.slug));
  const separate = ordered.reduce((sum, bot) => sum + bot.monthlyPriceCents, 0);
  if (separate <= 0) throw new Error("bundle has no priced bots");
  let running = 0;
  return ordered.map((bot, index) => {
    const amountCents = index === ordered.length - 1
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
