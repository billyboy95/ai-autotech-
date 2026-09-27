"use client";

import { useActionState } from "react";
import { applyBotAssistant, emptyAssistant, proposeBotAssistant } from "@/app/actions/bots";
import { assistantUnavailableMessage } from "@/lib/bots/assistant";

export function AssistantPanel({ enabled }: { enabled: boolean }) {
  const [plan, propose] = useActionState(proposeBotAssistant, emptyAssistant);
  const [applied, apply] = useActionState(applyBotAssistant, emptyAssistant);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Assistant</h2>
      {enabled ? (
        <p className="mt-1 text-sm text-slate-500">Ask for a task, a draft, a stage move, or a bot. You confirm before anything is applied. Nothing is sent.</p>
      ) : (
        <p className="mt-1 text-sm text-slate-500">{assistantUnavailableMessage()}</p>
      )}
      {enabled ? (
        <form action={propose} className="mt-3 grid gap-2">
          <label className="grid gap-1 text-sm text-slate-600">
            Request
            <input name="request" className="h-10 rounded-md border border-slate-200 px-3 text-slate-800" placeholder="Draft a follow-up and activate the inbound bot" />
          </label>
          <button className="h-10 w-fit rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">Propose</button>
        </form>
      ) : null}
      {plan.message ? <p className="mt-3 text-sm text-slate-600">{plan.message}</p> : null}
      {plan.proposals.length ? (
        <form action={apply} className="mt-3 grid gap-2">
          <input type="hidden" name="payload" value={JSON.stringify({ actions: plan.proposals })} />
          {plan.proposals.map((proposal) => (
            <label key={proposal.id} className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
              <input type="checkbox" name="id" value={proposal.id} defaultChecked className="mt-1" />
              <span>
                <span className="font-semibold text-[#0B1F3A]">{proposal.label}</span>
                <span className="text-slate-500"> · {proposal.kind}</span>
                {proposal.detail ? <span className="block text-slate-600">{proposal.detail}</span> : null}
              </span>
            </label>
          ))}
          <button className="h-10 w-fit rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700">Confirm selected</button>
        </form>
      ) : null}
      {applied.message ? <p className="mt-3 text-sm font-semibold text-slate-700">{applied.message}</p> : null}
    </section>
  );
}
