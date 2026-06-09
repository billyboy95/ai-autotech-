"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CreditCard, FileDown } from "lucide-react";
import { createCheckoutSession, type BillingActionState } from "@/app/actions/billing";

const initialState: BillingActionState = { ok: false, message: "" };

function CheckoutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <CreditCard size={16} />
      {pending ? "Opening checkout..." : "Start subscription"}
    </button>
  );
}

export function BillingPanel() {
  const [state, action] = useActionState(createCheckoutSession, initialState);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Subscriptions and PDF Output</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Stripe Checkout is wired for subscription billing. Proposal and invoice PDF endpoints are available for rendering client-ready documents.
      </p>

      <form action={action} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Stripe price ID
          <input
            name="price_id"
            className="h-10 rounded-md border border-slate-200 px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
            placeholder="Defaults to STRIPE_PRICE_ID"
          />
        </label>
        <CheckoutButton />
        {state.message ? (
          <p className={`text-sm font-semibold ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
            {state.message}
          </p>
        ) : null}
      </form>

      <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5">
        <a
          href="/api/proposals/demo/pdf"
          className="flex h-10 items-center justify-between rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-[#2563EB] hover:text-[#2563EB]"
        >
          Sample proposal PDF
          <FileDown size={16} />
        </a>
        <a
          href="/api/invoices/demo/pdf"
          className="flex h-10 items-center justify-between rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-[#2563EB] hover:text-[#2563EB]"
        >
          Sample invoice PDF
          <FileDown size={16} />
        </a>
      </div>
    </section>
  );
}
