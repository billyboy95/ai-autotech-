import type { SupabaseClient } from "@supabase/supabase-js";
import { messageCategory } from "@/lib/automation/compliance";
import { changedBy } from "@/lib/automation/diff";
import { DEFAULT_TEMPLATES } from "@/lib/automation/templates";
import {
  DEFAULT_SETTINGS,
  emptyLead,
  normalizeStage,
  type Activity,
  type AssignmentRule,
  type AutomationSettings,
  type AutomationState,
  type Campaign,
  type CampaignStatus,
  type Channel,
  type Handover,
  type LeadRecord,
  type MessageCategory,
  type MessageTemplate,
  type OnboardingTask,
  type OutboxMessage,
  type OutboxStatus,
  type Prospect,
  type ProspectStatus,
  type QuotePlaceholder,
  type SocialPlatform,
  type SocialPost,
  type SocialStatus,
  type Suppression,
  type TrackedClick,
} from "@/lib/automation/types";

export const MIGRATION_FILE = "supabase/migrations/20260926160000_crm_automation.sql";
export const OUTBOUND_MIGRATION_FILE = "supabase/migrations/20260926183000_outbound_channels.sql";
export const COMPLIANCE_MIGRATION_FILE = "supabase/migrations/20260926200000_send_compliance.sql";

export function migrationHint(detail: string) {
  return `${detail} Apply ${MIGRATION_FILE}, then ${OUTBOUND_MIGRATION_FILE}, then ${COMPLIANCE_MIGRATION_FILE} in the Supabase SQL editor. Existing leads are not deleted.`;
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

  const [activities, outbox, templates, settings, handovers, tasks, quotes, social, campaigns, prospects, clicks, suppressions] = await Promise.all([
    supabase.from("crm_lead_activity").select("*").order("created_at", { ascending: true }),
    supabase.from("crm_outbox").select("*").order("scheduled_for", { ascending: true }),
    supabase.from("crm_message_templates").select("*"),
    supabase.from("crm_automation_settings").select("*").eq("id", "default").maybeSingle(),
    supabase.from("crm_handovers").select("*"),
    supabase.from("crm_onboarding_tasks").select("*").order("ord", { ascending: true }),
    supabase.from("crm_quote_placeholders").select("*"),
    supabase.from("crm_social_posts").select("*").order("scheduled_for", { ascending: true }),
    supabase.from("crm_campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("crm_prospects").select("*").order("created_at", { ascending: false }),
    supabase.from("crm_social_clicks").select("*").order("created_at", { ascending: true }),
    supabase.from("crm_suppressions").select("*").order("created_at", { ascending: true }),
  ]);

  const coreError =
    activities.error?.message ||
    outbox.error?.message ||
    templates.error?.message ||
    settings.error?.message ||
    handovers.error?.message ||
    tasks.error?.message ||
    quotes.error?.message ||
    null;
  const outboundError =
    social.error?.message || campaigns.error?.message || prospects.error?.message || clicks.error?.message || null;
  const complianceError = suppressions.error?.message || null;
  const setupError = coreError
    ? migrationHint(coreError)
    : outboundError
      ? `${outboundError} Apply ${OUTBOUND_MIGRATION_FILE} in the Supabase SQL editor. The pipeline still runs. Existing leads are not deleted.`
      : complianceError
        ? `${complianceError} Apply ${COMPLIANCE_MIGRATION_FILE} in the Supabase SQL editor. The pipeline still runs. Existing leads are not deleted.`
        : null;

  const templateRows = (templates.data ?? []) as Record<string, unknown>[];
  const settingsRow = settings.data as Record<string, unknown> | null;

  return {
    automationReady: !coreError,
    setupError,
    state: {
      leads: ((leads.data ?? []) as Record<string, unknown>[]).map(mapLead),
      activities: coreError ? [] : ((activities.data ?? []) as Record<string, unknown>[]).map(mapActivity),
      outbox: coreError ? [] : ((outbox.data ?? []) as Record<string, unknown>[]).map(mapOutbox),
      templates: templateRows.length ? templateRows.map(mapTemplate) : DEFAULT_TEMPLATES.map((template) => ({ ...template })),
      settings: settingsRow ? mapSettings(settingsRow) : structuredClone(DEFAULT_SETTINGS),
      handovers: coreError ? [] : ((handovers.data ?? []) as Record<string, unknown>[]).map(mapHandover),
      tasks: coreError ? [] : ((tasks.data ?? []) as Record<string, unknown>[]).map(mapTask),
      quotes: coreError ? [] : ((quotes.data ?? []) as Record<string, unknown>[]).map(mapQuote),
      socialPosts: outboundError || coreError ? [] : ((social.data ?? []) as Record<string, unknown>[]).map(mapSocial),
      campaigns: outboundError || coreError ? [] : ((campaigns.data ?? []) as Record<string, unknown>[]).map(mapCampaign),
      prospects: outboundError || coreError ? [] : ((prospects.data ?? []) as Record<string, unknown>[]).map(mapProspect),
      clicks: outboundError || coreError ? [] : ((clicks.data ?? []) as Record<string, unknown>[]).map(mapClick),
      suppressions: complianceError || coreError ? [] : ((suppressions.data ?? []) as Record<string, unknown>[]).map(mapSuppression),
    },
  };
}

export async function saveSupabaseWorkspace(
  supabase: SupabaseClient,
  before: AutomationState,
  after: AutomationState,
) {
  await upsertRows(
    supabase,
    "crm_leads",
    changedBy(before.leads, after.leads, (item) => item.id).map(leadToRow),
    ["utm_source", "marketing_consent"],
  );

  const knownActivities = new Set(before.activities.map((item) => item.id));
  const freshActivities = after.activities.filter((item) => !knownActivities.has(item.id) && item.leadId);
  if (freshActivities.length) {
    const saved = await supabase.from("crm_lead_activity").insert(freshActivities.map(activityToRow));
    if (saved.error) throw new Error(migrationHint(saved.error.message));
  }

  await upsertOutbox(supabase, changedBy(before.outbox, after.outbox, (item) => item.id).map(outboxToRow));

  const changedTemplates = changedBy(before.templates, after.templates, (item) => item.key);
  if (changedTemplates.length) {
    const saved = await supabase.from("crm_message_templates").upsert(
      changedTemplates.map((template) => ({
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

  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) {
    const savedSettings = await supabase.from("crm_automation_settings").upsert(settingsToRow(after.settings));
    if (savedSettings.error) throw new Error(migrationHint(savedSettings.error.message));
  }

  await upsertRows(supabase, "crm_handovers", changedBy(before.handovers, after.handovers, (item) => item.id).map(handoverToRow));
  await upsertRows(supabase, "crm_onboarding_tasks", changedBy(before.tasks, after.tasks, (item) => item.id).map(taskToRow));
  await upsertRows(supabase, "crm_quote_placeholders", changedBy(before.quotes, after.quotes, (item) => item.id).map(quoteToRow));
  await upsertRows(supabase, "crm_social_posts", changedBy(before.socialPosts, after.socialPosts, (item) => item.id).map(socialToRow));
  await upsertRows(supabase, "crm_campaigns", changedBy(before.campaigns, after.campaigns, (item) => item.id).map(campaignToRow));
  await upsertRows(
    supabase,
    "crm_prospects",
    changedBy(before.prospects, after.prospects, (item) => item.id).map(prospectToRow),
    ["marketing_consent"],
  );
  await upsertRows(supabase, "crm_social_clicks", changedBy(before.clicks, after.clicks, (item) => item.id).map(clickToRow));

  const knownSuppressions = new Set((before.suppressions || []).map((item) => item.id));
  const freshSuppressions = (after.suppressions || []).filter((item) => !knownSuppressions.has(item.id));
  if (freshSuppressions.length) {
    const saved = await supabase.from("crm_suppressions").insert(freshSuppressions.map(suppressionToRow));
    if (saved.error) {
      throw new Error(`${saved.error.message} Apply ${COMPLIANCE_MIGRATION_FILE} in the Supabase SQL editor. Existing leads are not deleted.`);
    }
  }

  await syncSourceStatus(supabase, before, after);
}

async function upsertRows(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  optionalKeys: string[] = [],
) {
  if (!rows.length) return;
  let payload = rows;
  let saved = await supabase.from(table).upsert(payload);
  for (const key of optionalKeys) {
    if (!saved.error || !new RegExp(key, "i").test(saved.error.message)) continue;
    payload = payload.map((row) => omitKey(row, key));
    saved = await supabase.from(table).upsert(payload);
  }
  if (saved.error) throw new Error(migrationHint(saved.error.message));
}

async function upsertOutbox(supabase: SupabaseClient, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  let payload = rows;
  let saved = await supabase.from("crm_outbox").upsert(payload);
  if (saved.error && /check constraint/i.test(saved.error.message) && /status/i.test(saved.error.message)) {
    payload = payload.map((row) => (row.status === "blocked" ? { ...row, status: "failed", error: row.error || "Blocked" } : row));
    saved = await supabase.from("crm_outbox").upsert(payload);
  }
  for (const key of ["prospect_id", "cost_usd", "cost_zar", "cost_category", "message_category"]) {
    if (!saved.error || !new RegExp(key, "i").test(saved.error.message)) continue;
    payload = payload.map((row) => omitKey(row, key));
    saved = await supabase.from("crm_outbox").upsert(payload);
  }
  if (saved.error) throw new Error(migrationHint(saved.error.message));
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
    utmSource: text(row.utm_source),
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
    marketingConsent: row.marketing_consent === true,
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
    utm_source: lead.utmSource || "",
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
    marketing_consent: lead.marketingConsent === true,
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
    prospectId: text(row.prospect_id) || null,
    templateKey: text(row.template_key),
    channel: asChannel(text(row.channel)),
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
    category: asCategory(text(row.message_category), text(row.template_key)),
    costUsd: nullableNum(row.cost_usd),
    costZar: nullableNum(row.cost_zar),
    costCategory: text(row.cost_category),
    createdAt: text(row.created_at) || new Date().toISOString(),
  };
}

function outboxToRow(item: OutboxMessage) {
  return {
    id: item.id,
    lead_id: item.leadId || null,
    prospect_id: item.prospectId,
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
    message_category: item.category || "",
    cost_usd: item.costUsd,
    cost_zar: item.costZar,
    cost_category: item.costCategory || "",
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

function mapSocial(row: Record<string, unknown>): SocialPost {
  return {
    id: text(row.id),
    platform: asPlatform(text(row.platform)),
    body: text(row.body),
    mediaUrl: text(row.media_url),
    linkUrl: text(row.link_url),
    scheduledFor: text(row.scheduled_for) || new Date().toISOString(),
    status: asSocialStatus(text(row.status)),
    utmSource: text(row.utm_source),
    utmCampaign: text(row.utm_campaign),
    copyText: text(row.copy_text),
    provider: text(row.provider),
    providerId: text(row.provider_id),
    error: text(row.error),
    publishedAt: text(row.published_at) || null,
    createdAt: text(row.created_at) || new Date().toISOString(),
  };
}

function socialToRow(item: SocialPost) {
  return {
    id: item.id,
    platform: item.platform,
    body: item.body,
    media_url: item.mediaUrl,
    link_url: item.linkUrl,
    scheduled_for: item.scheduledFor,
    status: item.status,
    utm_source: item.utmSource,
    utm_campaign: item.utmCampaign,
    copy_text: item.copyText,
    provider: item.provider,
    provider_id: item.providerId,
    error: item.error,
    published_at: item.publishedAt,
    created_at: item.createdAt,
  };
}

function mapCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: text(row.id),
    name: text(row.name) || "Outbound prospects",
    status: asCampaignStatus(text(row.status)),
    steps: Array.isArray(row.steps) ? row.steps.map(mapStep).filter((step) => step.body) : [],
    createdAt: text(row.created_at) || new Date().toISOString(),
  };
}

function campaignToRow(item: Campaign) {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    steps: item.steps,
    created_at: item.createdAt,
  };
}

function mapProspect(row: Record<string, unknown>): Prospect {
  return {
    id: text(row.id),
    campaignId: text(row.campaign_id),
    name: text(row.name),
    business: text(row.business),
    niche: text(row.niche),
    website: text(row.website),
    phone: text(row.phone),
    email: text(row.email),
    openingLine: text(row.opening_line),
    marketingConsent: row.marketing_consent === true,
    status: asProspectStatus(text(row.status)),
    stepIndex: num(row.step_index),
    leadId: text(row.lead_id) || null,
    touches: Array.isArray(row.touches) ? row.touches.map(mapTouch) : [],
    createdAt: text(row.created_at) || new Date().toISOString(),
    updatedAt: text(row.updated_at) || new Date().toISOString(),
  };
}

function prospectToRow(item: Prospect) {
  return {
    id: item.id,
    campaign_id: item.campaignId,
    name: item.name,
    business: item.business,
    niche: item.niche,
    website: item.website,
    phone: item.phone,
    email: item.email,
    opening_line: item.openingLine,
    marketing_consent: item.marketingConsent === true,
    status: item.status,
    step_index: item.stepIndex,
    lead_id: item.leadId,
    touches: item.touches,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function mapClick(row: Record<string, unknown>): TrackedClick {
  return {
    id: text(row.id),
    postId: text(row.post_id) || null,
    utmSource: text(row.utm_source),
    utmCampaign: text(row.utm_campaign),
    utmMedium: text(row.utm_medium),
    destination: text(row.destination),
    leadId: text(row.lead_id) || null,
    createdAt: text(row.created_at) || new Date().toISOString(),
  };
}

function clickToRow(item: TrackedClick) {
  return {
    id: item.id,
    post_id: item.postId,
    utm_source: item.utmSource,
    utm_campaign: item.utmCampaign,
    utm_medium: item.utmMedium,
    destination: item.destination,
    lead_id: item.leadId,
    created_at: item.createdAt,
  };
}

function mapStep(value: unknown) {
  const row = record(value);
  return {
    id: text(row.id) || crypto.randomUUID(),
    channel: asChannel(text(row.channel)),
    delayHours: num(row.delayHours ?? row.delay_hours),
    subject: text(row.subject),
    body: text(row.body),
  };
}

function mapTouch(value: unknown) {
  const row = record(value);
  return {
    at: text(row.at) || new Date().toISOString(),
    channel: asChannel(text(row.channel)),
    title: text(row.title),
    body: text(row.body),
    messageId: text(row.messageId ?? row.message_id),
  };
}

function asChannel(value: string): Channel {
  if (value === "email" || value === "sms") return value;
  return "whatsapp";
}

function asPlatform(value: string): SocialPlatform {
  if (value === "instagram" || value === "linkedin") return value;
  return "facebook";
}

function asSocialStatus(value: string): SocialStatus {
  if (value === "approved" || value === "published" || value === "failed" || value === "cancelled") return value;
  return "queued";
}

function asCampaignStatus(value: string): CampaignStatus {
  if (value === "draft" || value === "paused") return value;
  return "active";
}

function asProspectStatus(value: string): ProspectStatus {
  if (value === "queued" || value === "replied" || value === "booked" || value === "stopped") return value;
  return "in_sequence";
}

function mapSuppression(row: Record<string, unknown>): Suppression {
  const channel = text(row.channel);
  return {
    id: text(row.id),
    address: text(row.address),
    channel: channel === "email" || channel === "sms" || channel === "whatsapp" ? channel : "",
    reason: text(row.reason),
    createdAt: text(row.created_at) || new Date().toISOString(),
  };
}

function suppressionToRow(item: Suppression) {
  return {
    id: item.id,
    address: item.address,
    channel: item.channel,
    reason: item.reason,
    created_at: item.createdAt,
  };
}

function asCategory(value: string, templateKey: string): MessageCategory {
  if (value === "service" || value === "marketing") return value;
  return messageCategory(templateKey);
}

function outboxStatus(value: string): OutboxStatus {
  if (value === "approved" || value === "sent" || value === "failed" || value === "cancelled" || value === "blocked") return value;
  return "queued";
}

function omitKey<T extends Record<string, unknown>>(row: T, key: string) {
  const copy = { ...row };
  delete copy[key];
  return copy;
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  return [];
}
