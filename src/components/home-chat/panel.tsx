"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { askHomeChat } from "@/app/actions/home-chat";
import { EMPTY_HOME_CHAT, type HomeChatState } from "@/lib/home-chat/engine";

const fieldClass = "h-11 w-full rounded-md border border-slate-300 px-3 text-base text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";
const buttonClass = "inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] sm:w-fit";

export function HomeChatPanel({ mode, orgSlug }: { mode: "fixture" | "sandbox"; orgSlug: string }) {
  const [turn, ask] = useActionState(askHomeChat, { ...EMPTY_HOME_CHAT, mode });
  const [history, setHistory] = useState<HomeChatState[]>([]);

  useEffect(() => {
    if (!turn.id) return;
    setHistory((current) => {
      if (current.some((item) => item.id === turn.id)) return current;
      return [...current, turn].slice(-12);
    });
  }, [turn]);

  return (
    <section id="home-chat" data-testid="home-chat" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="home-chat-heading">
      <h2 id="home-chat-heading" className="font-display text-lg font-bold text-[#0B1F3A]">Assistant</h2>
      <p className="mt-1 text-sm text-slate-700">
        Type what you want done. Look up a lead, summarise the pipeline, leave a follow-up draft, or open a task. Nothing is sent.
      </p>
      {mode === "fixture" ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Fixture only. Drafts are not stored until HOME_CHAT_ENABLED is true and step 25 is applied. Nothing is sent.
        </p>
      ) : (
        <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Sandbox drafts can be stored. Nothing is sent and nothing is charged.
        </p>
      )}
      <div className="mt-3 grid gap-3" aria-live="polite">
        {history.map((item) => (
          <article key={item.id} className="grid gap-2 rounded-md border border-slate-200 p-3">
            {item.request ? <p className="text-sm font-semibold text-[#0B1F3A]">{item.request}</p> : null}
            <p className="text-sm text-slate-700">{item.message}</p>
            {item.matches[0] ? (
              <p className="text-sm text-slate-700">
                {item.matches[0].name}
                {item.matches[0].company ? ` · ${item.matches[0].company}` : ""}
                {item.matches[0].stage ? ` · ${item.matches[0].stage}` : ""}
              </p>
            ) : null}
            {item.drafts[0] ? (
              <p className="whitespace-pre-wrap break-words rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {item.drafts[0].kind === "task" ? "Task draft" : "Follow-up draft"} · {item.drafts[0].status}
                <span className="mt-1 block">{item.drafts[0].body || item.drafts[0].title}</span>
              </p>
            ) : null}
            <Link href={item.nextStep.href} className={`${buttonClass} bg-[#2563EB] text-white`}>
              {item.nextStep.label}
            </Link>
          </article>
        ))}
      </div>
      <form key={turn.id || "new"} action={ask} className="mt-3 grid gap-2">
        <input type="hidden" name="slug" value={orgSlug} />
        <label className="grid gap-1 text-sm font-semibold text-slate-700" htmlFor="home-chat-request">
          What do you want to do?
          <input id="home-chat-request" name="request" className={fieldClass} placeholder="Summarise the pipeline" autoComplete="off" />
        </label>
        <button className={`${buttonClass} bg-[#0B1F3A] text-white`}>Ask</button>
      </form>
    </section>
  );
}
