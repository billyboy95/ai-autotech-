import Link from "next/link";
import { formatCents, formatDuration, messageSummary, redFlags, type PeriodMetrics } from "@/lib/agency/metrics";
import { formatCurrency } from "@/lib/utils";
import type { RollupClient } from "@/lib/agency/load";

function Sparkline({ values }: { values: number[] }) {
  const width = 96;
  const height = 28;
  if (!values.length) return <span className="text-xs text-slate-400">No days</span>;
  const max = Math.max(1, ...values);
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  const points = values
    .map((value, index) => `${index * step},${height - (value / max) * (height - 4) - 2}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`New leads by day: ${values.join(", ")}`} className="text-[#2563EB]">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

const FLAG_LABEL = {
  no_reply_2h: "No reply >2h",
  failures: "Failures",
  past_due: "Past due",
} as const;

export function AgencyRollupTable({
  rows,
  sample,
  fromDay,
  toDay,
}: {
  rows: RollupClient[];
  sample: boolean;
  fromDay: string;
  toDay: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="agency-rollup">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Client rollup</h2>
          <p className="text-sm text-slate-500">
            {fromDay} to {toDay}, Africa/Johannesburg. Open pipeline is the book at the end of the period. Outbox held is the current hold count.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            From
            <input name="from" type="date" defaultValue={fromDay} className="h-10 rounded-md border border-slate-200 px-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            To
            <input name="to" type="date" defaultValue={toDay} className="h-10 rounded-md border border-slate-200 px-2 text-sm" />
          </label>
          <button className="h-10 rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold text-white">Update</button>
        </form>
      </div>
      {sample ? (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Sample period for 1–3 Sep 2026. Live numbers load after step 14 in supabase/APPLY-ORDER.md is applied.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Client</th>
              <th className="px-3 py-2 font-semibold">Leads</th>
              <th className="px-3 py-2 font-semibold">First response</th>
              <th className="px-3 py-2 font-semibold">Open pipeline</th>
              <th className="px-3 py-2 font-semibold">Won</th>
              <th className="px-3 py-2 font-semibold">Messages</th>
              <th className="px-3 py-2 font-semibold">WA/SMS cost</th>
              <th className="px-3 py-2 font-semibold">Billed</th>
              <th className="px-3 py-2 font-semibold">Opt-out</th>
              <th className="px-3 py-2 font-semibold">Blocked</th>
              <th className="px-3 py-2 font-semibold">Failed runs</th>
              <th className="px-3 py-2 font-semibold">Held</th>
              <th className="px-3 py-2 font-semibold">Plan</th>
              <th className="px-3 py-2 font-semibold">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={14}>No client workspaces in this rollup.</td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <RollupRow key={row.slug} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RollupRow({ row }: { row: RollupClient }) {
  const flags = redFlags(row.metrics);
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.primaryColor }} />
          <Link href={`/command-centre?org=${row.slug}`} className="font-semibold text-[#0B1F3A] hover:text-[#2563EB]">
            {row.name}
          </Link>
        </div>
        <Sparkline values={row.metrics.sparkline} />
        {row.customDomain ? <p className="text-xs text-slate-500">{row.customDomain}</p> : null}
      </td>
      <Metric value={String(row.metrics.newLeads)} />
      <Metric value={formatDuration(row.metrics.medianFirstResponseSeconds)} />
      <Metric value={formatCurrency(row.metrics.openPipelineZar)} />
      <Metric value={formatCurrency(row.metrics.wonZar)} />
      <td className="px-3 py-3 text-xs text-slate-600">{messageSummary(row.metrics.messagesByChannel)}</td>
      <Metric value={formatCents(row.metrics.waSmsCostCents)} />
      <Metric value={formatCents(row.metrics.waSmsBilledCents)} />
      <Metric value={row.metrics.consentDecisions ? `${Math.round(row.metrics.optOutRate * 1000) / 10}%` : "—"} />
      <Metric value={String(row.metrics.blockedConsentCount)} />
      <Metric value={String(row.metrics.failedWorkflowRuns)} />
      <Metric value={String(row.metrics.outboxHeld)} />
      <Metric value={row.metrics.subscriptionStatus || "None"} />
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {flags.length === 0 ? <span className="text-xs text-slate-400">Clear</span> : null}
          {flags.map((flag) => (
            <span
              key={flag}
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${flag === "past_due" ? "bg-amber-100 text-amber-900" : "bg-rose-100 text-rose-900"}`}
            >
              {FLAG_LABEL[flag]}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function Metric({ value }: { value: string }) {
  return <td className="px-3 py-3 font-semibold text-[#0B1F3A]">{value}</td>;
}

export function PeriodMetricsPanel({
  metrics,
  sample,
  fromDay,
  toDay,
}: {
  metrics: PeriodMetrics;
  sample: boolean;
  fromDay: string;
  toDay: string;
}) {
  const flags = redFlags(metrics);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="period-metrics">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">This period</h2>
          <p className="text-sm text-slate-500">{fromDay} to {toDay}. Same totals as the agency rollup.</p>
        </div>
        {flags.length ? (
          <div className="flex flex-wrap gap-1">
            {flags.map((flag) => (
              <span key={flag} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${flag === "past_due" ? "bg-amber-100 text-amber-900" : "bg-rose-100 text-rose-900"}`}>
                {FLAG_LABEL[flag]}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {sample ? <p className="mt-3 text-sm text-amber-800">Sample figures until the phase 2g migration is applied.</p> : null}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="New leads" value={String(metrics.newLeads)} />
        <Stat label="Median first response" value={formatDuration(metrics.medianFirstResponseSeconds)} />
        <Stat label="Open pipeline" value={formatCurrency(metrics.openPipelineZar)} />
        <Stat label="Won" value={formatCurrency(metrics.wonZar)} />
        <Stat label="Messages" value={messageSummary(metrics.messagesByChannel)} />
        <Stat label="WA/SMS cost" value={formatCents(metrics.waSmsCostCents)} />
        <Stat label="WA/SMS billed" value={formatCents(metrics.waSmsBilledCents)} />
        <Stat label="Opt-out rate" value={metrics.consentDecisions ? `${Math.round(metrics.optOutRate * 1000) / 10}%` : "—"} />
        <Stat label="Blocked consent" value={String(metrics.blockedConsentCount)} />
        <Stat label="Failed workflow runs" value={String(metrics.failedWorkflowRuns)} />
        <Stat label="Outbox held" value={String(metrics.outboxHeld)} />
        <Stat label="Subscription" value={metrics.subscriptionStatus || "None"} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#0B1F3A]">{value}</dd>
    </div>
  );
}
