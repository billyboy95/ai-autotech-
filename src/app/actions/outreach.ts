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

function idsFrom(formData: FormData) {
  return [...new Set(formData.getAll("ids").map((value) => String(value).trim()))].filter((id) => UUID.test(id));
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function count(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ownerContext(campaign: string) {
  const ctx = await staffContext();
  const tenant = await safeResolveWorkspace();
  if (tenant.role !== "agency_owner") back(campaign, "owner-only");
  return ctx;
}

function delivering(payload: Record<string, unknown>) {
  if (payload.sent === true || count(payload.queued) > 0 || count(payload.approved) > 0) return true;
  const results = Array.isArray(payload.results) ? payload.results : [];
  return results.some((row) => {
    const status = String(asRecord(row).status || "");
    return status === "queued" || status === "approved" || status === "sent";
  });
}

/** Owner only. Writes outbox drafts. Does not call a mail, WhatsApp, or SMS provider. */
export async function queueOutreachOpeners(formData: FormData) {
  const campaign = text(formData, "campaign");
  const ids = idsFrom(formData);
  if (ids.length === 0) back(campaign, "none-selected");
  if (ids.length > 25) back(campaign, "too-many");
  const { supabase, orgId } = await ownerContext(campaign);
  const saved = await supabase.rpc("queue_outreach_openers", { p_org: orgId, p_ids: ids });
  if (saved.error) {
    const missing = /queue_outreach_openers|schema cache|does not exist/i.test(saved.error.message);
    back(campaign, missing ? "opener-unavailable" : "save-failed");
  }
  const payload = asRecord(saved.data);
  if (delivering(payload)) back(campaign, "refused");
  if (payload.ok === false && payload.error === "too-many") back(campaign, "too-many");
  revalidatePath(PATH);
  const drafted = count(payload.drafted);
  const blocked = count(payload.blocked);
  if (drafted > 0 && blocked === 0) back(campaign, "opener-drafted");
  if (drafted > 0) back(campaign, "opener-partial");
  back(campaign, "opener-none");
}

/** Owner only. Dry-run unless the confirm box is ticked. Cancels queued marketing rows. Does not send. */
export async function cancelStaleMarketingOutbox(formData: FormData) {
  const campaign = text(formData, "campaign");
  if (text(formData, "confirm") !== "yes") back(campaign, "confirm-required");
  const { supabase, orgId } = await ownerContext(campaign);
  const saved = await supabase.rpc("cancel_stale_marketing_outbox", { p_org: orgId, p_confirm: true });
  if (saved.error) {
    const missing = /cancel_stale_marketing_outbox|schema cache|does not exist/i.test(saved.error.message);
    back(campaign, missing ? "opener-unavailable" : "save-failed");
  }
  const payload = asRecord(saved.data);
  if (delivering(payload)) back(campaign, "refused");
  revalidatePath(PATH);
  back(campaign, count(payload.cancelled) > 0 ? "stale-cancelled" : "stale-none");
}
