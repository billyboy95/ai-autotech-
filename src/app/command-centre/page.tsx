import type { Metadata } from "next";
import Link from "next/link";
import { runAutomationsNow } from "@/app/actions/automation";
import { CrmFrame } from "@/components/crm/frame";
import { formatZar } from "@/lib/automation/ids";
import { loadCommandData } from "@/lib/automation/page-data";
import { buildReport } from "@/lib/automation/report";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function CommandCentrePage() {
  const { workspace, classic, sendingEnabled } = await loadCommandData();
  const report = buildReport(workspace.state, new Date(), sendingEnabled);
  const openJobs = classic.jobs.filter((job) => job.status !== "Done");
  const unpaid = classic.invoices.filter((invoice) => invoice.status === "Unpaid");

  return (
    <CrmFrame setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div data-testid="dashboard" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Today</h1>
            <p className="text-sm text-slate-500">{report.date} · Africa/Johannesburg</p>
          </div>
          <form action={runAutomationsNow}>
            <button className="h-10 rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">Run automations</button>
          </form>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="New leads today" value={String(report.newToday)} detail="Captured since midnight in Johannesburg" />
          <Card label="Pipeline value" value={formatZar(report.pipelineValueZar)} detail="Open, won, and handover deals" />
          <Card label="Outbox waiting" value={String(report.outboxQueued)} detail="Queued messages, not delivered" href="/command-centre/outbox" />
          <Card label="Stuck or overdue" value={String(report.stuck.length)} detail="Needs a look" />
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Card label="Contacted" value={`${report.conversion.contacted}%`} detail="Share of leads past New" />
          <Card label="Audit booked" value={`${report.conversion.booked}%`} detail="Booked, proposed, or won" />
          <Card label="Won" value={`${report.conversion.won}%`} detail="Won or in handover" />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Leads per stage</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {report.perStage.map((row) => (
              <div key={row.stage} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.stage}</p>
                <p className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">{row.count}</p>
                <p className="text-xs text-slate-500">{row.valueZar ? formatZar(row.valueZar) : "No value yet"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Hot leads</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {report.hotLeads.length === 0 ? <li className="text-slate-500">No hot leads right now.</li> : null}
              {report.hotLeads.map((lead) => (
                <li key={lead.id}>
                  <Link href={`/command-centre/leads/${lead.id}`} className="font-semibold text-[#0B1F3A] hover:text-[#2563EB]">
                    {lead.name}
                  </Link>
                  <span className="text-slate-500">
                    {" "}
                    · {lead.company || "No company"} · {lead.score} · {lead.stage} · {lead.ownerName || "Unassigned"}
                  </span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Stuck or overdue</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {report.stuck.length === 0 ? <li className="text-slate-500">Nothing is stuck.</li> : null}
              {report.stuck.map((lead) => (
                <li key={lead.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <Link href={`/command-centre/leads/${lead.id}`} className="font-semibold text-[#0B1F3A] hover:text-[#2563EB]">
                    {lead.name}
                  </Link>
                  <span className="text-slate-500"> · {lead.stage}</span>
                  <p className="text-slate-600">{lead.reason}</p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Open jobs</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">{openJobs.length}</p>
            <ul className="mt-2 text-sm text-slate-600">
              {openJobs.slice(0, 3).map((job) => (
                <li key={job.id}>
                  {job.title} · {job.client}
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unpaid</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">{unpaid.length}</p>
            <ul className="mt-2 text-sm text-slate-600">
              {unpaid.slice(0, 3).map((invoice) => (
                <li key={invoice.id}>
                  {formatZar(Number(invoice.amount) || 0)} · {invoice.client}
                </li>
              ))}
            </ul>
          </article>
        </section>
      </div>
    </CrmFrame>
  );
}

function Card({ label, value, detail, href }: { label: string; value: string; detail: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-[#2563EB]">
        {body}
      </Link>
    );
  }
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{body}</article>;
}
