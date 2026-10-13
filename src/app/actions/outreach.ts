"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { mapOutreachCsv } from "@/lib/outreach/csv";
import { canMoveTo, isOutreachStage } from "@/lib/outreach/funnel";
import { outreachLiveMode } from "@/lib/outreach/load";

const PATH = "/command-centre/outreach";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF = new Set(["agency_owner", "agency_staff", "client_admin"]);
const CAMPAIGN = /^[a-z0-9][a-z0-9-]{1,60}$/;

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function back(campaign: string, notice: string): never {
  const qs = new URLSearchParams();
  if (campaign) qs.set("campaign", campaign);
  qs.set("notice", notice);
  redirect(`${PATH}?${qs.toString()}`);
}

async function staffContext() {
  const tenant = await safeResolveWorkspace();
  if (!outreachLiveMode(tenant) || !tenant.role || !STAFF.has(tenant.role)) {
    redirect(`/login?next=${encodeURIComponent(PATH)}`);
  }
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect(`/login?next=${encodeURIComponent(PATH)}`);
  return { supabase, orgId: tenant.active.id };
}

export async function setOutreachStage(formData: FormData) {
  const id = text(formData, "id");
  const stage = text(formData, "stage");
  const campaign = text(formData, "campaign");
  if (!UUID.test(id) || !isOutreachStage(stage)) back(campaign, "invalid");
  const { supabase, orgId } = await staffContext();
  const found = await supabase
    .from("crm_outreach_prospects")
    .select("stage, do_not_contact")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (found.error || !found.data) back(campaign, "not-found");
  const current = found.data as { stage: string; do_not_contact: boolean };
  if (!canMoveTo({ stage: current.stage as never, doNotContact: current.do_not_contact }, stage as never)) {
    back(campaign, "dnc-blocked");
  }
  const updated = await supabase.from("crm_outreach_prospects").update({ stage }).eq("org_id", orgId).eq("id", id);
  if (updated.error) back(campaign, "save-failed");
  revalidatePath(PATH);
  back(campaign, "saved");
}

export async function setOutreachDoNotContact(formData: FormData) {
  const id = text(formData, "id");
  const campaign = text(formData, "campaign");
  const on = text(formData, "on") === "true";
  const reason = text(formData, "reason").slice(0, 300) || (on ? "Asked not to be contacted" : "");
  if (!UUID.test(id)) back(campaign, "invalid");
  const { supabase, orgId } = await staffContext();
  const patch = on ? { do_not_contact: true, dnc_reason: reason } : { do_not_contact: false, dnc_reason: "", dnc_at: null };
  const updated = await supabase.from("crm_outreach_prospects").update(patch).eq("org_id", orgId).eq("id", id);
  if (updated.error) back(campaign, "save-failed");
  revalidatePath(PATH);
  back(campaign, on ? "dnc-on" : "dnc-off");
}

export async function saveOutreachNote(formData: FormData) {
  const id = text(formData, "id");
  const campaign = text(formData, "campaign");
  const notes = text(formData, "notes").slice(0, 4000);
  if (!UUID.test(id)) back(campaign, "invalid");
  const { supabase, orgId } = await staffContext();
  const updated = await supabase.from("crm_outreach_prospects").update({ notes }).eq("org_id", orgId).eq("id", id);
  if (updated.error) back(campaign, "save-failed");
  revalidatePath(PATH);
  back(campaign, "saved");
}

/** Adds new prospects from a CSV. Existing rows (same campaign + business) are left untouched. */
export async function importOutreachCsv(formData: FormData) {
  const campaign = text(formData, "campaign").toLowerCase();
  if (!CAMPAIGN.test(campaign)) back("", "bad-campaign");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 1_000_000) back(campaign, "bad-file");
  const rows = mapOutreachCsv(await (file as File).text()).slice(0, 1000);
  if (rows.length === 0) back(campaign, "empty-file");
  const { supabase, orgId } = await staffContext();
  const insert = await supabase
    .from("crm_outreach_prospects")
    .upsert(
      rows.map((row) => ({ ...row, org_id: orgId, campaign, stage: "not_contacted" })),
      { onConflict: "org_id,campaign,business", ignoreDuplicates: true },
    );
  if (insert.error) back(campaign, "import-failed");
  revalidatePath(PATH);
  back(campaign, "imported");
}
