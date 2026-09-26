import type { Metadata } from "next";
import Link from "next/link";
import { approveOutboxMessage, cancelOutboxMessage } from "@/app/actions/automation";
import { CrmFrame } from "@/components/crm/frame";
import { buildMailto } from "@/lib/automation/channels";
import { formatWhen } from "@/lib/automation/ids";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outbox | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function OutboxPage() {
  const { workspace, sendingEnabled } = await loadCommandData();
  const messages = workspace.state.outbox
    .slice()
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
  const names = new Map(workspace.state.leads.map((lead) => [lead.id, lead.name]));

  return (
    <CrmFrame setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div data-testid="outbox" className="grid gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Outbox</h1>
          <p className="text-sm text-slate-500">
            {messages.filter((message) => message.status === "queued").length} queued. Approve keeps a message as a draft you can send by hand.
          </p>
        </div>
        <div className="grid gap-3">
          {messages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No messages yet.</p>
          ) : null}
          {messages.map((message) => (
            <article key={message.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {message.channel} · {message.status} · {message.provider || "outbox"}
                  </p>
                  <h2 className="font-semibold text-[#0B1F3A]">
                    <Link href={`/command-centre/leads/${message.leadId}`} className="hover:text-[#2563EB]">
                      {names.get(message.leadId) || message.leadId}
                    </Link>
                    <span className="font-normal text-slate-500"> · {message.toAddress}</span>
                  </h2>
                  {message.subject ? <p className="text-sm text-slate-600">{message.subject}</p> : null}
                </div>
                <p className="text-xs text-slate-400">{formatWhen(message.scheduledFor)}</p>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{message.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {message.waLink ? (
                  <a href={message.waLink} className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]">
                    Open wa.me
                  </a>
                ) : null}
                {message.channel === "email" ? (
                  <a
                    href={buildMailto(message.toAddress, message.subject, message.body)}
                    className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A]"
                  >
                    Open email draft
                  </a>
                ) : null}
                {message.status === "queued" || message.status === "failed" ? (
                  <form action={approveOutboxMessage}>
                    <input type="hidden" name="id" value={message.id} />
                    <button className="h-9 rounded-md bg-[#2563EB] px-3 text-sm font-semibold text-white">Approve draft</button>
                  </form>
                ) : null}
                {message.status !== "sent" && message.status !== "cancelled" ? (
                  <form action={cancelOutboxMessage}>
                    <input type="hidden" name="id" value={message.id} />
                    <button className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600">Cancel</button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </CrmFrame>
  );
}
