export const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Audit booked",
  "Audit done",
  "Proposal sent",
  "Won",
  "Lost",
  "Onboarding/Handover",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const OPEN_STAGES: PipelineStage[] = [
  "New",
  "Contacted",
  "Audit booked",
  "Audit done",
  "Proposal sent",
];

export type Channel = "whatsapp" | "email";

export type OutboxStatus = "queued" | "approved" | "sent" | "failed" | "cancelled";

export type AssignmentStrategy = "fixed" | "round_robin";

export type AssignmentRule = {
  id: string;
  name: string;
  active: boolean;
  matchSource: string;
  matchQrSource: string;
  owner: string;
};

export type AutomationSettings = {
  defaultOwner: string;
  strategy: AssignmentStrategy;
  team: string[];
  roundRobinIndex: number;
  bookingUrl: string;
  proposalFollowupDays: number;
  staleGraceDays: number;
  stuckAfterDays: number;
  checklist: string[];
  rules: AssignmentRule[];
};

export type MessageTemplate = {
  key: string;
  channel: Channel;
  name: string;
  subject: string;
  body: string;
  active: boolean;
};

export type LeadRecord = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  whatsapp: string;
  stage: PipelineStage;
  notes: string;
  source: string;
  qrSource: string;
  campaign: string;
  eventName: string;
  ownerName: string;
  score: number;
  scoreReasons: string[];
  companySize: string;
  website: string;
  industry: string;
  answers: Record<string, unknown>;
  valueZar: number;
  bookedAt: string | null;
  auditDoneAt: string | null;
  proposalSentAt: string | null;
  stageChangedAt: string;
  createdAt: string;
  updatedAt: string;
  sequenceStep: number;
  lostReason: string;
  wonAt: string | null;
  repliedAt: string | null;
  enrolled: boolean;
  auditLeadId: string | null;
  contactLeadId: string | null;
  ord: number;
};

export type Activity = {
  id: string;
  leadId: string;
  kind: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type OutboxMessage = {
  id: string;
  leadId: string;
  templateKey: string;
  channel: Channel;
  toAddress: string;
  subject: string;
  body: string;
  status: OutboxStatus;
  scheduledFor: string;
  sentAt: string | null;
  provider: string;
  providerId: string;
  error: string;
  waLink: string;
  createdAt: string;
};

export type Handover = {
  id: string;
  leadId: string;
  deliveredBy: string;
  whatSold: string;
  valueZar: number;
  createdAt: string;
};

export type OnboardingTask = {
  id: string;
  leadId: string;
  handoverId: string;
  title: string;
  done: boolean;
  ord: number;
  createdAt: string;
};

export type QuotePlaceholder = {
  id: string;
  leadId: string;
  handoverId: string;
  kind: "quote" | "invoice";
  reference: string;
  description: string;
  amountZar: number;
  status: string;
  createdAt: string;
};

export type AutomationState = {
  leads: LeadRecord[];
  activities: Activity[];
  outbox: OutboxMessage[];
  templates: MessageTemplate[];
  settings: AutomationSettings;
  handovers: Handover[];
  tasks: OnboardingTask[];
  quotes: QuotePlaceholder[];
};

export type CaptureInput = {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  notes?: string;
  source?: string;
  qrSource?: string;
  campaign?: string;
  eventName?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  answers?: Record<string, unknown>;
  recommendations?: unknown[];
  valueZar?: number;
  auditLeadId?: string | null;
  contactLeadId?: string | null;
  createdAt?: string;
};

export type InboundEvent = {
  type: "booking.created" | "reply.received" | "audit.completed" | "proposal.sent";
  leadId?: string;
  email?: string;
  phone?: string;
  startsAt?: string;
  text?: string;
  valueZar?: number;
  whatSold?: string;
};

export const JOHANNESBURG = "Africa/Johannesburg";

export const DEFAULT_CHECKLIST = [
  "Confirm what was sold and how we will know it worked",
  "Introduce the person who will deliver the work",
  "Collect WhatsApp, website, and inbox access",
  "Book the kickoff call",
  "Send the draft quote or invoice for acceptance",
];

export const DEFAULT_SETTINGS: AutomationSettings = {
  defaultOwner: "Billy",
  strategy: "fixed",
  team: ["Billy"],
  roundRobinIndex: 0,
  bookingUrl: "",
  proposalFollowupDays: 3,
  staleGraceDays: 2,
  stuckAfterDays: 3,
  checklist: DEFAULT_CHECKLIST,
  rules: [
    {
      id: "qr-billy",
      name: "Billy's phone QR",
      active: true,
      matchSource: "",
      matchQrSource: "billy_phone_qr",
      owner: "Billy",
    },
  ],
};

export function normalizeStage(stage: string): PipelineStage {
  if (stage === "Talking") return "Contacted";
  if (stage === "Quoted") return "Proposal sent";
  if ((PIPELINE_STAGES as readonly string[]).includes(stage)) return stage as PipelineStage;
  return "New";
}

export function emptyLead(partial: Partial<LeadRecord> & Pick<LeadRecord, "id" | "name" | "createdAt">): LeadRecord {
  return {
    company: "",
    phone: "",
    email: "",
    whatsapp: "",
    stage: "New",
    notes: "",
    source: "",
    qrSource: "",
    campaign: "",
    eventName: "",
    ownerName: "",
    score: 0,
    scoreReasons: [],
    companySize: "",
    website: "",
    industry: "",
    answers: {},
    valueZar: 0,
    bookedAt: null,
    auditDoneAt: null,
    proposalSentAt: null,
    stageChangedAt: partial.createdAt,
    updatedAt: partial.createdAt,
    sequenceStep: 0,
    lostReason: "",
    wonAt: null,
    repliedAt: null,
    enrolled: false,
    auditLeadId: null,
    contactLeadId: null,
    ord: 0,
    ...partial,
  };
}
