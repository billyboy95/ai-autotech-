import { openServiceDatabase } from "@/server/workers/service-db";
import { serviceConfigured } from "@/server/workers/with-org";
import type { CatalogPayload } from "@/lib/calendars/types";

export { serviceConfigured };

export async function fetchBookingCatalog(slug: string) {
  const db = openServiceDatabase();
  if (!db) return { configured: false as const, payload: null, error: null as string | null };
  const result = await db.rpc("public_booking_catalog", { p_slug: slug });
  if (result.error) return { configured: true as const, payload: null, error: result.error.message };
  return { configured: true as const, payload: (result.data ?? null) as CatalogPayload | null, error: null as string | null };
}

export async function bookPublicAppointment(input: {
  slug: string;
  startsAt: string;
  name: string;
  phone: string;
  email: string;
  consent: boolean;
  consentText: string;
}) {
  const db = openServiceDatabase();
  if (!db) return { configured: false as const, data: null, error: null as string | null };
  const result = await db.rpc("book_public_appointment", {
    p_slug: input.slug,
    p_starts_at: input.startsAt,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    p_consent: input.consent,
    p_consent_text: input.consentText,
  });
  if (result.error) return { configured: true as const, data: null, error: result.error.message };
  return {
    configured: true as const,
    data: result.data as { ok?: boolean; appointment_id?: string; lead_id?: string } | null,
    error: null as string | null,
  };
}

export async function orgIdForBookingSlug(slug: string) {
  const db = openServiceDatabase();
  if (!db) return null;
  const row = await db.from("booking_links").select("org_id").eq("slug", slug).maybeSingle();
  if (row.error || !row.data) return null;
  const orgId = (row.data as { org_id?: string }).org_id;
  return orgId ? String(orgId) : null;
}
