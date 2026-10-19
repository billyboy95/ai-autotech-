import Link from "next/link";
import {
  cancelStaleMarketingOutbox,
  importOutreachCsv,
  queueOutreachOpeners,
  saveOutreachNote,
  setOutreachDoNotContact,
  setOutreachStage,
} from "@/app/actions/outreach";
import { ALL_OUTREACH_STAGES, STAGE_LABELS, type OutreachStage } from "@/lib/outreach/funnel";
import type { OutreachDesk as Desk, StaleMarketingPreview } from "@/lib/outreach/load";

const NOTICES: Record<string, string> = {
  saved: "Saved.",
  imported: "Import done. Existing prospects were left as they were.",
  "dnc-on": "Marked do-not-contact. They can never be moved to Sent again.",
  "dnc-off": "Do-not-contact removed.",
  "dnc-blocked": "Blocked: this prospect is do-not-contact and cannot be sent to.",
  invalid: "That request was not valid.",
  "not-found": "Prospect not found.",
  "save-failed": "Could not save. Try again.",
  "import-failed": "Import failed. Check the CSV columns.",
  "bad-campaign": "Campaign name: lowercase letters, numbers and dashes only.",
  "bad-file": "Choose a CSV file under 1 MB.",
  "empty-file": "No rows found. The CSV needs a Business column.",
  "owner-only": "Only the agency owner can queue an opener or cancel queued marketing rows.",
  "none-selected": "Tick at least one prospect. Nothing was sent.",
  "too-many": "Queue at most 25 prospects at a time. Nothing was sent.",
  "opener-unavailable": "Queue opener is not in the database yet. Apply supabase/migrations/20261114120000_outreach_queue_opener.sql.",
  "opener-drafted": "Opener saved as a draft. Nothing was sent.",
  "opener-partial": "Some openers were drafted. Others were blocked. Nothing was sent.",
  "opener-none": "Nothing new was drafted. Do-not-contact, a missing email, or an existing draft blocked them. Nothing was sent.",
  "confirm-required": "Tick the confirm box before cancelling queued marketing rows. Nothing was changed.",
  "stale-cancelled": "Queued marketing rows were cancelled. Nothing was sent.",
  "stale-none": "No queued marketing rows to cancel. Nothing was sent.",
  refused: "Stopped. That result would have queued or sent a message.",
};

const BAR = ["bg-slate-300", "bg-[#2563EB]", "bg-[#3B82F6]", "bg-[#0EA5E9]", "bg-[#14B8A6]", "bg-[#10B981]", "bg-[#16A34A]"];

function pct(value: number | null) {
  return value === null ? "–" : `${value}%`;
}

export function OutreachDesk({
  data,
  stageFilter,
  notice,
  owner,
  stale,
}: {
  data: Desk;
  stageFilter: OutreachStage | "dnc" | null;
  notice: string | null;
  owner: boolean;
  stale: StaleMarketingPreview | null;
}) {
  const fixture = data.mode === "fixture";
  const canQueue = !fixture && owner;
  const sent = data.summary.steps.find((s) => s.stage === "sent")?.reached ?? 0;
  const max = Math.max(1, data.summary.total);
  const rows = data.prospects.filter((p) =>
    stageFilter === null ? true : stageFilter === "dnc" ? p.doNotContact : p.stage === stageFilter,
  );
  const q = (stage: string | null) => {
    const qs = new URLSearchParams();
    if (data.campaign && !fixture) qs.set("campaign", data.campaign);
    if (stage) qs.set("stage", stage);
    const s = qs.toString();
    return `/command-centre/outreach${s ? `?${s}` : ""}`;
  };

  return (
    <div className="grid gap-4" data-testid="outreach-desk">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Outreach</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">Outreach funnel</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Personal outreach to the 2-call close: sent, replied, booked call 1, showed, call 2, closed. {data.notice}
        </p>
        {notice && NOTICES[notice] ? (
          <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-[#0B1F3A]" role="status">
            {NOTICES[notice]}
          </p>
        ) : null}
        {data.campaigns.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.campaigns.map((name) => (
              <Link
                key={name}
                href={`/command-centre/outreach?campaign=${encodeURIComponent(name)}`}
                className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold ${
                  name === data.campaign ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-slate-200 text-[#0B1F3A]"
                }`}
              >
                {name}
              </Link>
            ))}
          </div>
        ) : data.campaign ? (
          <p className="mt-3 text-xs font-semibold text-slate-500">Campaign: {data.campaign}</p>
        ) : null}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="funnel-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="funnel-title" className="font-display text-lg font-bold text-[#0B1F3A]">
            Funnel and conversion
          </h2>
          <p className="text-xs text-slate-500">
            {data.summary.total} prospects · {data.summary.doNotContact} do-not-contact · {data.summary.lost} lost
            {data.summary.queued > 0 ? ` · ${data.summary.queued} opener queued, not sent` : ""}
            {data.summary.sentPerClose !== null ? ` · ${data.summary.sentPerClose} sent per close` : ""}
          </p>
        </div>
        <ol className="mt-4 grid gap-2" data-testid="outreach-funnel">
          {data.summary.steps.map((step, index) => (
            <li key={step.stage} className="grid grid-cols-[120px_1fr_150px] items-center gap-3 text-sm">
              <Link href={q(step.stage)} className="font-semibold text-[#0B1F3A] hover:text-[#2563EB]">
                {step.label}
              </Link>
              <div className="h-7 rounded-md bg-slate-100">
                <div
                  className={`flex h-7 items-center rounded-md px-2 text-xs font-bold text-white ${BAR[index]}`}
                  style={{ width: `${Math.max(step.reached ? 8 : 0, (step.reached / max) * 100)}%` }}
                >
                  {step.reached > 0 ? step.reached : ""}
                </div>
              </div>
              <span className="text-xs text-slate-600">
                {index === 0 ? `${step.current} waiting` : `${pct(step.fromPrevious)} of prev`}
                {index > 1 ? ` · ${pct(step.fromSent)} of sent` : ""}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Counts are cumulative: a prospect who reached Call 2 also counts in Sent, Replied, Booked and Showed. Lost prospects keep
          the steps they passed. {sent === 0 ? "Nothing sent yet." : ""}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="list-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="list-title" className="font-display text-lg font-bold text-[#0B1F3A]">
            Prospects {stageFilter ? `· ${stageFilter === "dnc" ? "Do-not-contact" : STAGE_LABELS[stageFilter]}` : ""}
          </h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href={q(null)} className="rounded-full border border-slate-200 px-3 py-1 font-semibold">
              All
            </Link>
            <Link href={q("dnc")} className="rounded-full border border-rose-200 px-3 py-1 font-semibold text-rose-700">
              Do-not-contact
            </Link>
            <Link href={q("outreach_queued")} className="rounded-full border border-slate-200 px-3 py-1 font-semibold">
              Opener queued
            </Link>
            <Link href={q("lost")} className="rounded-full border border-slate-200 px-3 py-1 font-semibold">
              Lost
            </Link>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm" data-testid="outreach-table">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {canQueue ? <th className="py-2 pr-3">Queue</th> : null}
                <th className="py-2 pr-3">Business</th>
                <th className="py-2 pr-3">Contact</th>
                <th className="py-2 pr-3">Stage</th>
                <th className="py-2 pr-3">Do-not-contact</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={canQueue ? 6 : 5} className="py-4 text-slate-500">
                    No prospects here.
                  </td>
                </tr>
              ) : null}
              {rows.map((p) => (
                <tr key={p.id} className={`border-t border-slate-100 align-top ${p.doNotContact ? "bg-rose-50/60" : ""}`}>
                  {canQueue ? (
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        name="ids"
                        value={p.id}
                        form="queue-opener-form"
                        aria-label={`Queue opener for ${p.business}`}
                        disabled={p.doNotContact || (p.stage !== "not_contacted" && p.stage !== "outreach_queued")}
                      />
                    </td>
                  ) : null}
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-[#0B1F3A]">
                      <span className="mr-1 rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">{p.priority}</span>
                      {p.business}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.area}
                      {p.fspNumber ? ` · FSP ${p.fspNumber}` : ""}
                    </p>
                    {p.website ? (
                      <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2563EB]">
                        {p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    ) : null}
                    {p.hook ? <p className="mt-1 max-w-sm text-xs italic text-slate-500">{p.hook}</p> : null}
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-600">
                    {p.contactName ? <p className="font-semibold text-slate-700">{p.contactName}</p> : null}
                    {p.email ? <p>{p.email}</p> : null}
                    {p.phone ? <p>{p.phone}</p> : null}
                    <p className="text-slate-400">via {p.channel}</p>
                  </td>
                  <td className="py-3 pr-3">
                    {fixture ? (
                      <span className="text-xs font-semibold">{STAGE_LABELS[p.stage]}</span>
                    ) : (
                      <form action={setOutreachStage} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="campaign" value={data.campaign} />
                        <select
                          name="stage"
                          defaultValue={p.stage}
                          aria-label={`Stage for ${p.business}`}
                          className="h-9 rounded-md border border-slate-200 px-2 text-xs"
                        >
                          {ALL_OUTREACH_STAGES.map((s) => (
                            <option
                              key={s}
                              value={s}
                              disabled={p.doNotContact && (s === "sent" || s === "outreach_queued") && p.stage === "not_contacted"}
                            >
                              {STAGE_LABELS[s]}
                            </option>
                          ))}
                        </select>
                        <button className="h-9 rounded-md bg-[#0B1F3A] px-2 text-xs font-semibold text-white">Save</button>
                      </form>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {p.doNotContact ? <p className="text-xs font-bold text-rose-700">Do not contact</p> : null}
                    {p.dncReason ? <p className="text-xs text-rose-700">{p.dncReason}</p> : null}
                    {fixture ? null : (
                      <form action={setOutreachDoNotContact} className="mt-1 flex flex-col gap-1">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="campaign" value={data.campaign} />
                        <input type="hidden" name="on" value={p.doNotContact ? "false" : "true"} />
                        {p.doNotContact ? null : (
                          <input
                            name="reason"
                            placeholder="Reason (e.g. replied no thanks)"
                            className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                          />
                        )}
                        <button
                          className={`h-8 rounded-md px-2 text-xs font-semibold ${
                            p.doNotContact ? "border border-slate-200 text-slate-600" : "bg-rose-600 text-white"
                          }`}
                        >
                          {p.doNotContact ? "Remove flag" : "Mark do-not-contact"}
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="py-3">
                    {fixture ? (
                      <p className="text-xs text-slate-500">{p.notes}</p>
                    ) : (
                      <form action={saveOutreachNote} className="flex flex-col gap-1">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="campaign" value={data.campaign} />
                        <textarea
                          name="notes"
                          defaultValue={p.notes}
                          rows={2}
                          className="w-56 rounded-md border border-slate-200 px-2 py-1 text-xs"
                          aria-label={`Notes for ${p.business}`}
                        />
                        <button className="h-8 w-fit rounded-md border border-slate-200 px-2 text-xs font-semibold">Save note</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="queue-title" data-testid="queue-opener">
        <h2 id="queue-title" className="font-display text-lg font-bold text-[#0B1F3A]">
          Queue opener
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Saves a personal email draft for ticked prospects. The outbox status is <strong>draft</strong>. Drafts are not
          delivered, including after a send switch is turned on. This does not email, WhatsApp, or text anyone.
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Free reply audit. This is not insurance advice and does not recommend a policy, a product, or cover. Reply YES for
          times. Reply STOP to opt out. A missing marketing opt-in stays a consent draft.
        </p>
        {fixture ? (
          <button type="button" disabled className="mt-3 h-10 rounded-md bg-slate-200 px-3 text-sm font-semibold text-slate-500">
            Queue opener
          </button>
        ) : canQueue ? (
          <form id="queue-opener-form" action={queueOutreachOpeners} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="campaign" value={data.campaign} />
            <button className="h-10 rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold text-white" data-testid="queue-opener-submit">
              Queue opener
            </button>
            <span className="text-xs text-slate-500">Tick prospects in the table first. At most 25.</span>
          </form>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Only the agency owner can queue an opener. Nothing is sent from this page.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="stale-title" data-testid="cancel-stale-outbox">
        <h2 id="stale-title" className="font-display text-lg font-bold text-[#0B1F3A]">
          Hold queued marketing outbox
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Lists marketing rows already sitting at status <strong>queued</strong>. Those can flush if sending is turned on.
          Cancelling moves them to <strong>cancelled</strong>. Draft openers are left alone. Nothing is sent.
        </p>
        {fixture ? (
          <p className="mt-3 text-sm text-slate-500">Sample desk. This list does not run and does not send.</p>
        ) : !owner ? (
          <p className="mt-3 text-sm text-slate-600">Only the agency owner can cancel queued marketing rows.</p>
        ) : stale && !stale.ready ? (
          <p className="mt-3 text-sm text-slate-600">{stale.notice}</p>
        ) : (
          <>
            <p className="mt-3 text-sm font-semibold text-[#0B1F3A]" data-testid="stale-count">
              {stale?.count ?? 0} queued marketing {stale?.count === 1 ? "row" : "rows"}
            </p>
            {stale && stale.rows.length > 0 ? (
              <ul className="mt-2 grid gap-2 text-xs text-slate-600">
                {stale.rows.map((row) => (
                  <li key={row.id} className="rounded-md border border-slate-100 px-3 py-2">
                    <span className="font-semibold text-[#0B1F3A]">{row.toAddress || "No address"}</span>
                    {row.subject ? ` · ${row.subject}` : ""}
                    <span className="mt-1 block text-slate-400">
                      {row.purpose || row.category} · {row.createdAt ? row.createdAt.slice(0, 16).replace("T", " ") : "queued"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No queued marketing rows.</p>
            )}
            <form action={cancelStaleMarketingOutbox} className="mt-3 grid gap-2">
              <input type="hidden" name="campaign" value={data.campaign} />
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" name="confirm" value="yes" className="mt-1" />
                I understand this cancels the listed queued marketing rows and does not send anything.
              </label>
              <button
                className="h-10 w-fit rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-800"
                data-testid="cancel-stale-submit"
                disabled={!stale || stale.count === 0}
              >
                Cancel these queued marketing rows
              </button>
            </form>
          </>
        )}
        {fixture ? (
          <button type="button" disabled className="mt-3 h-10 rounded-md bg-slate-200 px-3 text-sm font-semibold text-slate-500">
            Cancel these queued marketing rows
          </button>
        ) : null}
      </section>

      {fixture ? null : (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="import-title">
          <h2 id="import-title" className="font-display text-lg font-bold text-[#0B1F3A]">
            Import a prospect list (CSV)
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Columns like brokers.csv: Business, Area, Website, Public business email, Phone, Source URL, Personalisation hook,
            Priority. New rows start at Not contacted. Existing rows are never overwritten.
          </p>
          <form action={importOutreachCsv} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              name="campaign"
              defaultValue={data.campaign || "brokers-gauteng"}
              aria-label="Campaign name"
              className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            />
            <input name="file" type="file" accept=".csv,text/csv" aria-label="CSV file" className="text-sm" />
            <button className="h-10 rounded-md bg-[#2563EB] px-3 text-sm font-semibold text-white">Import</button>
          </form>
        </section>
      )}
    </div>
  );
}
