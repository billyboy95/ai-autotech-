import { canManageCalendars, missingCalendarTable } from "@/lib/calendars/book";
import { previewCalendarDesk } from "@/lib/calendars/preview";
import type { CalendarDesk, ExceptionSummary } from "@/lib/calendars/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

export async function loadCalendarDesk(input: { org?: string | null; calendarId?: string | null; notice?: string | null }): Promise<CalendarDesk> {
  const tenant = await safeResolveWorkspace(input.org);
  const preview = previewCalendarDesk(tenant.active.slug, siteUrl());
  if (input.notice) preview.notice = input.notice;
  const connected = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!connected || tenant.mode !== "member" || !tenant.scoped || tenant.active.id.startsWith("preview-")) {
    return preview;
  }

  const desk: CalendarDesk = {
    ...preview,
    preview: false,
    notice: input.notice ?? null,
    canManage: canManageCalendars(tenant.role),
    orgSlug: tenant.active.slug,
    senderName: tenant.active.senderName || tenant.active.name,
    calendars: [],
    selectedId: null,
    weekly: [],
    exceptions: [],
    eventTypes: [],
    appointments: [],
    members: [],
  };

  try {
    const supabase = await createSupabaseServerClient();
    const calendars = await supabase
      .from("calendars")
      .select("id, name, timezone, active")
      .eq("org_id", tenant.active.id)
      .order("name");
    if (calendars.error) {
      desk.notice = missingCalendarTable(calendars.error.message)
        ? "Calendar tables are not in this database yet. Apply phase 3b before saving. Nothing was stored and nothing was sent."
        : calendars.error.message;
      desk.canManage = false;
      return desk;
    }
    desk.calendars = (calendars.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      timezone: String(row.timezone || "Africa/Johannesburg"),
      active: Boolean(row.active),
    }));
    const selected = desk.calendars.find((row) => row.id === input.calendarId) ?? desk.calendars[0] ?? null;
    desk.selectedId = selected?.id ?? null;
    if (!selected) return desk;

    const [availability, events, links, appointments, members] = await Promise.all([
      supabase.from("calendar_availability").select("id, kind, weekday, start_minute, end_minute, exception_date, available").eq("calendar_id", selected.id).eq("org_id", tenant.active.id),
      supabase.from("calendar_event_types").select("id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes, location_mode, location_detail, active").eq("calendar_id", selected.id).eq("org_id", tenant.active.id).order("name"),
      supabase.from("booking_links").select("event_type_id, slug, active").eq("org_id", tenant.active.id),
      supabase.from("crm_appointments").select("id, guest_name, guest_email, guest_phone, starts_at, ends_at, status, assigned_member_id, event_type_id").eq("calendar_id", selected.id).eq("org_id", tenant.active.id).order("starts_at", { ascending: false }).limit(30),
      supabase.from("memberships").select("id, user_id, role").eq("org_id", tenant.active.id).order("role"),
    ]);
    const failed = [availability.error, events.error, links.error, appointments.error, members.error].find(Boolean);
    if (failed) {
      desk.notice = failed.message;
      return desk;
    }
    desk.weekly = (availability.data ?? [])
      .filter((row) => row.kind === "weekly")
      .map((row) => ({
        weekday: Number(row.weekday),
        startMinute: Number(row.start_minute),
        endMinute: Number(row.end_minute),
      }));
    desk.exceptions = (availability.data ?? [])
      .filter((row) => row.kind === "exception")
      .map((row): ExceptionSummary => ({
        id: String(row.id),
        date: String(row.exception_date).slice(0, 10),
        available: Boolean(row.available),
        startMinute: row.start_minute == null ? null : Number(row.start_minute),
        endMinute: row.end_minute == null ? null : Number(row.end_minute),
      }));
    const slugByEvent = new Map((links.data ?? []).map((row) => [String(row.event_type_id), String(row.slug)]));
    const nameByEvent = new Map((events.data ?? []).map((row) => [String(row.id), String(row.name)]));
    desk.eventTypes = (events.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      durationMinutes: Number(row.duration_minutes),
      bufferBefore: Number(row.buffer_before_minutes),
      bufferAfter: Number(row.buffer_after_minutes),
      locationMode: String(row.location_mode),
      locationDetail: String(row.location_detail || ""),
      active: Boolean(row.active),
      slug: slugByEvent.get(String(row.id)) ?? null,
    }));
    desk.appointments = (appointments.data ?? []).map((row) => ({
      id: String(row.id),
      guestName: String(row.guest_name || ""),
      guestEmail: String(row.guest_email || ""),
      guestPhone: String(row.guest_phone || ""),
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
      status: String(row.status),
      assignedMemberId: row.assigned_member_id ? String(row.assigned_member_id) : null,
      eventName: nameByEvent.get(String(row.event_type_id)) || "Appointment",
    }));
    desk.members = (members.data ?? []).map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      role: String(row.role),
    }));
    return desk;
  } catch (error) {
    desk.notice = error instanceof Error ? error.message : "Calendars could not be loaded.";
    desk.canManage = false;
    return desk;
  }
}
