"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestServiceQuote, type QuoteActionState } from "@/app/actions/services";
import { BUSINESS_EMAIL } from "@/lib/brand/contact";
import { formatPackageZar, PRICE_PLACEHOLDER_LABEL, SERVICE_PACKAGES } from "@/lib/services/catalog";

const initial: QuoteActionState = { ok: false, message: "" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Sending the request..." : "Request a quote"}
    </button>
  );
}

export function ServiceEnquiryForm() {
  const [state, action] = useActionState(requestServiceQuote, initial);
  return (
    <form action={action} className="grid gap-4">
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">{PRICE_PLACEHOLDER_LABEL} Nothing is charged on this form.</p>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Package
        <select name="package_code" required className="h-11 rounded-md border border-slate-200 bg-white px-3" defaultValue="website_build">
          {SERVICE_PACKAGES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name} · {formatPackageZar(item.priceCents)} placeholder
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Name
          <input name="full_name" required className="h-11 rounded-md border border-slate-200 px-3" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Company
          <input name="company" className="h-11 rounded-md border border-slate-200 px-3" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input name="email" type="email" required className="h-11 rounded-md border border-slate-200 px-3" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Phone
          <input name="phone" className="h-11 rounded-md border border-slate-200 px-3" />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        What do you need?
        <textarea name="message" rows={4} className="rounded-md border border-slate-200 px-3 py-2" />
      </label>
      <input name="_honey" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <Submit />
      {state.message ? (
        <p className={state.ok ? "text-sm text-emerald-800" : "text-sm text-rose-800"}>{state.message}</p>
      ) : null}
      {state.acceptPath ? (
        <a className="text-sm font-semibold text-[#2563EB]" href={state.acceptPath}>
          Open the quote
        </a>
      ) : null}
      <p className="text-sm text-slate-600">
        Questions: <a className="font-semibold text-[#0B1F3A]" href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a>
      </p>
    </form>
  );
}
