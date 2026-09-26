"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { eraseContact, type ContactRecord } from "@/lib/compliance/dsr";

export async function eraseContactAction(formData: FormData) {
  const id = String(formData.get("id") || "");
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("Sign in to erase a contact.");
  const loaded = await supabase.from("crm_contacts").select("*").eq("id", id).maybeSingle();
  if (loaded.error || !loaded.data) throw new Error(loaded.error?.message || "Contact not found.");
  const contact = mapContact(loaded.data as Record<string, unknown>);
  const erased = eraseContact(contact, new Date());
  const saved = await supabase
    .from("crm_contacts")
    .update({
      first_name: erased.contact.firstName,
      last_name: erased.contact.lastName,
      email: "",
      phone_e164: "",
      whatsapp_e164: "",
      company: "",
      tags: [],
      custom: {},
      erased_at: erased.contact.erasedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (saved.error) throw new Error(saved.error.message);
  if (erased.suppressions.length) {
    await supabase.from("suppressions").upsert(
      erased.suppressions.map((item) => ({
        org_id: contact.orgId,
        channel: item.channel,
        address: item.address,
        reason: item.reason,
      })),
      { onConflict: "org_id,channel,address" },
    );
  }
  await supabase.from("data_requests").insert({
    org_id: contact.orgId,
    contact_id: id,
    type: "delete",
    status: "completed",
    requested_at: erased.dataRequest.requestedAt,
    completed_at: erased.dataRequest.completedAt,
  });
  revalidatePath("/command-centre/contacts");
}

function mapContact(row: Record<string, unknown>): ContactRecord {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    firstName: String(row.first_name || ""),
    lastName: String(row.last_name || ""),
    email: String(row.email || ""),
    phoneE164: String(row.phone_e164 || ""),
    whatsappE164: String(row.whatsapp_e164 || ""),
    company: String(row.company || ""),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    custom: row.custom && typeof row.custom === "object" ? (row.custom as Record<string, unknown>) : {},
    leadId: row.lead_id ? String(row.lead_id) : null,
    clientId: row.client_id ? String(row.client_id) : null,
    erasedAt: row.erased_at ? String(row.erased_at) : null,
  };
}
