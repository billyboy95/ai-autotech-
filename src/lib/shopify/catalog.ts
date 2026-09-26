import type { ShopifyStoreRecord } from "@/lib/tenant/types";

export const ZENTRIX_NICHES = [
  "Pets",
  "Auto",
  "Kitchens",
  "Camping",
  "Holidays",
  "Home",
  "Beauty",
  "Baby",
  "Fitness",
  "Tools",
] as const;

export function zentrixStores(): ShopifyStoreRecord[] {
  return ZENTRIX_NICHES.map((niche) => {
    const slug = niche.toLowerCase();
    return {
      niche,
      name: `Zentrix ${niche}`,
      myshopifyDomain: `zentrix-${slug}.myshopify.com`,
      publicDomain: `${slug}.zentrixonline.co.za`,
      planStatus: "not_connected",
    };
  });
}
