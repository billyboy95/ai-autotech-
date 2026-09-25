import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, loadMessages, type Conversation } from "@/lib/whatsapp/store";
import { pauseBot, resumeBot } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "WhatsApp thread", robots: { index: false, follow: false, nocache: true } };

export default async function WhatsappThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await db().from("crm_whatsapp_conversations").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Conversation;
  const rows = await loadMessages(id, 300);
  const paused = c.bot_paused_until && new Date(c.bot_paused_until).getTime() > Date.now();

  return (
    <main className="mx-auto max-w-3xl p-4 font-sans sm:p-8">
      <Link href="/whatsapp" className="text-sm text-blue-600 hover:underline">
        ← WhatsApp inbox
      </Link>
      <h1 className="mt-2 text-xl font-bold text-slate-900">
        {c.lead?.name || c.profile_name || c.wa_id} {c.lead?.business ? `· ${c.lead.business}` : ""}
      </h1>
      <p className="text-xs text-slate-500">
        {c.wa_id.startsWith("sim:") ? "Simulator" : <a className="text-blue-600" href={`https://wa.me/${c.wa_id}`}>+{c.wa_id}</a>} · status {c.status}
        {c.opted_out ? " · opted out" : ""} · {paused ? `bot paused until ${new Date(c.bot_paused_until!).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} SAST` : "bot active"}
      </p>
      <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(c.lead ?? {}, null, 2)}</pre>
      <form action={paused ? resumeBot : pauseBot} className="mt-3">
        <input type="hidden" name="id" value={c.id} />
        <button className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">{paused ? "Resume bot on this chat" : "Pause bot on this chat"}</button>
      </form>
      <div className="mt-6 space-y-2 rounded-xl bg-[#efeae2] p-4">
        {rows.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "in" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm shadow-sm ${
                m.author === "system" ? "bg-amber-50 text-xs text-amber-800" : m.direction === "in" ? "bg-white" : m.author === "billy" ? "bg-blue-100" : "bg-[#d9fdd3]"
              }`}
            >
              <div className="text-[10px] font-semibold uppercase text-slate-500">{m.author}</div>
              <div className="whitespace-pre-wrap">{m.body}</div>
              <div className="text-right text-[10px] text-slate-500">
                {new Date(m.created_at).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
