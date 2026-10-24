"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { TRY_BANNER, TRY_GO_LIVE_HREF } from "@/lib/try-chat/prompt";

type Bubble = { id: string; role: "user" | "assistant"; content: string };

export function TryChat({ slug, token }: { slug: string; token: string }) {
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(token ? "" : "This test link is missing a token.");
  const scroller = useRef<HTMLDivElement>(null);
  const chatting = useRef(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void fetch(`/api/public/try/${encodeURIComponent(slug)}?t=${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { ok?: boolean; message?: string; messages?: { role: "user" | "assistant"; content: string }[] };
        if (chatting.current) return;
        if (!response.ok || body.ok === false) {
          setNotice(body.message || "This test link is not active.");
          return;
        }
        setMessages((body.messages ?? []).map((item, index) => ({
          id: `loaded-${index}`,
          role: item.role,
          content: item.content,
        })));
      })
      .catch(() => {
        if (!controller.signal.aborted) setNotice("The test chat could not be loaded. Nothing was sent.");
      });
    return () => controller.abort();
  }, [slug, token]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, pending]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || pending || !token) return;
    chatting.current = true;
    const mine: Bubble = { id: `user-${Date.now()}`, role: "user", content: message };
    setMessages((current) => [...current, mine]);
    setDraft("");
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/public/try/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, message }),
      });
      const body = await response.json() as { message?: string; reply?: string };
      const reply = (body.reply || body.message || "Nothing was sent.").trim();
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", content: reply }]);
    } catch {
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "The test chat could not reply. Nothing was sent and nothing was charged.",
      }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[#ECE5DD]">
      <header className="bg-[#075E54] px-4 py-3 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">AI employee</p>
        <h1 className="font-display text-lg font-bold">Test chat</h1>
        <p className="text-sm text-emerald-50">{slug}</p>
      </header>
      <p data-testid="try-banner" className="bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950">
        {TRY_BANNER}
      </p>
      <div ref={scroller} className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3" aria-live="polite">
        {messages.length === 0 ? (
          <p className="rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-600">Say hello to try this agent. This chat stays in test mode.</p>
        ) : null}
        {messages.map((item) => (
          <p
            key={item.id}
            className={
              item.role === "user"
                ? "ml-10 max-w-[85%] self-end rounded-lg rounded-br-sm bg-[#DCF8C6] px-3 py-2 text-sm text-slate-900"
                : "mr-10 max-w-[85%] self-start rounded-lg rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-900"
            }
          >
            {item.content}
          </p>
        ))}
        {pending ? <p className="mr-10 self-start rounded-lg bg-white px-3 py-2 text-sm text-slate-500">Typing…</p> : null}
        {notice ? <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{notice}</p> : null}
      </div>
      <div className="border-t border-slate-200 bg-[#F0F0F0] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          href={TRY_GO_LIVE_HREF}
          data-testid="try-go-live"
          className="mb-2 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075E54]"
        >
          Go live
        </Link>
        <form onSubmit={send} className="flex items-end gap-2">
          <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold text-slate-700">
            <span className="sr-only">Message</span>
            <input
              name="message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={2000}
              autoComplete="off"
              placeholder="Message"
              className="h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075E54]"
            />
          </label>
          <button
            type="submit"
            disabled={pending || !token}
            className="inline-flex h-11 items-center rounded-full bg-[#075E54] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
