import { NextResponse } from "next/server";
import { contactExport, type ContactRecord } from "@/lib/compliance/dsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) return NextResponse.json({ ok: false, error: "Sign in to download contact data." }, { status: 401 });

  const contact = await supabase.from("crm_contacts").select("*").eq("id", id).maybeSingle();
  if (contact.error || !contact.data) {
    return NextResponse.json({ ok: false, error: "Contact not found." }, { status: 404 });
  }
  const row = contact.data as Record<string, unknown>;
  const [consents, requests] = await Promise.all([
    supabase.from("contact_consents").select("*").eq("contact_id", id),
    supabase.from("data_requests").select("*").eq("contact_id", id),
  ]);
  const record: ContactRecord = {
    id: String(row.id),
    orgId: String(row.org_id),
    firstName: String(row.first_name || ""),
    lastName: String(row.last_name || ""),
    email: String(row.email || ""),
    phoneE164: String(row.phone_e164 || ""),
    whatsappE164: String(row.whatsapp_e164 || ""),
    company: String(row.company || ""),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    custom: {},
    leadId: row.lead_id ? String(row.lead_id) : null,
    clientId: row.client_id ? String(row.client_id) : null,
    erasedAt: row.erased_at ? String(row.erased_at) : null,
  };
  const body = contactExport({
    contact: record,
    consents: consents.data ?? [],
    suppressions: [],
    messages: [],
    dataRequests: requests.data ?? [],
  });
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="contact-${id}.json"`,
    },
  });
}
