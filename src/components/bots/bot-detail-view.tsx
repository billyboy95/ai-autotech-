import Link from "next/link";
import { runInstalledBot, updateInstalledBot } from "@/app/actions/bots";
import { formatWhen, formatZar } from "@/lib/automation/ids";
import type { BotDetailData } from "@/lib/bots/preview";

export function BotDetailView({ data }: { data: BotDetailData }) {
  const back = `/command-centre/bots/${data.slug}`;
  return (
    <div data-testid="bot-detail" className="grid gap-4">
      <div>
        <Link href="/command-centre/bots" className="text-sm font-semibold text-[#2563EB]">Bot Store</Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">{data.name}</h1>
        <p className="text-sm text-slate-500">{data.description}</p>
      </div>
      {data.notice ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{data.notice}</p> : null}
      {!data.found ? null : (
        <>
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{data.status}</span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Placeholder price</span>
              <span className="text-sm text-slate-500">{formatZar(data.monthlyPriceCents / 100)} / month · {data.engine}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusForm slug={data.orgSlug} bot={data.slug} status="active" label="Activate" back={back} />
              <StatusForm slug={data.orgSlug} bot={data.slug} status="paused" label="Pause" back={back} />
              <form action={runInstalledBot}>
                <input type="hidden" name="slug" value={data.orgSlug} />
                <input type="hidden" name="bot" value={data.slug} />
                <input type="hidden" name="return_to" value={back} />
                <button className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700">Run draft</button>
              </form>
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Settings</h2>
            <form action={updateInstalledBot} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="slug" value={data.orgSlug} />
              <input type="hidden" name="bot" value={data.slug} />
              <input type="hidden" name="return_to" value={back} />
              <label className="grid gap-1 text-sm text-slate-600">
                Tone
                <input name="tone" defaultValue={data.config.tone} className="h-10 rounded-md border border-slate-200 px-3 text-slate-800" />
              </label>
              <label className="grid gap-1 text-sm text-slate-600">
                Channel
                <input name="channel" defaultValue={data.config.channel} className="h-10 rounded-md border border-slate-200 px-3 text-slate-800" />
              </label>
              <label className="grid gap-1 text-sm text-slate-600">
                Working hours start
                <input name="hours_start" defaultValue={data.config.workingHours.start} className="h-10 rounded-md border border-slate-200 px-3 text-slate-800" />
              </label>
              <label className="grid gap-1 text-sm text-slate-600">
                Working hours end
                <input name="hours_end" defaultValue={data.config.workingHours.end} className="h-10 rounded-md border border-slate-200 px-3 text-slate-800" />
              </label>
              <label className="grid gap-1 text-sm text-slate-600">
                Pipeline
                <input name="pipeline" defaultValue={data.config.pipeline} className="h-10 rounded-md border border-slate-200 px-3 text-slate-800" />
              </label>
              <label className="grid gap-1 text-sm text-slate-600">
                Stage
                <input name="stage" defaultValue={data.config.stage} className="h-10 rounded-md border border-slate-200 px-3 text-slate-800" />
              </label>
              <div className="sm:col-span-2">
                <button className="h-10 rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">Save settings</button>
              </div>
            </form>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Activity</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              {data.runs.length === 0 ? <li className="text-slate-500">No runs yet. A run saves a draft or a task. Nothing is sent.</li> : null}
              {data.runs.map((run) => (
                <li key={run.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <span className="font-semibold text-[#0B1F3A]">{run.status}</span>
                  <span className="text-slate-500"> · {run.kind} · {formatWhen(run.createdAt)}</span>
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
      <button className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700">{label}</button>
    </form>
  );
}
