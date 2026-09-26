import type { Metadata } from "next";
import Link from "next/link";
import { CommandShell } from "@/components/crm/command-shell";
import { formatZar } from "@/lib/automation/ids";
import { loadCommandData } from "@/lib/automation/page-data";
import { buildReport, summaryLines } from "@/lib/automation/report";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily summary | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function SummaryPage() {
  const { workspace, sendingEnabled } = await loadCommandData();
  const report = buildReport(workspace.state, new Date(), sendingEnabled);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div className="grid gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Daily summary</h1>
          <p className="text-sm text-slate-500">A bot can read the same numbers at /api/automation/summary.</p>
        </div>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {summaryLines(report).map((line) => (
            <p key={line} className="text-sm text-slate-700">
              {line}
            </p>
          ))}
          <p className="mt-4 text-sm text-slate-700">Pipeline value {formatZar(report.pipelineValueZar)}.</p>
          {report.attribution.length ? (
            <ul className="mt-3 grid gap-1 text-sm text-slate-700">
              {report.attribution.map((row) => (
                <li key={`${row.source}-${row.campaign}`}>
                  {row.source} / {row.campaign}: {row.leads}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">By stage</h2>
          <ul className="mt-3 grid gap-1 text-sm">
            {report.perStage.map((row) => (
              <li key={row.stage}>
                {row.stage}: {row.count}
                {row.valueZar ? ` · ${formatZar(row.valueZar)}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/command-centre/pipeline" className="font-semibold text-[#2563EB]">
              Open the pipeline
            </Link>
          </p>
        </article>
      </div>
    </CommandShell>
  );
}
