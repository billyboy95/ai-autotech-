import Link from "next/link";
import { applyBotTemplate } from "@/app/actions/bots";
import { Advanced } from "@/components/ui/advanced";
import { PageLead } from "@/components/ui/page-lead";
import { DEPARTMENT_LABELS, INDUSTRY_LABELS, INDUSTRIES, AGENT_DEPARTMENTS } from "@/lib/bots/catalog";
import type { BotStoreData } from "@/lib/bots/preview";

export function TemplateLibrary({
  data,
  industry,
  department,
}: {
  data: BotStoreData;
  industry: string;
  department: string;
}) {
  const templates = data.templates.filter((template) => {
    if (industry && template.industry !== industry) return false;
    if (department && template.department !== department) return false;
    return true;
  });
  return (
    <div className="grid gap-4">
      <PageLead
        title="Templates"
        body="Apply a ready-made team if you already know the industry. Re-apply does not duplicate it. Sending stays off."
        action="Set up a team"
        href="/command-centre/setup"
      />
      <Advanced defaultOpen={Boolean(industry || department)}>
      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="grid gap-1 text-sm text-slate-600">
          Industry
          <select name="industry" defaultValue={industry} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-800">
            <option value="">All industries</option>
            {INDUSTRIES.map((key) => (
              <option key={key} value={key}>{INDUSTRY_LABELS[key]}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-slate-600">
          Department
          <select name="department" defaultValue={department} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-800">
            <option value="">All departments</option>
            {AGENT_DEPARTMENTS.map((key) => (
              <option key={key} value={key}>{DEPARTMENT_LABELS[key]}</option>
            ))}
          </select>
        </label>
        <button className="inline-flex h-11 items-center rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">Filter</button>
      </form>
      </Advanced>
      {data.notice ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{data.notice}</p> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <article key={template.slug} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">{template.name}</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              {template.industry ? INDUSTRY_LABELS[template.industry as keyof typeof INDUSTRY_LABELS] || template.industry : "Department team"}
              {template.department ? ` · ${DEPARTMENT_LABELS[template.department as keyof typeof DEPARTMENT_LABELS] || template.department}` : ""}
            </p>
            <p className="mt-2 text-sm text-slate-600">{template.description}</p>
            <form action={applyBotTemplate} className="mt-3">
              <input type="hidden" name="slug" value={data.orgSlug} />
              <input type="hidden" name="template" value={template.slug} />
              <input type="hidden" name="return_to" value="/command-centre/agents/templates" />
              <button className="inline-flex h-11 items-center rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold text-white">Apply template</button>
            </form>
          </article>
        ))}
      </div>
      {templates.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
          No template uses that filter. Clear it, or <Link href="/command-centre/setup" className="font-semibold text-[#2563EB]">set up a team</Link>.
        </p>
      ) : null}
    </div>
  );
}
