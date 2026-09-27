import Link from "next/link";
import { runInstalledBot, updateInstalledBot } from "@/app/actions/bots";
import { Advanced } from "@/components/ui/advanced";
import { formatWhen, formatZar } from "@/lib/automation/ids";
import type { BotDetailData } from "@/lib/bots/preview";
import { formatComputerUsage } from "@/lib/computers/meter";

export function BotDetailView({ data }: { data: BotDetailData }) {
  const back = `/command-centre/bots/${data.slug}`;
  return (
    <div data-testid="bot-detail" className="grid gap-4">
      <div>
        <Link href="/command-centre/bots" className="text-sm font-semibold text-[#2563EB]">Agent store</Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">{data.name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-700">{data.departmentLabel ? `${data.departmentLabel}. ` : ""}{data.description} Run a draft next. Nothing is sent.</p>
      </div>
      {data.notice ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{data.notice}</p> : null}
      {!data.found ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
          That agent is not in the catalogue. <Link href="/command-centre/bots" className="font-semibold text-[#2563EB]">Open the agent store</Link>.
        </p>
      ) : (
        <>
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{data.status}</span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950">Placeholder price</span>
              <span className="text-sm text-slate-700">
                {data.tier === "included" ? "Included with platform" : `${formatZar(data.monthlyPriceCents / 100)} / month`}
                {data.tierLabel ? ` · ${data.tierLabel}` : ""}
                {data.includedHours != null ? ` · ${data.includedHours}h` : ""}
              </span>
            </div>
            <form action={runInstalledBot} className="mt-3">
              <input type="hidden" name="slug" value={data.orgSlug} />
              <input type="hidden" name="bot" value={data.slug} />
              <input type="hidden" name="return_to" value={back} />
              <button className="inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]">Run a draft</button>
            </form>
            {data.canViewComputer ? (
              <div className="mt-3">
                <Link href={`/command-centre/bots/${data.slug}/computer`} data-testid="view-computer" className="inline-flex h-11 items-center rounded-md border border-[#2563EB] px-4 text-sm font-semibold text-[#2563EB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]">View computer</Link>
                <p className="mt-2 text-sm text-slate-700">Computer hours {formatComputerUsage(data.computerUsedSeconds)} of {data.computerAllowanceHours}h. Sandbox only.</p>
              </div>
            ) : null}
          </section>

          {data.touches ? (
            <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Where this agent works</h2>
              <p className="mt-1 text-sm text-slate-700">Agents work across the CRM and the team. This one does not send.</p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-[#0B1F3A]">Reports to</dt>
                  <dd className="text-slate-600">{data.touches.reportsTo}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#0B1F3A]">Pipeline</dt>
                  <dd className="text-slate-600">{data.touches.pipelines.join(", ") || data.config.pipeline}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#0B1F3A]">Inbox</dt>
                  <dd className="text-slate-600">{data.touches.inbox ? "Drafts replies in the inbox" : "Does not sit in the inbox"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#0B1F3A]">Tasks</dt>
                  <dd className="text-slate-600">{data.touches.tasks ? "Opens tasks for a person" : "Does not open tasks"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#0B1F3A]">Calendar</dt>
                  <dd className="text-slate-600">{data.touches.calendar ? "Drafts a booking link" : "Does not book"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#0B1F3A]">Reviews</dt>
                  <dd className="text-slate-600">{data.touches.reviews ? "Drafts review requests or replies" : "Does not touch reviews"}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <Advanced>
          <div className="flex flex-wrap gap-2">
            <StatusForm slug={data.orgSlug} bot={data.slug} status="active" label="Activate" back={back} />
            <StatusForm slug={data.orgSlug} bot={data.slug} status="paused" label="Pause" back={back} />
          </div>
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Settings</h2>
            <form action={updateInstalledBot} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="slug" value={data.orgSlug} />
              <input type="hidden" name="bot" value={data.slug} />
              <input type="hidden" name="return_to" value={back} />
              <label className="grid gap-1 text-sm text-slate-600">
                Tone
                <input name="tone" defaultValue={data.config.tone} className="h-11 rounded-md border border-slate-300 px-3 text-slate-800" />
              </label>
              <label className="grid gap-1 text-sm text-slate-600">
                Channel
                <input name="channel" defaultValue={data.config.channel} className="h-11 rounded-md border border-slate-300 px-3 text-slate-800" />
              </label>
              <label className="grid gap-1 text-sm text-slate-600">
                Working hours start
                <input name="hours_start" defaultValue={data.config.workingHours.start} className="h-11 rounded-md border border-slate-300 px-3 text-slate-800" />
              </label>
              <label className="grid gap-1 text-sm text-slate-600">
                Working hours end
                <input name="hours_end" defaultValue={data.config.workingHours.end} className="h-11 rounded-md border border-slate-300 px-3 text-slate-800" />
              </label>
              <label className="grid gap-1 text-sm text-slate-600">
                Pipeline
                <input name="pipeline" defaultValue={data.config.pipeline} className="h-11 rounded-md border border-slate-300 px-3 text-slate-800" />
              </label>
              <label className="grid gap-1 text-sm text-slate-600">
                Stage
                <input name="stage" defaultValue={data.config.stage} className="h-11 rounded-md border border-slate-300 px-3 text-slate-800" />
              </label>
              <div className="sm:col-span-2">
                <button className="inline-flex h-11 items-center rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]">Save settings</button>
              </div>
            </form>
          </section>
          </Advanced>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Activity</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {data.runs.length === 0 ? <li className="text-slate-700">No drafts yet. Use Run a draft above. It saves a draft or a task and does not send.</li> : null}
              {data.runs.map((run) => (
                <li key={run.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <span className="font-semibold text-[#0B1F3A]">{run.status}</span>
                  <span className="text-slate-700"> · {run.kind} · {formatWhen(run.createdAt)}</span>
                  <p className="text-slate-600">{run.summary}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function StatusForm({ slug, bot, status, label, back }: { slug: string; bot: string; status: string; label: string; back: string }) {
  return (
    <form action={updateInstalledBot}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="bot" value={bot} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="return_to" value={back} />
      <button className="inline-flex h-11 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]">{label}</button>
    </form>
  );
}
