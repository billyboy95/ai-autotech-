"use client";

import { useActionState } from "react";
import { startFreeTrial, type TrialStartState } from "@/app/actions/free-trial";
import { POPIA_TRIAL_CONSENT, type TrialNiche } from "@/lib/trial/trial";

const initial: TrialStartState = { ok: false, message: "" };

const fieldClass =
  "h-11 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100";

export function StartTrialForm({ niches }: { niches: TrialNiche[] }) {
  const [state, action, pending] = useActionState(startFreeTrial, initial);
  return (
    <form action={action} data-testid="trial-form" className="grid gap-3">
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Niche
        <select name="niche" required defaultValue={niches[0]?.id ?? ""} className={fieldClass}>
          {niches.map((niche) => (
            <option key={niche.id} value={niche.id}>
              {niche.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Business name
        <input name="business" required autoComplete="organization" className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Your name
        <input name="name" required autoComplete="name" className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Email
        <input name="email" type="email" required autoComplete="email" className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Phone
        <input name="phone" type="tel" required autoComplete="tel" className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Password
        <input name="password" type="password" required autoComplete="new-password" minLength={8} className={fieldClass} />
      </label>
      <p className="text-xs leading-5 text-slate-500">This password signs you in. No email, SMS, or WhatsApp is sent.</p>
      <label className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="flex items-start gap-2 text-sm leading-6 text-slate-700">
        <input name="popia" type="checkbox" value="yes" required className="mt-1" />
        <span>{POPIA_TRIAL_CONSENT}</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Starting..." : "Start free trial"}
      </button>
      {state.message ? (
        <p className={`text-sm leading-6 ${state.ok ? "text-emerald-800" : "text-rose-800"}`} data-testid="trial-result">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
