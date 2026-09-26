import { AGENCY_WHATSAPP_E164, OFFER_PACKAGES } from "@/lib/brand/catalog";

export function whatsAppHref(text: string) {
  return `https://wa.me/${AGENCY_WHATSAPP_E164}?text=${encodeURIComponent(text)}`;
}

/** The coded package messages ask AI AutoTech to share more details and pricing. No package price is published. */
export function packagePricingMessage(packageName: string) {
  return `AI AutoTech, share more details and pricing for ${packageName}.`;
}

export function packageWhatsAppHref(packageName: string) {
  const pack = OFFER_PACKAGES.find((item) => item.name === packageName);
  if (!pack?.asksForPricing) return `https://wa.me/${AGENCY_WHATSAPP_E164}`;
  return whatsAppHref(packagePricingMessage(packageName));
}
