"use server";

import { missingCalendarTable, planBooking } from "@/lib/calendars/book";
import { loadPublicBooking } from "@/lib/calendars/public";
import { formatSlot } from "@/lib/calendars/slots";
import { bookPublicAppointment, orgIdForBookingSlug, serviceConfigured } from "@/server/workers/booking";
import { notifyPublicCapture } from "@/server/workers/funnel";

export type BookingState = { ok: boolean; message: string };

function publicError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("consent required")) return "Consent is required before this appointment can be booked.";
  if (text.includes("slot taken")) return "That time was just taken. Pick another.";
  if (text.includes("outside hours") || text.includes("closed") || text.includes("midnight")) return "That time is not open.";
  if (text.includes("not active")) return "This booking link is not active.";
  if (missingCalendarTable(message)) return "Booking is not available until the calendar migration is applied. Nothing was stored.";
  return "The appointment could not be saved. Nothing was sent.";
}

export async function submitPublicBooking(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const page = await loadPublicBooking(slug);
  if (page.kind !== "link") return { ok: false, message: "This booking link is not active." };
  const plan = planBooking({
    consent: formData.get("consent") === "on",
    consentText: String(formData.get("consentText") || ""),
    expectedConsentText: page.consentText,
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    startsAt: String(formData.get("startsAt") || ""),
    slots: page.slots,
    honeypot: String(formData.get("company_website") || ""),
  });
  if (!plan.ok) return { ok: false, message: plan.error };
  const when = formatSlot(plan.startsAt, page.timezone);
  if (page.preview || !serviceConfigured()) {
    return {
      ok: true,
      message: `Preview booking accepted for ${when}. Nothing was stored and no confirmation message was sent.`,
    };
  }
  const saved = await bookPublicAppointment({
    slug,
    startsAt: plan.startsAt,
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    consent: true,
    consentText: page.consentText,
  });
  if (!saved.configured) {
    return {
      ok: true,
      message: `Preview booking accepted for ${when}. Nothing was stored and no confirmation message was sent.`,
    };
  }
  if (saved.error || !saved.data?.ok) return { ok: false, message: publicError(saved.error || "The appointment could not be saved.") };
  const orgId = await orgIdForBookingSlug(slug);
  const appointmentId = saved.data.appointment_id ? String(saved.data.appointment_id) : "";
  if (orgId && appointmentId) {
    await notifyPublicCapture({
      kind: "booking",
      orgId,
      sourceId: appointmentId,
      leadId: saved.data.lead_id ? String(saved.data.lead_id) : null,
      name: String(formData.get("name") || "").trim(),
      company: "",
      phone: String(formData.get("phone") || "").trim(),
      leadEmail: String(formData.get("email") || "").trim(),
      detail: when,
    });
  }
  return { ok: true, message: `You're booked for ${when}. No confirmation SMS or email was sent.` };
}
