"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseContactCsv } from "@/lib/bots/contact-csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";

const PLACEHOLDERS = new Set(["email:resend", "whatsapp:meta_cloud", "facebook:meta", "instagram:meta"]);

function canManage(role: string | null) {
  return role === "client_admin" || isAgencyRole(role as "agency_owner" | "agency_staff" | null);
}

function readyPath(team: string) {
  const slug = team.replace(/[^a-z0-9-]/g, "").slice(0, 80);
  return `/command-centre/setup?team=${slug}&paid=1`;
}

function withNotice(path: string, message: string): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}notice=${encodeURIComponent(message)}`);
}

async function manageable(slug: string) {
  const workspace = await safeResolveWorkspace(slug);
  if (workspace.mode !== "member" || workspace.active.slug !== slug || !canManage(workspace.role)) return null;
  return workspace;
}

/** Saves a pending channel row and never stores a key. */
export async function placeholderChannel(formData: FormData) {
  const team = String(formData.get("team") ?? "");
  const back = readyPath(team);
  const secretish = ["secret", "api_key", "token", "key", "merchant_key"].some((name) => String(formData.get(name) ?? "").trim());
  if (secretish) withNotice(back, "No key is stored. Nothing was sent.");
  const slug = String(formData.get("slug") ?? "");
  const channel = String(formData.get("channel") ?? "");
  const provider = String(formData.get("provider") ?? "");
  const label = String(formData.get("label") ?? "Account").slice(0, 80);
  if (!PLACEHOLDERS.has(`${channel}:${provider}`)) {
    withNotice(back, `${label} is a placeholder. No key is stored and nothing was sent.`);
  }
  const workspace = await manageable(slug);
  if (!workspace) withNotice(back, "Preview workspace. The account was not saved and no key was stored.");
  const supabase = await createSupabaseServerClient();
  const existing = await supabase
    .from("channel_connections")
    .select("id")
    .eq("org_id", workspace.active.id)
    .eq("channel", channel)
    .eq("provider", provider)
    .eq("identifier", "placeholder")
    .maybeSingle();
  if (existing.error) withNotice(back, existing.error.message);
  const row = {
    org_id: workspace.active.id,
    channel,
    provider,
    identifier: "placeholder",
    display_name: label,
    status: "pending",
    public_config: {},
    updated_at: new Date().toISOString(),
  };
  const saved = existing.data
    ? await supabase.from("channel_connections").update(row).eq("id", existing.data.id)
    : await supabase.from("channel_connections").insert(row);
  if (saved.error) withNotice(back, saved.error.message);
  revalidatePath("/command-centre/setup");
  withNotice(back, `${label} is marked to connect. No key is stored and nothing was sent.`);
}

/** CSV into CRM contacts. Uses the existing consent_basis column. Nothing is sent. */
export async function importSetupContacts(formData: FormData) {
  const team = String(formData.get("team") ?? "");
  const back = readyPath(team);
  const file = formData.get("file");
  let csv = String(formData.get("csv") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > 500_000) withNotice(back, "That file is too large. Nothing was stored and nothing was sent.");
    csv = await file.text();
  }
  const parsed = parseContactCsv(csv);
  if (parsed.error) withNotice(back, `${parsed.error} Nothing was stored and nothing was sent.`);
  if (parsed.rows.length > 200) withNotice(back, "Import up to 200 contacts at a time. Nothing was stored and nothing was sent.");
  const slug = String(formData.get("slug") ?? "");
  const workspace = await manageable(slug);
  if (!workspace) withNotice(back, "Preview workspace. Contacts were not stored and nothing was sent.");
  const supabase = await createSupabaseServerClient();
  let stored = 0;
  for (const row of parsed.rows) {
    const inserted = await supabase.from("crm_contacts").insert({
      org_id: workspace.active.id,
      first_name: row.firstName,
      last_name: row.lastName,
      email: row.email,
      phone_e164: row.phone,
      company: row.company,
      custom: { consent_basis: row.consentBasis, source: "csv-import" },
    }).select("id").maybeSingle();
    if (inserted.error || !inserted.data) continue;
    stored += 1;
    if (row.consentBasis !== "consent" && row.consentBasis !== "existing_customer") continue;
    const channel = row.email ? "email" : row.phone ? "sms" : "";
    const address = row.email || row.phone;
    if (!channel || !address) continue;
    await supabase.from("contact_consents").insert({
      org_id: workspace.active.id,
      contact_id: inserted.data.id,
      channel,
      purpose: "service",
      status: "opted_in",
      basis: row.consentBasis,
      address,
      source: "csv-import",
      evidence: { consent_basis: row.consentBasis },
    });
  }
  revalidatePath("/command-centre/contacts");
  revalidatePath("/command-centre/setup");
  withNotice(back, `Imported ${stored} contact${stored === 1 ? "" : "s"}. Nothing was sent.`);
}
