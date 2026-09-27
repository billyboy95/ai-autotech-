"use client";

import { useActionState } from "react";
import { submitPublicBooking, type BookingState } from "@/app/actions/booking";
import { formatSlot, locationLabel } from "@/lib/calendars/slots";
import type { PublicBookingPage } from "@/lib/calendars/types";

const initial: BookingState = { ok: false, message: "" };

export function BookingForm({ page }: { page: Extract<PublicBookingPage, { kind: "link" }> }) {
  const [state, action, pending] = useActionState(submitPublicBooking, initial);
  return (
    <form action={action} className="mt-5 grid gap-3">
      <input type="hidden" name="slug" value={page.slug} />
      <input type="hidden" name="consentText" value={page.consentText} />
      <p className="text-sm text-slate-600">
        {page.durationMinutes} minutes · {locationLabel(page.locationMode)}
        {page.locationDetail ? ` · ${page.locationDetail}` : ""}
      </p>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Time ({page.timezone})
        <select name="startsAt" required className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          {page.slots.length === 0 ? <option value="">No open times in the next two weeks</option> : null}
          {page.slots.map((slot) => (
            <option key={slot} value={slot}>{formatSlot(slot, page.timezone)}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Name
        <input name="name" required maxLength={100} autoComplete="name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Phone
        <input name="phone" maxLength={30} autoComplete="tel" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Email
        <input name="email" type="email" maxLength={160} autoComplete="email" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </label>
      <label className="absolute -left-[9999px]" aria-hidden="true">
        Company website
        <input name="company_website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input name="consent" type="checkbox" required className="mt-1" />
        <span>{page.consentText}</span>
      </label>
      {state.message ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>{state.message}</p>
      ) : null}
      <button disabled={pending || page.slots.length === 0} className="h-10 w-fit rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:bg-slate-300">
        Book appointment
      </button>
      <p className="text-xs text-slate-500">Booking does not send an SMS or email confirmation.</p>
    </form>
  );
}
