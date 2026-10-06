import { ResultsCallLink } from "@/components/funnel/results-call-link";
import type { ReportSection } from "@/lib/funnel/report";

export function PublicAuditReport({
  title,
  narrative,
  sections,
  resultsCallUrl,
}: {
  title: string;
  narrative: string;
  sections: ReportSection[];
  resultsCallUrl: string;
}) {
  return (
    <section className="grid gap-3 border-t border-slate-200 pt-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Audit report</p>
        <h2 className="mt-1 font-display text-xl font-bold text-[#0B1F3A]">{title}</h2>
      </div>
      <p className="text-sm leading-6 text-slate-700">{narrative}</p>
      {sections.map((section) => (
        <div key={section.id}>
          <h3 className="text-sm font-semibold text-[#0B1F3A]">{section.heading}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{section.body}</p>
        </div>
      ))}
      <ResultsCallLink href={resultsCallUrl} />
      <p className="text-xs text-slate-500">This page does not send a message.</p>
    </section>
  );
}
