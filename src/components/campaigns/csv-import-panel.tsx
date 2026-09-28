"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitCampaignCsvImport } from "@/app/actions/campaign-csv-import";
import { EMPTY_CSV_IMPORT_ACTION, FIXTURE_CAMPAIGN_CSV, blockedReasonCount, type CsvImportPlan } from "@/lib/campaigns/csv-import";
import { FIXTURE_CAMPAIGN_NAME } from "@/lib/campaigns/dry-run";
import type { CampaignDryRunMode } from "@/lib/campaigns/flag";

const buttonClass = "inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] sm:w-fit";

export function CsvImportPanel({
  mode,
  orgSlug,
  preview,
  sendingEnabled,
}: {
  mode: CampaignDryRunMode;
  orgSlug: string;
  preview: CsvImportPlan;
  sendingEnabled: boolean;
}) {
  const [state, act] = useActionState(submitCampaignCsvImport, { ...EMPTY_CSV_IMPORT_ACTION, rows: [] });
  const active = state.id ? state : preview;
  const report = active.report;
  const queued = 0;
  const popia = report ? blockedReasonCount(report, "POPIA") : 0;
  const stop = report ? blockedReasonCount(report, "STOP") : 0;

  return (
    <section data-testid="campaign-csv-import" data-queued={queued} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Sandbox CSV import</h2>
        <p className="mt-1 text-sm text-slate-700">
          Dry-load a consent-ready CSV into a draft campaign. consent_basis is required. Missing consent is skipped. Nothing is queued and nothing is sent.
        </p>
      </div>
      {mode === "fixture" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Fixture only. This dry-load is not stored until CAMPAIGN_CSV_IMPORT_ENABLED is true and step 27 is applied. Nothing is queued.
        </p>
      ) : (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Sandbox dry-load can be stored as a draft campaign. Sending stays off. Nothing is queued.
        </p>
      )}
      {sendingEnabled ? (
        <p className="text-sm text-slate-700">{`This dry-load does not send. Outbox queued: ${queued}.`}</p>
      ) : (
        <p className="text-sm text-slate-700">{`Sending stays off. Send now and go live are refused. Outbox queued: ${queued}.`}</p>
      )}
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imported</dt>
          <dd className="font-semibold text-[#0B1F3A]">{active.imported}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skipped (missing consent)</dt>
          <dd className="font-semibold text-[#0B1F3A]">{active.skippedMissingConsent}</dd>
        </div>
      </dl>
      <p className="text-sm text-slate-700">{`POPIA blocked ${popia}. STOP blocked ${stop}.`}</p>
      {report ? (
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
      ) : null}
      <form action={act} className="grid gap-3">
        <input type="hidden" name="slug" value={orgSlug} />
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Draft campaign name
          <input name="campaignName" defaultValue={FIXTURE_CAMPAIGN_NAME} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Consent-ready CSV
          <textarea
            name="csv"
            rows={6}
            defaultValue={FIXTURE_CAMPAIGN_CSV}
            className="rounded-md border border-slate-200 px-3 py-2 font-mono text-xs font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Or upload a CSV
          <input name="file" type="file" accept=".csv,text/csv" className="mt-1 block text-sm font-normal" />
        </label>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button name="intent" value="dry_load" className={`${buttonClass} bg-[#0B1F3A] text-white`}>Dry-load CSV</button>
          <button name="intent" value="send_now" className={`${buttonClass} border border-slate-200 text-[#0B1F3A]`}>Send now</button>
          <button name="intent" value="go_live" className={`${buttonClass} border border-slate-200 text-[#0B1F3A]`}>Go live</button>
        </div>
      </form>
      {state.message ? (
        <p data-testid="csv-import-result" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
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
