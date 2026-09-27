"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bookingSlug, canManageCalendars, missingCalendarTable } from "@/lib/calendars/book";
import { LOCATION_MODES, parseMinute } from "@/lib/calendars/slots";
import { workspaceWriteBlock } from "@/lib/billing/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";

const STATUSES = new Set(["scheduled", "cancelled", "completed", "no_show"]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function back(org: string, calendarId: string, notice: string): never {
  const params = new URLSearchParams();
  if (org) params.set("org", org);
  if (calendarId) params.set("id", calendarId);
  if (notice) params.set("notice", notice);
  const query = params.toString();
  redirect(query ? `/command-centre/calendars?${query}` : "/command-centre/calendars");
}

async function guard(formData: FormData) {
  const slug = text(formData, "org");
  const workspace = await safeResolveWorkspace(slug);
  if (workspace.requiresLogin && slug) {
    redirect(`/login?next=${encodeURIComponent(`/command-centre/calendars?org=${slug}`)}`);
  }
  if (
    workspace.mode !== "member"
    || !workspace.scoped
    || workspace.active.id.startsWith("preview-")
    || !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    return { workspace, error: "Preview workspace. Connect Supabase before saving a calendar. Nothing was stored and nothing was sent." };
  }
  if (slug && workspace.active.slug !== slug) {
    return { workspace, error: "That workspace is outside your account." };
  }
  if (!canManageCalendars(workspace.role)) {
    return { workspace, error: "Only an agency owner, agency staff member, or client admin can change calendars." };
  }
  const blocked = await workspaceWriteBlock(workspace.active.id);
  if (blocked) return { workspace, error: blocked };
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect(`/login?next=${encodeURIComponent(`/command-centre/calendars?org=${workspace.active.slug}`)}`);
  return { workspace, error: null, supabase };
}

function fail(message: string) {
  return missingCalendarTable(message)
    ? "Calendar tables are not in this database yet. Apply phase 3b. Nothing was stored and nothing was sent."
    : message;
}

export async function createCalendar(formData: FormData) {
  const gate = await guard(formData);
  const calendarId = text(formData, "calendarId");
  if (gate.error || !gate.supabase) back(gate.workspace.active.slug, calendarId, gate.error || "Could not save.");
  const name = text(formData, "name");
  const timezone = text(formData, "timezone") || "Africa/Johannesburg";
  if (name.length < 2 || name.length > 80) back(gate.workspace.active.slug, calendarId, "Enter a calendar name.");
  const supabase = gate.supabase;
  const created = await supabase.from("calendars").insert({
    org_id: gate.workspace.active.id,
    name,
    timezone,
    description: "",
    active: true,
  }).select("id").single();
  if (created.error || !created.data) back(gate.workspace.active.slug, calendarId, fail(created.error?.message || "Could not create the calendar."));
  const id = String(created.data.id);
  const hours = [1, 2, 3, 4, 5].map((weekday) => ({
    org_id: gate.workspace.active.id,
    calendar_id: id,
    kind: "weekly",
    weekday,
    start_minute: 9 * 60,
    end_minute: 17 * 60,
    available: true,
  }));
  const seeded = await supabase.from("calendar_availability").insert(hours);
  revalidatePath("/command-centre/calendars");
  back(gate.workspace.active.slug, id, seeded.error ? fail(seeded.error.message) : "Calendar saved. Weekday hours are 09:00–17:00. Sending was not changed.");
}

export async function saveWeeklyHours(formData: FormData) {
  const gate = await guard(formData);
  const calendarId = text(formData, "calendarId");
  if (gate.error || !gate.supabase) back(gate.workspace.active.slug, calendarId, gate.error || "Could not save.");
  const rows = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    if (formData.get(`day-${weekday}-open`) !== "on") continue;
    const start = parseMinute(text(formData, `day-${weekday}-start`) || "09:00");
    const end = parseMinute(text(formData, `day-${weekday}-end`) || "17:00");
    if (start == null || end == null || end <= start) {
      back(gate.workspace.active.slug, calendarId, "Each open day needs an end time after the start.");
    }
    rows.push({
      org_id: gate.workspace.active.id,
      calendar_id: calendarId,
      kind: "weekly",
      weekday,
      start_minute: start,
      end_minute: end,
      available: true,
    });
  }
  const supabase = gate.supabase;
  const removed = await supabase.from("calendar_availability").delete().eq("calendar_id", calendarId).eq("org_id", gate.workspace.active.id).eq("kind", "weekly");
  if (removed.error) back(gate.workspace.active.slug, calendarId, fail(removed.error.message));
  if (rows.length) {
    const inserted = await supabase.from("calendar_availability").insert(rows);
    if (inserted.error) back(gate.workspace.active.slug, calendarId, fail(inserted.error.message));
  }
  revalidatePath("/command-centre/calendars");
  back(gate.workspace.active.slug, calendarId, "Weekly hours saved. Sending was not changed.");
}

export async function addException(formData: FormData) {
  const gate = await guard(formData);
  const calendarId = text(formData, "calendarId");
  if (gate.error || !gate.supabase) back(gate.workspace.active.slug, calendarId, gate.error || "Could not save.");
  const date = text(formData, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back(gate.workspace.active.slug, calendarId, "Choose a date.");
  const closed = formData.get("closed") === "on";
  const start = closed ? null : parseMinute(text(formData, "start") || "09:00");
  const end = closed ? null : parseMinute(text(formData, "end") || "17:00");
  if (!closed && (start == null || end == null || end <= start)) {
    back(gate.workspace.active.slug, calendarId, "An open exception needs an end time after the start.");
  }
  const inserted = await gate.supabase.from("calendar_availability").insert({
    org_id: gate.workspace.active.id,
    calendar_id: calendarId,
    kind: "exception",
    exception_date: date,
    available: !closed,
    start_minute: start,
    end_minute: end,
  });
  revalidatePath("/command-centre/calendars");
  back(gate.workspace.active.slug, calendarId, inserted.error ? fail(inserted.error.message) : "Exception saved.");
}

export async function deleteException(formData: FormData) {
  const gate = await guard(formData);
  const calendarId = text(formData, "calendarId");
  if (gate.error || !gate.supabase) back(gate.workspace.active.slug, calendarId, gate.error || "Could not save.");
  const id = text(formData, "exceptionId");
  const removed = await gate.supabase.from("calendar_availability").delete().eq("id", id).eq("org_id", gate.workspace.active.id).eq("kind", "exception");
  revalidatePath("/command-centre/calendars");
  back(gate.workspace.active.slug, calendarId, removed.error ? fail(removed.error.message) : "Exception removed.");
}

export async function createEventType(formData: FormData) {
  const gate = await guard(formData);
  const calendarId = text(formData, "calendarId");
  if (gate.error || !gate.supabase) back(gate.workspace.active.slug, calendarId, gate.error || "Could not save.");
  const name = text(formData, "name");
  const duration = Number(text(formData, "duration") || "20");
  const bufferBefore = Number(text(formData, "bufferBefore") || "0");
  const bufferAfter = Number(text(formData, "bufferAfter") || "0");
  const locationMode = text(formData, "locationMode") || "phone";
  const locationDetail = text(formData, "locationDetail");
  if (name.length < 2 || name.length > 80) back(gate.workspace.active.slug, calendarId, "Enter an event name.");
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) back(gate.workspace.active.slug, calendarId, "Duration must be between 5 and 480 minutes.");
  if (![bufferBefore, bufferAfter].every((value) => Number.isInteger(value) && value >= 0 && value <= 180)) {
    back(gate.workspace.active.slug, calendarId, "Buffers must be between 0 and 180 minutes.");
  }
  if (!(LOCATION_MODES as readonly string[]).includes(locationMode)) back(gate.workspace.active.slug, calendarId, "Choose a location.");
  const supabase = gate.supabase;
  const created = await supabase.from("calendar_event_types").insert({
    org_id: gate.workspace.active.id,
    calendar_id: calendarId,
    name,
    duration_minutes: duration,
    buffer_before_minutes: bufferBefore,
    buffer_after_minutes: bufferAfter,
    location_mode: locationMode,
    location_detail: locationDetail,
    active: true,
  }).select("id").single();
  if (created.error || !created.data) back(gate.workspace.active.slug, calendarId, fail(created.error?.message || "Could not save the event type."));
  const eventId = String(created.data.id);
  const slug = bookingSlug(gate.workspace.active.slug, name);
  let linkError = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`.slice(0, 80);
    const linked = await supabase.from("booking_links").insert({
      org_id: gate.workspace.active.id,
      event_type_id: eventId,
      slug: candidate,
      active: true,
      consent_text: "",
    });
    if (!linked.error) {
      linkError = "";
      break;
    }
    linkError = linked.error.message;
    if (!/duplicate|unique/i.test(linkError)) break;
  }
  revalidatePath("/command-centre/calendars");
  back(gate.workspace.active.slug, calendarId, linkError ? fail(linkError) : "Event type saved. Copy the public link. No payment and no message were added.");
}

export async function assignAppointment(formData: FormData) {
  const gate = await guard(formData);
  const calendarId = text(formData, "calendarId");
  if (gate.error || !gate.supabase) back(gate.workspace.active.slug, calendarId, gate.error || "Could not save.");
  const appointmentId = text(formData, "appointmentId");
  const memberId = text(formData, "memberId");
  let assignedUser: string | null = null;
  if (memberId) {
    const member = await gate.supabase.from("memberships").select("id, user_id").eq("id", memberId).eq("org_id", gate.workspace.active.id).maybeSingle();
    if (member.error || !member.data) back(gate.workspace.active.slug, calendarId, member.error ? fail(member.error.message) : "That member is outside this workspace.");
    assignedUser = String(member.data.user_id);
  }
  const saved = await gate.supabase.from("crm_appointments").update({
    assigned_member_id: memberId || null,
    assigned_user_id: assignedUser,
  }).eq("id", appointmentId).eq("org_id", gate.workspace.active.id);
  revalidatePath("/command-centre/calendars");
  back(gate.workspace.active.slug, calendarId, saved.error ? fail(saved.error.message) : "Assignment saved.");
}

export async function setAppointmentStatus(formData: FormData) {
  const gate = await guard(formData);
  const calendarId = text(formData, "calendarId");
  if (gate.error || !gate.supabase) back(gate.workspace.active.slug, calendarId, gate.error || "Could not save.");
  const status = text(formData, "status");
  if (!STATUSES.has(status)) back(gate.workspace.active.slug, calendarId, "Choose a status.");
  const saved = await gate.supabase.from("crm_appointments").update({ status }).eq("id", text(formData, "appointmentId")).eq("org_id", gate.workspace.active.id);
  revalidatePath("/command-centre/calendars");
  back(gate.workspace.active.slug, calendarId, saved.error ? fail(saved.error.message) : "Status saved. No message was sent.");
}
