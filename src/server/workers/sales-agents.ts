import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnvLike } from "@/lib/automation/channels";
import type { PublicCaptureInput } from "@/lib/funnel/capture";
import { isSalesAgentsEnabled } from "@/lib/sales-agents/flag";
import {
  channelSnapshots,
  planAuditFollowUp,
  planBookingReminders,
  planDailySummary,
  planOnboarding,
  planStalledLead,
  planStop,
  type ChannelSnapshot,
  type SalesPlan,
} from "@/lib/sales-agents/plan";
import type { BusinessProfile } from "@/lib/bots/onboarding";
import { openServiceDatabase } from "@/server/workers/service-db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ConsentRow = { channel?: string; purpose?: string; status?: string; basis?: string; address?: string };
type SuppressionRow = { channel?: string; address?: string };

function skipped(reason: string) {
  return { stored: false as const, reason, sent: false as const };
}

async function loadChannels(
  db: SupabaseClient,
  orgId: string,
  phone: string,
  email: string,
  formConsent?: { accepted: boolean; text: string },
): Promise<{ channels: ChannelSnapshot[]; sendingEnabled: boolean }> {
  const [consents, suppressions, org] = await Promise.all([
    db.from("contact_consents").select("channel, purpose, status, basis, address").eq("org_id", orgId).limit(80),
    db.from("suppressions").select("channel, address").eq("org_id", orgId).limit(80),
    db.from("organizations").select("sending_enabled").eq("id", orgId).maybeSingle(),
  ]);
  const consentRows = ((consents.data || []) as ConsentRow[]).map((row) => ({
    channel: String(row.channel || ""),
    purpose: String(row.purpose || ""),
    status: String(row.status || ""),
    basis: String(row.basis || ""),
    address: String(row.address || ""),
  }));
  const suppressionRows = ((suppressions.data || []) as SuppressionRow[]).map((row) => ({
    channel: String(row.channel || ""),
    address: String(row.address || ""),
  }));
  return {
    channels: channelSnapshots({ phone, email, consents: consentRows, suppressions: suppressionRows, formConsent }),
    sendingEnabled: Boolean((org.data as { sending_enabled?: boolean } | null)?.sending_enabled),
  };
}

async function persist(db: SupabaseClient, orgId: string, plan: SalesPlan) {
  const saved = await db.rpc("save_sales_agent_batch", {
    p_org: orgId,
    p_payload: {
      sequence: plan.sequence,
      drafts: plan.drafts,
      notices: plan.notices,
      onboarding: plan.onboarding,
      cancelPending: plan.cancelPending,
    },
  });
  if (saved.error) {
    console.error("sales agent batch skipped", saved.error.message);
    return skipped("save_failed");
  }
  const data = saved.data as { stored?: number; sent?: boolean } | null;
  return { stored: true as const, reason: "saved", sent: false as const, count: Number(data?.stored || 0) };
}

export async function notePublicCaptureForSalesAgents(input: PublicCaptureInput & {
  reportPath?: string;
  consentAccepted?: boolean;
  consentText?: string;
}) {
  try {
    if (!isSalesAgentsEnabled()) return skipped("flag_off");
    if (input.kind !== "audit" || !input.orgId || !UUID.test(input.orgId) || !UUID.test(input.sourceId)) return skipped("ignored");
    const db = openServiceDatabase();
    if (!db) return skipped("no_db");
    const gates = await loadChannels(db, input.orgId, input.phone, input.leadEmail, {
      accepted: Boolean(input.consentAccepted),
      text: input.consentText || "",
    });
    const plan = planAuditFollowUp({
      now: new Date(),
      sendingEnabled: gates.sendingEnabled,
      senderName: "Billy",
      name: input.name,
      company: input.company,
      leadId: input.leadId || "",
      auditLeadId: input.sourceId,
      reportPath: input.reportPath || "",
      bookingUrl: "",
      channels: gates.channels,
      trigger: "audit_arrived",
    });
    return persist(db, input.orgId, plan);
  } catch (error) {
    console.error("sales agent audit skipped", error instanceof Error ? error.message : "failed");
    return skipped("error");
  }
}

export async function noteReportApproved(input: { orgId: string; auditLeadId: string; leadId: string }) {
  try {
    if (!isSalesAgentsEnabled()) return skipped("flag_off");
    if (!UUID.test(input.orgId) || !UUID.test(input.auditLeadId)) return skipped("ignored");
    const db = openServiceDatabase();
    if (!db) return skipped("no_db");
    const lead = await db
      .from("crm_audit_leads")
      .select("first_name, last_name, company, email, phone, consent, consent_text, share_token")
      .eq("id", input.auditLeadId)
      .eq("org_id", input.orgId)
      .maybeSingle();
    if (lead.error || !lead.data) return skipped("no_lead");
    const row = lead.data as {
      first_name?: string;
      last_name?: string;
      company?: string;
      email?: string;
      phone?: string;
      consent?: boolean;
      consent_text?: string;
      share_token?: string;
    };
    const gates = await loadChannels(db, input.orgId, String(row.phone || ""), String(row.email || ""), {
      accepted: Boolean(row.consent),
      text: String(row.consent_text || ""),
    });
    const existing = await db.from("crm_sales_drafts").select("dedupe_key").eq("org_id", input.orgId).limit(80);
    const plan = planAuditFollowUp({
      now: new Date(),
      sendingEnabled: gates.sendingEnabled,
      senderName: "Billy",
      name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
      company: String(row.company || ""),
      leadId: input.leadId,
      auditLeadId: input.auditLeadId,
      reportPath: row.share_token ? `/team/${row.share_token}` : "",
      bookingUrl: "",
      channels: gates.channels,
      trigger: "report_approved",
      existingKeys: ((existing.data || []) as { dedupe_key?: string }[]).map((item) => String(item.dedupe_key || "")),
    });
    return persist(db, input.orgId, plan);
  } catch (error) {
    console.error("sales agent report skipped", error instanceof Error ? error.message : "failed");
    return skipped("error");
  }
}

export async function noteResultsCallBooked(input: {
  orgId: string;
  appointmentId: string;
  leadId: string;
  auditLeadId?: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  startsAt: string;
  consentAccepted: boolean;
}) {
  try {
    if (!isSalesAgentsEnabled()) return skipped("flag_off");
    if (!UUID.test(input.orgId)) return skipped("ignored");
    const db = openServiceDatabase();
    if (!db) return skipped("no_db");
    const gates = await loadChannels(db, input.orgId, input.phone, input.email);
    const reminders = planBookingReminders({
      now: new Date(),
      sendingEnabled: gates.sendingEnabled,
      senderName: "Billy",
      name: input.name,
      company: input.company,
      leadId: input.leadId,
      appointmentId: input.appointmentId,
      startsAt: input.startsAt,
      channels: gates.channels,
      consentAccepted: input.consentAccepted,
    });
    const saved = await persist(db, input.orgId, reminders);
    let auditLeadId = input.auditLeadId || "";
    if (!UUID.test(auditLeadId) && input.leadId) {
      const lead = await db.from("crm_leads").select("audit_lead_id").eq("id", input.leadId).maybeSingle();
      auditLeadId = String((lead.data as { audit_lead_id?: string } | null)?.audit_lead_id || "");
    }
    if (UUID.test(auditLeadId)) {
      const stop = planStop({
        sendingEnabled: gates.sendingEnabled,
        name: input.name,
        company: input.company,
        leadId: input.leadId,
        auditLeadId,
        stopReason: "booking",
      });
      await persist(db, input.orgId, stop);
    }
    return saved;
  } catch (error) {
    console.error("sales agent booking skipped", error instanceof Error ? error.message : "failed");
    return skipped("error");
  }
}

export async function noteLeadReply(input: { orgId: string; leadId: string; name?: string; stop: boolean }) {
  try {
    if (!isSalesAgentsEnabled()) return skipped("flag_off");
    if (!UUID.test(input.orgId) || !input.leadId) return skipped("ignored");
    const db = openServiceDatabase();
    if (!db) return skipped("no_db");
    const sequence = await db
      .from("crm_sales_sequences")
      .select("audit_lead_id")
      .eq("org_id", input.orgId)
      .eq("lead_id", input.leadId)
      .eq("status", "active")
      .limit(1);
    const auditLeadId = (sequence.data?.[0] as { audit_lead_id?: string } | undefined)?.audit_lead_id || "";
    if (!UUID.test(auditLeadId)) return skipped("no_sequence");
    const plan = planStop({
      sendingEnabled: false,
      name: input.name || "Lead",
      company: "",
      leadId: input.leadId,
      auditLeadId,
      stopReason: input.stop ? "opt_out" : "reply",
    });
    return persist(db, input.orgId, plan);
  } catch (error) {
    console.error("sales agent reply skipped", error instanceof Error ? error.message : "failed");
    return skipped("error");
  }
}

export async function noteDealWon(input: {
  orgId: string;
  leadId: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  profile?: BusinessProfile | null;
}) {
  try {
    if (!isSalesAgentsEnabled()) return skipped("flag_off");
    if (!UUID.test(input.orgId) || !input.leadId) return skipped("ignored");
    const db = openServiceDatabase();
    if (!db) return skipped("no_db");
    const gates = await loadChannels(db, input.orgId, input.phone, input.email);
    const plan = planOnboarding({
      now: new Date(),
      sendingEnabled: gates.sendingEnabled,
      senderName: "Billy",
      name: input.name,
      company: input.company,
      leadId: input.leadId,
      sourceKey: `deal_won:${input.leadId}`,
      trigger: "deal_won",
      bookingUrl: "",
      channels: gates.channels,
      profile: input.profile || null,
    });
    return persist(db, input.orgId, plan);
  } catch (error) {
    console.error("sales agent onboarding skipped", error instanceof Error ? error.message : "failed");
    return skipped("error");
  }
}

export async function noteLeadMarkedWon(leadId: string) {
  try {
    if (!isSalesAgentsEnabled()) return skipped("flag_off");
    const db = openServiceDatabase();
    if (!db || !leadId) return skipped("no_db");
    const lead = await db.from("crm_leads").select("org_id, name, company, phone, email").eq("id", leadId).maybeSingle();
    const row = lead.data as { org_id?: string; name?: string; company?: string; phone?: string; email?: string } | null;
    if (lead.error || !row?.org_id) return skipped("no_lead");
    return noteDealWon({
      orgId: String(row.org_id),
      leadId,
      name: String(row.name || ""),
      company: String(row.company || ""),
      phone: String(row.phone || ""),
      email: String(row.email || ""),
      profile: null,
    });
  } catch (error) {
    console.error("sales agent won skipped", error instanceof Error ? error.message : "failed");
    return skipped("error");
  }
}

export async function noteClassicInvoicePaid(invoiceId: string) {
  try {
    if (!isSalesAgentsEnabled()) return skipped("flag_off");
    const db = openServiceDatabase();
    if (!db || !invoiceId) return skipped("no_db");
    const invoice = await db.from("crm_invoices").select("org_id, client").eq("id", invoiceId).maybeSingle();
    const row = invoice.data as { org_id?: string; client?: string } | null;
    if (invoice.error || !row?.org_id) return skipped("no_invoice");
    return noteInvoicePaid({
      orgId: String(row.org_id),
      invoiceId,
      name: String(row.client || "Client"),
      company: String(row.client || ""),
      phone: "",
      email: "",
    });
  } catch (error) {
    console.error("sales agent invoice skipped", error instanceof Error ? error.message : "failed");
    return skipped("error");
  }
}

export async function noteInvoicePaid(input: {
  orgId: string;
  invoiceId: string;
  name: string;
  company: string;
  phone: string;
  email: string;
}) {
  try {
    if (!isSalesAgentsEnabled()) return skipped("flag_off");
    if (!UUID.test(input.orgId) || !input.invoiceId) return skipped("ignored");
    const db = openServiceDatabase();
    if (!db) return skipped("no_db");
    const gates = await loadChannels(db, input.orgId, input.phone, input.email);
    const plan = planOnboarding({
      now: new Date(),
      sendingEnabled: gates.sendingEnabled,
      senderName: "Billy",
      name: input.name,
      company: input.company,
      leadId: "",
      sourceKey: `invoice_paid:${input.invoiceId}`,
      trigger: "invoice_paid",
      bookingUrl: "",
      channels: gates.channels,
      profile: null,
    });
    return persist(db, input.orgId, plan);
  } catch (error) {
    console.error("sales agent invoice skipped", error instanceof Error ? error.message : "failed");
    return skipped("error");
  }
}

export async function runSalesAgentCron(now = new Date(), env: EnvLike = process.env) {
  if (!isSalesAgentsEnabled(env)) {
    return { ok: true as const, skipped: true, stored: 0, sent: false as const, reason: "SALES_AGENTS_ENABLED is unset" };
  }
  const db = openServiceDatabase();
  if (!db) return { ok: true as const, skipped: true, stored: 0, sent: false as const, reason: "no_db" };
  let stored = 0;
  try {
    const due = await db
      .from("crm_sales_sequences")
      .select("org_id, audit_lead_id, lead_id, status")
      .eq("status", "active")
      .limit(50);
    for (const row of (due.data || []) as { org_id?: string; audit_lead_id?: string; lead_id?: string }[]) {
      const orgId = String(row.org_id || "");
      const auditLeadId = String(row.audit_lead_id || "");
      if (!UUID.test(orgId) || !UUID.test(auditLeadId)) continue;
      const day5 = await db
        .from("crm_sales_drafts")
        .select("scheduled_for")
        .eq("org_id", orgId)
        .eq("step", "day5")
        .eq("status", "draft")
        .limit(1);
      const when = String((day5.data?.[0] as { scheduled_for?: string } | undefined)?.scheduled_for || "");
      const stalled = planStalledLead({
        now,
        name: "Lead",
        company: "",
        leadId: String(row.lead_id || ""),
        auditLeadId,
        day5DueAt: when,
        stopped: false,
      });
      if (!stalled) continue;
      const saved = await persist(db, orgId, {
        willSend: false,
        sendingEnabled: false,
        sequence: null,
        drafts: [],
        notices: [stalled],
        onboarding: null,
        cancelPending: false,
      });
      if (saved.stored) stored += 1;
    }

    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const orgs = await db.from("organizations").select("id").limit(50);
    for (const org of (orgs.data || []) as { id?: string }[]) {
      const orgId = String(org.id || "");
      if (!UUID.test(orgId)) continue;
      const [leads, drafts, calls, won] = await Promise.all([
        db.from("crm_notifications").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("kind", "audit").gte("created_at", since),
        db.from("crm_sales_drafts").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "draft"),
        db.from("crm_appointments").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "scheduled").gte("created_at", since),
        db.from("crm_leads").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("won_at", since),
      ]);
      const summary = planDailySummary({
        now,
        leadsIn: leads.count || 0,
        draftsWaiting: drafts.count || 0,
        callsBooked: calls.count || 0,
        won: won.count || 0,
      });
      const saved = await persist(db, orgId, {
        willSend: false,
        sendingEnabled: false,
        sequence: null,
        drafts: [],
        notices: [summary],
        onboarding: null,
        cancelPending: false,
      });
      if (saved.stored) stored += 1;
    }
  } catch (error) {
    console.error("sales agent cron skipped", error instanceof Error ? error.message : "failed");
    return { ok: true as const, skipped: true, stored, sent: false as const, reason: "error" };
  }
  return { ok: true as const, skipped: false, stored, sent: false as const, reason: "saved" };
}
