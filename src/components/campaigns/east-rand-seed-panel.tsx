"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitEastRandSandboxSeed } from "@/app/actions/east-rand-seed";
import { EAST_RAND_SANDBOX_CAMPAIGN_NAME, EAST_RAND_SANDBOX_LABEL } from "@/lib/campaigns/east-rand-seed";
import { blockedReasonCount, type CsvImportPlan } from "@/lib/campaigns/csv-import";
import type { CampaignDryRunMode } from "@/lib/campaigns/flag";

const buttonClass = "inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] sm:w-fit";

const initial = {
  id: "",
  stored: false,
  error: "",
  campaignName: EAST_RAND_SANDBOX_CAMPAIGN_NAME,
  source: "fixture" as const,
  imported: 0,
  skippedMissingConsent: 0,
  queued: 0 as const,
  sent: 0 as const,
  charged: false as const,
  report: null,
  rows: [],
  refused: false,
  message: "",
};

export function EastRandSeedPanel({
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
  const [state, act] = useActionState(submitEastRandSandboxSeed, initial);
  const active = state.id ? state : preview;
  const report = active.report;
  const queued = 0;
  const popia = report ? blockedReasonCount(report, "POPIA") : 0;
  const stop = report ? blockedReasonCount(report, "STOP") : 0;

  return (
    <section id="east-rand-seed" data-testid="east-rand-seed" data-label={EAST_RAND_SANDBOX_LABEL} data-queued={queued} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">sandbox</p>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">East Rand sandbox seed</h2>
        <p className="mt-1 text-sm text-slate-700">
          One click dry-loads a fixed sandbox prospect set into {EAST_RAND_SANDBOX_CAMPAIGN_NAME}. Columns include consent_basis. These contacts are fake sandbox rows. Status stays draft.
        </p>
      </div>
      {mode === "fixture" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Fixture only. This seed is not stored until EAST_RAND_CAMPAIGN_SEED_ENABLED is true and step 30 is applied. Outbox queued: {queued}.
        </p>
      ) : (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Sandbox seed can be stored as a draft campaign. Sending stays off. Outbox queued: {queued}.
        </p>
      )}
      {sendingEnabled ? (
        <p className="text-sm text-slate-700">{`This sandbox seed does not send. Outbox queued: ${queued}.`}</p>
      ) : (
        <p className="text-sm text-slate-700">{`Sending stays off. Send now and Go live are refused. Outbox queued: ${queued}.`}</p>
      )}
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sandbox rows</dt>
          <dd className="font-semibold text-[#0B1F3A]">{preview.rows.length}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imported</dt>
          <dd className="font-semibold text-[#0B1F3A]">{active.imported}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skipped (missing consent)</dt>
          <dd className="font-semibold text-[#0B1F3A]">{active.skippedMissingConsent}</dd>
        </div>
      </dl>
      <p className="text-sm text-slate-700">{`POPIA blocked ${popia}. STOP blocked ${stop}. Label: ${EAST_RAND_SANDBOX_LABEL}.`}</p>
      {report ? (
        <ul className="grid max-h-64 gap-2 overflow-auto">
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
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <button name="intent" value="seed" className={`${buttonClass} bg-[#0B1F3A] text-white`}>Load sandbox seed</button>
          <button name="intent" value="send_now" className={`${buttonClass} border border-slate-200 text-[#0B1F3A]`}>Send now</button>
          <button name="intent" value="go_live" className={`${buttonClass} border border-slate-200 text-[#0B1F3A]`}>Go live</button>
        </div>
      </form>
      {state.message ? (
        <p data-testid="east-rand-seed-result" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
          {state.message}
        </p>
      ) : null}
      <p className="text-sm text-slate-700">
        <Link href="/command-centre/outbox" className="font-semibold text-[#2563EB]">Open the outbox</Link>
        {`. Queued stays ${queued}.`}
      </p>
    </section>
  );
}
