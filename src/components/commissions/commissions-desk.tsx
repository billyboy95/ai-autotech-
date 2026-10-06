"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  attributeByCode,
  attributeManual,
  recordReceipt,
  saveSalesperson,
  type CommissionActionState,
} from "@/app/actions/commissions";
import { formatCommissionZar, ruleLabel } from "@/lib/commissions/calc";
import type { CommissionDesk } from "@/lib/commissions/types";

const initial: CommissionActionState = { ok: false, message: "" };

const fieldClass = "h-11 w-full min-w-0 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:border-[#2563EB]";

export function CommissionsDesk({ data }: { data: CommissionDesk }) {
  return (
    <div data-testid="commission-desk" data-commission-mode={data.mode} className="grid w-full min-w-0 gap-4 overflow-x-hidden">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Sales commission</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">Salespeople</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          A salesperson earns a percent of the gross amount received after a deal is marked won and the payment is marked paid.
          Part payments use the amount on that payment. Payouts are a mark on the ledger. No money is sent from this page.
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{data.disclaimer}</p>
      </div>
      {data.notice ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{data.notice}</p> : null}

      <section className="grid gap-3">
        {data.salespeople.map((person) => (
          <article key={person.id} className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="break-words font-display text-lg font-bold text-[#0B1F3A]">{person.name}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{person.active ? "Active" : "Paused"}</span>
            </div>
            <p className="break-words text-sm text-slate-600">{person.contact || "No contact entered"}</p>
            <p className="break-all text-sm font-semibold text-[#0B1F3A]">{person.code}</p>
            <p className="break-all text-sm text-slate-600">{person.link}</p>
            <p className="text-sm leading-6 text-slate-700">{ruleLabel(person)}</p>
            <Link
              href={`/command-centre/commissions/${person.id}?org=${encodeURIComponent(data.orgSlug)}`}
              className="inline-flex h-11 items-center text-sm font-semibold text-[#2563EB]"
            >
              Open statement
            </Link>
          </article>
        ))}
      </section>

      <SalespersonForm data={data} />
      <AttributeForms data={data} />
      <ReceiptForm data={data} />

      <section className="grid min-w-0 gap-3">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Recent ledger</h2>
        {data.lines.map((line) => (
          <article key={line.id} className="grid min-w-0 gap-1 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 shadow-sm">
            <p className="break-words font-semibold text-[#0B1F3A]">{line.title}</p>
            <p className="text-slate-600">
              {formatCommissionZar(line.amountCents)} on {formatCommissionZar(line.basisCents)} received · {line.status} · {line.method === "eft" ? "EFT" : "other"}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

function Note({ state }: { state: CommissionActionState }) {
  if (!state.message) return null;
  return <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>;
}

function SalespersonForm({ data }: { data: CommissionDesk }) {
  const [state, action] = useActionState(saveSalesperson, initial);
  const locked = !data.writes || !data.canManage || data.preview;
  return (
    <form action={action} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Add a salesperson</h2>
      <p className="text-sm leading-6 text-slate-600">Owner only. The percent starts at 30 as a placeholder. Basis stays the gross amount received.</p>
      <input type="hidden" name="org" value={data.orgSlug} />
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Name
        <input name="name" placeholder="Name" className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Contact
        <input name="contact" placeholder="Email or phone" className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Code
        <input name="code" placeholder="NOMSA30" className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Percent of amount received
        <input name="percent" type="number" min={0} max={100} step="0.01" defaultValue={30} className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Once-off or recurring
        <select name="cadence" className={fieldClass} defaultValue="once_off">
          <option value="once_off">Once-off</option>
          <option value="recurring">Recurring</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Month limit for recurring
        <input name="monthLimit" type="number" min={1} max={36} placeholder="Empty for no limit" className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Active
        <select name="active" className={fieldClass} defaultValue="yes">
          <option value="yes">Active</option>
          <option value="no">Paused</option>
        </select>
      </label>
      <button disabled={locked} className="h-11 w-full rounded-md bg-[#2563EB] text-sm font-semibold text-white disabled:bg-slate-300 sm:w-auto sm:px-4">
        Save salesperson
      </button>
      <Note state={state} />
      {locked ? <p className="text-xs leading-5 text-slate-500">Saving is off while the flag is unset. Nothing is written.</p> : null}
    </form>
  );
}

function AttributeForms({ data }: { data: CommissionDesk }) {
  const [codeState, codeAction] = useActionState(attributeByCode, initial);
  const [manualState, manualAction] = useActionState(attributeManual, initial);
  const locked = !data.writes || !data.canAttribute || data.preview;
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <form action={codeAction} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Code on the lead</h2>
        <p className="text-sm leading-6 text-slate-600">The link uses aff=. Staff attach that code to the lead. Commission is not created yet.</p>
        <input type="hidden" name="org" value={data.orgSlug} />
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Code
          <input name="code" defaultValue={data.cookieCode ?? ""} placeholder="NOMSA30" className={fieldClass} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Lead id
          <input name="leadId" placeholder="lead id" className={fieldClass} />
        </label>
        <button disabled={locked} className="h-11 w-full rounded-md bg-[#0B1F3A] text-sm font-semibold text-white disabled:bg-slate-300">
          Attribute code
        </button>
        <Note state={codeState} />
      </form>
      <form action={manualAction} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Manual on the deal</h2>
        <p className="text-sm leading-6 text-slate-600">Staff pick the salesperson and the deal. One salesperson per deal.</p>
        <input type="hidden" name="org" value={data.orgSlug} />
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Salesperson
          <select name="salespersonId" className={fieldClass} defaultValue="">
            <option value="">Choose</option>
            {data.salespeople.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Deal id
          <input name="dealId" placeholder="deal id" className={fieldClass} />
        </label>
        <button disabled={locked} className="h-11 w-full rounded-md bg-[#0B1F3A] text-sm font-semibold text-white disabled:bg-slate-300">
          Attribute deal
        </button>
        <Note state={manualState} />
        {locked ? <p className="text-xs leading-5 text-slate-500">Attribution is off while the flag is unset. Nothing is written.</p> : null}
      </form>
    </div>
  );
}

function ReceiptForm({ data }: { data: CommissionDesk }) {
  const [state, action] = useActionState(recordReceipt, initial);
  const locked = !data.writes || !data.canAttribute || data.preview;
  return (
    <form action={action} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Amount received</h2>
      <p className="text-sm leading-6 text-slate-600">
        Record the EFT after the deal is won. The commission line is the percent of this amount. A later part payment adds its own line, until a recurring month limit is filled.
      </p>
      <input type="hidden" name="org" value={data.orgSlug} />
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Attributed sale
        <select name="attributionId" className={fieldClass} defaultValue="">
          <option value="">Choose</option>
          {data.attributions.map((row) => (
            <option key={row.id} value={row.id}>{row.title} · {row.salespersonName}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Amount received (rand)
        <input name="amount" inputMode="decimal" placeholder="4000.00" className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Date received
        <input name="paidOn" type="date" className={fieldClass} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">
        Method
        <select name="method" className={fieldClass} defaultValue="eft">
          <option value="eft">EFT</option>
          <option value="other">Other</option>
        </select>
      </label>
      <button disabled={locked} className="h-11 w-full rounded-md bg-[#2563EB] text-sm font-semibold text-white disabled:bg-slate-300 sm:w-auto sm:px-4">
        Record payment
      </button>
      <Note state={state} />
      {locked ? <p className="text-xs leading-5 text-slate-500">Recording is off while the flag is unset. Nothing is written.</p> : null}
    </form>
  );
}
