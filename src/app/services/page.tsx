import { PublicPageShell } from "@/components/public-page-shell";
import { ServiceEnquiryForm } from "@/components/services/enquiry-form";
import { OFFER_PACKAGES, OFFER_SERVICES } from "@/lib/brand/catalog";
import { BUSINESS_EMAIL } from "@/lib/brand/contact";
import { packageWhatsAppHref } from "@/lib/brand/whatsapp";
import { PRICE_PLACEHOLDER_LABEL } from "@/lib/services/catalog";

export default function ServicesPage() {
  return (
    <PublicPageShell
      title="Services"
      description="Professional websites, landing pages, sales funnels, lead capture, brand identity kits, and basic automation. Website, app, and marketing prices on the quote form are placeholders until Billy confirms them."
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
    >
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-6">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">Website, app, and marketing quotes</h2>
          <p className="mt-2 text-sm leading-6 text-amber-950">{PRICE_PLACEHOLDER_LABEL}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            The form saves a lead and a quote in the CRM. Accepting the quote opens a PayFast once-off checkout. Nothing is charged until you pay there. Prices exclude VAT.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Email <a className="font-semibold" href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a>
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <ServiceEnquiryForm />
        </div>
      </section>
    </PublicPageShell>
  );
}
