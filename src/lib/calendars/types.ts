import type { BusyRange, ExceptionWindow, WeeklyWindow } from "@/lib/calendars/slots";

export type CalendarSummary = {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
};

export type EventTypeSummary = {
  id: string;
  name: string;
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  locationMode: string;
  locationDetail: string;
  active: boolean;
  slug: string | null;
};

export type AppointmentSummary = {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  startsAt: string;
  endsAt: string;
  status: string;
  assignedMemberId: string | null;
  eventName: string;
};

export type MemberSummary = {
  id: string;
  userId: string;
  role: string;
};

export type ExceptionSummary = ExceptionWindow & { id: string };

export type CalendarDesk = {
  preview: boolean;
  notice: string | null;
  canManage: boolean;
  orgSlug: string;
  senderName: string;
  siteUrl: string;
  calendars: CalendarSummary[];
  selectedId: string | null;
  weekly: WeeklyWindow[];
  exceptions: ExceptionSummary[];
  eventTypes: EventTypeSummary[];
  appointments: AppointmentSummary[];
  members: MemberSummary[];
};

export type PublicLinkCard = {
  slug: string;
  name: string;
  durationMinutes: number;
  locationMode: string;
};

export type PublicBookingPage =
  | {
      kind: "link";
      preview: boolean;
      slug: string;
      orgName: string;
      orgSlug: string;
      senderName: string;
      timezone: string;
      consentText: string;
      eventName: string;
      durationMinutes: number;
      locationMode: string;
      locationDetail: string;
      calendarName: string;
      slots: string[];
    }
  | {
      kind: "org";
      preview: boolean;
      slug: string;
      orgName: string;
      senderName: string;
      links: PublicLinkCard[];
    }
  | {
      kind: "missing";
      preview: boolean;
      slug: string;
      message: string;
    };

export type CatalogPayload = {
  kind?: string;
  orgName?: string;
  orgSlug?: string;
  senderName?: string;
  timezone?: string;
  consentText?: string;
  event?: {
    name?: string;
    durationMinutes?: number;
    bufferBefore?: number;
    bufferAfter?: number;
    locationMode?: string;
    locationDetail?: string;
    calendarName?: string;
  } | null;
  weekly?: WeeklyWindow[];
  exceptions?: ExceptionWindow[];
  busy?: BusyRange[];
  links?: PublicLinkCard[];
};
