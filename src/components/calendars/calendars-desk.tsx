import {
  addException,
  assignAppointment,
  createCalendar,
  createEventType,
  deleteException,
  saveWeeklyHours,
  setAppointmentStatus,
} from "@/app/actions/calendars";
import { DAY_LABELS, formatMinute, formatSlot, locationLabel, LOCATION_MODES } from "@/lib/calendars/slots";
import type { CalendarDesk } from "@/lib/calendars/types";

function bookingHref(siteUrl: string, slug: string) {
  const path = `/book/${slug}`;
  return siteUrl ? `${siteUrl}${path}` : path;
}

export function CalendarsDesk({ data }: { data: CalendarDesk }) {
  const selected = data.calendars.find((calendar) => calendar.id === data.selectedId) ?? null;
  const hours = new Map(data.weekly.map((row) => [row.weekday, row]));

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Calendars</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Set weekly hours, event types, and a public booking link. A booking stores consent and does not send a confirmation. The workflow trigger is the existing <code>appointment.booked</code> event. Sending stays off.
        </p>
      </div>
      {data.notice ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{data.notice}</p> : null}

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Calendars</h2>
        {data.calendars.length === 0 ? <p className="text-sm text-slate-500">No calendars in this workspace yet.</p> : null}
        <ul className="grid gap-2">
          {data.calendars.map((calendar) => (
            <li key={calendar.id}>
              <a
                href={`/command-centre/calendars?org=${encodeURIComponent(data.orgSlug)}&id=${encodeURIComponent(calendar.id)}`}
                className={`block rounded-md border px-3 py-2 text-sm ${calendar.id === data.selectedId ? "border-[#0B1F3A] bg-slate-50 font-semibold" : "border-slate-200"}`}
              >
                {calendar.name}
                <span className="ml-2 font-normal text-slate-500">{calendar.timezone}</span>
              </a>
            </li>
          ))}
        </ul>
        <form action={createCalendar} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="org" value={data.orgSlug} />
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Name
            <input name="name" required minLength={2} maxLength={80} placeholder="Audit calls" disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Timezone
            <input name="timezone" defaultValue="Africa/Johannesburg" disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </label>
          <button disabled={!data.canManage} className="h-10 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:bg-slate-300">Add calendar</button>
        </form>
      </section>

      {selected ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Weekly hours · {selected.name}</h2>
            <p className="mt-1 text-sm text-slate-500">Sunday is the first row. Times are in {selected.timezone}.</p>
            <form action={saveWeeklyHours} className="mt-3 grid gap-2">
              <input type="hidden" name="org" value={data.orgSlug} />
              <input type="hidden" name="calendarId" value={selected.id} />
              {DAY_LABELS.map((label, weekday) => {
                const window = hours.get(weekday);
                return (
                  <div key={label} className="grid grid-cols-[8rem_auto_1fr_1fr] items-center gap-2 text-sm">
                    <span>{label}</span>
                    <label className="flex items-center gap-2 text-slate-600">
                      <input type="checkbox" name={`day-${weekday}-open`} defaultChecked={Boolean(window)} disabled={!data.canManage} />
                      Open
                    </label>
                    <input name={`day-${weekday}-start`} defaultValue={formatMinute(window?.startMinute ?? 9 * 60)} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3" />
                    <input name={`day-${weekday}-end`} defaultValue={formatMinute(window?.endMinute ?? 17 * 60)} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3" />
                  </div>
                );
              })}
              <button disabled={!data.canManage} className="mt-2 h-10 w-fit rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white disabled:bg-slate-300">Save hours</button>
            </form>
            <div className="mt-4 grid gap-2">
              {data.exceptions.map((item) => (
                <form key={item.id} action={deleteException} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <input type="hidden" name="org" value={data.orgSlug} />
                  <input type="hidden" name="calendarId" value={selected.id} />
                  <input type="hidden" name="exceptionId" value={item.id} />
                  <span>
                    {item.date} · {item.available && item.startMinute != null && item.endMinute != null ? `${formatMinute(item.startMinute)}–${formatMinute(item.endMinute)}` : "Closed"}
                  </span>
                  <button disabled={!data.canManage} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold disabled:bg-slate-100">Remove</button>
                </form>
              ))}
              <form action={addException} className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_1fr_auto] sm:items-end">
                <input type="hidden" name="org" value={data.orgSlug} />
                <input type="hidden" name="calendarId" value={selected.id} />
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Exception date
                  <input type="date" name="date" required disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" name="closed" disabled={!data.canManage} />
                  Closed
                </label>
                <input name="start" defaultValue="09:00" disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                <input name="end" defaultValue="12:00" disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                <button disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold disabled:bg-slate-100">Add exception</button>
              </form>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Event types</h2>
            <ul className="mt-3 grid gap-3">
              {data.eventTypes.map((event) => {
                const href = event.slug ? bookingHref(data.siteUrl, event.slug) : "";
                return (
                  <li key={event.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <p className="font-semibold text-[#0B1F3A]">{event.name}</p>
                    <p className="text-slate-600">
                      {event.durationMinutes} min · buffer {event.bufferBefore}/{event.bufferAfter} · {locationLabel(event.locationMode)}
                      {event.locationDetail ? ` · ${event.locationDetail}` : ""}
                    </p>
                    {href ? (
                      <p className="mt-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Public link</span>
                        <input readOnly value={href} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 font-mono text-xs" />
                      </p>
                    ) : <p className="mt-2 text-slate-500">No public link yet.</p>}
                  </li>
                );
              })}
            </ul>
            <form action={createEventType} className="mt-4 grid gap-2">
              <input type="hidden" name="org" value={data.orgSlug} />
              <input type="hidden" name="calendarId" value={selected.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Name
                  <input name="name" required minLength={2} maxLength={80} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Duration (minutes)
                  <input name="duration" type="number" min={5} max={480} defaultValue={20} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Buffer before
                  <input name="bufferBefore" type="number" min={0} max={180} defaultValue={0} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Buffer after
                  <input name="bufferAfter" type="number" min={0} max={180} defaultValue={0} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Location
                  <select name="locationMode" defaultValue="phone" disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
                    {LOCATION_MODES.map((mode) => <option key={mode} value={mode}>{locationLabel(mode)}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Location detail
                  <input name="locationDetail" maxLength={160} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                </label>
              </div>
              <button disabled={!data.canManage} className="h-10 w-fit rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:bg-slate-300">Add event type</button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Appointments</h2>
            <p className="mt-1 text-sm text-slate-500">Staff who only see their own inbox threads only see appointments assigned to them. Unassigned bookings stay with admins.</p>
            {data.appointments.length === 0 ? <p className="mt-3 text-sm text-slate-500">No appointments yet.</p> : null}
            <ul className="mt-3 grid gap-3">
              {data.appointments.map((item) => (
                <li key={item.id} className="grid gap-2 rounded-md border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-[#0B1F3A]">{item.guestName || "Guest"} · {item.eventName}</p>
                  <p className="text-slate-600">{formatSlot(item.startsAt, selected.timezone)} · {item.guestEmail} {item.guestPhone}</p>
                  <div className="flex flex-wrap gap-2">
                    <form action={assignAppointment} className="flex gap-2">
                      <input type="hidden" name="org" value={data.orgSlug} />
                      <input type="hidden" name="calendarId" value={selected.id} />
                      <input type="hidden" name="appointmentId" value={item.id} />
                      <select name="memberId" defaultValue={item.assignedMemberId ?? ""} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-2 text-sm">
                        <option value="">Unassigned</option>
                        {data.members.map((member) => (
                          <option key={member.id} value={member.id}>{member.role} · {member.userId.slice(0, 8)}</option>
                        ))}
                      </select>
                      <button disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold disabled:bg-slate-100">Assign</button>
                    </form>
                    <form action={setAppointmentStatus} className="flex gap-2">
                      <input type="hidden" name="org" value={data.orgSlug} />
                      <input type="hidden" name="calendarId" value={selected.id} />
                      <input type="hidden" name="appointmentId" value={item.id} />
                      <select name="status" defaultValue={item.status} disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-2 text-sm">
                        <option value="scheduled">Scheduled</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="completed">Completed</option>
                        <option value="no_show">No show</option>
                      </select>
                      <button disabled={!data.canManage} className="h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold disabled:bg-slate-100">Status</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
