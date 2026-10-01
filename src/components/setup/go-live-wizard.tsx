import Link from "next/link";
import { ChecklistNoteForm } from "@/components/setup/checklist-form";
import { FIXTURE_WIZARD_COPY, wizardStatusLabel, type SetupWizardModel } from "@/lib/setup/wizard";

const tone: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  configured: "bg-emerald-50 text-emerald-950",
  connected: "bg-emerald-50 text-emerald-950",
  missing: "bg-amber-50 text-amber-950",
  not_connected: "bg-amber-50 text-amber-950",
  leave_unset: "bg-sky-50 text-sky-950",
  fixture: "bg-amber-50 text-amber-950",
  noted: "bg-slate-100 text-slate-700",
};

export function GoLiveWizard({ model, orgSlug }: { model: SetupWizardModel; orgSlug: string }) {
  return (
    <section
      id="setup-wizard"
      data-testid="setup-wizard"
      data-mode={model.mode}
      data-write={model.write ? "true" : "false"}
      className="grid max-w-3xl gap-4"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Go-live</p>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Setup / go-live wizard</h1>
        <p className="mt-2 text-sm text-slate-700">
          Ordered checklist for the remaining production blockers. sending_enabled stays false. Nothing is sent and nothing is spent.
          Leave AI_REPLY_CRON_ENABLED unset. This page does not schedule a cron.
        </p>
      </div>

      {model.mode === "fixture" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">{FIXTURE_WIZARD_COPY}</p>
      ) : (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          SETUP_WIZARD_ENABLED is the string true. A sandbox checklist event can be stored after step 32 is applied. No secret is stored.
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Copy helper</h2>
        <p className="mt-2 text-sm text-slate-700">{model.paste}</p>
        <p className="mt-2 text-sm text-slate-700">
          Step 32 is also unapplied. Set SETUP_WIZARD_ENABLED to the string true only after that file is applied. Do not turn on East Rand seed, the Zentrix pack, or the PWA write flag from this page. Step 33 is also unapplied. Leave MIGRATION_RUNNER_ENABLED unset. The migration runner does not apply SQL.
        </p>
      </div>

      <ol className="grid gap-3">
        {model.items.map((item) => (
          <li key={item.stepKey} data-step={item.stepKey} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Step {item.order}</p>
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{item.label}</h2>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[item.status] ?? tone.pending}`}>
                {wizardStatusLabel(item.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{item.detail}</p>
            {item.stepKey === "sql_steps" ? (
              <ol className="mt-3 grid gap-1 text-sm text-slate-700">
                {model.sqlSteps.map((step) => (
                  <li key={step.file}>
                    {step.step}. {step.name} · Pending. Do not claim applied.
                  </li>
                ))}
              </ol>
            ) : null}
            {item.stepKey === "feature_flags" ? (
              <ul className="mt-3 grid gap-1 text-sm text-slate-700">
                {model.flags.map((flag) => (
                  <li key={flag.key}>
                    {flag.key} · {flag.presence === "set" ? "set" : "unset"} · step {flag.step} · {flag.purpose}. Leave unset.
                  </li>
                ))}
              </ul>
            ) : null}
            {item.href && item.hrefLabel ? (
              <p className="mt-2">
                <Link href={item.href} className="font-semibold text-[#2563EB]">
                  {item.hrefLabel}
                </Link>
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Sandbox note</h2>
        <p className="mt-1 text-sm text-slate-700">
          The note stores org, step, and status only. sandbox stays true. charged stays false. A secret field is refused.
        </p>
        <div className="mt-3">
          <ChecklistNoteForm mode={model.mode} orgSlug={orgSlug} />
        </div>
      </div>
    </section>
  );
}
