"use client";

import { useState, type FormEvent } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { applyBotAssistant, proposeBotAssistant } from "@/app/actions/bots";
import { TeamRecommendationView } from "@/components/bots/team-recommendation";
import { replyToLeadAgent, type LeadAgentReply } from "@/lib/bots/lead-agent";

const emptyAssistant = { message: "", proposals: [] as { id: string; kind: string; label: string; detail: string }[] };

const fieldClass = "h-11 rounded-md border border-slate-300 px-3 text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";
const buttonClass = "inline-flex h-11 items-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

export function AssistantPanel({ enabled }: { enabled: boolean }) {
  const [plan, propose] = useActionState(proposeBotAssistant, emptyAssistant);
  const [applied, apply] = useActionState(applyBotAssistant, emptyAssistant);
  const [reply, setReply] = useState<LeadAgentReply | null>(null);

  function onAsk(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const request = String(new FormData(form).get("request") ?? "");
    setReply(replyToLeadAgent(request));
    if (!enabled) {
      event.preventDefault();
      return;
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="lead-agent-heading">
      <h2 id="lead-agent-heading" className="font-display text-lg font-bold text-[#0B1F3A]">Lead Agent</h2>
      <p className="mt-1 text-sm text-slate-700">
        Ask for any page in the menus, or name a business and get the full team. Nothing is sent.{" "}
        <Link href="/command-centre/lead-agent" className="font-semibold text-[#2563EB]">Build the full team</Link>
        {enabled ? " Confirm before a task, draft, or agent change is saved." : " The writing model is off, so tasks and drafts wait until it is turned on."}
      </p>
      <form action={enabled ? propose : undefined} onSubmit={onAsk} className="mt-3 grid gap-2">
        <label className="grid gap-1 text-sm font-semibold text-slate-700" htmlFor="lead-agent-request">
          What do you want to do?
          <input id="lead-agent-request" name="request" className={fieldClass} placeholder="Open the inbox, or build a team for a clinic" />
        </label>
        <button className={`${buttonClass} w-fit bg-[#0B1F3A] text-white`}>Ask</button>
      </form>
      {reply ? (
        <div className="mt-3 grid gap-3" role="status">
          <p className="text-sm text-slate-700">{reply.message}</p>
          <div className="flex flex-wrap gap-2">
            {reply.links.map((link) => (
              <Link key={link.href} href={link.href} className={`${buttonClass} bg-[#2563EB] text-white`}>
                {link.label}
              </Link>
            ))}
          </div>
          {reply.recommendation ? <TeamRecommendationView recommendation={reply.recommendation} /> : null}
        </div>
      ) : null}
      {plan.message ? <p className="mt-3 text-sm text-slate-700">{plan.message}</p> : null}
      {plan.proposals.length ? (
        <form action={apply} className="mt-3 grid gap-2">
          <input type="hidden" name="payload" value={JSON.stringify({ actions: plan.proposals })} />
          {plan.proposals.map((proposal) => (
            <label key={proposal.id} className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
              <input type="checkbox" name="id" value={proposal.id} defaultChecked className="mt-1 h-4 w-4" />
              <span>
                <span className="font-semibold text-[#0B1F3A]">{proposal.label}</span>
                <span className="text-slate-600"> · {proposal.kind}</span>
                {proposal.detail ? <span className="block text-slate-700">{proposal.detail}</span> : null}
              </span>
            </label>
          ))}
          <button className={`${buttonClass} w-fit border border-slate-300 text-[#0B1F3A]`}>Confirm selected</button>
        </form>
      ) : null}
      {applied.message ? <p className="mt-3 text-sm font-semibold text-slate-800">{applied.message}</p> : null}
    </section>
  );
}
