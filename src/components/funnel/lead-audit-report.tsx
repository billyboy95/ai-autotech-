import { approveAuditReport, saveAuditReport } from "@/app/actions/funnel";
import { ResultsCallLink } from "@/components/funnel/results-call-link";
import type { LeadReportState } from "@/lib/funnel/load";

export function LeadAuditReport({ report, leadId }: { report: LeadReportState; leadId: string }) {
  if (report.mode === "fixture" || !report.present) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Audit report</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{report.notice}</p>
        <div className="mt-3">
          <ResultsCallLink href={report.resultsCallUrl} />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">{report.status}</p>
      <h2 className="mt-1 font-display text-lg font-bold text-[#0B1F3A]">{report.title || "Audit report"}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{report.notice}</p>
      <form action={saveAuditReport} className="mt-4 grid gap-3">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="auditLeadId" value={report.auditLeadId || ""} />
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Narrative
          <textarea name="narrative" rows={5} defaultValue={report.narrative} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
        </label>
        {report.sections.map((section) => (
          <label key={section.id} className="grid gap-1 text-xs font-semibold text-slate-600">
            {section.heading}
            <textarea name={`section:${section.id}`} rows={4} defaultValue={section.body} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
          </label>
        ))}
        <button className="h-11 rounded-md border border-slate-200 text-sm font-semibold text-[#0B1F3A]">Save draft</button>
      </form>
      <form action={approveAuditReport} className="mt-3">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="auditLeadId" value={report.auditLeadId || ""} />
        <button className="h-11 rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">Approve for the team page</button>
      </form>
      <div className="mt-4">
        <ResultsCallLink href={report.resultsCallUrl} />
      </div>
    </section>
  );
}
