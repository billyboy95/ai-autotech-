"use client";

import { useActionState, useState } from "react";
import { provisionWorkspace, type ProvisionState } from "@/app/actions/provision";

const initial: ProvisionState = { ok: false, message: "", report: [] };

type SnapshotChoice = { id: string; name: string; description: string };
type PlanChoice = { key: string; label: string; detail: string };

const STEPS = ["Workspace", "Snapshot", "Client admin", "Plan"] as const;

export function ProvisionWizard({ snapshots, plans }: { snapshots: SnapshotChoice[]; plans: PlanChoice[] }) {
  const [state, action, pending] = useActionState(provisionWorkspace, initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  function next(form: HTMLFormElement) {
    const data = new FormData(form);
    if (step === 0 && String(data.get("name") ?? "").trim().length < 2) {
      setError("Give the workspace a name.");
      return;
    }
    if (step === 1 && !String(data.get("snapshotId") ?? "")) {
      setError("Pick a snapshot.");
      return;
    }
    if (step === 2 && !String(data.get("email") ?? "").includes("@")) {
      setError("Enter the client admin email.");
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  return (
    <form action={action} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="provision-wizard">
      <ol className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "text-[#2563EB]" : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <fieldset className={step === 0 ? "grid gap-3" : "hidden"} data-testid="provision-step-1">
        <legend className="text-sm font-semibold text-[#0B1F3A]">Name, slug, and branding</legend>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Workspace name
          <input name="name" placeholder="East Sea Technocentric Varsity" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Slug
          <input name="slug" placeholder="eastc" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Sender name
          <input name="senderName" placeholder="Shown on later messages" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Logo URL
          <input name="logoUrl" placeholder="https://example.com/logo.png" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Primary colour
            <input name="primaryColor" type="color" defaultValue="#0B1F3A" className="h-10 w-full rounded-md border border-slate-200 bg-white" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Accent colour
            <input name="accentColor" type="color" defaultValue="#2563EB" className="h-10 w-full rounded-md border border-slate-200 bg-white" />
          </label>
        </div>
      </fieldset>

      <fieldset className={step === 1 ? "grid gap-3" : "hidden"} data-testid="provision-step-2">
        <legend className="text-sm font-semibold text-[#0B1F3A]">Pick a snapshot</legend>
        {snapshots.map((snapshot, index) => (
          <label key={snapshot.id} className="grid gap-1 rounded-lg border border-slate-200 p-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-[#0B1F3A]">
              <input type="radio" name="snapshotId" value={snapshot.id} defaultChecked={index === 0} />
              {snapshot.name}
            </span>
            <span className="pl-6 text-slate-600">{snapshot.description}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className={step === 2 ? "grid gap-3" : "hidden"} data-testid="provision-step-3">
        <legend className="text-sm font-semibold text-[#0B1F3A]">Invite a client admin</legend>
        <p className="text-sm text-slate-600">They get the client admin role for this workspace only. No message is sent from here.</p>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Email
          <input name="email" type="email" placeholder="admin@client.co.za" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
      </fieldset>

      <fieldset className={step === 3 ? "grid gap-3" : "hidden"} data-testid="provision-step-4">
        <legend className="text-sm font-semibold text-[#0B1F3A]">Plan placeholder</legend>
        <p className="text-sm text-slate-600">This choice is stored on the workspace. It does not open a checkout and it does not charge a card.</p>
        {plans.map((plan, index) => (
          <label key={plan.key} className="grid gap-1 rounded-lg border border-slate-200 p-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-[#0B1F3A]">
              <input type="radio" name="plan" value={plan.key} defaultChecked={index === 0} />
              {plan.label}
            </span>
            <span className="pl-6 text-slate-600">{plan.detail}</span>
          </label>
        ))}
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">Sending stays off. The new workspace gets a checklist to connect channels, review templates, and turn sending on later.</p>
      </fieldset>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {step > 0 ? (
          <button type="button" className="h-10 rounded-md border border-slate-200 px-4 text-sm font-semibold text-[#0B1F3A]" onClick={() => setStep((current) => current - 1)}>
            Back
          </button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="h-10 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white"
            onClick={(event) => next(event.currentTarget.form!)}
          >
            Next
          </button>
        ) : (
          <button disabled={pending} className="h-10 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60">
            {pending ? "Creating…" : "Create workspace"}
          </button>
        )}
      </div>
    </form>
  );
}
