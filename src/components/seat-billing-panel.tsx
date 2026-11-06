import React from "react";
import type { SeatBillingView } from "@/lib/billing/seats";

function zar(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}

function countLabel(value: number | null) {
  return value === null ? "Unavailable" : String(value);
}

/** Read-only seat and WhatsApp number lines. Renders nothing when the flag is off. */
export function SeatBillingPanel({ seat }: { seat: SeatBillingView | null }) {
  if (!seat) return null;
  return (
    <section data-seat-billing="on" className="grid gap-3 border-t border-slate-200 pt-4">
      <div>
        <h3 className="text-sm font-semibold text-[#0B1F3A]">Team seats and WhatsApp numbers</h3>
        <p className="mt-1 text-sm text-slate-600">
          Placeholder ZAR. Not a client quote. VAT excluded. PayFast sandbox only. This panel does not charge a card and does not send a message.
        </p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team seats</dt>
          <dd className="font-semibold text-[#0B1F3A]" data-seat-count={seat.teamSeats === null ? "unavailable" : String(seat.teamSeats)}>
            {countLabel(seat.teamSeats)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Connected WhatsApp numbers</dt>
          <dd
            className="font-semibold text-[#0B1F3A]"
            data-whatsapp-count={seat.whatsappNumbers === null ? "unavailable" : String(seat.whatsappNumbers)}
          >
            {countLabel(seat.whatsappNumbers)}
          </dd>
        </div>
      </dl>
      {seat.notice ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{seat.notice}</p> : null}
      <ul className="grid gap-1 text-sm text-slate-700">
        {seat.plans.map((plan) => (
          <li key={plan.code} data-plan={plan.code} data-cents={plan.priceCents}>
            {plan.name} · {zar(plan.priceCents)} / {plan.interval} · Placeholder
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-500">
        These lines show in the plan menu only while TEAM_SEAT_BILLING_ENABLED is the string true. Checkout still posts to the PayFast sandbox. Live PayFast is refused.
      </p>
    </section>
  );
}
