"use client";

import { useActionState, useState } from "react";
import { applyEducationPackToEastc, type ApplyEducationState } from "@/app/actions/eastc-education";

const initial: ApplyEducationState = { ok: false, message: "", report: [] };

export function ApplyEducationPackForm() {
  const [state, action, pending] = useActionState(applyEducationPackToEastc, initial);
  const [confirming, setConfirming] = useState(false);

  return (
    <section id="education-pack" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="apply-education-pack">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">EASTC</p>
      <h2 className="mt-1 font-display text-lg font-bold text-[#0B1F3A]">Education pack</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Loads the Education / Admissions snapshot onto the existing EASTC workspace: pipeline, stages, templates,
        custom fields, and an inactive workflow. Contacts, messages, and secrets are not copied. Sending stays off.
      </p>
      {confirming ? (
        <form action={action} className="mt-3 grid gap-3">
          <input type="hidden" name="confirm" value="yes" />
          <p className="text-sm text-slate-700">
            Confirm this applies the Education pack to EASTC only. Nothing is sent and sending stays off.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={pending}
              className="h-10 rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Applying…" : "Confirm apply to EASTC"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-10 rounded-md border border-slate-200 px-4 text-sm font-semibold text-[#0B1F3A]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 h-10 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white"
        >
          Apply Education pack to EASTC
        </button>
      )}
      {state.message ? (
        <p className={`mt-3 text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}
    </section>
  );
}
