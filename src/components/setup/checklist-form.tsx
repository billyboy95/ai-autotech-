"use client";

import { useActionState } from "react";
import { recordSetupChecklistEvent } from "@/app/actions/setup-wizard";
import { SETUP_STEP_KEYS, type SetupWizardMode } from "@/lib/setup/wizard";

const initial = { stored: false, write: false, mode: "fixture" as const, message: "" };

const labels: Record<(typeof SETUP_STEP_KEYS)[number], string> = {
  sql_steps: "Supabase SQL steps 20–31",
  owner_attach: "Agency owner first login",
  cron_secret: "CRON_SECRET",
  channel_email: "Email",
  channel_whatsapp: "WhatsApp (Meta)",
  channel_sms: "SMS",
  payfast_billing: "PayFast / BILLING_SANDBOX",
  feature_flags: "Phase 5 flags",
};

export function ChecklistNoteForm({ mode, orgSlug }: { mode: SetupWizardMode; orgSlug: string }) {
  const [state, action] = useActionState(recordSetupChecklistEvent, initial);
  return (
    <form action={action} className="grid gap-3" data-testid="setup-checklist-form">
      <input type="hidden" name="slug" value={orgSlug} />
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Checklist step
        <select name="step_key" defaultValue="sql_steps" className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          {SETUP_STEP_KEYS.map((key) => (
            <option key={key} value={key}>
              {labels[key]}
            </option>
          ))}
        </select>
      </label>
      <button className="inline-flex h-11 w-fit items-center rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">
        Record sandbox checklist event
      </button>
      <p
        className="text-sm text-slate-700"
        data-stored={state.stored ? "yes" : "no"}
        data-write={state.message ? String(state.write) : mode === "sandbox" ? "true" : "false"}
      >
        {state.message || (mode === "fixture"
          ? "Recording stays off while SETUP_WIZARD_ENABLED is unset. write: false."
          : "Recording can store one sandbox checklist event. No secret is stored.")}
      </p>
    </form>
  );
}
