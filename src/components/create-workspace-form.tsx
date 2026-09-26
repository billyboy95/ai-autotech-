"use client";

import { useActionState } from "react";
import { createWorkspace, type TenantActionState } from "@/app/actions/tenant";

const initial: TenantActionState = { ok: false, message: "" };

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspace, initial);

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Workspace name
        <input name="name" required placeholder="EASTC" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Slug
        <input name="slug" placeholder="eastc" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Location
        <input name="location" placeholder="Kempton Park" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Domain
        <input name="domain" placeholder="eastech.co.za" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Template
        <select name="blueprint" defaultValue="education" className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="agency">Agency snapshot — sales stages, follow-ups, templates</option>
          <option value="education">Education — Enquiry through Enrolled</option>
        </select>
      </label>
      <button disabled={pending} className="h-10 rounded-md bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Creating…" : "Create workspace"}
      </button>
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
    </form>
  );
}
