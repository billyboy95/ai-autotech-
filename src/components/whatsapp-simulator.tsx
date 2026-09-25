"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { id: string; from: "lead" | "bot" | "system"; text: string; time: string; kind?: "audio" | "image" };
type State = {
  status?: string;
  bot_paused_until?: string | null;
  handover_reason?: string;
  needs_attention?: boolean;
  opted_out?: boolean;
  lead?: Record<string, string>;
};
type Debug = { intent?: string; flags?: string[]; model?: string; handoverReason?: string; alert?: string; usage?: { inputTokens?: number; outputTokens?: number } };

const now = () => new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Ticks() {
  return (
    <svg viewBox="0 0 16 11" width="16" height="11" className="inline-block" aria-hidden>
      <path fill="#53bdeb" d="M11.07.66 5.4 7.4 3.16 5.07 2 6.2l3.46 3.6 6.8-8.08L11.07.66Zm3.2 0-5.67 6.74-.6-.62-1.14 1.13 1.8 1.88 6.8-8.08L14.27.66Z" />
    </svg>
  );
}

export function WhatsappSimulator() {
  const [session, setSession] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [debug, setDebug] = useState<Debug | null>(null);
  const [showDebug, setShowDebug] = useState(true);
  const [error, setError] = useState("");
  const [fast, setFast] = useState(false);
  const queue = useRef<Array<{ type: "text" | "audio" | "image"; text: string; unplayable?: boolean }>>([]);
  const busy = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ?session=<id> reopens a saved test chat (e.g. one from the scripted test runs).
    const fromUrl = new URLSearchParams(window.location.search).get("session");
    const saved = window.sessionStorage.getItem("wa-sim-session");
    const s = (fromUrl && /^[a-zA-Z0-9-]{8,64}$/.test(fromUrl) ? fromUrl : null) || saved || uid();
    window.sessionStorage.setItem("wa-sim-session", s);
    setSession(s);
    fetch(`/api/whatsapp-sim?session=${s}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.state) setState(d.state);
        if (d.messages?.length) {
          setMsgs(
            d.messages
              .filter((m: { author: string }) => m.author !== "system")
              .map((m: { author: string; body: string; type: string; at: string }) => ({
                id: uid(),
                from: m.author === "lead" ? "lead" : "bot",
                text: m.body,
                kind: m.type === "audio" ? "audio" : m.type === "image" ? "image" : undefined,
                time: new Date(m.at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false }),
              })),
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  async function pump() {
    if (busy.current) return;
    busy.current = true;
    try {
      while (queue.current.length) {
        const item = queue.current.shift()!;
        setError("");
        const res = await fetch("/api/whatsapp-sim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, ...item }),
        });
        const data = await res.json().catch(() => ({ ok: false, error: "Bad response" }));
        if (!data.ok) {
          setError(data.error || "Something failed");
          continue;
        }
        setState(data.state);
        const r = data.result;
        if (r.status !== "replied") {
          setDebug({ intent: r.status === "paused" ? "bot paused (handover), no reply" : r.status });
          continue;
        }
        setDebug({ intent: r.brain.intent, flags: r.brain.flags, model: r.brain.model, handoverReason: r.brain.handoverReason, alert: r.alert?.detail, usage: r.brain.usage });
        for (const b of r.bubbles as Array<{ text: string; delayMs: number }>) {
          setTyping(true);
          await sleep(fast ? 300 : Math.min(b.delayMs, 6000));
          setTyping(false);
          setMsgs((m) => [...m, { id: uid(), from: "bot", text: b.text, time: now() }]);
          await sleep(250);
        }
      }
    } finally {
      busy.current = false;
      setTyping(false);
    }
  }

  function send(type: "text" | "audio" | "image", text: string, unplayable?: boolean) {
    const label = type === "audio" ? (unplayable ? "Voice note (0:14)" : `Voice note: "${text}"`) : type === "image" ? `Photo${text ? `: ${text}` : ""}` : text;
    setMsgs((m) => [...m, { id: uid(), from: "lead", text: label, time: now(), kind: type === "text" ? undefined : type }]);
    queue.current.push({ type, text, unplayable });
    setInput("");
    void pump();
  }

  function reset() {
    const s = uid();
    window.sessionStorage.setItem("wa-sim-session", s);
    setSession(s);
    setMsgs([]);
    setState(null);
    setDebug(null);
    setError("");
  }

  async function resume() {
    await fetch("/api/whatsapp-sim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session, action: "resume" }) });
    setState((s) => (s ? { ...s, bot_paused_until: null, needs_attention: false } : s));
  }

  const paused = state?.bot_paused_until && new Date(state.bot_paused_until).getTime() > Date.now();

  return (
    <div className="min-h-screen bg-[#d1d7db] p-0 font-sans sm:p-6" data-testid="wa-sim">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row">
        <div className="flex h-[100dvh] flex-1 flex-col overflow-hidden bg-[#efeae2] shadow-xl sm:h-[86vh] sm:rounded-xl">
          <header className="flex items-center gap-3 bg-[#008069] px-4 py-3 text-white">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-bold text-[#008069]">AI</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">AI Auto Tech</div>
              <div className="text-xs text-emerald-100" data-testid="wa-status">
                {typing ? "typing…" : paused ? "Billy will take over (bot paused)" : "online"}
              </div>
            </div>
            <button onClick={() => setShowDebug((v) => !v)} className="rounded bg-white/15 px-2 py-1 text-xs hover:bg-white/25">
              {showDebug ? "Hide" : "Show"} brain
            </button>
            <button onClick={reset} className="rounded bg-white/15 px-2 py-1 text-xs hover:bg-white/25" data-testid="wa-reset">
              New chat
            </button>
          </header>

          <div
            className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4 sm:px-8"
            style={{
              backgroundImage:
                "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              backgroundPosition: "0 0, 11px 11px",
            }}
            data-testid="wa-thread"
          >
            <div className="mx-auto mb-3 w-fit rounded-md bg-[#ffeecd] px-3 py-1.5 text-center text-[11.5px] text-[#54656f] shadow-sm">
              Simulator: same brain as the live WhatsApp bot. Test chats are marked status=test and never become real leads.
            </div>
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.from === "lead" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`relative max-w-[78%] rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14.2px] leading-[19px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
                    m.from === "lead" ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"
                  }`}
                  data-testid={m.from === "lead" ? "wa-out" : "wa-in"}
                >
                  {m.kind === "audio" && <span className="mr-1">🎤</span>}
                  {m.kind === "image" && <span className="mr-1">📷</span>}
                  <span className="whitespace-pre-wrap break-words">{m.text}</span>
                  <span className="float-right ml-2 mt-1.5 flex translate-y-1 items-center gap-1 text-[11px] text-[#667781]">
                    {m.time}
                    {m.from === "lead" && <Ticks />}
                  </span>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start" data-testid="wa-typing">
                <div className="rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-sm">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-[#8696a0]" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && <div className="bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div>}

          <form
            className="flex items-center gap-2 bg-[#f0f2f5] px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) send("text", input.trim());
            }}
          >
            <button
              type="button"
              title="Send a photo"
              onClick={() => send("image", input.trim())}
              className="grid h-10 w-10 place-items-center rounded-full text-xl text-[#54656f] hover:bg-black/5"
              data-testid="wa-photo"
            >
              📷
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message as the lead"
              className="h-10 flex-1 rounded-lg bg-white px-3 text-[15px] outline-none"
              data-testid="wa-input"
            />
            {input.trim() ? (
              <button type="submit" className="grid h-10 w-10 place-items-center rounded-full bg-[#00a884] text-white" data-testid="wa-send" title="Send">
                ➤
              </button>
            ) : (
              <button
                type="button"
                title="Voice note (empty box = unplayable; type text first to simulate a transcribed voice note)"
                onClick={() => send("audio", "", true)}
                className="grid h-10 w-10 place-items-center rounded-full bg-[#00a884] text-white"
                data-testid="wa-voice"
              >
                🎤
              </button>
            )}
            {input.trim() && (
              <button
                type="button"
                title="Send what you typed as a transcribed voice note"
                onClick={() => send("audio", input.trim())}
                className="grid h-10 w-10 place-items-center rounded-full text-xl text-[#54656f] hover:bg-black/5"
              >
                🎤
              </button>
            )}
          </form>
        </div>

        {showDebug && (
          <aside className="w-full shrink-0 space-y-3 rounded-xl bg-white p-4 text-sm shadow-xl lg:w-80" data-testid="wa-debug">
            <h2 className="font-semibold text-slate-900">Brain</h2>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> Skip typing delays
            </label>
            <div className="space-y-1 text-xs text-slate-700">
              <div>
                <b>Intent:</b> {debug?.intent ?? "–"}
              </div>
              {debug?.handoverReason && (
                <div>
                  <b>Handover:</b> {debug.handoverReason}
                </div>
              )}
              {debug?.alert && (
                <div>
                  <b>Alert:</b> {debug.alert}
                </div>
              )}
              <div>
                <b>Post-process fixes:</b> {debug?.flags?.length ? debug.flags.join(", ") : "none"}
              </div>
              <div>
                <b>Model:</b> {debug?.model ?? "–"}
                {debug?.usage?.inputTokens ? ` (${debug.usage.inputTokens} in / ${debug.usage.outputTokens} out tokens)` : ""}
              </div>
            </div>
            <h3 className="pt-2 font-semibold text-slate-900">Lead facts</h3>
            <dl className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-xs">
              {["name", "business", "industry", "pain", "budget", "timeline", "email"].map((k) => (
                <div key={k} className="contents">
                  <dt className="capitalize text-slate-500">{k}</dt>
                  <dd className="text-slate-900">{state?.lead?.[k] || "–"}</dd>
                </div>
              ))}
            </dl>
            <h3 className="pt-2 font-semibold text-slate-900">Thread</h3>
            <div className="space-y-1 text-xs text-slate-700">
              <div>
                <b>Status:</b> {state?.status ?? "–"} {state?.opted_out ? "(opted out)" : ""}
              </div>
              <div>
                <b>Bot:</b> {paused ? `paused until ${new Date(state!.bot_paused_until!).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} SAST` : "active"}
              </div>
              {paused && (
                <button onClick={resume} className="mt-1 rounded bg-slate-900 px-2 py-1 text-white">
                  Resume bot
                </button>
              )}
            </div>
            <p className="pt-2 text-[11px] leading-4 text-slate-500">
              🎤 with an empty box sends an unplayable voice note. Type words then tap the small 🎤 to simulate a transcribed voice note. 📷 sends a photo (text = caption).
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
