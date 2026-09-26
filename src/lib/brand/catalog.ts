/**
 * Sourced from the owner's older repos (CONTEXT.md, 2026-09-26).
 * Deck colours are the agency workspace defaults. The official-site bundle
 * uses a different palette (#0078D4 / #002050) and is not applied here.
 */

export const AGENCY_DECK_COLORS = {
  navy: "#1B3A5C",
  blue: "#4A9EDB",
  pale: "#BAE6FD",
} as const;

export const AGENCY_TAGLINE = "Automate · Innovate · Elevate";
export const AGENCY_PROMISE = "convert, capture and scale";
export const AGENCY_WHATSAPP_E164 = "27646863803";

export const UPGRADE_PATH = ["Digital Foundation", "CRM + Automation", "Full AI Ecosystem"] as const;

export const OFFER_SERVICES = [
  { name: "Professional Websites", detail: "Responsive conversion sites." },
  { name: "Landing Pages", detail: "Campaign pages." },
  { name: "Sales Funnels", detail: "Funnel journeys." },
  { name: "Lead Capture Systems", detail: "Forms, booking, WhatsApp, and quote flows." },
  { name: "Brand Identity Starter Kits", detail: "Logo, colour, type, and positioning." },
  { name: "Basic Automation Setup", detail: "Enquiry, email, WhatsApp, and lead-routing automation." },
  { name: "AI AutoTech Upgrade Path", detail: "" },
] as const;

export const OFFER_PACKAGES = [
  {
    name: "Starter Online Presence",
    features: ["1-page responsive site", "contact form", "WhatsApp button", "basic SEO", "social links", "fast-loading layout"],
    asksForPricing: true,
  },
  {
    name: "Business Website System",
    features: ["5-page site", "lead form", "WhatsApp", "booking link", "analytics", "SEO structure"],
    asksForPricing: true,
  },
  {
    name: "Funnel + Lead Generation System",
    features: ["landing page", "sales funnel", "lead magnet", "quote form", "email notification", "WhatsApp CTA", "conversion copy", "CRM-ready structure"],
    asksForPricing: true,
  },
  {
    name: "AI AutoTech Scale Upgrade",
    features: ["CRM setup", "WhatsApp automation", "AI chatbot/lead qualification", "workflow automation", "client onboarding", "dashboard integration", "business-process automation"],
    asksForPricing: false,
  },
] as const;

export const LEGACY_JOB_KINDS = ["Website", "WhatsApp", "AI Employee", "Other"] as const;

export const JOB_KINDS = [
  ...OFFER_SERVICES.map((item) => item.name),
  ...OFFER_PACKAGES.map((item) => item.name),
  ...LEGACY_JOB_KINDS,
] as const;

export type JobKind = (typeof JOB_KINDS)[number];

export const OPERATING_DIVISIONS = [
  "Revenue & Sales",
  "Operations",
  "Technology",
  "Marketing",
  "Intelligence",
  "Client Relations",
] as const;

export const AGENT_DEPARTMENTS = [
  "Executive",
  "Sales",
  "Voice",
  "Research",
  "Website",
  "Automation",
  "Client Success",
  "Finance",
  "Content",
  "Admin",
] as const;

export const AUTOMATION_SUITE = [
  "AI chatbots/sales assistants",
  "WhatsApp+CRM",
  "Automated client onboarding",
  "Internal dashboards/process automation",
  "Custom web apps/infrastructure",
] as const;

export function isJobKind(value: string): value is JobKind {
  return (JOB_KINDS as readonly string[]).includes(value);
}
