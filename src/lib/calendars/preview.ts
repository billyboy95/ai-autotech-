import { consentTextForLink } from "@/lib/calendars/consent";
import { openSlots, todayInZone, type WeeklyWindow } from "@/lib/calendars/slots";
import type { CalendarDesk, PublicBookingPage } from "@/lib/calendars/types";

const WEEKLY: WeeklyWindow[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

const PREVIEW_ORGS = {
  "ai-autotech": {
    name: "AI AutoTech Pty Ltd",
    sender: "AI AutoTech Pty Ltd",
    slug: "ai-autotech-audit",
    event: "20 minute audit",
    duration: 20,
    mode: "phone",
    detail: "We phone you",
  },
  eastc: {
    name: "East Sea Technocentric Varsity (EASTC)",
    sender: "East Sea Technocentric Varsity (EASTC)",
    slug: "eastc-intro",
    event: "Intro call",
    duration: 30,
    mode: "video",
    detail: "Video link after booking",
  },
  zentrix: {
    name: "Zentrix Online",
    sender: "Zentrix Online",
    slug: "zentrix-call",
    event: "Shop call",
    duration: 20,
    mode: "phone",
    detail: "We phone you",
  },
} as const;

type PreviewOrg = (typeof PREVIEW_ORGS)[keyof typeof PREVIEW_ORGS];

function orgForSlug(slug: string): { key: keyof typeof PREVIEW_ORGS; org: PreviewOrg } | null {
  if (slug in PREVIEW_ORGS) {
    const key = slug as keyof typeof PREVIEW_ORGS;
    return { key, org: PREVIEW_ORGS[key] };
  }
  const found = (Object.keys(PREVIEW_ORGS) as Array<keyof typeof PREVIEW_ORGS>).find((key) => PREVIEW_ORGS[key].slug === slug);
  if (!found) return null;
  return { key: found, org: PREVIEW_ORGS[found] };
}

export function previewCalendarDesk(orgSlug: string, siteUrl: string): CalendarDesk {
  const match = PREVIEW_ORGS[orgSlug as keyof typeof PREVIEW_ORGS] ?? PREVIEW_ORGS["ai-autotech"];
  return {
    preview: true,
    notice: "Preview workspace. Connect Supabase to save calendars. Nothing is stored and no confirmation is sent.",
    canManage: false,
    orgSlug: orgSlug in PREVIEW_ORGS ? orgSlug : "ai-autotech",
    senderName: match.sender,
    siteUrl,
    calendars: [{ id: "preview-calendar", name: "Bookings", timezone: "Africa/Johannesburg", active: true }],
    selectedId: "preview-calendar",
    weekly: WEEKLY,
    exceptions: [],
    eventTypes: [{
      id: "preview-event",
      name: match.event,
      durationMinutes: match.duration,
      bufferBefore: 10,
      bufferAfter: 10,
      locationMode: match.mode,
      locationDetail: match.detail,
      active: true,
      slug: match.slug,
    }],
    appointments: [],
    members: [],
  };
}

export function previewPublicBooking(slug: string): PublicBookingPage {
  const match = orgForSlug(slug);
  if (!match) {
    return {
      kind: "missing",
      preview: true,
      slug,
      message: "This booking link is not active.",
    };
  }
  if (slug === match.key) {
    return {
      kind: "org",
      preview: true,
      slug,
      orgName: match.org.name,
      senderName: match.org.sender,
      links: [{
        slug: match.org.slug,
        name: match.org.event,
        durationMinutes: match.org.duration,
        locationMode: match.org.mode,
      }],
    };
  }
  const timezone = "Africa/Johannesburg";
  const slots = openSlots({
    timezone,
    fromDate: todayInZone(timezone),
    days: 14,
    durationMinutes: match.org.duration,
    bufferBefore: 10,
    bufferAfter: 10,
    weekly: WEEKLY,
    exceptions: [],
    busy: [],
    stepMinutes: 20,
  });
  return {
    kind: "link",
    preview: true,
    slug: match.org.slug,
    orgName: match.org.name,
    orgSlug: match.key,
    senderName: match.org.sender,
    timezone,
    consentText: consentTextForLink("", match.org.sender),
    eventName: match.org.event,
    durationMinutes: match.org.duration,
    locationMode: match.org.mode,
    locationDetail: match.org.detail,
    calendarName: "Bookings",
    slots,
  };
}
