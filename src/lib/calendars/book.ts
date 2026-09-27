export type BookingPlanInput = {
  consent: boolean;
  consentText: string;
  expectedConsentText: string;
  name: string;
  phone: string;
  email: string;
  startsAt: string;
  slots: string[];
  honeypot?: string;
};

export function planBooking(input: BookingPlanInput): { ok: true; startsAt: string } | { ok: false; error: string } {
  if (input.honeypot?.trim()) return { ok: false, error: "Could not book that time." };
  const consent = input.consentText.trim();
  if (!input.consent || consent.length < 12 || consent !== input.expectedConsentText.trim()) {
    return { ok: false, error: "Consent is required before this appointment can be booked." };
  }
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Enter your name." };
  if (!phone && !email) return { ok: false, error: "Enter a phone number or an email address." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  const starts = Date.parse(input.startsAt);
  if (!Number.isFinite(starts) || !input.slots.some((slot) => Date.parse(slot) === starts)) {
    return { ok: false, error: "That time is no longer open." };
  }
  return { ok: true, startsAt: new Date(starts).toISOString() };
}

export function bookingSlug(orgSlug: string, name: string) {
  const base = `${orgSlug}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base || `${orgSlug}-booking`;
}

export function missingCalendarTable(message: string) {
  const text = message.toLowerCase();
  const missing = text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find");
  return missing && (text.includes("calendar") || text.includes("booking_link") || text.includes("crm_appointment"));
}

export function canManageCalendars(role: string | null | undefined) {
  return role === "agency_owner" || role === "agency_staff" || role === "client_admin";
}
