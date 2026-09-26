import { emptyChannels, type WorkspaceBlueprint, type WorkspaceSummary } from "./types";

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

export const BLUEPRINTS = [AGENCY_BLUEPRINT, EDUCATION_BLUEPRINT];

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
    settings: { channels: emptyChannels() },
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
    settings: { channels: emptyChannels() },
  };
  return [agency, eastc];
}
