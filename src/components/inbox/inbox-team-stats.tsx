import React from "react"; // Classic JSX runtime for the node test. Next builds this file either way.
import { formatDurationMs } from "@/lib/inbox/team-stats";
import type { InboxTeamStats } from "@/lib/inbox/types";

const SLA_LIST_CAP = 8;

export function InboxTeamStatsPanel({ stats }: { stats: InboxTeamStats | null }) {
  if (!stats) return null;
  const shown = stats.slaBreaches.slice(0, SLA_LIST_CAP);
  const extra = stats.slaBreaches.length - shown.length;
  return (
    <section
      id="inbox-team-stats"
      data-testid="inbox-team-stats"
      aria-labelledby="inbox-team-stats-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="inbox-team-stats-heading" className="font-semibold text-[#0B1F3A]">Team stats</h2>
        <p className="text-xs text-slate-500">This view only. Sending stays off. Nothing is sent.</p>
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">First response</dt>
          <dd data-testid="inbox-first-response" className="text-lg font-semibold text-[#0B1F3A]">
            {stats.medianFirstResponseMs == null ? "No replies yet" : formatDurationMs(stats.medianFirstResponseMs)}
          </dd>
          <p className="text-xs text-slate-500">
            {stats.repliedCount === 0
              ? "No conversation in this view has a first reply."
              : `Median across ${stats.repliedCount} ${stats.repliedCount === 1 ? "conversation" : "conversations"} with a first reply.`}
          </p>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Awaiting first reply</dt>
          <dd data-testid="inbox-awaiting-reply" className="text-lg font-semibold text-[#0B1F3A]">{stats.awaitingFirstReply}</dd>
          <p className="text-xs text-slate-500">Open conversations that still have no queued, held, or sent reply.</p>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">SLA</dt>
          <dd data-testid="inbox-sla-count" className="text-lg font-semibold text-[#0B1F3A]">
            {stats.slaBreaches.length === 0 ? "None past SLA" : `${stats.slaBreaches.length} over ${stats.slaHours}h`}
          </dd>
          <p className="text-xs text-slate-500">Open conversations older than {stats.slaHours} hours.</p>
        </div>
      </dl>
      <div className="mt-3" data-testid="inbox-sla-flags">
        {shown.length === 0 ? (
          <p className="text-sm text-slate-600">No open conversation is older than {stats.slaHours} hours.</p>
        ) : (
          <ul className="grid gap-1 text-sm text-amber-950">
            {shown.map((item) => (
              <li key={item.conversationId}>{item.contactName} · open {formatDurationMs(item.ageMs)}</li>
            ))}
            {extra > 0 ? <li>and {extra} more</li> : null}
          </ul>
        )}
      </div>
      {stats.agents.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No agents in this view.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table data-testid="inbox-agent-stats" className="w-full text-left text-sm">
            <caption className="sr-only">Replies and assignments by agent</caption>
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-1 pr-3 font-semibold">Agent</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Assigned</th>
                <th scope="col" className="py-1 font-semibold">Replies</th>
              </tr>
            </thead>
            <tbody>
              {stats.agents.map((agent) => (
                <tr key={agent.key} className="border-t border-slate-100 text-slate-800">
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium">{agent.label}</th>
                  <td className="py-1.5 pr-3">{agent.assigned}</td>
                  <td className="py-1.5">{agent.replies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">{stats.openCount} open in this view.</p>
      {!stats.messagesLoaded ? (
        <p className="mt-2 text-sm text-amber-900">Message times could not be loaded. Assignment counts still use this list. Nothing was sent.</p>
      ) : null}
      {stats.truncated ? (
        <p className="mt-2 text-xs text-slate-500">Reply times use the earliest 2000 messages in this view.</p>
      ) : null}
    </section>
  );
}
