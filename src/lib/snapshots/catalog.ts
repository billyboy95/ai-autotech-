import { PIPELINE_STAGES } from "@/lib/automation/types";
import { DEFAULT_TEMPLATES, STEP_TEMPLATES } from "@/lib/automation/templates";
import { phase1SnapshotWorkflows } from "@/lib/workflows/phase1";
import type { SnapshotPayload, SnapshotPipeline, SnapshotSequence, SnapshotTemplate } from "@/lib/snapshots/payload";
import { AGENCY_DRAFT_WORKFLOWS, AGENCY_V2_EXTRAS, RESTAURANT_PAYLOAD, RESTAURANT_SNAPSHOT, RESTAURANT_SNAPSHOT_ID } from "@/lib/snapshots/templates-v2";

export { RESTAURANT_PAYLOAD, RESTAURANT_SNAPSHOT_ID };

export const AGENCY_DEFAULT_SNAPSHOT_ID = "a2c00000-0000-4000-8000-000000000001";
export const EDUCATION_SNAPSHOT_ID = "a2c00000-0000-4000-8000-000000000002";

export const PLAN_OPTIONS = [
  {
    key: "platform",
    label: "Platform R299 + agents",
    detail: "R299/mo covers the CRM, the Lead Agent, and a small computer-time pool. Agents are Starter, Pro, or Always-On. Placeholder price. Nothing is charged.",
  },
] as const;

export type PlanKey = (typeof PLAN_OPTIONS)[number]["key"];

export function planLabel(key: string) {
  const match = PLAN_OPTIONS.find((item) => item.key === key);
  if (match) return match.label;
  if (key === "starter" || key === "growth" || key === "scale") return "Platform R299 + agents";
  return key;
}

export type SnapshotOption = {
  id: string;
  name: string;
  description: string;
};

const AGENCY_STAGE_KEYS: Record<(typeof PIPELINE_STAGES)[number], string> = {
  New: "stage:sales:new",
  Contacted: "stage:sales:contacted",
  "Audit booked": "stage:sales:audit-booked",
  "Audit done": "stage:sales:audit-done",
  "Proposal sent": "stage:sales:proposal-sent",
  Won: "stage:sales:won",
  Lost: "stage:sales:lost",
  "Onboarding/Handover": "stage:sales:handover",
};

function agencyPipeline(): SnapshotPipeline {
  return {
    asset_key: "pipeline:sales",
    name: "Sales",
    is_default: true,
    stages: PIPELINE_STAGES.map((name, index) => ({
      asset_key: AGENCY_STAGE_KEYS[name],
      name,
      position: index + 1,
      is_won: name === "Won",
      is_lost: name === "Lost",
    })),
  };
}

function agencyTemplates(): SnapshotTemplate[] {
  return DEFAULT_TEMPLATES.map((template) => ({
    asset_key: `template:${template.key}`,
    channel: template.channel === "sms" ? "sms" : template.channel,
    name: template.name,
    subject: template.subject,
    body: template.body,
    active: template.active,
  }));
}

const NEW_LEAD_STEPS = [
  { id: "ack" as const, delay: 0 },
  { id: "day1" as const, delay: 24 },
  { id: "day3" as const, delay: 72 },
  { id: "day7" as const, delay: 168 },
];

function stepsFor(sequenceKey: string, items: ReadonlyArray<{ id: string; delay: number; keys: readonly string[] }>) {
  const steps = [];
  for (const item of items) {
    for (const key of item.keys) {
      const channel = key.endsWith("_email") ? "email" : key.endsWith("_sms") ? "sms" : "whatsapp";
      steps.push({
        asset_key: `step:${sequenceKey}:${item.id}:${channel}`,
        position: steps.length + 1,
        delay_hours: item.delay,
        channel: channel as "whatsapp" | "email" | "sms",
        template_asset_key: `template:${key}`,
      });
    }
  }
  return steps;
}

function agencySequences(): SnapshotSequence[] {
  return [
    {
      asset_key: "sequence:new-lead",
      name: "New lead follow-up",
      active: true,
      steps: stepsFor(
        "new-lead",
        NEW_LEAD_STEPS.map((step) => ({ ...step, keys: STEP_TEMPLATES[step.id] })),
      ),
    },
    {
      asset_key: "sequence:audit-reminder",
      name: "Audit reminder",
      active: true,
      steps: stepsFor("audit-reminder", [{ id: "audit", delay: 0, keys: STEP_TEMPLATES.audit_reminder }]),
    },
    {
      asset_key: "sequence:proposal-followup",
      name: "Proposal follow-up",
      active: true,
      steps: stepsFor("proposal-followup", [{ id: "proposal", delay: 72, keys: STEP_TEMPLATES.proposal_followup }]),
    },
  ];
}

export const AGENCY_DEFAULT_PAYLOAD: SnapshotPayload = {
  version: 2,
  pipelines: [agencyPipeline()],
  message_templates: agencyTemplates(),
  sequences: agencySequences(),
  custom_fields: [
    { asset_key: "field:lead:company-size", entity: "lead", field_key: "company_size", label: "Company size", field_type: "text", options: [], required: false, position: 1 },
    { asset_key: "field:lead:industry", entity: "lead", field_key: "industry", label: "Industry", field_type: "text", options: [], required: false, position: 2 },
    { asset_key: "field:lead:website", entity: "lead", field_key: "website", label: "Website", field_type: "text", options: [], required: false, position: 3 },
  ],
  workflows: [...phase1SnapshotWorkflows(), ...AGENCY_DRAFT_WORKFLOWS],
  ...AGENCY_V2_EXTRAS,
};

export const EDUCATION_STAGES = [
  "Enquiry",
  "Application Started",
  "Docs Submitted",
  "Accepted",
  "Registered",
  "Lost",
] as const;

export const EDUCATION_PAYLOAD: SnapshotPayload = {
  version: 1,
  pipelines: [
    {
      asset_key: "pipeline:admissions",
      name: "Admissions",
      is_default: true,
      stages: [
        { asset_key: "stage:admissions:enquiry", name: "Enquiry", position: 1, is_won: false, is_lost: false },
        { asset_key: "stage:admissions:application-started", name: "Application Started", position: 2, is_won: false, is_lost: false },
        { asset_key: "stage:admissions:docs-submitted", name: "Docs Submitted", position: 3, is_won: false, is_lost: false },
        { asset_key: "stage:admissions:accepted", name: "Accepted", position: 4, is_won: false, is_lost: false },
        { asset_key: "stage:admissions:registered", name: "Registered", position: 5, is_won: true, is_lost: false },
        { asset_key: "stage:admissions:lost", name: "Lost", position: 6, is_won: false, is_lost: true },
      ],
    },
  ],
  message_templates: [
    {
      asset_key: "template:admissions:enquiry",
      channel: "whatsapp",
      name: "Enquiry received",
      subject: "",
      body: "Hi {{firstName}}, thank you for your enquiry. An admissions advisor will contact you with the next step. This is a template only and is not sent automatically.",
      active: true,
    },
    {
      asset_key: "template:admissions:application",
      channel: "whatsapp",
      name: "Application started",
      subject: "",
      body: "Hi {{firstName}}, your application has been started. Reply if you want help finishing it. This template is not sent until sending is turned on.",
      active: true,
    },
    {
      asset_key: "template:admissions:docs",
      channel: "whatsapp",
      name: "Documents reminder",
      subject: "",
      body: "Hi {{firstName}}, we still need your documents before the application can move on. Reply with any questions. This template is not sent automatically.",
      active: true,
    },
    {
      asset_key: "template:admissions:accepted",
      channel: "whatsapp",
      name: "Accepted next steps",
      subject: "",
      body: "Hi {{firstName}}, your application was accepted. The next step is registration. This template is not sent automatically.",
      active: true,
    },
  ],
  sequences: [
    {
      asset_key: "sequence:admissions-follow-up",
      name: "Admissions follow-up",
      active: false,
      steps: [
        { asset_key: "step:admissions:enquiry", position: 1, delay_hours: 0, channel: "whatsapp", template_asset_key: "template:admissions:enquiry" },
        { asset_key: "step:admissions:application", position: 2, delay_hours: 24, channel: "whatsapp", template_asset_key: "template:admissions:application" },
        { asset_key: "step:admissions:docs", position: 3, delay_hours: 72, channel: "whatsapp", template_asset_key: "template:admissions:docs" },
        { asset_key: "step:admissions:accepted", position: 4, delay_hours: 0, channel: "whatsapp", template_asset_key: "template:admissions:accepted" },
      ],
    },
  ],
  custom_fields: [
    { asset_key: "field:admissions:programme", entity: "lead", field_key: "programme", label: "Programme", field_type: "text", options: [], required: false, position: 1 },
    { asset_key: "field:admissions:campus", entity: "lead", field_key: "campus", label: "Campus", field_type: "text", options: [], required: false, position: 2 },
    { asset_key: "field:admissions:intake", entity: "lead", field_key: "intake_month", label: "Intake", field_type: "text", options: [], required: false, position: 3 },
  ],
  workflows: [
    {
      asset_key: "workflow:admissions-enquiry",
      name: "Enquiry received",
      active: false,
      trigger_type: "form.submitted",
      trigger: {},
      steps: [
        { id: "note", title: "Tell the owner", action: { kind: "notify_user", text: "Enquiry stored. Nothing is sent." }, next: "end" },
        { id: "end", title: "End", action: { kind: "end" } },
      ],
    },
  ],
};

export const AGENCY_DEFAULT_SNAPSHOT: SnapshotOption = {
  id: AGENCY_DEFAULT_SNAPSHOT_ID,
  name: "Agency Default",
  description: "AI AutoTech sales pipeline, follow-up sequences, and message templates. Applying it does not send anything.",
};

export const EDUCATION_SNAPSHOT: SnapshotOption = {
  id: EDUCATION_SNAPSHOT_ID,
  name: "Education / Admissions",
  description: "Enquiry through Registered or Lost. WhatsApp follow-ups are stored as templates only and are not sent.",
};

export const SEEDED_SNAPSHOTS = [
  { ...AGENCY_DEFAULT_SNAPSHOT, payload: AGENCY_DEFAULT_PAYLOAD },
  { ...EDUCATION_SNAPSHOT, payload: EDUCATION_PAYLOAD },
  { ...RESTAURANT_SNAPSHOT, payload: RESTAURANT_PAYLOAD },
] as const;

export function seededSnapshotOptions(): SnapshotOption[] {
  return SEEDED_SNAPSHOTS.map(({ id, name, description }) => ({ id, name, description }));
}
