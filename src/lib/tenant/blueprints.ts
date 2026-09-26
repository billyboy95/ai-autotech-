import { emptyChannels, emptyShopify, type WorkspaceBlueprint, type WorkspaceSummary } from "./types";

export const AGENCY_BLUEPRINT: WorkspaceBlueprint = {
  key: "agency",
  label: "Agency snapshot (sales pipeline, follow-ups, templates)",
  pipelineName: "Sales",
  stages: [
    { name: "New", position: 1, isWon: false, isLost: false },
    { name: "Talking", position: 2, isWon: false, isLost: false },
    { name: "Quoted", position: 3, isWon: false, isLost: false },
    { name: "Won", position: 4, isWon: true, isLost: false },
    { name: "Lost", position: 5, isWon: false, isLost: true },
  ],
  templates: [
    {
      name: "First reply",
      channel: "whatsapp",
      body: "Hi {{name}}, this is AI AutoTech. Thanks for reaching out — when is a good time for a short call?",
    },
    {
      name: "Next-day follow-up",
      channel: "whatsapp",
      body: "Hi {{name}}, just checking you saw my note yesterday. Happy to map the first automation for {{company}}.",
    },
  ],
  sequenceName: "New lead follow-up",
  steps: [
    { position: 1, delayHours: 0, channel: "whatsapp", templateName: "First reply" },
    { position: 2, delayHours: 24, channel: "whatsapp", templateName: "Next-day follow-up" },
  ],
};

export const EDUCATION_BLUEPRINT: WorkspaceBlueprint = {
  key: "education",
  label: "Education campus (enquiry to enrolled)",
  pipelineName: "Enrolment",
  stages: [
    { name: "Enquiry", position: 1, isWon: false, isLost: false },
    { name: "Contacted", position: 2, isWon: false, isLost: false },
    { name: "Campus visit booked", position: 3, isWon: false, isLost: false },
    { name: "Application", position: 4, isWon: false, isLost: false },
    { name: "Enrolled", position: 5, isWon: true, isLost: false },
    { name: "Lost", position: 6, isWon: false, isLost: true },
  ],
  templates: [
    {
      name: "Enquiry received",
      channel: "whatsapp",
      body: "Hi {{name}}, we received your enquiry. A student advisor will contact you shortly.",
    },
    {
      name: "Campus visit",
      channel: "whatsapp",
      body: "Hi {{name}}, would you like to book a campus visit? Reply with a day that suits you.",
    },
    {
      name: "Application nudge",
      channel: "email",
      body: "Hi {{name}}, your application is still open. Reply if you want help finishing it.",
    },
  ],
  sequenceName: "Enquiry follow-up",
  steps: [
    { position: 1, delayHours: 0, channel: "whatsapp", templateName: "Enquiry received" },
    { position: 2, delayHours: 24, channel: "whatsapp", templateName: "Campus visit" },
    { position: 3, delayHours: 72, channel: "email", templateName: "Application nudge" },
  ],
};

export const ECOMMERCE_BLUEPRINT: WorkspaceBlueprint = {
  key: "ecommerce",
  label: "Ecommerce (visitor to repeat customer)",
  pipelineName: "Ecommerce",
  stages: [
    { name: "Visitor/lead", position: 1, isWon: false, isLost: false },
    { name: "Subscriber", position: 2, isWon: false, isLost: false },
    { name: "Cart abandoned", position: 3, isWon: false, isLost: false },
    { name: "Customer", position: 4, isWon: true, isLost: false },
    { name: "Repeat customer", position: 5, isWon: true, isLost: false },
    { name: "Lost", position: 6, isWon: false, isLost: true },
  ],
  templates: [
    {
      name: "Cart reminder",
      channel: "email",
      body: "Hi {{name}}, you left something in your cart. It is still waiting if you want it.",
    },
    {
      name: "Welcome subscriber",
      channel: "email",
      body: "Hi {{name}}, welcome. We will send the useful offers, not a flood.",
    },
  ],
  sequenceName: "Abandoned cart",
  steps: [
    { position: 1, delayHours: 1, channel: "email", templateName: "Cart reminder" },
    { position: 2, delayHours: 24, channel: "email", templateName: "Cart reminder" },
  ],
};

export const BLUEPRINTS = [AGENCY_BLUEPRINT, EDUCATION_BLUEPRINT, ECOMMERCE_BLUEPRINT];

export function blueprintForSlug(slug: string) {
  if (slug === "eastc") return EDUCATION_BLUEPRINT;
  if (slug === "zentrix") return ECOMMERCE_BLUEPRINT;
  return AGENCY_BLUEPRINT;
}

export function previewWorkspaces(): WorkspaceSummary[] {
  const agency: WorkspaceSummary = {
    id: "preview-agency",
    name: "AI AutoTech Pty Ltd",
    slug: "ai-autotech",
    orgType: "agency",
    parentId: null,
    legalName: "AI AutoTech Pty Ltd",
    location: "South Africa",
    industry: "AI automation",
    logoUrl: "",
    primaryColor: "#0B1F3A",
    accentColor: "#2563EB",
    domain: "aiautotech.co.za",
    formKey: "ai-autotech",
    settings: { channels: emptyChannels(), shopify: emptyShopify() },
  };
  const eastc: WorkspaceSummary = {
    id: "preview-eastc",
    name: "EASTC",
    slug: "eastc",
    orgType: "client",
    parentId: agency.id,
    legalName: "East Sea Technocentric Varsity",
    location: "Kempton Park, South Africa",
    industry: "Education",
    logoUrl: "",
    primaryColor: "#0F3D4C",
    accentColor: "#C4A35A",
    domain: "eastech.co.za",
    formKey: "eastc",
    settings: { channels: emptyChannels(), shopify: emptyShopify() },
  };
  const zentrix: WorkspaceSummary = {
    id: "preview-zentrix",
    name: "Zentrix Online",
    slug: "zentrix",
    orgType: "client",
    parentId: agency.id,
    legalName: "Zentrix Online",
    location: "South Africa",
    industry: "Ecommerce",
    logoUrl: "",
    primaryColor: "#111827",
    accentColor: "#16A34A",
    domain: "zentrixonline.co.za",
    formKey: "zentrix",
    settings: { channels: emptyChannels(), shopify: emptyShopify() },
  };
  return [agency, eastc, zentrix];
}
