import type { Metadata } from "next";
import Link from "next/link";
import { resolveRequestBrand } from "@/lib/brand/request";
import { runAutomationsNow } from "@/app/actions/automation";
import { PeriodMetricsPanel } from "@/components/agency-rollup";
import { AssistantPanel } from "@/components/bots/assistant-panel";
import { HomeChatPanel } from "@/components/home-chat/panel";
import { OpsReadinessPanel } from "@/components/ops/readiness-panel";
import { CommandShell } from "@/components/crm/command-shell";
import { Advanced } from "@/components/ui/advanced";
import { PageLead } from "@/components/ui/page-lead";
import { isBotAssistantEnabled } from "@/lib/bots/flag";
import { homeChatDisplayMode } from "@/lib/home-chat/flag";
import { loadWorkspacePeriod } from "@/lib/agency/load";
import { eastcPeriodFixture, periodBounds, periodMetrics, zentrixPeriodFixture } from "@/lib/agency/metrics";
import { formatZar } from "@/lib/automation/ids";
import { loadCommandData } from "@/lib/automation/page-data";
import { buildReport } from "@/lib/automation/report";
import { loadOpsReadiness } from "@/lib/ops/readiness";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveRequestBrand();
  if (brand && !brand.showPlatformName) {
    return { title: { absolute: brand.productName }, robots: { index: false, follow: false } };
  }
  return { title: "Home", robots: { index: false, follow: false } };
}

export default async function CommandCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const bounds = periodBounds(params);
  const { workspace, classic, sendingEnabled, tenant } = await loadCommandData();
  const opsChecks = await loadOpsReadiness({
    mode: tenant.mode,
    workspaceSendingEnabled: tenant.active.sendingEnabled,
  });
  const report = buildReport(workspace.state, new Date(), sendingEnabled);
  const livePeriod = tenant.mode === "member" && tenant.role && !tenant.requiresLogin
    ? await loadWorkspacePeriod(tenant.active.id, bounds.from, bounds.to)
    : null;
  const samplePeriod =
    !livePeriod && tenant.mode === "preview" && tenant.active.slug === "eastc"
      ? periodMetrics(eastcPeriodFixture)
      : !livePeriod && tenant.mode === "preview" && tenant.active.slug === "zentrix"
        ? periodMetrics(zentrixPeriodFixture)
        : null;
  const period = livePeriod ?? samplePeriod;
  const openJobs = classic.jobs.filter((job) => job.status !== "Done");
  const unpaid = classic.invoices.filter((invoice) => invoice.status === "Unpaid");

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <div data-testid="dashboard" className="grid gap-4">
        <PageLead
          title="Home"
          body={`Today · ${report.date} · Africa/Johannesburg. Ask the assistant to look up a lead, summarise the pipeline, or leave a draft. Nothing is sent.`}
          action="Ask the assistant"
          href="#home-chat"
        />

        <HomeChatPanel mode={homeChatDisplayMode({ tenantMode: tenant.mode })} orgSlug={tenant.active.slug} />

        <AssistantPanel enabled={isBotAssistantEnabled()} />

        <OpsReadinessPanel checks={opsChecks} />

        <Advanced>
          <form action={runAutomationsNow}>
            <button className="inline-flex h-11 items-center rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">Run automations</button>
          </form>
        </Advanced>

        {period ? (
          <PeriodMetricsPanel
            metrics={period}
            sample={!livePeriod}
            fromDay={livePeriod ? bounds.fromDay : "2026-09-01"}
            toDay={livePeriod ? bounds.toDay : "2026-09-03"}
          />
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="New leads today" value={String(report.newToday)} detail="Captured since midnight in Johannesburg" />
          <Card label="Pipeline value" value={formatZar(report.pipelineValueZar)} detail="Open, won, and handover deals" />
          <Card label="Outbox waiting" value={String(report.outboxQueued)} detail="Queued messages, not delivered" href="/command-centre/outbox" />
          <Card label="Stuck or overdue" value={String(report.stuck.length)} detail="Needs a look" />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Attribution</h2>
          <ul className="mt-3 grid gap-1 text-sm">
            {report.attribution.length === 0 ? <li className="text-slate-700">No leads yet. Set up a team above, or add a contact in CRM.</li> : null}
            {report.attribution.map((row) => (
              <li key={`${row.source}-${row.campaign}`}>
                <span className="font-semibold text-[#0B1F3A]">{row.source}</span>
                <span className="text-slate-700"> / {row.campaign}</span>
                <span className="text-slate-700"> · {row.leads}</span>
              </li>
            ))}
          </ul>
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{row.stage}</p>
                <p className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">{row.count}</p>
                <p className="text-xs text-slate-700">{row.valueZar ? formatZar(row.valueZar) : "No value yet"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Hot leads</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {report.hotLeads.length === 0 ? <li className="text-slate-700">No hot leads right now. They show here after a lead scores high.</li> : null}
              {report.hotLeads.map((lead) => (
                <li key={lead.id}>
                  <Link href={`/command-centre/leads/${lead.id}`} className="font-semibold text-[#0B1F3A] hover:text-[#2563EB]">
                    {lead.name}
                  </Link>
                  <span className="text-slate-700">
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
              {report.stuck.length === 0 ? <li className="text-slate-700">Nothing is stuck. Overdue leads show here when they need a look.</li> : null}
              {report.stuck.map((lead) => (
                <li key={lead.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <Link href={`/command-centre/leads/${lead.id}`} className="font-semibold text-[#0B1F3A] hover:text-[#2563EB]">
                    {lead.name}
                  </Link>
                  <span className="text-slate-700"> · {lead.stage}</span>
                  <p className="text-slate-600">{lead.reason}</p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Open jobs</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Unpaid</p>
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
    </CommandShell>
  );
}

function Card({ label, value, detail, href }: { label: string; value: string; detail: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">{value}</p>
      <p className="mt-1 text-sm text-slate-700">{detail}</p>
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
