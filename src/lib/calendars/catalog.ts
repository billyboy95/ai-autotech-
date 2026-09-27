import { consentTextForLink } from "@/lib/calendars/consent";
import { openSlots, todayInZone } from "@/lib/calendars/slots";
import type { CatalogPayload, PublicBookingPage } from "@/lib/calendars/types";

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function dateOnly(value: unknown) {
  const text = String(value ?? "");
  return text.slice(0, 10);
}

export function pageFromCatalog(slug: string, payload: CatalogPayload, preview: boolean): PublicBookingPage {
  if (payload.kind === "org") {
    return {
      kind: "org",
      preview,
      slug,
      orgName: String(payload.orgName || "Workspace"),
      senderName: String(payload.senderName || payload.orgName || "This workspace"),
      links: (payload.links ?? []).map((link) => ({
        slug: String(link.slug),
        name: String(link.name),
        durationMinutes: asNumber(link.durationMinutes, 20),
        locationMode: String(link.locationMode || "phone"),
      })),
    };
  }
  if (payload.kind !== "link" || !payload.event) {
    return { kind: "missing", preview, slug, message: "This booking link is not active." };
  }
  const timezone = String(payload.timezone || "Africa/Johannesburg");
  const durationMinutes = asNumber(payload.event.durationMinutes, 20);
  const bufferBefore = asNumber(payload.event.bufferBefore, 0);
  const bufferAfter = asNumber(payload.event.bufferAfter, 0);
  const senderName = String(payload.senderName || payload.orgName || "This workspace");
  const slots = openSlots({
    timezone,
    fromDate: todayInZone(timezone),
    days: 14,
    durationMinutes,
    bufferBefore,
    bufferAfter,
    weekly: (payload.weekly ?? []).map((row) => ({
      weekday: asNumber(row.weekday),
      startMinute: asNumber(row.startMinute),
      endMinute: asNumber(row.endMinute),
    })),
    exceptions: (payload.exceptions ?? []).map((row) => ({
      date: dateOnly(row.date),
      available: Boolean(row.available),
      startMinute: row.startMinute == null ? null : asNumber(row.startMinute),
      endMinute: row.endMinute == null ? null : asNumber(row.endMinute),
    })),
    busy: (payload.busy ?? []).map((row) => ({
      startsAt: String(row.startsAt),
      endsAt: String(row.endsAt),
      bufferBefore: asNumber(row.bufferBefore),
      bufferAfter: asNumber(row.bufferAfter),
    })),
    stepMinutes: 15,
  });
  return {
    kind: "link",
    preview,
    slug,
    orgName: String(payload.orgName || "Workspace"),
    orgSlug: String(payload.orgSlug || ""),
    senderName,
    timezone,
    consentText: consentTextForLink(String(payload.consentText || ""), senderName),
    eventName: String(payload.event.name || "Appointment"),
    durationMinutes,
    locationMode: String(payload.event.locationMode || "phone"),
    locationDetail: String(payload.event.locationDetail || ""),
    calendarName: String(payload.event.calendarName || "Calendar"),
    slots,
  };
}
