export type ServiceKind = "website" | "app" | "marketing" | "addon";
export type ServiceBilling = "once_off" | "month";

export type ServicePackage = {
  code: string;
  name: string;
  kind: ServiceKind;
  summary: string;
  scope: readonly [string, string, string, string];
  priceCents: number;
  billing: ServiceBilling;
  priceFrom: boolean;
  supportCents: number | null;
};

export const SERVICE_PACKAGES: readonly ServicePackage[] = [
  {
    code: "website_starter",
    name: "Website Starter",
    kind: "website",
    summary: "Small brochure site. R4,500 once-off, excluding VAT.",
    scope: [
      "One-page or small brochure site",
      "Mobile layout, contact form, and basic SEO",
      "Handover notes for hosting, domain, and SSL",
      "One round of revisions",
    ],
    priceCents: 450_000,
    billing: "once_off",
    priceFrom: false,
    supportCents: null,
  },
  {
    code: "website_business",
    name: "Website Business",
    kind: "website",
    summary: "Multi-page business site. R8,950 once-off, excluding VAT.",
    scope: [
      "Multi-page site for home, services, about, and contact",
      "Lead form wired into the CRM",
      "Mobile layout, basic SEO, and an analytics hookup",
      "Two rounds of revisions",
    ],
    priceCents: 895_000,
    billing: "once_off",
    priceFrom: false,
    supportCents: null,
  },
  {
    code: "website_premium",
    name: "Website Premium",
    kind: "website",
    summary: "Custom marketing site. Quote starts at R16,500 once-off, excluding VAT.",
    scope: [
      "Custom marketing site with landing pages",
      "CRM lead capture, WhatsApp, and booking links",
      "SEO structure, a speed pass, and analytics",
      "Quote starts at R16,500 and scales with pages and integrations",
    ],
    priceCents: 1_650_000,
    billing: "once_off",
    priceFrom: true,
    supportCents: null,
  },
  {
    code: "app_mvp",
    name: "App MVP",
    kind: "app",
    summary: "First usable app. Build starts at R35,000, plus R750 per month support. Excluding VAT.",
    scope: [
      "One core workflow and a small set of screens",
      "Sign-in, data storage, and a simple admin view",
      "Staging build and a handover walkthrough",
      "Build starts at R35,000. Support is R750 per month",
    ],
    priceCents: 3_500_000,
    billing: "once_off",
    priceFrom: true,
    supportCents: 75_000,
  },
  {
    code: "app_full",
    name: "App Full",
    kind: "app",
    summary: "Full app build. Build starts at R85,000, plus R1,500 per month support. Excluding VAT.",
    scope: [
      "Multi-role app with the agreed workflows",
      "Admin, reporting, and the integrations in scope",
      "Staging, production handover, and training",
      "Build starts at R85,000. Support is R1,500 per month",
    ],
    priceCents: 8_500_000,
    billing: "once_off",
    priceFrom: true,
    supportCents: 150_000,
  },
  {
    code: "marketing_starter",
    name: "Marketing Starter",
    kind: "marketing",
    summary: "Monthly marketing retainer. R3,950 per month, excluding VAT.",
    scope: [
      "Monthly content plan and a posting cadence",
      "One campaign or offer each month",
      "Basic reporting on reach and enquiries",
      "Retainer billed monthly, excluding VAT",
    ],
    priceCents: 395_000,
    billing: "month",
    priceFrom: false,
    supportCents: null,
  },
  {
    code: "marketing_growth",
    name: "Marketing Growth",
    kind: "marketing",
    summary: "Larger monthly marketing retainer. R7,500 per month, excluding VAT.",
    scope: [
      "Content, ads creative, and a monthly offer",
      "Landing page updates tied to the campaign",
      "Lead follow-up copy and a monthly report",
      "Retainer billed monthly, excluding VAT",
    ],
    priceCents: 750_000,
    billing: "month",
    priceFrom: false,
    supportCents: null,
  },
  {
    code: "addon_hosting",
    name: "Hosting, domain and SSL",
    kind: "addon",
    summary: "Hosting, domain, and SSL add-on. R150 per month, excluding VAT.",
    scope: [
      "Site hosting on a managed plan",
      "Domain renewal coordination",
      "SSL certificate kept current",
      "Billed monthly, excluding VAT",
    ],
    priceCents: 15_000,
    billing: "month",
    priceFrom: false,
    supportCents: null,
  },
];

export type ServicePackageCode = (typeof SERVICE_PACKAGES)[number]["code"];

export function servicePackage(code: string) {
  return SERVICE_PACKAGES.find((item) => item.code === code) ?? null;
}

export function formatPackageZar(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Quote starting amount, with from-pricing and monthly support called out. */
export function packagePriceLabel(pack: Pick<ServicePackage, "priceCents" | "priceFrom" | "billing" | "supportCents">) {
  const amount = formatPackageZar(pack.priceCents);
  const head = pack.priceFrom ? `from ${amount}` : amount;
  if (pack.billing === "month") return `${head} / month`;
  if (pack.supportCents) return `${head} build + ${formatPackageZar(pack.supportCents)} / month support`;
  return `${head} once-off`;
}
