import type { BotCategory, BotConfig, BotEngine, CatalogBot, CatalogBundle, TeamTemplate, TemplatePipeline, TemplateWorkflow } from "@/lib/bots/catalog-types";
import { questionsForDepartment } from "@/lib/bots/setup-questions";

export const AGENT_DEPARTMENTS = [
  "sales",
  "marketing",
  "branding",
  "admin",
  "operations",
  "customer-service",
  "booking",
  "finance",
  "hr",
  "onboarding",
  "reputation",
  "social",
  "ads",
  "content",
  "ecommerce",
  "it-support",
] as const;

export type AgentDepartment = (typeof AGENT_DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<AgentDepartment, string> = {
  sales: "Sales",
  marketing: "Marketing",
  branding: "Branding",
  admin: "Admin",
  operations: "Operations",
  "customer-service": "Customer service",
  booking: "Booking / reception",
  finance: "Finance / bookkeeping",
  hr: "HR / recruitment",
  onboarding: "Onboarding",
  reputation: "Reputation / reviews",
  social: "Social media",
  ads: "Ads",
  content: "Content",
  ecommerce: "Ecommerce / fulfilment",
  "it-support": "IT / support",
};

export const INDUSTRIES = [
  "healthcare",
  "fashion",
  "restaurant",
  "real-estate",
  "education",
  "beauty",
  "fitness",
  "legal",
  "trades",
  "automotive",
  "ecommerce",
  "agency",
  "youtube",
  "facebook",
  "tiktok",
  "podcast",
  "personal-brand",
  "ai-agency",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<Industry, string> = {
  healthcare: "Healthcare / clinic",
  fashion: "Clothing / fashion",
  restaurant: "Restaurant / food",
  "real-estate": "Real estate",
  education: "Education / school",
  beauty: "Beauty / salon / spa",
  fitness: "Fitness / gym",
  legal: "Legal / professional services",
  trades: "Trades / home services",
  automotive: "Automotive",
  ecommerce: "Ecommerce store",
  agency: "Agency / consulting",
  youtube: "Faceless YouTube",
  facebook: "Facebook page / community",
  tiktok: "TikTok / Reels",
  podcast: "Podcast",
  "personal-brand": "Personal brand",
  "ai-agency": "AI agency / automation agency",
};

/** Human role each agent reports to. Shown on the agent page and the Team page. */
export const DEPARTMENT_LEADS: Record<AgentDepartment, string> = {
  sales: "Sales lead",
  marketing: "Marketing lead",
  branding: "Brand lead",
  admin: "Office manager",
  operations: "Operations lead",
  "customer-service": "Support lead",
  booking: "Front desk lead",
  finance: "Finance lead",
  hr: "People lead",
  onboarding: "Client success lead",
  reputation: "Reputation lead",
  social: "Social lead",
  ads: "Ads lead",
  content: "Content lead",
  ecommerce: "Fulfilment lead",
  "it-support": "IT lead",
};

export type AgentTouches = {
  pipelines: string[];
  inbox: boolean;
  tasks: boolean;
  calendar: boolean;
  reviews: boolean;
  reportsTo: string;
};

const HOURS = {
  timezone: "Africa/Johannesburg",
  start: "08:00",
  end: "17:00",
  days: [1, 2, 3, 4, 5],
};

const CATEGORY_OF: Record<AgentDepartment, BotCategory> = {
  sales: "sales",
  onboarding: "sales",
  marketing: "marketing",
  branding: "marketing",
  social: "marketing",
  ads: "marketing",
  content: "marketing",
  "customer-service": "support",
  booking: "support",
  reputation: "support",
  "it-support": "support",
  admin: "ops",
  operations: "ops",
  finance: "ops",
  hr: "ops",
  ecommerce: "ops",
};

type AgentSeed = {
  slug: string;
  name: string;
  department: AgentDepartment;
  description: string;
  monthlyPriceCents: number;
  capabilities: string[];
  engine: BotEngine;
  tone: string;
  channel: string;
  pipeline: string;
  stage: string;
  inbox?: boolean;
  tasks?: boolean;
  calendar?: boolean;
  reviews?: boolean;
};

function config(seed: AgentSeed): BotConfig {
  return {
    tone: seed.tone,
    workingHours: HOURS,
    pipeline: seed.pipeline,
    stage: seed.stage,
    channel: seed.channel,
  };
}

function agent(seed: AgentSeed): CatalogBot {
  const tasks = seed.tasks ?? (seed.engine === "workflows" || seed.engine === "calendar" || seed.capabilities.includes("task"));
  return {
    slug: seed.slug,
    name: seed.name,
    category: CATEGORY_OF[seed.department],
    department: seed.department,
    description: seed.description,
    monthlyPriceCents: seed.monthlyPriceCents,
    currency: "ZAR",
    pricePlaceholder: true,
    capabilities: seed.capabilities,
    defaultConfig: config(seed),
    engine: seed.engine,
    active: true,
    touches: {
      pipelines: [seed.pipeline],
      inbox: seed.inbox ?? ["whatsapp", "email", "sms"].includes(seed.channel),
      tasks,
      calendar: seed.calendar ?? seed.engine === "calendar",
      reviews: seed.reviews ?? seed.department === "reputation",
      reportsTo: DEPARTMENT_LEADS[seed.department],
    },
    setupQuestions: questionsForDepartment(seed.department),
  };
}

const SALES_PIPE = "pipeline:bot:sales-team";
const MARKET_PIPE = "pipeline:bot:marketing-team";

/** Placeholder ZAR prices, to be confirmed by Billy. */
const SEEDS: AgentSeed[] = [
  { slug: "inbound-lead", name: "Inbound Lead", department: "sales", description: "Assigns a new lead and saves an AI reply draft. Nothing is sent.", monthlyPriceCents: 150_000, capabilities: ["assign-lead", "ai-draft", "workflow"], engine: "ai_reply", tone: "warm and plain", channel: "whatsapp", pipeline: SALES_PIPE, stage: "stage:bot:sales-team:new", tasks: true },
  { slug: "outbound-sales", name: "Outbound Sales", department: "sales", description: "Drafts outreach after consent and suppression checks. Nothing is sent.", monthlyPriceCents: 200_000, capabilities: ["outbox-draft", "consent-check"], engine: "outbox_draft", tone: "direct", channel: "whatsapp", pipeline: SALES_PIPE, stage: "stage:bot:sales-team:contacted" },
  { slug: "proposal-writer", name: "Proposal Writer", department: "sales", description: "Drafts a proposal note for the open deal. Nothing is sent.", monthlyPriceCents: 140_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "clear", channel: "email", pipeline: SALES_PIPE, stage: "stage:bot:sales-team:proposal", tasks: true },
  { slug: "campaign-planner", name: "Campaign Planner", department: "marketing", description: "Plans a campaign and saves a task. Nothing is sent.", monthlyPriceCents: 150_000, capabilities: ["task", "workflow"], engine: "workflows", tone: "clear", channel: "email", pipeline: MARKET_PIPE, stage: "stage:bot:marketing-team:idea" },
  { slug: "email-nurture", name: "Email Nurture", department: "marketing", description: "Drafts a nurture email after consent checks. Nothing is sent.", monthlyPriceCents: 130_000, capabilities: ["outbox-draft", "consent-check"], engine: "outbox_draft", tone: "helpful", channel: "email", pipeline: MARKET_PIPE, stage: "stage:bot:marketing-team:draft" },
  { slug: "offer-manager", name: "Offer Manager", department: "marketing", description: "Drafts an offer for the current campaign. Nothing is published.", monthlyPriceCents: 140_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "direct", channel: "email", pipeline: MARKET_PIPE, stage: "stage:bot:marketing-team:review", tasks: true },
  { slug: "brand-voice", name: "Brand Voice", department: "branding", description: "Drafts lines in the brand voice. Nothing is published.", monthlyPriceCents: 160_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "on brand", channel: "social", pipeline: "pipeline:bot:branding", stage: "stage:bot:branding:new", inbox: false, tasks: true },
  { slug: "visual-brief", name: "Visual Brief", department: "branding", description: "Writes a visual brief as a task. Nothing is published.", monthlyPriceCents: 140_000, capabilities: ["task"], engine: "workflows", tone: "precise", channel: "email", pipeline: "pipeline:bot:branding", stage: "stage:bot:branding:new", inbox: false },
  { slug: "brand-guidelines", name: "Brand Guidelines", department: "branding", description: "Keeps a guidelines checklist as a task. Nothing is sent.", monthlyPriceCents: 120_000, capabilities: ["task"], engine: "workflows", tone: "plain", channel: "email", pipeline: "pipeline:bot:branding", stage: "stage:bot:branding:new", inbox: false },
  { slug: "inbox-clerk", name: "Inbox Clerk", department: "admin", description: "Sorts the inbox into a task list. Nothing is sent.", monthlyPriceCents: 110_000, capabilities: ["task"], engine: "workflows", tone: "plain", channel: "email", pipeline: "pipeline:bot:admin", stage: "stage:bot:admin:new", inbox: true },
  { slug: "document-admin", name: "Document Admin", department: "admin", description: "Tracks missing documents as tasks. Nothing is sent.", monthlyPriceCents: 120_000, capabilities: ["task"], engine: "workflows", tone: "careful", channel: "email", pipeline: "pipeline:bot:admin", stage: "stage:bot:admin:new", inbox: false },
  { slug: "calendar-admin", name: "Calendar Admin", department: "admin", description: "Drafts a scheduling note and a task. Nothing is sent.", monthlyPriceCents: 130_000, capabilities: ["task", "calendar-link"], engine: "calendar", tone: "helpful", channel: "email", pipeline: "pipeline:bot:admin", stage: "stage:bot:admin:new" },
  { slug: "ops-coordinator", name: "Operations Coordinator", department: "operations", description: "Opens an operations task for the next handoff. Nothing is sent.", monthlyPriceCents: 150_000, capabilities: ["task", "workflow"], engine: "workflows", tone: "direct", channel: "email", pipeline: "pipeline:bot:operations", stage: "stage:bot:operations:new", inbox: false },
  { slug: "vendor-followup", name: "Vendor Follow-up", department: "operations", description: "Drafts a vendor follow-up after consent checks. Nothing is sent.", monthlyPriceCents: 130_000, capabilities: ["outbox-draft", "consent-check"], engine: "outbox_draft", tone: "brief", channel: "email", pipeline: "pipeline:bot:operations", stage: "stage:bot:operations:new" },
  { slug: "sop-keeper", name: "SOP Keeper", department: "operations", description: "Turns a repeat job into a checklist task. Nothing is sent.", monthlyPriceCents: 120_000, capabilities: ["task"], engine: "workflows", tone: "plain", channel: "email", pipeline: "pipeline:bot:operations", stage: "stage:bot:operations:new", inbox: false },
  { slug: "support-replies", name: "Support Replies", department: "customer-service", description: "Drafts a support reply. Nothing is sent.", monthlyPriceCents: 140_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "calm", channel: "whatsapp", pipeline: "pipeline:bot:customer-service", stage: "stage:bot:customer-service:new", tasks: true },
  { slug: "complaint-handler", name: "Complaint Handler", department: "customer-service", description: "Drafts a complaint reply and a task for a person. Nothing is sent.", monthlyPriceCents: 150_000, capabilities: ["ai-draft", "task"], engine: "ai_reply", tone: "careful", channel: "email", pipeline: "pipeline:bot:customer-service", stage: "stage:bot:customer-service:new" },
  { slug: "faq-drafts", name: "FAQ Drafts", department: "customer-service", description: "Drafts an answer from the usual questions. Nothing is sent.", monthlyPriceCents: 110_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "plain", channel: "email", pipeline: "pipeline:bot:customer-service", stage: "stage:bot:customer-service:new", tasks: false, inbox: true },
  { slug: "receptionist", name: "Receptionist", department: "booking", description: "Drafts a booking reply and a front-desk task. Nothing is sent.", monthlyPriceCents: 140_000, capabilities: ["calendar-link", "task", "ai-draft"], engine: "calendar", tone: "warm", channel: "whatsapp", pipeline: "pipeline:bot:booking", stage: "stage:bot:booking:new" },
  { slug: "reminder-drafts", name: "Reminder Drafts", department: "booking", description: "Drafts an appointment reminder after consent checks. Nothing is sent.", monthlyPriceCents: 120_000, capabilities: ["outbox-draft", "consent-check", "calendar-link"], engine: "outbox_draft", tone: "friendly", channel: "whatsapp", pipeline: "pipeline:bot:booking", stage: "stage:bot:booking:new", calendar: true },
  { slug: "waitlist", name: "Waitlist", department: "booking", description: "Keeps a waitlist task when the diary is full. Nothing is sent.", monthlyPriceCents: 100_000, capabilities: ["task"], engine: "workflows", tone: "brief", channel: "whatsapp", pipeline: "pipeline:bot:booking", stage: "stage:bot:booking:new" },
  { slug: "invoice-drafts", name: "Invoice Drafts", department: "finance", description: "Drafts an invoice note as a task. Nothing is charged and nothing is sent.", monthlyPriceCents: 140_000, capabilities: ["task"], engine: "workflows", tone: "formal", channel: "email", pipeline: "pipeline:bot:finance", stage: "stage:bot:finance:new", inbox: false },
  { slug: "bookkeeping-notes", name: "Bookkeeping Notes", department: "finance", description: "Files a bookkeeping task for the month. Nothing is sent.", monthlyPriceCents: 150_000, capabilities: ["task"], engine: "workflows", tone: "precise", channel: "email", pipeline: "pipeline:bot:finance", stage: "stage:bot:finance:new", inbox: false },
  { slug: "payment-chase", name: "Payment Chase", department: "finance", description: "Drafts a payment reminder after consent checks. Nothing is sent.", monthlyPriceCents: 130_000, capabilities: ["outbox-draft", "consent-check"], engine: "outbox_draft", tone: "polite", channel: "email", pipeline: "pipeline:bot:finance", stage: "stage:bot:finance:new" },
  { slug: "recruiter-screen", name: "Recruiter Screen", department: "hr", description: "Drafts a screening note and a task. Nothing is sent.", monthlyPriceCents: 150_000, capabilities: ["ai-draft", "task"], engine: "ai_reply", tone: "neutral", channel: "email", pipeline: "pipeline:bot:hr", stage: "stage:bot:hr:new" },
  { slug: "interview-scheduler", name: "Interview Scheduler", department: "hr", description: "Drafts an interview time and a booking link. Nothing is sent.", monthlyPriceCents: 130_000, capabilities: ["calendar-link", "task"], engine: "calendar", tone: "warm", channel: "email", pipeline: "pipeline:bot:hr", stage: "stage:bot:hr:new" },
  { slug: "people-onboarding", name: "People Onboarding", department: "hr", description: "Creates a new-hire checklist task. Nothing is sent.", monthlyPriceCents: 120_000, capabilities: ["task"], engine: "workflows", tone: "helpful", channel: "email", pipeline: "pipeline:bot:hr", stage: "stage:bot:hr:new", inbox: false },
  { slug: "onboarding", name: "Onboarding", department: "onboarding", description: "Creates onboarding tasks and a booking-link draft. Nothing is sent.", monthlyPriceCents: 100_000, capabilities: ["task", "calendar-link", "workflow"], engine: "calendar", tone: "helpful", channel: "email", pipeline: SALES_PIPE, stage: "stage:bot:sales-team:won" },
  { slug: "kickoff-tasks", name: "Kickoff Tasks", department: "onboarding", description: "Opens the kickoff task list for a new client. Nothing is sent.", monthlyPriceCents: 120_000, capabilities: ["task", "workflow"], engine: "workflows", tone: "clear", channel: "email", pipeline: "pipeline:bot:onboarding", stage: "stage:bot:onboarding:new", inbox: false },
  { slug: "handover-checklist", name: "Handover Checklist", department: "onboarding", description: "Writes the handover checklist as a task. Nothing is sent.", monthlyPriceCents: 110_000, capabilities: ["task"], engine: "workflows", tone: "plain", channel: "email", pipeline: "pipeline:bot:onboarding", stage: "stage:bot:onboarding:new", inbox: false },
  { slug: "review-requests", name: "Review Requests", department: "reputation", description: "Drafts a review request after consent checks. Nothing is sent.", monthlyPriceCents: 120_000, capabilities: ["outbox-draft", "consent-check"], engine: "outbox_draft", tone: "grateful", channel: "whatsapp", pipeline: "pipeline:bot:reputation", stage: "stage:bot:reputation:new", reviews: true },
  { slug: "review-replies", name: "Review Replies", department: "reputation", description: "Drafts a reply to a public review. Nothing is posted.", monthlyPriceCents: 130_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "grateful", channel: "social", pipeline: "pipeline:bot:reputation", stage: "stage:bot:reputation:new", inbox: false, tasks: true, reviews: true },
  { slug: "rating-watch", name: "Rating Watch", department: "reputation", description: "Opens a task when a rating needs a person. Nothing is posted.", monthlyPriceCents: 110_000, capabilities: ["task"], engine: "workflows", tone: "calm", channel: "email", pipeline: "pipeline:bot:reputation", stage: "stage:bot:reputation:new", inbox: false, reviews: true },
  { slug: "social-posting", name: "Social Media Posting", department: "social", description: "Drafts social posts only. Nothing is published.", monthlyPriceCents: 120_000, capabilities: ["social-post-draft"], engine: "workflows", tone: "friendly", channel: "social", pipeline: MARKET_PIPE, stage: "stage:bot:marketing-team:idea", inbox: false, tasks: false },
  { slug: "community-replies", name: "Community Replies", department: "social", description: "Drafts a reply to a comment. Nothing is published.", monthlyPriceCents: 130_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "friendly", channel: "social", pipeline: "pipeline:bot:social", stage: "stage:bot:social:new", inbox: true, tasks: true },
  { slug: "content-calendar", name: "Content Calendar", department: "social", description: "Files the week's posts as tasks. Nothing is published.", monthlyPriceCents: 140_000, capabilities: ["task"], engine: "workflows", tone: "bright", channel: "social", pipeline: "pipeline:bot:social", stage: "stage:bot:social:new", inbox: false },
  { slug: "ads", name: "Ads", department: "ads", description: "Drafts ad copy only. Nothing is published.", monthlyPriceCents: 180_000, capabilities: ["ad-copy-draft"], engine: "outbox_draft", tone: "clear", channel: "ads", pipeline: MARKET_PIPE, stage: "stage:bot:marketing-team:draft", inbox: false, tasks: false },
  { slug: "search-copy", name: "Search Copy", department: "ads", description: "Drafts search ad lines. Nothing is published.", monthlyPriceCents: 150_000, capabilities: ["ad-copy-draft"], engine: "outbox_draft", tone: "tight", channel: "ads", pipeline: "pipeline:bot:ads", stage: "stage:bot:ads:new", inbox: false, tasks: false },
  { slug: "retargeting-copy", name: "Retargeting Copy", department: "ads", description: "Drafts retargeting copy. Nothing is published.", monthlyPriceCents: 150_000, capabilities: ["ad-copy-draft"], engine: "outbox_draft", tone: "direct", channel: "ads", pipeline: "pipeline:bot:ads", stage: "stage:bot:ads:new", inbox: false, tasks: false },
  { slug: "blog-drafts", name: "Blog Drafts", department: "content", description: "Drafts a short article. Nothing is published.", monthlyPriceCents: 140_000, capabilities: ["content-draft"], engine: "workflows", tone: "useful", channel: "email", pipeline: "pipeline:bot:content", stage: "stage:bot:content:new", inbox: false, tasks: true },
  { slug: "newsletter-drafts", name: "Newsletter Drafts", department: "content", description: "Drafts a newsletter after consent checks. Nothing is sent.", monthlyPriceCents: 140_000, capabilities: ["outbox-draft", "consent-check"], engine: "outbox_draft", tone: "warm", channel: "email", pipeline: "pipeline:bot:content", stage: "stage:bot:content:new" },
  { slug: "case-study", name: "Case Study", department: "content", description: "Drafts a case study outline as a task. Nothing is published.", monthlyPriceCents: 160_000, capabilities: ["task", "content-draft"], engine: "workflows", tone: "specific", channel: "email", pipeline: "pipeline:bot:content", stage: "stage:bot:content:new", inbox: false },
  { slug: "order-status", name: "Order Status", department: "ecommerce", description: "Drafts an order update. Nothing is sent.", monthlyPriceCents: 130_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "clear", channel: "email", pipeline: "pipeline:bot:ecommerce", stage: "stage:bot:ecommerce:new", tasks: true },
  { slug: "fulfilment-tasks", name: "Fulfilment Tasks", department: "ecommerce", description: "Opens a fulfilment task for an order. Nothing is sent.", monthlyPriceCents: 140_000, capabilities: ["task"], engine: "workflows", tone: "brief", channel: "email", pipeline: "pipeline:bot:ecommerce", stage: "stage:bot:ecommerce:new", inbox: false },
  { slug: "returns-drafts", name: "Returns Drafts", department: "ecommerce", description: "Drafts a returns reply. Nothing is sent.", monthlyPriceCents: 120_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "fair", channel: "email", pipeline: "pipeline:bot:ecommerce", stage: "stage:bot:ecommerce:new", tasks: true },
  { slug: "ticket-triage", name: "Ticket Triage", department: "it-support", description: "Turns a support note into a task. Nothing is sent.", monthlyPriceCents: 140_000, capabilities: ["task"], engine: "workflows", tone: "calm", channel: "email", pipeline: "pipeline:bot:it-support", stage: "stage:bot:it-support:new", inbox: true },
  { slug: "password-help", name: "Password Help", department: "it-support", description: "Drafts password-reset steps. Nothing is sent and no secret is stored.", monthlyPriceCents: 110_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "plain", channel: "email", pipeline: "pipeline:bot:it-support", stage: "stage:bot:it-support:new", tasks: true },
  { slug: "status-notes", name: "Status Notes", department: "it-support", description: "Writes an internal status task. Nothing is sent.", monthlyPriceCents: 100_000, capabilities: ["task"], engine: "workflows", tone: "plain", channel: "email", pipeline: "pipeline:bot:it-support", stage: "stage:bot:it-support:new", inbox: false },
  { slug: "scriptwriter", name: "Scriptwriter", department: "content", description: "Drafts a script. Nothing is published.", monthlyPriceCents: 150_000, capabilities: ["content-draft"], engine: "workflows", tone: "clear", channel: "email", pipeline: "pipeline:bot:content", stage: "stage:bot:content:new", inbox: false, tasks: true },
  { slug: "video-editor-brief", name: "Video Editor Brief", department: "content", description: "Writes an editor brief as a task. Nothing is published.", monthlyPriceCents: 140_000, capabilities: ["task"], engine: "workflows", tone: "precise", channel: "email", pipeline: "pipeline:bot:content", stage: "stage:bot:content:new", inbox: false },
  { slug: "thumbnail-brief", name: "Thumbnail Brief", department: "content", description: "Writes a thumbnail and design brief as a task. Nothing is published.", monthlyPriceCents: 120_000, capabilities: ["task"], engine: "workflows", tone: "visual", channel: "email", pipeline: "pipeline:bot:content", stage: "stage:bot:content:new", inbox: false },
  { slug: "seo-titles", name: "SEO Titles", department: "content", description: "Drafts titles and search lines. Nothing is published.", monthlyPriceCents: 130_000, capabilities: ["content-draft"], engine: "ai_reply", tone: "tight", channel: "email", pipeline: "pipeline:bot:content", stage: "stage:bot:content:new", inbox: false, tasks: true },
  { slug: "scheduler-poster", name: "Scheduler", department: "social", description: "Files a posting slot and a draft. Nothing is published.", monthlyPriceCents: 120_000, capabilities: ["social-post-draft", "task"], engine: "workflows", tone: "brief", channel: "social", pipeline: "pipeline:bot:social", stage: "stage:bot:social:new", inbox: false },
  { slug: "community-manager", name: "Community Manager", department: "social", description: "Drafts a community reply. Nothing is published.", monthlyPriceCents: 140_000, capabilities: ["ai-draft"], engine: "ai_reply", tone: "friendly", channel: "social", pipeline: "pipeline:bot:social", stage: "stage:bot:social:new", inbox: true, tasks: true },
  { slug: "content-analytics", name: "Content Analytics", department: "content", description: "Writes a performance note as a task. Nothing is sent.", monthlyPriceCents: 130_000, capabilities: ["task"], engine: "workflows", tone: "plain", channel: "email", pipeline: "pipeline:bot:content", stage: "stage:bot:content:new", inbox: false },
];

export const BOT_CATALOG: CatalogBot[] = SEEDS.map(agent);

const bySlug = new Map(BOT_CATALOG.map((bot) => [bot.slug, bot]));

export function priceBand(slugs: string[]) {
  const bots = slugs.map((slug) => {
    const bot = bySlug.get(slug);
    if (!bot) throw new Error(`unknown bot ${slug}`);
    return bot;
  });
  const separateTotalCents = bots.reduce((sum, bot) => sum + bot.monthlyPriceCents, 0);
  const bundlePriceCents = separateTotalCents - Math.round(separateTotalCents * 0.2);
  return { separateTotalCents, bundlePriceCents };
}

function bundle(
  slug: string,
  name: string,
  description: string,
  botSlugs: string[],
  industry: Industry | null,
  department: AgentDepartment | null,
): CatalogBundle & { industry: Industry | null; department: AgentDepartment | null } {
  return {
    slug,
    name,
    description,
    botSlugs,
    bundlePriceCents: priceBand(botSlugs).bundlePriceCents,
    discountPercent: 20,
    currency: "ZAR",
    pricePlaceholder: true,
    industry,
    department,
  };
}

export const BOT_BUNDLES: Array<CatalogBundle & { industry: Industry | null; department: AgentDepartment | null }> = [
  bundle("sales-team", "Sales Team", "Inbound Lead, Outbound Sales, and Onboarding as one team. Placeholder price, to be confirmed by Billy.", ["inbound-lead", "outbound-sales", "onboarding"], null, "sales"),
  bundle("marketing-team", "Marketing Team", "Ads and Social Media Posting as one team. Placeholder price, to be confirmed by Billy.", ["ads", "social-posting"], null, "marketing"),
  bundle("admin-team", "Admin Team", "Inbox, documents, and calendar admin as one team. Placeholder price, to be confirmed by Billy.", ["inbox-clerk", "document-admin", "calendar-admin"], null, "admin"),
  bundle("operations-team", "Operations Team", "Coordination, vendors, and SOPs as one team. Placeholder price, to be confirmed by Billy.", ["ops-coordinator", "vendor-followup", "sop-keeper"], null, "operations"),
  bundle("full-business", "Full Business", "Sales and marketing agents together. Placeholder price, to be confirmed by Billy.", ["inbound-lead", "outbound-sales", "onboarding", "ads", "social-posting"], null, null),
  bundle("healthcare-clinic", "Healthcare / clinic", "Reception, reminders, patient admin, reviews, operations, and billing. Not a sales team. Placeholder price, to be confirmed by Billy.", ["receptionist", "reminder-drafts", "document-admin", "review-requests", "ops-coordinator", "invoice-drafts"], "healthcare", null),
  bundle("fashion-brand", "Clothing / fashion", "Branding, sales, marketing, social, ads, fulfilment, and customer service. Placeholder price, to be confirmed by Billy.", ["brand-voice", "inbound-lead", "campaign-planner", "social-posting", "ads", "order-status", "support-replies"], "fashion", null),
  bundle("restaurant-food", "Restaurant / food", "Reception, reminders, reviews, social, and offers. Placeholder price, to be confirmed by Billy.", ["receptionist", "reminder-drafts", "review-replies", "social-posting", "offer-manager"], "restaurant", null),
  bundle("real-estate", "Real estate", "Inbound, outbound, proposals, reminders, and reviews. Placeholder price, to be confirmed by Billy.", ["inbound-lead", "outbound-sales", "proposal-writer", "reminder-drafts", "review-requests"], "real-estate", null),
  bundle("education-school", "Education / school", "Admissions desk, documents, reminders, onboarding, and reviews. Uses the Education admissions stages. Placeholder price, to be confirmed by Billy.", ["receptionist", "document-admin", "reminder-drafts", "onboarding", "review-requests"], "education", null),
  bundle("beauty-salon", "Beauty / salon / spa", "Reception, reminders, reviews, social, and brand voice. Placeholder price, to be confirmed by Billy.", ["receptionist", "reminder-drafts", "review-requests", "social-posting", "brand-voice"], "beauty", null),
  bundle("fitness-gym", "Fitness / gym", "Leads, reception, reminders, social, and reviews. Placeholder price, to be confirmed by Billy.", ["inbound-lead", "receptionist", "reminder-drafts", "social-posting", "review-requests"], "fitness", null),
  bundle("legal-services", "Legal / professional services", "Intake, documents, diary, invoices, and onboarding. Placeholder price, to be confirmed by Billy.", ["inbound-lead", "document-admin", "calendar-admin", "invoice-drafts", "onboarding"], "legal", null),
  bundle("trades-home", "Trades / home services", "Leads, reception, reminders, invoices, and reviews. Placeholder price, to be confirmed by Billy.", ["inbound-lead", "receptionist", "reminder-drafts", "invoice-drafts", "review-requests"], "trades", null),
  bundle("automotive", "Automotive", "Leads, reception, reminders, reviews, and invoices. Placeholder price, to be confirmed by Billy.", ["inbound-lead", "receptionist", "reminder-drafts", "review-requests", "invoice-drafts"], "automotive", null),
  bundle("ecommerce-store", "Ecommerce store", "Orders, fulfilment, returns, support, ads, and social. Placeholder price, to be confirmed by Billy.", ["order-status", "fulfilment-tasks", "returns-drafts", "support-replies", "ads", "social-posting"], "ecommerce", null),
  bundle("agency-consulting", "Agency / consulting", "Inbound, outbound, proposals, onboarding, invoices, and content. Placeholder price, to be confirmed by Billy.", ["inbound-lead", "outbound-sales", "proposal-writer", "onboarding", "invoice-drafts", "blog-drafts"], "agency", null),
  bundle("faceless-youtube", "Faceless YouTube", "Scripts, edit briefs, thumbnails, titles, scheduling, and analytics. Placeholder price, to be confirmed by Billy.", ["scriptwriter", "video-editor-brief", "thumbnail-brief", "seo-titles", "scheduler-poster", "content-analytics"], "youtube", null),
  bundle("facebook-community", "Facebook page / community", "Community, scheduling, scripts, titles, analytics, and a content calendar. Placeholder price, to be confirmed by Billy.", ["community-manager", "scheduler-poster", "scriptwriter", "seo-titles", "content-analytics", "content-calendar"], "facebook", null),
  bundle("tiktok-reels", "TikTok / Reels", "Scripts, edit briefs, thumbnails, scheduling, and community replies. Placeholder price, to be confirmed by Billy.", ["scriptwriter", "video-editor-brief", "thumbnail-brief", "scheduler-poster", "community-manager"], "tiktok", null),
  bundle("podcast", "Podcast", "Scripts, titles, scheduling, community, and analytics. Placeholder price, to be confirmed by Billy.", ["scriptwriter", "seo-titles", "scheduler-poster", "community-manager", "content-analytics"], "podcast", null),
  bundle("personal-brand", "Personal brand", "Scripts, brand voice, scheduling, community, and titles. Placeholder price, to be confirmed by Billy.", ["scriptwriter", "brand-voice", "scheduler-poster", "community-manager", "seo-titles"], "personal-brand", null),
  bundle("ai-automation-agency", "AI agency / automation agency", "The AI AutoTech shape: inbound, outbound, proposals, onboarding, ads, social, support, and content. Placeholder price, to be confirmed by Billy.", ["inbound-lead", "outbound-sales", "proposal-writer", "onboarding", "ads", "social-posting", "support-replies", "blog-drafts"], "ai-agency", null),
];

function stages(prefix: string, rows: Array<[string, string, boolean?, boolean?]>): TemplatePipeline["stages"] {
  return rows.map(([key, name, won, lost], index) => ({
    assetKey: `${prefix}:${key}`,
    name,
    position: index + 1,
    isWon: Boolean(won),
    isLost: Boolean(lost),
  }));
}

function pipe(assetKey: string, name: string, stageRows: Array<[string, string, boolean?, boolean?]>): TemplatePipeline {
  const prefix = assetKey.replace("pipeline:", "stage:");
  return { assetKey, name, isDefault: false, stages: stages(prefix, stageRows) };
}

function flow(assetKey: string, name: string, triggerType: string, title: string): TemplateWorkflow {
  return { assetKey, name, triggerType, steps: [{ id: "task", kind: "create_task", title }] };
}

const SALES_PIPELINE: TemplatePipeline = {
  assetKey: "pipeline:bot:sales-team",
  name: "Sales Team",
  isDefault: false,
  stages: [
    { assetKey: "stage:bot:sales-team:new", name: "New", position: 1, isWon: false, isLost: false },
    { assetKey: "stage:bot:sales-team:contacted", name: "Contacted", position: 2, isWon: false, isLost: false },
    { assetKey: "stage:bot:sales-team:qualified", name: "Qualified", position: 3, isWon: false, isLost: false },
    { assetKey: "stage:bot:sales-team:proposal", name: "Proposal", position: 4, isWon: false, isLost: false },
    { assetKey: "stage:bot:sales-team:won", name: "Won", position: 5, isWon: true, isLost: false },
    { assetKey: "stage:bot:sales-team:lost", name: "Lost", position: 6, isWon: false, isLost: true },
  ],
};

const MARKETING_PIPELINE: TemplatePipeline = {
  assetKey: "pipeline:bot:marketing-team",
  name: "Marketing Team",
  isDefault: false,
  stages: [
    { assetKey: "stage:bot:marketing-team:idea", name: "Idea", position: 1, isWon: false, isLost: false },
    { assetKey: "stage:bot:marketing-team:draft", name: "Draft", position: 2, isWon: false, isLost: false },
    { assetKey: "stage:bot:marketing-team:review", name: "Review", position: 3, isWon: false, isLost: false },
    { assetKey: "stage:bot:marketing-team:scheduled", name: "Scheduled", position: 4, isWon: false, isLost: false },
  ],
};

const SALES_WORKFLOWS: TemplateWorkflow[] = [
  { assetKey: "workflow:bot:inbound-assign", name: "Assign inbound lead", triggerType: "lead.created", steps: [{ id: "assign", kind: "create_task", title: "Assign the inbound lead" }] },
  { assetKey: "workflow:bot:onboarding-tasks", name: "Onboarding tasks", triggerType: "lead.stage_changed", steps: [{ id: "welcome", kind: "create_task", title: "Create the onboarding tasks" }] },
];

const MARKETING_WORKFLOWS: TemplateWorkflow[] = [
  { assetKey: "workflow:bot:ads-draft", name: "Draft ad copy", triggerType: "schedule.cron", steps: [{ id: "ad", kind: "create_task", title: "Draft the ad copy" }] },
  { assetKey: "workflow:bot:social-draft", name: "Draft social post", triggerType: "schedule.cron", steps: [{ id: "post", kind: "create_task", title: "Draft the social post" }] },
];

/** Same stage keys as the Education snapshot in src/lib/snapshots/catalog.ts. */
export const EDUCATION_ADMISSIONS_PIPELINE: TemplatePipeline = {
  assetKey: "pipeline:admissions",
  name: "Admissions",
  isDefault: false,
  stages: [
    { assetKey: "stage:admissions:enquiry", name: "Enquiry", position: 1, isWon: false, isLost: false },
    { assetKey: "stage:admissions:application-started", name: "Application Started", position: 2, isWon: false, isLost: false },
    { assetKey: "stage:admissions:docs-submitted", name: "Docs Submitted", position: 3, isWon: false, isLost: false },
    { assetKey: "stage:admissions:accepted", name: "Accepted", position: 4, isWon: false, isLost: false },
    { assetKey: "stage:admissions:registered", name: "Registered", position: 5, isWon: true, isLost: false },
    { assetKey: "stage:admissions:lost", name: "Lost", position: 6, isWon: false, isLost: true },
  ],
};

const SIMPLE: Array<[string, string, boolean?, boolean?]> = [
  ["new", "New"],
  ["doing", "In progress"],
  ["done", "Done", true],
];

function botsFor(slugs: string[]) {
  return slugs.map((slug) => {
    const bot = bySlug.get(slug);
    if (!bot) throw new Error(`unknown bot ${slug}`);
    return { slug, config: bot.defaultConfig };
  });
}

function niche(
  slug: string,
  name: string,
  description: string,
  industry: Industry,
  pipeline: TemplatePipeline,
  workflowTitle: string,
): TeamTemplate {
  const source = BOT_BUNDLES.find((item) => item.slug === slug);
  if (!source) throw new Error(`unknown bundle ${slug}`);
  return {
    slug,
    name,
    description,
    bundleSlug: slug,
    industry,
    department: null,
    bots: botsFor(source.botSlugs),
    pipelines: [pipeline],
    workflows: [flow(`workflow:bot:${slug}`, workflowTitle, "lead.created", workflowTitle)],
  };
}

export const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    slug: "sales-team",
    name: "Sales Team",
    description: "One click: inbound, outbound, and onboarding agents, the sales pipeline, and task workflows. Sending stays off.",
    bundleSlug: "sales-team",
    industry: null,
    department: "sales",
    bots: botsFor(["inbound-lead", "outbound-sales", "onboarding"]),
    pipelines: [SALES_PIPELINE],
    workflows: SALES_WORKFLOWS,
  },
  {
    slug: "marketing-team",
    name: "Marketing Team",
    description: "One click: ads and social agents, the marketing pipeline, and draft workflows. Sending stays off.",
    bundleSlug: "marketing-team",
    industry: null,
    department: "marketing",
    bots: botsFor(["ads", "social-posting"]),
    pipelines: [MARKETING_PIPELINE],
    workflows: MARKETING_WORKFLOWS,
  },
  {
    slug: "admin-team",
    name: "Admin Team",
    description: "One click: inbox, documents, and calendar agents. Sending stays off.",
    bundleSlug: "admin-team",
    industry: null,
    department: "admin",
    bots: botsFor(["inbox-clerk", "document-admin", "calendar-admin"]),
    pipelines: [pipe("pipeline:bot:admin", "Admin", SIMPLE)],
    workflows: [flow("workflow:bot:admin-file", "File the admin item", "lead.created", "File the admin item")],
  },
  {
    slug: "operations-team",
    name: "Operations Team",
    description: "One click: coordination, vendor, and SOP agents. Sending stays off.",
    bundleSlug: "operations-team",
    industry: null,
    department: "operations",
    bots: botsFor(["ops-coordinator", "vendor-followup", "sop-keeper"]),
    pipelines: [pipe("pipeline:bot:operations", "Operations", [["logged", "Logged"], ["doing", "In progress"], ["done", "Done", true]])],
    workflows: [flow("workflow:bot:ops-task", "Open the operations task", "lead.created", "Open the operations task")],
  },
  {
    slug: "full-business",
    name: "Full Business",
    description: "One click: the sales and marketing agents, both pipelines, and the task workflows. Sending stays off.",
    bundleSlug: "full-business",
    industry: null,
    department: null,
    bots: botsFor(["inbound-lead", "outbound-sales", "onboarding", "ads", "social-posting"]),
    pipelines: [SALES_PIPELINE, MARKETING_PIPELINE],
    workflows: [...SALES_WORKFLOWS, ...MARKETING_WORKFLOWS],
  },
  niche("healthcare-clinic", "Healthcare / clinic", "Reception, patient admin, reminders, reviews, operations, and billing. Sending stays off.", "healthcare", pipe("pipeline:bot:healthcare-clinic", "Clinic", [["enquiry", "Enquiry"], ["booked", "Booked"], ["seen", "Seen", true], ["follow-up", "Follow-up"]]), "Prepare the clinic follow-up"),
  niche("fashion-brand", "Clothing / fashion", "Brand, sales, marketing, social, ads, fulfilment, and service. Sending stays off.", "fashion", pipe("pipeline:bot:fashion-brand", "Fashion", [["lead", "Lead"], ["styled", "Styled"], ["ordered", "Ordered", true]]), "Draft the fashion follow-up"),
  niche("restaurant-food", "Restaurant / food", "Bookings, reminders, reviews, social, and offers. Sending stays off.", "restaurant", pipe("pipeline:bot:restaurant-food", "Restaurant", [["enquiry", "Enquiry"], ["booked", "Booked"], ["seated", "Seated", true]]), "Confirm the booking draft"),
  niche("real-estate", "Real estate", "Leads, viewings, proposals, and reviews. Sending stays off.", "real-estate", pipe("pipeline:bot:real-estate", "Property", [["enquiry", "Enquiry"], ["viewing", "Viewing"], ["offer", "Offer"], ["won", "Won", true], ["lost", "Lost", false, true]]), "Book the viewing task"),
  niche("education-school", "Education / school", "Admissions stages from the Education snapshot, plus the school agents. Sending stays off.", "education", EDUCATION_ADMISSIONS_PIPELINE, "Follow the admissions enquiry"),
  niche("beauty-salon", "Beauty / salon / spa", "Diary, reminders, reviews, and social. Sending stays off.", "beauty", pipe("pipeline:bot:beauty-salon", "Salon", [["enquiry", "Enquiry"], ["booked", "Booked"], ["visited", "Visited", true]]), "Hold the appointment draft"),
  niche("fitness-gym", "Fitness / gym", "Trials, memberships, reminders, and social. Sending stays off.", "fitness", pipe("pipeline:bot:fitness-gym", "Gym", [["trial", "Trial"], ["joined", "Joined", true], ["lost", "Lost", false, true]]), "Follow the trial booking"),
  niche("legal-services", "Legal / professional services", "Intake, documents, diary, and invoices. Sending stays off.", "legal", pipe("pipeline:bot:legal-services", "Matter", [["enquiry", "Enquiry"], ["consult", "Consult"], ["engaged", "Engaged", true], ["closed", "Closed", false, true]]), "Open the matter task"),
  niche("trades-home", "Trades / home services", "Jobs, visits, invoices, and reviews. Sending stays off.", "trades", pipe("pipeline:bot:trades-home", "Job", [["enquiry", "Enquiry"], ["quoted", "Quoted"], ["booked", "Booked"], ["done", "Done", true]]), "Schedule the site visit"),
  niche("automotive", "Automotive", "Enquiries, bookings, reviews, and invoices. Sending stays off.", "automotive", pipe("pipeline:bot:automotive", "Workshop", [["enquiry", "Enquiry"], ["booked", "Booked"], ["done", "Done", true]]), "Confirm the workshop booking"),
  niche("ecommerce-store", "Ecommerce store", "Orders, fulfilment, returns, and marketing drafts. Sending stays off.", "ecommerce", pipe("pipeline:bot:ecommerce-store", "Order", [["new", "New"], ["packed", "Packed"], ["fulfilled", "Fulfilled", true], ["returned", "Returned", false, true]]), "Open the fulfilment task"),
  niche("agency-consulting", "Agency / consulting", "Pipeline, proposals, onboarding, and content. Sending stays off.", "agency", pipe("pipeline:bot:agency-consulting", "Engagement", [["lead", "Lead"], ["proposal", "Proposal"], ["won", "Won", true], ["lost", "Lost", false, true]]), "Draft the engagement task"),
  niche("faceless-youtube", "Faceless YouTube", "Script, edit, thumbnail, titles, scheduler, and analytics. Sending stays off.", "youtube", pipe("pipeline:bot:faceless-youtube", "Video", [["idea", "Idea"], ["script", "Script"], ["edit", "Edit"], ["scheduled", "Scheduled", true]]), "Draft the next video task"),
  niche("facebook-community", "Facebook page / community", "Community, posts, and a content calendar. Sending stays off.", "facebook", pipe("pipeline:bot:facebook-community", "Community", [["idea", "Idea"], ["draft", "Draft"], ["scheduled", "Scheduled", true]]), "Draft the community post"),
  niche("tiktok-reels", "TikTok / Reels", "Short scripts, edits, and posting drafts. Sending stays off.", "tiktok", pipe("pipeline:bot:tiktok-reels", "Short", [["idea", "Idea"], ["cut", "Cut"], ["scheduled", "Scheduled", true]]), "Draft the short video task"),
  niche("podcast", "Podcast", "Episode scripts, titles, and posting drafts. Sending stays off.", "podcast", pipe("pipeline:bot:podcast", "Episode", [["idea", "Idea"], ["recorded", "Recorded"], ["scheduled", "Scheduled", true]]), "Draft the episode task"),
  niche("personal-brand", "Personal brand", "Founder scripts, voice, and posting drafts. Sending stays off.", "personal-brand", pipe("pipeline:bot:personal-brand", "Founder", [["idea", "Idea"], ["draft", "Draft"], ["scheduled", "Scheduled", true]]), "Draft the founder post"),
  niche("ai-automation-agency", "AI agency / automation agency", "The same shape as AI AutoTech: pipeline, proposals, onboarding, ads, social, support, and content. Sending stays off.", "ai-agency", pipe("pipeline:bot:ai-automation-agency", "Client", [["lead", "Lead"], ["proposal", "Proposal"], ["won", "Won", true], ["lost", "Lost", false, true]]), "Open the client task"),
];
