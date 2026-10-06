"use client";

import { useActionState } from "react";
import { setLedgerStatus, type CommissionActionState } from "@/app/actions/commissions";
import { canSetLedgerStatus, formatCommissionZar, ruleLabel } from "@/lib/commissions/calc";
import type { CommissionStatement, LedgerStatus } from "@/lib/commissions/types";

const initial: CommissionActionState = { ok: false, message: "" };

const STATUS_LABEL: Record<LedgerStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  void: "Void",
};

export function StatementView({ data }: { data: CommissionStatement }) {
  const person = data.salesperson;
  return (
    <div data-testid="commission-statement" data-commission-mode={data.mode} className="mx-auto grid w-full min-w-0 max-w-lg gap-4 overflow-x-hidden">
      <div className="min-w-0">
        <a href={`/command-centre/commissions?org=${encodeURIComponent(data.orgSlug)}`} className="text-sm font-semibold text-[#2563EB]">
          Commissions
        </a>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Salesperson statement</p>
        <h1 className="mt-1 break-words font-display text-2xl font-bold text-[#0B1F3A]">
          {person ? person.name : "Statement"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{data.disclaimer}</p>
      </div>
      {data.notice ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{data.notice}</p> : null}
      {person ? (
        <section className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">{person.active ? "Active" : "Paused"} · {person.contact || "No contact entered"}</p>
          <p className="break-all text-sm font-semibold text-[#0B1F3A]">{person.code}</p>
          <p className="break-all text-sm text-slate-600">{person.link}</p>
          <p className="text-sm leading-6 text-slate-700">{ruleLabel(person)}</p>
          <p className="text-xs text-slate-500">Basis is the gross amount received. 30% is the placeholder until the owner sets the percent. Part payments use the amount on that payment, not the quoted total.</p>
        </section>
      ) : null}
      <section className="grid grid-cols-2 gap-3">
        {[
          ["Pending", data.totals.pendingCents],
          ["Approved", data.totals.approvedCents],
          ["Marked paid", data.totals.paidCents],
          ["Void", data.totals.voidCents],
        ].map(([label, cents]) => (
          <article key={String(label)} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 break-words font-display text-xl font-bold text-[#0B1F3A]">{formatCommissionZar(Number(cents))}</p>
          </article>
        ))}
      </section>
      <section className="grid min-w-0 gap-3">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Ledger</h2>
        {data.lines.length === 0 ? <p className="text-sm text-slate-600">No commission lines on this statement.</p> : null}
        {data.lines.map((line) => (
          <article key={line.id} className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 break-words font-semibold text-[#0B1F3A]">{line.title}</p>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{STATUS_LABEL[line.status]}</span>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Received {formatCommissionZar(line.basisCents)} on {line.paidOn || "the recorded date"} by {line.method === "eft" ? "EFT" : "other"}.
            </p>
            <p className="text-sm leading-6 text-slate-700">
              Commission {formatCommissionZar(line.amountCents)} · {line.percent}% of that amount · line {line.periodIndex}
            </p>
            <StatusForm lineId={line.id} status={line.status} orgSlug={data.orgSlug} writes={data.writes && data.canManage && !data.preview} />
          </article>
        ))}
      </section>
      <section className="grid min-w-0 gap-2">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Who changed what</h2>
        {data.audit.length === 0 ? <p className="text-sm text-slate-600">No audit rows on this sample.</p> : null}
        {data.audit.map((row) => (
          <article key={row.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 shadow-sm">
            <p className="font-semibold text-[#0B1F3A]">{row.action}</p>
            <p className="break-words">{row.detail}</p>
            <p className="text-slate-500">{row.at}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function StatusForm({ lineId, status, orgSlug, writes }: { lineId: string; status: LedgerStatus; orgSlug: string; writes: boolean }) {
  const [state, action] = useActionState(setLedgerStatus, initial);
  const choices = (["approved", "paid", "void"] as const).filter((next) => canSetLedgerStatus(status, next));
  if (!choices.length) return null;
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="org" value={orgSlug} />
      <input type="hidden" name="ledgerId" value={lineId} />
      <div className="grid gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            name="status"
            value={choice}
            disabled={!writes}
            className="h-11 w-full rounded-md border border-slate-300 text-sm font-semibold text-[#0B1F3A] disabled:bg-slate-100 disabled:text-slate-400"
          >
            {choice === "paid" ? "Mark paid" : choice === "approved" ? "Mark approved" : "Mark void"}
          </button>
        ))}
      </div>
      {state.message ? <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}
      {!writes ? <p className="text-xs leading-5 text-slate-500">The mark stays on this page. With the flag unset, it is not saved and no money is sent.</p> : null}
    </form>
  );
}
