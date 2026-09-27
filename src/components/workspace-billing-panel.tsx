"use client";

import { useActionState } from "react";
import {
  createYocoSandboxLink,
  preparePayfastCheckout,
  recordSandboxItn,
  type BillingActionState,
} from "@/app/actions/billing";
import type { BillingPageModel } from "@/lib/billing/load";

const initial: BillingActionState = { ok: false, message: "" };

function zar(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}

function statusLabel(status: string | null) {
  if (!status) return "No subscription";
  if (status === "past_due") return "Past due";
  return status.slice(0, 1).toUpperCase() + status.slice(1);
}

export function WorkspaceBillingPanel({ billing }: { billing: BillingPageModel }) {
  const [checkoutState, prepareCheckout, preparing] = useActionState(preparePayfastCheckout, initial);
  const [itnState, applyItn, applyingItn] = useActionState(recordSandboxItn, initial);
  const [yocoState, draftYoco, draftingYoco] = useActionState(createYocoSandboxLink, initial);
  const status = billing.subscription?.status ?? null;

  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Billing</h2>
          <p className="mt-1 text-sm text-slate-600">
            {billing.orgName} · plans in ZAR · PayFast sandbox subscriptions. Paystack is stubbed. Yoco is once-off drafts only.
          </p>
        </div>
        <p className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "suspended" ? "bg-rose-100 text-rose-900" : status === "past_due" ? "bg-amber-100 text-amber-950" : status === "active" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>
          {statusLabel(status)}
        </p>
      </div>

      {billing.notice ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{billing.notice}</p> : null}
      {billing.readOnly ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">
          This workspace is suspended. The rest of the CRM is read-only and sending stays off. Sandbox checkout on this page does not take a live payment.
        </p>
      ) : null}
      {!billing.canManage ? (
        <p className="text-sm text-slate-600">Billing is managed by a workspace admin. Client users can see that the workspace is suspended, and cannot change the plan.</p>
      ) : null}

      {billing.subscription ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</dt>
            <dd className="font-semibold text-[#0B1F3A]">{billing.subscription.planCode}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider</dt>
            <dd className="font-semibold text-[#0B1F3A]">{billing.subscription.provider}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period end</dt>
            <dd className="font-semibold text-[#0B1F3A]">{billing.subscription.currentPeriodEnd ? billing.subscription.currentPeriodEnd.slice(0, 10) : "—"}</dd>
          </div>
        </dl>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-[#0B1F3A]">This month&apos;s usage</h3>
        {billing.usageLines.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">No ledger rows in the current Johannesburg month. The monthly job sums usage × markup into a sandbox invoice and does not charge a card.</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm text-slate-700">
            {billing.usageLines.map((line) => (
              <li key={line.meter}>{line.meter}: {line.quantity} · {zar(line.amountCents)}</li>
            ))}
            <li className="font-semibold text-[#0B1F3A]">Total {zar(billing.usageTotalCents)}</li>
          </ul>
        )}
      </div>

      {billing.canManage ? (
        <form action={prepareCheckout} className="grid gap-3 border-t border-slate-200 pt-4">
          <input type="hidden" name="slug" value={billing.slug} />
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Plan
            <select name="plan_code" className="h-10 rounded-md border border-slate-200 px-3 text-sm" defaultValue={billing.plans[0]?.code || "starter"}>
              {billing.plans.length === 0 ? <option value="starter">Starter</option> : null}
              {billing.plans.map((plan) => (
                <option key={plan.code} value={plan.code}>
                  {plan.name} · {zar(plan.priceCents)} / {plan.interval}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Payer email
            <input name="email" type="email" defaultValue={billing.email} className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="sandbox@example.com" />
          </label>
          <button disabled={preparing || !billing.sandboxEnabled} className="h-10 w-fit rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:opacity-60">
            {preparing ? "Preparing…" : "Prepare PayFast sandbox checkout"}
          </button>
          {!billing.sandboxEnabled ? (
            <p className="text-sm text-slate-500">Set BILLING_SANDBOX=true and PAYFAST_MERCHANT_ID=10000100 with the sandbox merchant key. No charge is sent until you submit the PayFast sandbox form.</p>
          ) : null}
          {checkoutState.message ? <p className={`text-sm font-semibold ${checkoutState.ok ? "text-emerald-700" : "text-rose-700"}`}>{checkoutState.message}</p> : null}
        </form>
      ) : null}

      {checkoutState.checkout ? (
        <form method="post" action={checkoutState.checkout.actionUrl} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          {Object.entries(checkoutState.checkout.fields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <p className="text-sm text-slate-600">This form posts to the PayFast sandbox only. Use a PayFast test card. This app does not call the live PayFast host.</p>
          <button className="mt-3 h-10 rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">Continue to PayFast sandbox</button>
        </form>
      ) : null}

      {billing.canManage && billing.mockItn ? (
        <form action={applyItn} className="grid gap-2 border-t border-slate-200 pt-4">
          <input type="hidden" name="slug" value={billing.slug} />
          <input type="hidden" name="plan_code" value={billing.plans[0]?.code || "starter"} />
          <p className="text-sm text-slate-600">Record a mocked PayFast ITN for the first plan. This marks the subscription active in sandbox and does not call PayFast.</p>
          <button disabled={applyingItn} className="h-10 w-fit rounded-md border border-slate-200 px-4 text-sm font-semibold text-[#0B1F3A] disabled:opacity-60">
            {applyingItn ? "Applying…" : "Apply sandbox ITN"}
          </button>
          {itnState.message ? <p className={`text-sm font-semibold ${itnState.ok ? "text-emerald-700" : "text-rose-700"}`}>{itnState.message}</p> : null}
        </form>
      ) : null}

      {billing.canManage ? (
        <form action={draftYoco} className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
          <input type="hidden" name="slug" value={billing.slug} />
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Yoco once-off amount (ZAR)
            <input name="amount_rands" inputMode="decimal" placeholder="150.00" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Description
            <input name="description" defaultValue="Once-off invoice" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button disabled={draftingYoco} className="h-10 rounded-md border border-slate-200 px-4 text-sm font-semibold text-[#0B1F3A] disabled:opacity-60">
              {draftingYoco ? "Saving…" : "Save Yoco sandbox draft"}
            </button>
            <p className="mt-2 text-sm text-slate-500">Yoco does not support recurring billing. The draft stays in this workspace. Yoco is not called.</p>
            {yocoState.message ? <p className={`mt-2 text-sm font-semibold ${yocoState.ok ? "text-emerald-700" : "text-rose-700"}`}>{yocoState.message}</p> : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
