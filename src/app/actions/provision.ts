"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PLAN_OPTIONS, type PlanKey } from "@/lib/snapshots/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";

export type PushReportRow = {
  asset_key: string;
  kind: string;
  result: string;
  org_id?: string;
};

export type ProvisionState = {
  ok: boolean;
  message: string;
  report: PushReportRow[];
};

const initialReport: PushReportRow[] = [];

function isPlan(value: string): value is PlanKey {
  return PLAN_OPTIONS.some((item) => item.key === value);
}

export async function provisionWorkspace(_state: ProvisionState, formData: FormData): Promise<ProvisionState> {
  const workspace = await resolveWorkspace();
  if (workspace.mode === "preview") {
    return {
      ok: false,
      report: initialReport,
      message: "Connect Supabase and apply supabase/migrations/20261016120000_phase2c_snapshots.sql before creating a live workspace. Sending stays off.",
    };
  }
  if (!workspace.canManageAgency) {
    return { ok: false, report: initialReport, message: "Sign in as an agency owner or staff member to create a client workspace." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const plan = String(formData.get("plan") ?? "");
  const snapshotId = String(formData.get("snapshotId") ?? "").trim();
  if (name.length < 2) return { ok: false, report: initialReport, message: "Give the workspace a name." };
  if (!email.includes("@")) return { ok: false, report: initialReport, message: "Enter the client admin email." };
  if (!isPlan(plan)) return { ok: false, report: initialReport, message: "Choose a plan placeholder." };
  if (!snapshotId) return { ok: false, report: initialReport, message: "Pick a snapshot." };

  const token = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("provision_client_workspace", {
    p_name: name,
    p_slug: String(formData.get("slug") ?? "").trim(),
    p_logo_url: String(formData.get("logoUrl") ?? "").trim(),
    p_primary_color: String(formData.get("primaryColor") ?? "").trim(),
    p_accent_color: String(formData.get("accentColor") ?? "").trim(),
    p_sender_name: String(formData.get("senderName") ?? "").trim(),
    p_snapshot_id: snapshotId,
    p_invite_email: email,
    p_plan_key: plan,
    p_invite_token_hash: tokenHash,
  });
  if (error) return { ok: false, report: initialReport, message: error.message };

  const created = data as { slug?: string; sending_enabled?: boolean } | null;
  if (!created?.slug) return { ok: false, report: initialReport, message: "The workspace was not created." };
  if (created.sending_enabled !== false) {
    return { ok: false, report: initialReport, message: "Sending was turned on. That is not allowed." };
  }

  revalidatePath("/agency");
  redirect(`/agency/${created.slug}/setup?invite=${token}`);
}

export async function pushSnapshot(_state: ProvisionState, formData: FormData): Promise<ProvisionState> {
  const workspace = await resolveWorkspace();
  if (workspace.mode === "preview") {
    return { ok: false, report: initialReport, message: "Apply the phase 2c migration before pushing a snapshot. Sending stays off." };
  }
  if (!workspace.canManageAgency) {
    return { ok: false, report: initialReport, message: "Sign in as an agency owner or staff member to push a snapshot." };
  }
  const snapshotId = String(formData.get("snapshotId") ?? "").trim();
  if (!snapshotId) return { ok: false, report: initialReport, message: "Choose a snapshot to push." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("snapshot_push", { p_snapshot_id: snapshotId });
  if (error) return { ok: false, report: initialReport, message: error.message };
  const report = Array.isArray(data) ? (data as PushReportRow[]) : [];
  revalidatePath("/agency/snapshots");
  const skipped = report.filter((row) => row.result === "skipped_client_edit").length;
  const updated = report.filter((row) => row.result === "updated" || row.result === "created").length;
  return {
    ok: true,
    report,
    message: report.length
      ? `Push finished. ${updated} asset${updated === 1 ? "" : "s"} written, ${skipped} left because the client edited them. Nothing was sent.`
      : "No workspaces have loaded this snapshot yet. Nothing was sent.",
  };
}

export async function saveSnapshotTemplate(_state: ProvisionState, formData: FormData): Promise<ProvisionState> {
  const slug = String(formData.get("slug") ?? "");
  const workspace = await resolveWorkspace(slug);
  if (workspace.mode === "preview") {
    return { ok: false, report: initialReport, message: "Templates save after Supabase and the phase 2c migration are in place. Nothing is sent." };
  }
  if (workspace.mode !== "member" || workspace.active.slug !== slug) {
    return { ok: false, report: initialReport, message: "Sign in with access to this workspace before editing templates." };
  }
  if (workspace.role !== "client_admin" && !isAgencyRole(workspace.role)) {
    return { ok: false, report: initialReport, message: "You can view these templates, but only an admin can change them." };
  }

  const id = String(formData.get("id") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("message_templates")
    .update({
      body: String(formData.get("body") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      active: formData.get("active") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", workspace.active.id);
  if (error) return { ok: false, report: initialReport, message: error.message };
  revalidatePath(`/agency/${slug}/templates`);
  revalidatePath(`/agency/${slug}/setup`);
  return { ok: true, report: initialReport, message: "Template saved. Nothing was sent." };
}
