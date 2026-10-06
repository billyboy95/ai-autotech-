import { createOpenAiCompatibleProvider } from "@/lib/ai-reply/provider";
import type { EnvLike } from "@/lib/automation/channels";
import { pickBookingSlug, RESULTS_CALL_FALLBACK, resultsCallHref } from "@/lib/funnel/booking-link";
import { handlePublicCapture, type CaptureDeps, type PublicCaptureInput } from "@/lib/funnel/capture";
import { isSalesFunnelEnabled } from "@/lib/funnel/flag";
import { draftsFromNotifyMemory, planOwnerAlert, type WorkflowNote } from "@/lib/funnel/notify";
import { acceptPolish, type ReportSection } from "@/lib/funnel/report";
import { notePublicCaptureForSalesAgents } from "@/server/workers/sales-agents";
import { openServiceDatabase } from "@/server/workers/service-db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resultsCallUrlForOrg(orgId: string) {
  const db = openServiceDatabase();
  if (!db || !UUID.test(orgId)) return RESULTS_CALL_FALLBACK;
  const listed = await db.from("booking_links").select("slug").eq("org_id", orgId).eq("active", true);
  if (listed.error || !listed.data) return RESULTS_CALL_FALLBACK;
  const links = (listed.data as { slug?: string }[]).map((row) => ({ slug: String(row.slug || "") }));
  return resultsCallHref(pickBookingSlug(links));
}

async function polish(source: string, narrative: string) {
  const provider = createOpenAiCompatibleProvider(process.env);
  if (!provider.configured()) return null;
  const result = await provider.complete([
    {
      role: "system",
      content:
        "Rewrite the narrative so it is clear. Use only facts already in the source. Do not add numbers, percentages, currency, hours, email addresses, or phone numbers. Return the narrative only.",
    },
    { role: "user", content: `Source:\n${source}\n\nNarrative:\n${narrative}` },
  ]);
  if (!result.ok) return null;
  return acceptPolish(source, result.text);
}

async function deliverAlert(plan: Extract<ReturnType<typeof planOwnerAlert>, { deliver: true }>) {
  if (plan.provider !== "resend") return { sent: false, reason: "provider_unset" };
  const key = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  if (!key || !from || !plan.to.length) return { sent: false, reason: "provider_unset" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: plan.to,
        subject: plan.subject,
        text: plan.text,
      }),
    });
    return response.ok ? { sent: true, reason: "ready" } : { sent: false, reason: "provider_unset" };
  } catch {
    return { sent: false, reason: "provider_unset" };
  }
}

function liveDeps(orgId: string): CaptureDeps {
  return {
    env: process.env,
    resultsCallUrl: () => resultsCallUrlForOrg(orgId),
    polish,
    deliverAlert: async (plan) => (plan.deliver ? deliverAlert(plan) : { sent: false, reason: plan.reason }),
    async insertNotification(row) {
      const db = openServiceDatabase();
      if (!db) return { id: null };
      const saved = await db.rpc("record_owner_notification", {
        p_org: orgId,
        p_kind: row.kind,
        p_title: row.title,
        p_body: row.body,
        p_href: row.href,
        p_lead_id: row.leadId,
        p_dedupe_key: row.dedupeKey,
      });
      if (saved.error) {
        console.error("owner notification skipped", saved.error.message);
        return { id: null };
      }
      const id = (saved.data as { id?: string } | null)?.id ?? null;
      return { id };
    },
    async insertReport(row) {
      const db = openServiceDatabase();
      if (!db) return { id: null };
      const saved = await db.rpc("save_audit_report_draft", {
        p_org: orgId,
        p_audit_lead_id: row.auditLeadId,
        p_lead_id: row.leadId,
        p_title: row.title,
        p_narrative: row.narrative,
        p_sections: row.sections,
        p_polished: row.polished,
      });
      if (saved.error) {
        console.error("audit report draft skipped", saved.error.message);
        return { id: null };
      }
      const id = (saved.data as { id?: string } | null)?.id ?? null;
      return { id };
    },
  };
}

/** Public audit, contact, and booking capture. Flag off stores nothing extra and emails nobody. */
export async function notifyPublicCapture(input: PublicCaptureInput) {
  try {
    const outcome = await handlePublicCapture(input, liveDeps(input.orgId || ""));
    await notePublicCaptureForSalesAgents(input);
    return outcome;
  } catch (error) {
    console.error("sales funnel capture skipped", error instanceof Error ? error.message : "failed");
    return null;
  }
}

export async function persistWorkflowNotifications(notes: WorkflowNote[], orgId: string, env: EnvLike = process.env) {
  if (!isSalesFunnelEnabled(env) || !UUID.test(orgId) || !notes.length) return { stored: 0 };
  const db = openServiceDatabase();
  if (!db) return { stored: 0 };
  let stored = 0;
  for (const draft of draftsFromNotifyMemory(notes)) {
    const saved = await db.rpc("record_owner_notification", {
      p_org: orgId,
      p_kind: draft.kind,
      p_title: draft.title,
      p_body: draft.body,
      p_href: draft.href,
      p_lead_id: draft.leadId,
      p_dedupe_key: draft.dedupeKey,
    });
    if (!saved.error) stored += 1;
  }
  return { stored };
}

export async function activeResultsCallUrl(orgId: string | null) {
  if (!orgId) return RESULTS_CALL_FALLBACK;
  try {
    return await resultsCallUrlForOrg(orgId);
  } catch {
    return RESULTS_CALL_FALLBACK;
  }
}

function sectionsOf(value: unknown): ReportSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: string; heading?: string; body?: string };
    if (row.id !== "gaps" && row.id !== "team" && row.id !== "impact") return [];
    return [{ id: row.id, heading: String(row.heading || row.id), body: String(row.body || "") }];
  });
}

/** Approved report only. A draft returns null. Contact fields are not selected. */
export async function loadApprovedShareReport(token: string) {
  if (!isSalesFunnelEnabled()) return null;
  const db = openServiceDatabase();
  if (!db) return null;
  const result = await db.rpc("approved_audit_report_for_token", { p_token: token });
  if (result.error || !result.data) return null;
  const row = result.data as { title?: string; narrative?: string; sections?: unknown; booking_slug?: string | null };
  return {
    title: String(row.title || "Audit report"),
    narrative: String(row.narrative || ""),
    sections: sectionsOf(row.sections),
    resultsCallUrl: resultsCallHref(row.booking_slug),
  };
}

/** Booking link for a share token. Returns the website fallback when the workspace has no active link. */
export async function resultsCallForShareToken(token: string) {
  if (!isSalesFunnelEnabled()) return null;
  const db = openServiceDatabase();
  if (!db) return RESULTS_CALL_FALLBACK;
  const row = await db.from("crm_audit_leads").select("org_id").eq("share_token", token).maybeSingle();
  if (row.error || !row.data) return RESULTS_CALL_FALLBACK;
  const orgId = (row.data as { org_id?: string }).org_id;
  return activeResultsCallUrl(orgId ? String(orgId) : null);
}
