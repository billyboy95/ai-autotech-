"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSalesFunnelEnabled } from "@/lib/funnel/flag";
import { noteReportApproved } from "@/server/workers/sales-agents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF = new Set(["agency_owner", "agency_staff", "client_admin"]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function staffContext(nextPath: string) {
  if (!isSalesFunnelEnabled()) {
    redirect(`${nextPath}?notice=fixture`);
  }
  const tenant = await safeResolveWorkspace();
  if (tenant.requiresLogin || tenant.mode !== "member" || !tenant.role || !STAFF.has(tenant.role)) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { supabase, userId: user.data.user.id, orgId: tenant.active.id };
}

export async function markNotificationRead(formData: FormData) {
  const id = text(formData, "id");
  const { supabase, userId } = await staffContext("/command-centre/notifications");
  if (UUID.test(id)) {
    await supabase.from("crm_notification_reads").upsert(
      { notification_id: id, user_id: userId, read_at: new Date().toISOString() },
      { onConflict: "notification_id,user_id" },
    );
  }
  revalidatePath("/command-centre/notifications");
  revalidatePath("/command-centre");
}

export async function markAllNotificationsRead() {
  const { supabase, userId, orgId } = await staffContext("/command-centre/notifications");
  const listed = await supabase.from("crm_notifications").select("id").eq("org_id", orgId).limit(50);
  const rows = (listed.data ?? []).map((row) => ({
    notification_id: String(row.id),
    user_id: userId,
    read_at: new Date().toISOString(),
  }));
  if (rows.length) {
    await supabase.from("crm_notification_reads").upsert(rows, { onConflict: "notification_id,user_id" });
  }
  revalidatePath("/command-centre/notifications");
  revalidatePath("/command-centre");
}

export async function saveAuditReport(formData: FormData) {
  const leadId = text(formData, "leadId");
  const auditLeadId = text(formData, "auditLeadId");
  const back = `/command-centre/leads/${leadId}`;
  const { supabase, orgId } = await staffContext(back);
  if (!UUID.test(auditLeadId)) redirect(back);
  const sections = ["gaps", "team", "impact"].map((id) => ({
    id,
    heading: id === "gaps" ? "Gaps" : id === "team" ? "Recommended AIOS agent team" : "Estimated impact",
    body: text(formData, `section:${id}`).slice(0, 4000),
  }));
  await supabase
    .from("crm_audit_reports")
    .update({
      narrative: text(formData, "narrative").slice(0, 8000),
      sections,
      status: "draft",
    })
    .eq("org_id", orgId)
    .eq("audit_lead_id", auditLeadId);
  revalidatePath(back);
  redirect(back);
}

export async function approveAuditReport(formData: FormData) {
  const leadId = text(formData, "leadId");
  const auditLeadId = text(formData, "auditLeadId");
  const back = `/command-centre/leads/${leadId}`;
  const { supabase, userId, orgId } = await staffContext(back);
  if (!UUID.test(auditLeadId)) redirect(back);
  await supabase
    .from("crm_audit_reports")
    .update({ status: "approved", approved_by: userId })
    .eq("org_id", orgId)
    .eq("audit_lead_id", auditLeadId);
  await noteReportApproved({ orgId, auditLeadId, leadId });
  revalidatePath(back);
  redirect(back);
}

/** Agency owner only. Refuses while the flag is off. This action is not run by capture. */
export async function ensureResultsCallCalendar() {
  const { supabase, orgId } = await staffContext("/command-centre/notifications");
  const tenant = await safeResolveWorkspace();
  if (tenant.role !== "agency_owner") redirect("/command-centre/notifications?notice=owner");
  await supabase.rpc("ensure_results_call_calendar", { p_org: orgId });
  revalidatePath("/command-centre/calendars");
  revalidatePath("/command-centre/notifications");
}
