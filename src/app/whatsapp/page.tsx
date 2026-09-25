import type { Metadata } from "next";
import Link from "next/link";
import { db, type Conversation } from "@/lib/whatsapp/store";
import { clearAttention } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "WhatsApp inbox", robots: { index: false, follow: false, nocache: true } };

type Row = Conversation & { updated_at: string; last_inbound_at: string | null };

export default async function WhatsappInbox({ searchParams }: { searchParams: Promise<{ tests?: string }> }) {
  const { tests } = await searchParams;
  const showTests = tests === "1";
  let q = db()
    .from("crm_whatsapp_conversations")
    .select("*")
    .order("needs_attention", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (!showTests) q = q.eq("is_test", false);
  const { data, error } = await q;
  const rows = (data ?? []) as Row[];

  return (
    <main className="mx-auto max-w-5xl p-4 font-sans sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">WhatsApp inbox</h1>
        <Link href="/command-centre" className="text-sm text-blue-600 hover:underline">
          ← CRM
        </Link>
        <Link href="/whatsapp-sim" className="text-sm text-blue-600 hover:underline">
          Simulator
        </Link>
        <Link href={showTests ? "/whatsapp" : "/whatsapp?tests=1"} className="ml-auto text-sm text-slate-600 hover:underline">
          {showTests ? "Hide test chats" : "Show test chats"}
        </Link>
      </div>
      {error && <p className="text-red-600">{error.message}</p>}
      {!rows.length && <p className="text-slate-600">No WhatsApp conversations yet.</p>}
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {rows.map((c) => {
          const paused = c.bot_paused_until && new Date(c.bot_paused_until).getTime() > Date.now();
          const lead = c.lead ?? {};
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/whatsapp/${c.id}`} className="font-semibold text-slate-900 hover:underline">
                  {lead.name || c.profile_name || (c.wa_id.startsWith("sim:") ? "Simulator chat" : `+${c.wa_id}`)}
                  {lead.business ? ` · ${lead.business}` : ""}
                </Link>
                <div className="text-xs text-slate-500">
                  {c.wa_id.startsWith("sim:") ? "simulator" : `+${c.wa_id}`} · {lead.industry || "industry ?"} · {lead.pain || "pain ?"} ·{" "}
                  {new Date(c.updated_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} SAST
                </div>
                {c.handover_reason && <div className="mt-1 text-xs text-amber-700">Handover: {c.handover_reason}</div>}
              </div>
              <div className="flex flex-wrap gap-1 text-[11px] font-semibold">
                {c.needs_attention && <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">NEEDS BILLY</span>}
                {paused && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">bot paused</span>}
                {c.opted_out && <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-700">opted out</span>}
                {c.is_test && <span className="rounded bg-violet-100 px-2 py-0.5 text-violet-700">test</span>}
                {c.crm_lead_id && <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">in CRM</span>}
              </div>
              {c.needs_attention && (
                <form action={clearAttention}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Done</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
