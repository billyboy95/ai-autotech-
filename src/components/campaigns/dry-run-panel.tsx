"use client";

import { useActionState } from "react";
import Link from "next/link";
import { runCampaignDryRun } from "@/app/actions/campaign-dry-run";
import { EMPTY_CAMPAIGN_ACTION, formatDryRunZar, type CampaignDryRunReport } from "@/lib/campaigns/dry-run";
import type { CampaignDryRunMode } from "@/lib/campaigns/flag";

const buttonClass = "inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] sm:w-fit";

export function DryRunPanel({
  mode,
  orgSlug,
  preview,
  sendingEnabled,
  notice,
}: {
  mode: CampaignDryRunMode;
  orgSlug: string;
  preview: CampaignDryRunReport;
  sendingEnabled: boolean;
  notice?: string | null;
}) {
  const [state, act] = useActionState(runCampaignDryRun, { ...EMPTY_CAMPAIGN_ACTION, id: "", stored: false });
  const report = state.report ?? preview;
  const queued = 0;

  return (
    <section data-testid="campaign-dry-run" data-queued={queued} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Campaign dry run</h2>
        <p className="mt-1 text-sm text-slate-700">
          {report.campaignName}. Preview who would receive a message. Nothing is sent and nothing is charged.
        </p>
      </div>
      {mode === "fixture" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Fixture only. Reports are not stored until CAMPAIGN_DRY_RUN_ENABLED is true and step 26 is applied. Nothing is queued.
        </p>
      ) : (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Sandbox reports can be stored. Sending stays off. Nothing is queued.
        </p>
      )}
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</p> : null}
      {sendingEnabled ? (
        <p className="text-sm text-slate-700">{`This dry run does not send. Outbox queued: ${queued}.`}</p>
      ) : (
        <p className="text-sm text-slate-700">{`Sending stays off. Send now and go live are refused. Outbox queued: ${queued}.`}</p>
      )}
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recipients</dt>
          <dd className="font-semibold text-[#0B1F3A]">{report.recipientCount}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Would receive</dt>
          <dd className="font-semibold text-[#0B1F3A]">{report.wouldReceive}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blocked</dt>
          <dd className="font-semibold text-[#0B1F3A]">{report.blocked}</dd>
        </div>
      </dl>
      <p className="text-sm text-slate-700">{`consent_basis: consent ${report.breakdown.consent} · existing_customer ${report.breakdown.existing_customer} · missing ${report.breakdown.missing} · opted_out ${report.breakdown.opted_out} · STOP ${report.breakdown.stop}`}</p>
      <p className="text-sm text-slate-700">{`Estimated cost ${formatDryRunZar(report.estimatedCostCents)}. Not charged.`}</p>
      {report.recipientCount === 0 ? (
        <p className="text-sm text-slate-700">
          No sandbox contacts yet. <Link href="/command-centre/import-contacts" className="font-semibold text-[#2563EB]">Import contacts</Link>, then dry-run. Nothing is sent.
        </p>
      ) : (
        <ul className="grid gap-2">
          {report.lines.map((line) => (
            <li key={`${line.name}-${line.channel}-${line.reason}`} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800">
              <span className="font-semibold text-[#0B1F3A]">{line.name}</span>
              {" "}
              {line.outcome === "would_receive" ? "would receive" : `blocked (${line.reason === "POPIA" ? "POPIA" : line.reason === "STOP" ? "STOP" : "consent"})`}
              <span className="text-slate-500"> · {line.channel}</span>
            </li>
          ))}
        </ul>
      )}
      <form action={act} className="grid gap-2 sm:flex sm:flex-wrap">
        <input type="hidden" name="slug" value={orgSlug} />
        <button name="intent" value="dry_run" className={`${buttonClass} bg-[#0B1F3A] text-white`}>Dry run</button>
        <button name="intent" value="send_now" className={`${buttonClass} border border-slate-200 text-[#0B1F3A]`}>Send now</button>
        <button name="intent" value="go_live" className={`${buttonClass} border border-slate-200 text-[#0B1F3A]`}>Go live</button>
      </form>
      {state.message ? (
        <p data-testid="dry-run-result" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
          {`${state.message} Outbox queued: ${queued}.`}
        </p>
      ) : null}
      <p className="text-sm text-slate-700">
        <Link href="/command-centre/outbox" className="font-semibold text-[#2563EB]">Open the outbox</Link>
        {`. Queued stays ${queued}.`}
      </p>
    </section>
  );
}
