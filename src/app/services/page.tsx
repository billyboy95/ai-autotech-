import { PublicPageShell } from "@/components/public-page-shell";
import { OFFER_PACKAGES, OFFER_SERVICES } from "@/lib/brand/catalog";
import { packageWhatsAppHref } from "@/lib/brand/whatsapp";

export default function ServicesPage() {
  return (
    <PublicPageShell
      title="Services"
      description="Professional websites, landing pages, sales funnels, lead capture, brand identity kits, and basic automation. Packages do not publish a price."
      sourcePage="services"
      items={[
        ...OFFER_SERVICES.filter((item) => item.detail).map((item) => ({
          title: item.name,
          detail: item.detail,
        })),
        { title: "AI AutoTech Upgrade Path" },
        ...OFFER_PACKAGES.map((item) => ({
          title: item.name,
          detail: item.features.join(", "),
          href: packageWhatsAppHref(item.name),
          hrefLabel: item.asksForPricing ? "WhatsApp for details and pricing" : "WhatsApp",
        })),
      ]}
    />
  );
}
