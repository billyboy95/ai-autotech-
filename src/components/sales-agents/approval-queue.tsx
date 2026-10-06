"use client";

import { useState } from "react";
import Link from "next/link";
import { approveSalesDraft, editSalesDraft, rejectSalesDraft } from "@/app/actions/sales-agents";
import { formatWhen } from "@/lib/automation/ids";
import type { ApprovalQueue, QueueDraft } from "@/lib/sales-agents/load";

const STEP_LABEL: Record<string, string> = {
  day0: "Day 0 · Thank you",
  day2: "Day 2 · Book the call",
  day5: "Day 5 · Last nudge",
  reminder_24h: "Reminder · 24 hours",
  reminder_1h: "Reminder · 1 hour",
  welcome: "Welcome",
};

function stepLabel(step: string) {
  return STEP_LABEL[step] || step;
}

export function ApprovalQueueDesk({ data }: { data: ApprovalQueue }) {
  const [drafts, setDrafts] = useState(data.drafts);
  const [editing, setEditing] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const fixture = data.mode === "fixture";

  function patch(id: string, next: Partial<QueueDraft>) {
    setDrafts((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }

  return (
    <div data-testid="approval-queue" data-mode={data.mode} className="mx-auto grid w-full max-w-[390px] gap-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Sales agents</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">Approval queue</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{data.notice}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-[#0B1F3A]">{data.summary.body}</p>
      </header>

      <ul className="grid gap-3">
        {drafts.length === 0 ? <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No drafts waiting.</li> : null}
        {drafts.map((draft) => {
          const body = bodies[draft.id] ?? draft.body;
          const open = editing === draft.id;
          return (
            <li key={draft.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {stepLabel(draft.step)} · {draft.channel}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0B1F3A]">{draft.subject || stepLabel(draft.step)}</p>
              {draft.status === "skipped" ? (
                <p className="mt-2 text-sm leading-6 text-amber-800">{draft.skipReason}</p>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{body}</p>
              )}
              <p className="mt-2 text-xs text-slate-400">{formatWhen(draft.scheduledFor)}</p>
              {draft.status === "approved" ? <p className="mt-3 text-sm font-semibold text-emerald-800">Queued in the outbox. Nothing was sent.</p> : null}
              {draft.status === "rejected" ? <p className="mt-3 text-sm font-semibold text-slate-500">Rejected. Nothing was sent.</p> : null}
              {draft.status === "draft" ? (
                <div className="mt-3 grid gap-2">
                  {open ? (
                    <textarea
                      className="min-h-28 w-full rounded-md border border-slate-200 p-3 text-base text-slate-800"
                      value={body}
                      onChange={(event) => setBodies((current) => ({ ...current, [draft.id]: event.target.value }))}
                    />
                  ) : null}
                  {fixture ? (
                    <>
                      <button
                        type="button"
                        className="flex h-12 w-full items-center justify-center rounded-md bg-[#0B1F3A] text-sm font-semibold text-white"
                        onClick={() => patch(draft.id, { status: "approved", body })}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="flex h-12 w-full items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-[#0B1F3A]"
                        onClick={() => (open ? (patch(draft.id, { body }), setEditing(null)) : setEditing(draft.id))}
                      >
                        {open ? "Save edit" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className="flex h-12 w-full items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-[#0B1F3A]"
                        onClick={() => patch(draft.id, { status: "rejected" })}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <>
                      <form action={approveSalesDraft}>
                        <input type="hidden" name="id" value={draft.id} />
                        <button className="flex h-12 w-full items-center justify-center rounded-md bg-[#0B1F3A] text-sm font-semibold text-white">Approve</button>
                      </form>
                      {open ? (
                        <form action={editSalesDraft}>
                          <input type="hidden" name="id" value={draft.id} />
                          <input type="hidden" name="body" value={body} />
                          <button className="flex h-12 w-full items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-[#0B1F3A]">Save edit</button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="flex h-12 w-full items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-[#0B1F3A]"
                          onClick={() => setEditing(draft.id)}
                        >
                          Edit
                        </button>
                      )}
                      <form action={rejectSalesDraft}>
                        <input type="hidden" name="id" value={draft.id} />
                        <button className="flex h-12 w-full items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-[#0B1F3A]">Reject</button>
                      </form>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Onboarding checklist</h2>
        <ul className="mt-3 grid gap-3">
          {data.checklist.length === 0 ? <li className="text-sm text-slate-500">No client checklist is open.</li> : null}
          {data.checklist.map((item) => (
            <li key={item.key} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-[#0B1F3A]">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
              {item.href.startsWith("/") ? (
                <Link href={item.href} className="mt-2 inline-flex h-12 items-center text-sm font-semibold text-[#2563EB]">
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
