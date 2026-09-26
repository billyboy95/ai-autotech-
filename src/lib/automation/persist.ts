import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TEMPLATES } from "@/lib/automation/templates";
import {
  DEFAULT_SETTINGS,
  emptyLead,
  normalizeStage,
  type Activity,
  type AssignmentRule,
  type AutomationSettings,
  type AutomationState,
  type Channel,
  type Handover,
  type LeadRecord,
  type MessageTemplate,
  type OnboardingTask,
  type OutboxMessage,
  type OutboxStatus,
  type QuotePlaceholder,
} from "@/lib/automation/types";

export const MIGRATION_FILE = "supabase/migrations/20260926160000_crm_automation.sql";

export function migrationHint(detail: string) {
  return `${detail} Apply ${MIGRATION_FILE} in the Supabase SQL editor. Existing leads are not deleted.`;
}

export async function loadSupabaseWorkspace(supabase: SupabaseClient): Promise<{
  state: AutomationState;
  automationReady: boolean;
  setupError: string | null;
}> {
  const leads = await supabase.from("crm_leads").select("*").order("ord", { ascending: true });
  if (leads.error) {
    throw new Error(`Could not read crm_leads: ${leads.error.message}`);
  }

  const [activities, outbox, templates, settings, handovers, tasks, quotes] = await Promise.all([
    supabase.from("crm_lead_activity").select("*").order("created_at", { ascending: true }),
    supabase.from("crm_outbox").select("*").order("scheduled_for", { ascending: true }),
    supabase.from("crm_message_templates").select("*"),
    supabase.from("crm_automation_settings").select("*").eq("id", "default").maybeSingle(),
    supabase.from("crm_handovers").select("*"),
    supabase.from("crm_onboarding_tasks").select("*").order("ord", { ascending: true }),
    supabase.from("crm_quote_placeholders").select("*"),
  ]);

  const setupError =
    activities.error?.message ||
    outbox.error?.message ||
    templates.error?.message ||
    settings.error?.message ||
    handovers.error?.message ||
    tasks.error?.message ||
    quotes.error?.message ||
    null;

  const templateRows = (templates.data ?? []) as Record<string, unknown>[];
  const settingsRow = settings.data as Record<string, unknown> | null;

  return {
    automationReady: !setupError,
    setupError: setupError ? migrationHint(setupError) : null,
    state: {
      leads: ((leads.data ?? []) as Record<string, unknown>[]).map(mapLead),
      activities: setupError ? [] : ((activities.data ?? []) as Record<string, unknown>[]).map(mapActivity),
      outbox: setupError ? [] : ((outbox.data ?? []) as Record<string, unknown>[]).map(mapOutbox),
      templates: templateRows.length ? templateRows.map(mapTemplate) : DEFAULT_TEMPLATES.map((template) => ({ ...template })),
      settings: settingsRow ? mapSettings(settingsRow) : structuredClone(DEFAULT_SETTINGS),
      handovers: setupError ? [] : ((handovers.data ?? []) as Record<string, unknown>[]).map(mapHandover),
      tasks: setupError ? [] : ((tasks.data ?? []) as Record<string, unknown>[]).map(mapTask),
      quotes: setupError ? [] : ((quotes.data ?? []) as Record<string, unknown>[]).map(mapQuote),
    },
  };
}

export async function saveSupabaseWorkspace(
  supabase: SupabaseClient,
  before: AutomationState,
  after: AutomationState,
) {
  if (after.leads.length) {
    const savedLeads = await supabase.from("crm_leads").upsert(after.leads.map(leadToRow));
    if (savedLeads.error) throw new Error(migrationHint(savedLeads.error.message));
  }

  const knownActivities = new Set(before.activities.map((item) => item.id));
  const freshActivities = after.activities.filter((item) => !knownActivities.has(item.id));
  if (freshActivities.length) {
    const saved = await supabase.from("crm_lead_activity").insert(freshActivities.map(activityToRow));
    if (saved.error) throw new Error(migrationHint(saved.error.message));
  }

  if (after.outbox.length) {
    const saved = await supabase.from("crm_outbox").upsert(after.outbox.map(outboxToRow));
    if (saved.error) throw new Error(migrationHint(saved.error.message));
  }

  if (after.templates.length) {
    const saved = await supabase.from("crm_message_templates").upsert(
      after.templates.map((template) => ({
        key: template.key,
        channel: template.channel,
        name: template.name,
        subject: template.subject,
        body: template.body,
        active: template.active,
        updated_at: new Date().toISOString(),
      })),
    );
    if (saved.error) throw new Error(migrationHint(saved.error.message));
  }

  const savedSettings = await supabase.from("crm_automation_settings").upsert(settingsToRow(after.settings));
  if (savedSettings.error) throw new Error(migrationHint(savedSettings.error.message));

  if (after.handovers.length) {
    const saved = await supabase.from("crm_handovers").upsert(after.handovers.map(handoverToRow));
    if (saved.error) throw new Error(migrationHint(saved.error.message));
  }
  if (after.tasks.length) {
    const saved = await supabase.from("crm_onboarding_tasks").upsert(after.tasks.map(taskToRow));
    if (saved.error) throw new Error(migrationHint(saved.error.message));
  }
  if (after.quotes.length) {
    const saved = await supabase.from("crm_quote_placeholders").upsert(after.quotes.map(quoteToRow));
    if (saved.error) throw new Error(migrationHint(saved.error.message));
  }

  await syncSourceStatus(supabase, before, after);
}

async function syncSourceStatus(supabase: SupabaseClient, before: AutomationState, after: AutomationState) {
  for (const lead of after.leads) {
    const prev = before.leads.find((item) => item.id === lead.id);
    if (prev && prev.stage === lead.stage) continue;
    if (lead.auditLeadId) {
      const status = auditStatus(lead.stage);
      if (status) await supabase.from("crm_audit_leads").update({ status }).eq("id", lead.auditLeadId);
    }
    if (lead.contactLeadId) {
      const status = contactStatus(lead.stage);
      if (status) await supabase.from("crm_contact_leads").update({ status }).eq("id", lead.contactLeadId);
    }
  }
}

function auditStatus(stage: LeadRecord["stage"]) {
  if (stage === "Contacted") return "contacted";
  if (stage === "Audit booked" || stage === "Audit done" || stage === "Proposal sent") return "booked";
  if (stage === "Won" || stage === "Onboarding/Handover") return "won";
  if (stage === "Lost") return "lost";
  return "";
}

function contactStatus(stage: LeadRecord["stage"]) {
  if (stage === "Contacted" || stage === "Audit booked" || stage === "Audit done" || stage === "Proposal sent") return "contacted";
  if (stage === "Won" || stage === "Onboarding/Handover") return "won";
  if (stage === "Lost") return "lost";
  return "";
}

function mapLead(row: Record<string, unknown>): LeadRecord {
  const createdAt = text(row.created_at) || new Date().toISOString();
  return emptyLead({
    id: text(row.id),
    name: text(row.name) || "Unnamed",
    company: text(row.company),
    phone: text(row.phone),
    email: text(row.email),
    whatsapp: text(row.whatsapp) || text(row.phone),
    stage: normalizeStage(text(row.stage) || "New"),
    notes: text(row.notes),
    source: text(row.source),
    qrSource: text(row.qr_source),
    campaign: text(row.campaign),
    eventName: text(row.event_name),
    ownerName: text(row.owner_name),
    score: num(row.score),
    scoreReasons: stringList(row.score_reasons),
    companySize: text(row.company_size),
    website: text(row.website),
    industry: text(row.industry),
    answers: record(row.answers),
    valueZar: num(row.value_zar),
    bookedAt: text(row.booked_at) || null,
    auditDoneAt: text(row.audit_done_at) || null,
    proposalSentAt: text(row.proposal_sent_at) || null,
    stageChangedAt: text(row.stage_changed_at) || createdAt,
    createdAt,
    updatedAt: text(row.updated_at) || createdAt,
    sequenceStep: num(row.sequence_step),
    lostReason: text(row.lost_reason),
    wonAt: text(row.won_at) || null,
    repliedAt: text(row.replied_at) || null,
    enrolled: Boolean(row.enrolled),
    auditLeadId: text(row.audit_lead_id) || null,
    contactLeadId: text(row.contact_lead_id) || null,
    ord: num(row.ord),
  });
}

function leadToRow(lead: LeadRecord) {
  return {
    id: lead.id,
    name: lead.name,
    company: lead.company,
    phone: lead.phone,
    email: lead.email,
    whatsapp: lead.whatsapp || lead.phone,
    stage: lead.stage,
    notes: lead.notes,
    source: lead.source,
    qr_source: lead.qrSource,
    campaign: lead.campaign,
    event_name: lead.eventName,
    owner_name: lead.ownerName,
    score: lead.score,
    score_reasons: lead.scoreReasons,
    company_size: lead.companySize,
    website: lead.website,
    industry: lead.industry,
    answers: lead.answers,
    value_zar: lead.valueZar,
    booked_at: lead.bookedAt,
    audit_done_at: lead.auditDoneAt,
    proposal_sent_at: lead.proposalSentAt,
    stage_changed_at: lead.stageChangedAt,
    sequence_step: lead.sequenceStep,
    lost_reason: lead.lostReason,
    won_at: lead.wonAt,
    replied_at: lead.repliedAt,
    enrolled: lead.enrolled,
    audit_lead_id: lead.auditLeadId,
    contact_lead_id: lead.contactLeadId,
    ord: lead.ord,
    updated_at: new Date().toISOString(),
  };
}

function mapActivity(row: Record<string, unknown>): Activity {
  return {
    id: text(row.id),
    leadId: text(row.lead_id),
    kind: text(row.kind),
    title: text(row.title),
    body: text(row.body),
    metadata: record(row.metadata),
    createdAt: text(row.created_at) || new Date().toISOString(),
  };
}

function activityToRow(item: Activity) {
  return {
    id: item.id,
    lead_id: item.leadId,
    kind: item.kind,
    title: item.title,
    body: item.body,
    metadata: item.metadata,
    created_at: item.createdAt,
  };
}

function mapOutbox(row: Record<string, unknown>): OutboxMessage {
  return {
    id: text(row.id),
    leadId: text(row.lead_id),
    templateKey: text(row.template_key),
    channel: text(row.channel) === "email" ? "email" : "whatsapp",
    toAddress: text(row.to_address),
    subject: text(row.subject),
    body: text(row.body),
    status: outboxStatus(text(row.status)),
    scheduledFor: text(row.scheduled_for) || new Date().toISOString(),
    sentAt: text(row.sent_at) || null,
    provider: text(row.provider),
    providerId: text(row.provider_id),
    error: text(row.error),
    waLink: text(row.wa_link),
    createdAt: text(row.created_at) || new Date().toISOString(),
  };
}

function outboxToRow(item: OutboxMessage) {
  return {
    id: item.id,
    lead_id: item.leadId,
    template_key: item.templateKey,
    channel: item.channel,
    to_address: item.toAddress,
    subject: item.subject,
    body: item.body,
    status: item.status,
    scheduled_for: item.scheduledFor,
    sent_at: item.sentAt,
    provider: item.provider,
    provider_id: item.providerId,
    error: item.error,
    wa_link: item.waLink,
    created_at: item.createdAt,
  };
}

function mapTemplate(row: Record<string, unknown>): MessageTemplate {
  return {
    key: text(row.key),
    channel: (text(row.channel) === "email" ? "email" : "whatsapp") as Channel,
    name: text(row.name),
    subject: text(row.subject),
    body: text(row.body),
    active: row.active !== false,
  };
}

function mapSettings(row: Record<string, unknown>): AutomationSettings {
  const strategy = text(row.strategy) === "round_robin" ? "round_robin" : "fixed";
  return {
    defaultOwner: text(row.default_owner) || "Billy",
    strategy,
    team: stringList(row.team).length ? stringList(row.team) : ["Billy"],
    roundRobinIndex: num(row.round_robin_index),
    bookingUrl: text(row.booking_url),
    proposalFollowupDays: num(row.proposal_followup_days) || 3,
    staleGraceDays: num(row.stale_grace_days) || 2,
    stuckAfterDays: num(row.stuck_after_days) || 3,
    checklist: stringList(row.checklist).length ? stringList(row.checklist) : [...DEFAULT_SETTINGS.checklist],
    rules: rules(row.rules),
  };
}

function settingsToRow(settings: AutomationSettings) {
  return {
    id: "default",
    default_owner: settings.defaultOwner || "Billy",
    strategy: settings.strategy,
    team: settings.team.length ? settings.team : ["Billy"],
    round_robin_index: settings.roundRobinIndex,
    booking_url: settings.bookingUrl,
    proposal_followup_days: settings.proposalFollowupDays,
    stale_grace_days: settings.staleGraceDays,
    stuck_after_days: settings.stuckAfterDays,
    checklist: settings.checklist,
    rules: settings.rules,
    updated_at: new Date().toISOString(),
  };
}

function mapHandover(row: Record<string, unknown>): Handover {
  return {
    id: text(row.id),
    leadId: text(row.lead_id),
    deliveredBy: text(row.delivered_by),
    whatSold: text(row.what_sold),
    valueZar: num(row.value_zar),
    createdAt: text(row.created_at) || new Date().toISOString(),
  };
}

function handoverToRow(item: Handover) {
  return {
    id: item.id,
    lead_id: item.leadId,
    delivered_by: item.deliveredBy,
    what_sold: item.whatSold,
    value_zar: item.valueZar,
    created_at: item.createdAt,
  };
}

function mapTask(row: Record<string, unknown>): OnboardingTask {
  return {
    id: text(row.id),
    leadId: text(row.lead_id),
    handoverId: text(row.handover_id),
    title: text(row.title),
    done: Boolean(row.done),
    ord: num(row.ord),
    createdAt: text(row.created_at) || new Date().toISOString(),
  };
}

function taskToRow(item: OnboardingTask) {
  return {
    id: item.id,
    lead_id: item.leadId,
    handover_id: item.handoverId,
    title: item.title,
    done: item.done,
    ord: item.ord,
    created_at: item.createdAt,
  };
}

function mapQuote(row: Record<string, unknown>): QuotePlaceholder {
  return {
    id: text(row.id),
    leadId: text(row.lead_id),
    handoverId: text(row.handover_id),
    kind: text(row.kind) === "invoice" ? "invoice" : "quote",
    reference: text(row.reference),
    description: text(row.description),
    amountZar: num(row.amount_zar),
    status: text(row.status) || "Draft",
    createdAt: text(row.created_at) || new Date().toISOString(),
  };
}

function quoteToRow(item: QuotePlaceholder) {
  return {
    id: item.id,
    lead_id: item.leadId,
    handover_id: item.handoverId,
    kind: item.kind,
    reference: item.reference,
    description: item.description,
    amount_zar: item.amountZar,
    status: item.status,
    created_at: item.createdAt,
  };
}

function rules(value: unknown): AssignmentRule[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.rules.map((rule) => ({ ...rule }));
  return value
    .map((item) => {
      const row = record(item);
      return {
        id: text(row.id) || crypto.randomUUID(),
        name: text(row.name) || "Rule",
        active: row.active !== false,
        matchSource: text(row.matchSource),
        matchQrSource: text(row.matchQrSource),
        owner: text(row.owner) || "Billy",
      };
    })
    .filter((rule) => rule.matchSource || rule.matchQrSource);
}

function outboxStatus(value: string): OutboxStatus {
  if (value === "approved" || value === "sent" || value === "failed" || value === "cancelled") return value;
  return "queued";
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  return [];
}
