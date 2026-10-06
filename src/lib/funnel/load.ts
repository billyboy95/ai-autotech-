import { createSupabaseServerClient } from "@/lib/supabase/server";
import { salesFunnelDisplayMode } from "@/lib/funnel/flag";
import { fixtureAuditReport, fixtureNotifications, fixtureResultsCallUrl, FIXTURE_COPY } from "@/lib/funnel/preview";
import type { ReportSection } from "@/lib/funnel/report";
import { activeResultsCallUrl, loadApprovedShareReport } from "@/server/workers/funnel";

export type DeskItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};

export type NotificationDesk = {
  mode: "fixture" | "live";
  flag: "unset" | "on";
  unread: number;
  items: DeskItem[];
  notice: string;
  report: ReturnType<typeof fixtureAuditReport> | null;
  resultsCallUrl: string;
};

function sectionsOf(value: unknown): ReportSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: string; heading?: string; body?: string };
    if (row.id !== "gaps" && row.id !== "team" && row.id !== "impact") return [];
    return [{ id: row.id, heading: String(row.heading || row.id), body: String(row.body || "") }];
  });
}

export async function loadNotificationDesk(input: { tenantMode: string; orgId: string }): Promise<NotificationDesk> {
  const mode = salesFunnelDisplayMode({ tenantMode: input.tenantMode });
  if (mode === "fixture" || input.orgId.startsWith("preview-")) {
    const items = fixtureNotifications();
    return {
      mode: "fixture",
      flag: "unset",
      unread: items.filter((item) => !item.read).length,
      items,
      notice: FIXTURE_COPY,
      report: fixtureAuditReport(),
      resultsCallUrl: fixtureResultsCallUrl(),
    };
  }

  const base: NotificationDesk = {
    mode: "live",
    flag: "on",
    unread: 0,
    items: [],
    notice: "Sending is off. Alerts stay inside the CRM. Nothing is emailed to a lead.",
    report: null,
    resultsCallUrl: await activeResultsCallUrl(input.orgId),
  };

  try {
    const supabase = await createSupabaseServerClient();
    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id;
    if (!userId) return { ...base, items: [], unread: 0 };
    const listed = await supabase
      .from("crm_notifications")
      .select("id, kind, title, body, href, created_at")
      .eq("org_id", input.orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (listed.error || !listed.data) return base;
    const ids = listed.data.map((row) => String(row.id));
    const reads = ids.length
      ? await supabase.from("crm_notification_reads").select("notification_id").eq("user_id", userId).in("notification_id", ids)
      : { data: [], error: null };
    const readIds = new Set((reads.data ?? []).map((row) => String(row.notification_id)));
    const items: DeskItem[] = listed.data.map((row) => ({
      id: String(row.id),
      kind: String(row.kind),
      title: String(row.title),
      body: String(row.body),
      href: String(row.href || "/command-centre/notifications"),
      createdAt: String(row.created_at),
      read: readIds.has(String(row.id)),
    }));
    return { ...base, items, unread: items.filter((item) => !item.read).length };
  } catch {
    return base;
  }
}

export async function loadNotificationUnread(input: { tenantMode: string; orgId: string }) {
  const mode = salesFunnelDisplayMode({ tenantMode: input.tenantMode });
  if (mode === "fixture" || input.orgId.startsWith("preview-")) {
    return { unread: fixtureNotifications().filter((item) => !item.read).length, fixture: true };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id;
    if (!userId) return { unread: 0, fixture: false };
    const listed = await supabase.from("crm_notifications").select("id").eq("org_id", input.orgId).limit(50);
    if (listed.error || !listed.data) return { unread: 0, fixture: false };
    const ids = listed.data.map((row) => String(row.id));
    if (!ids.length) return { unread: 0, fixture: false };
    const reads = await supabase.from("crm_notification_reads").select("notification_id").eq("user_id", userId).in("notification_id", ids);
    const readIds = new Set((reads.data ?? []).map((row) => String(row.notification_id)));
    return { unread: ids.filter((id) => !readIds.has(id)).length, fixture: false };
  } catch {
    return { unread: 0, fixture: false };
  }
}

export type LeadReportState = {
  mode: "fixture" | "live";
  present: boolean;
  status: "draft" | "approved" | "none";
  title: string;
  narrative: string;
  sections: ReportSection[];
  resultsCallUrl: string;
  auditLeadId: string | null;
  notice: string;
};

export async function loadLeadReport(input: {
  tenantMode: string;
  orgId: string;
  auditLeadId: string | null;
  leadId: string;
}): Promise<LeadReportState | null> {
  const mode = salesFunnelDisplayMode({ tenantMode: input.tenantMode });
  if (!input.auditLeadId) return null;
  if (mode === "fixture") {
    return {
      mode: "fixture",
      present: false,
      status: "none",
      title: "",
      narrative: "",
      sections: [],
      resultsCallUrl: fixtureResultsCallUrl(),
      auditLeadId: input.auditLeadId,
      notice: "SALES_FUNNEL_ENABLED is unset. This lead does not get a sample report. Open Alerts to preview the layout. Nothing is sent.",
    };
  }
  const resultsCallUrl = await activeResultsCallUrl(input.orgId);
  try {
    const supabase = await createSupabaseServerClient();
    const row = await supabase
      .from("crm_audit_reports")
      .select("status, title, narrative, sections")
      .eq("org_id", input.orgId)
      .eq("audit_lead_id", input.auditLeadId)
      .maybeSingle();
    if (row.error || !row.data) {
      return {
        mode: "live",
        present: false,
        status: "none",
        title: "",
        narrative: "",
        sections: [],
        resultsCallUrl,
        auditLeadId: input.auditLeadId,
        notice: "No draft yet. A draft is created when the audit is saved. It is not sent.",
      };
    }
    const status = row.data.status === "approved" ? "approved" : "draft";
    return {
      mode: "live",
      present: true,
      status,
      title: String(row.data.title || ""),
      narrative: String(row.data.narrative || ""),
      sections: sectionsOf(row.data.sections),
      resultsCallUrl,
      auditLeadId: input.auditLeadId,
      notice: status === "approved"
        ? "Approved. The prospect team page can show this. It is still not emailed."
        : "Draft. Only an approved report shows on the prospect team page. Nothing is sent.",
    };
  } catch {
    return null;
  }
}

export async function loadPublicApprovedReport(token: string) {
  return loadApprovedShareReport(token);
}
