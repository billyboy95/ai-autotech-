import Link from "next/link";
import { addFixtureComputerMinute } from "@/app/actions/computers";
import { formatComputerUsage } from "@/lib/computers/meter";
import { computerPagePath } from "@/lib/computers/paths";
import type { ComputerViewData } from "@/lib/computers/load";

const buttonClass = "inline-flex h-11 items-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

export function ComputerPanel({ data }: { data: ComputerViewData }) {
  const agentHref = `/command-centre/bots/${data.botSlug}`;
  return (
    <div data-testid="agent-computer" className="grid gap-4">
      <div>
        <Link href={agentHref} className="text-sm font-semibold text-[#2563EB]">{data.botName}</Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">Computer</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-700">
          Computers are sandbox until Billy enables a provider. This page does not rent a desktop and it does not spend.
        </p>
      </div>
      {data.notice ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{data.notice}</p> : null}
      {!data.found ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
          That agent is not in the catalogue. <Link href="/command-centre/bots" className="font-semibold text-[#2563EB]">Open the agent store</Link>.
        </p>
      ) : !data.canOpen ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
          You can open this computer when you are an agency owner, a client admin, or assigned to this agent.
        </p>
      ) : (
        <>
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{data.status}</span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950">Sandbox</span>
              <span className="text-sm text-slate-700">{data.provider === "e2b" ? "E2B stub" : "Fixture"} · placeholder price</span>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              Computer hours {formatComputerUsage(data.usedSeconds)} of {data.allowanceHours}h.
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div
                className="h-full bg-[#2563EB]"
                style={{ width: `${data.allowanceHours <= 0 ? (data.usedSeconds > 0 ? 100 : 0) : Math.min(100, (data.usedSeconds / (data.allowanceHours * 3600)) * 100)}%` }}
              />
            </div>
            {data.overAllowance ? (
              <p className="mt-3 text-sm text-slate-700">Paused. The hour allowance is used up. This is a soft pause. Nothing was charged.</p>
            ) : (
              <p className="mt-3 text-sm text-slate-700">Under the allowance. The meter is display and fixture time only.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={computerPagePath(data.botSlug, { org: data.orgSlug, viewOnly: true, tick: data.tick })} className={`${buttonClass} ${data.viewOnly ? "bg-[#0B1F3A] text-white" : "border border-slate-300 text-slate-700"}`}>View only</Link>
              <Link href={computerPagePath(data.botSlug, { org: data.orgSlug, viewOnly: false, tick: data.tick })} className={`${buttonClass} ${data.viewOnly ? "border border-slate-300 text-slate-700" : "bg-[#0B1F3A] text-white"}`}>Take over</Link>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {data.viewOnly
                ? "View only. You can watch the placeholder. Take over stays inside this sandbox."
                : "Take over is a sandbox control. No desktop is connected, so there is nothing to drive."}
            </p>
            <form action={addFixtureComputerMinute} className="mt-3">
              <input type="hidden" name="slug" value={data.orgSlug} />
              <input type="hidden" name="bot" value={data.botSlug} />
              <input type="hidden" name="view_only" value={data.viewOnly ? "1" : "0"} />
              <input type="hidden" name="tick" value={String(data.tick)} />
              <button className={`${buttonClass} bg-[#2563EB] text-white`}>Add a fixture minute</button>
            </form>
          </section>
          <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <iframe title="Agent computer" src={data.liveViewUrl} className="h-80 w-full bg-slate-50" />
          </section>
        </>
      )}
    </div>
  );
}
