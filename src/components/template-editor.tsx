"use client";

import { useActionState } from "react";
import { saveSnapshotTemplate, type ProvisionState } from "@/app/actions/provision";

const initial: ProvisionState = { ok: false, message: "", report: [] };

export function TemplateEditor({
  slug,
  template,
  canEdit,
}: {
  slug: string;
  canEdit: boolean;
  template: { id: string; channel: string; name: string; subject: string; body: string; active: boolean };
}) {
  const [state, action, pending] = useActionState(saveSnapshotTemplate, initial);

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-[#0B1F3A]">{template.name}</h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{template.channel}</span>
      </div>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={template.id} />
      {template.channel === "email" ? (
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Subject
          <input name="subject" defaultValue={template.subject} disabled={!canEdit} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
      ) : (
        <input type="hidden" name="subject" value={template.subject} />
      )}
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Message
        <textarea name="body" rows={5} defaultValue={template.body} disabled={!canEdit} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="active" defaultChecked={template.active} disabled={!canEdit} />
        Active in the sequence definition
      </label>
      {canEdit ? (
        <button disabled={pending} className="h-10 w-fit rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save template"}
        </button>
      ) : null}
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
    </form>
  );
}
