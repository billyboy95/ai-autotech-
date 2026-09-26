import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addLeadNote, markLeadWon, setLeadConsent, toggleOnboardingTask, updateLeadStage } from "@/app/actions/automation";
import { CrmFrame } from "@/components/crm/frame";
import { buildMailto, buildWaLink } from "@/lib/automation/channels";
import { formatSendCost, marketingConsentFor, previewSendBlock } from "@/lib/automation/compliance";
import { formatWhen, formatZar } from "@/lib/automation/ids";
import { loadCommandData } from "@/lib/automation/page-data";
import { PIPELINE_STAGES } from "@/lib/automation/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lead | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace, sendingEnabled } = await loadCommandData();
  const lead = workspace.state.leads.find((item) => item.id === id);
  if (!lead) notFound();

  const activities = workspace.state.activities
    .filter((item) => item.leadId === id)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const messages = workspace.state.outbox.filter((item) => item.leadId === id);
  const handover = workspace.state.handovers.find((item) => item.leadId === id);
  const tasks = workspace.state.tasks.filter((item) => item.leadId === id).sort((a, b) => a.ord - b.ord);
  const quote = workspace.state.quotes.find((item) => item.leadId === id);
  const booking = workspace.state.settings.bookingUrl;

  return (
    <CrmFrame setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div className="grid gap-4">
        <Link href="/command-centre/pipeline" className="text-sm font-semibold text-[#2563EB]">
          Back to pipeline
        </Link>
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">{lead.stage}</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">{lead.name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {lead.company || "No business name"}
                {lead.phone ? ` · ${lead.phone}` : ""}
                {lead.email ? ` · ${lead.email}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-bold text-[#0B1F3A]">{lead.score}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Owner" value={lead.ownerName || "Unassigned"} />
            <Fact label="Value" value={lead.valueZar ? formatZar(lead.valueZar) : "Not set"} />
            <Fact label="Source" value={[lead.utmSource || lead.source, lead.qrSource].filter(Boolean).join(" · ") || "Manual"} />
            <Fact label="Campaign" value={lead.campaign || "None"} />
            <Fact label="Team size" value={lead.companySize || "Unknown"} />
            <Fact label="Marketing opt-in" value={lead.marketingConsent ? "Recorded" : "Not recorded"} />
          </dl>
          {lead.scoreReasons.length ? <p className="mt-3 text-sm text-slate-600">{lead.scoreReasons.join(" · ")}</p> : null}
          {lead.lostReason ? <p className="mt-3 text-sm font-medium text-rose-700">{lead.lostReason}</p> : null}
          {lead.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{lead.notes}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {booking ? (
              <a href={booking} className="inline-flex h-10 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white">
                Booking link
              </a>
            ) : (
              <span className="inline-flex h-10 items-center rounded-md bg-slate-100 px-4 text-sm text-slate-500">
                Add a booking link in Settings
              </span>
            )}
            {lead.phone ? (
              <a
                href={buildWaLink(lead.phone, `Hi ${lead.name.split(" ")[0]}, it's Billy from AI AutoTech.`)}
                className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-[#0B1F3A]"
              >
                Open WhatsApp
              </a>
            ) : null}
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="grid gap-4">
            <form action={updateLeadStage} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Stage</h2>
              <input type="hidden" name="id" value={lead.id} />
              <select name="stage" defaultValue={lead.stage} className="h-10 rounded-md border border-slate-200 px-2 text-sm">
                {PIPELINE_STAGES.map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </select>
              <button className="h-10 rounded-md bg-[#0B1F3A] text-sm font-semibold text-white">Update stage</button>
            </form>

            {lead.stage !== "Won" && lead.stage !== "Onboarding/Handover" ? (
              <form action={markLeadWon} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Mark won</h2>
                <input type="hidden" name="id" value={lead.id} />
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  Value in rand
                  <input name="valueZar" defaultValue={lead.valueZar || ""} placeholder="18500" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">
                  What was sold
                  <input name="whatSold" placeholder="WhatsApp lead desk" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
                </label>
                <button className="h-10 rounded-md bg-emerald-700 text-sm font-semibold text-white">Won and start handover</button>
              </form>
            ) : null}

            <form action={setLeadConsent} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Marketing consent</h2>
              <p className="text-sm text-slate-600">
                {lead.marketingConsent
                  ? "Opt-in is recorded. Marketing messages can send once the switch is on."
                  : "No marketing opt-in. Follow-ups and campaigns stay blocked. Audit acknowledgements and reminders still queue."}
              </p>
              <input type="hidden" name="id" value={lead.id} />
              <input type="hidden" name="consent" value={lead.marketingConsent ? "false" : "true"} />
              <button className="h-10 rounded-md bg-[#0B1F3A] text-sm font-semibold text-white">
                {lead.marketingConsent ? "Clear opt-in" : "Record opt-in"}
              </button>
            </form>

            <form action={addLeadNote} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Note</h2>
              <input type="hidden" name="id" value={lead.id} />
              <textarea name="body" rows={3} className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="What happened" />
              <button className="h-10 rounded-md border border-slate-200 text-sm font-semibold text-[#0B1F3A]">Add to timeline</button>
            </form>
          </div>

          <div className="grid gap-4">
            <section data-testid="lead-timeline" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Activity</h2>
              <ol className="mt-4 grid gap-4 border-l border-slate-200 pl-4">
                {activities.length === 0 ? <li className="text-sm text-slate-500">No activity yet.</li> : null}
                {activities.map((item) => (
                  <li key={item.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                    <p className="text-sm font-semibold text-[#0B1F3A]">{item.title}</p>
                    {item.body ? <p className="text-sm text-slate-600">{item.body}</p> : null}
                    <p className="text-xs text-slate-400">{formatWhen(item.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Messages</h2>
              <ul className="mt-3 grid gap-2">
                {messages.length === 0 ? <li className="text-sm text-slate-500">No messages queued.</li> : null}
                {messages.map((message) => {
                  const block = previewSendBlock({
                    category: message.category || "service",
                    channel: message.channel,
                    to: message.toAddress,
                    marketingConsent: marketingConsentFor(workspace.state, message),
                    suppressions: workspace.state.suppressions || [],
                  });
                  const cost = formatSendCost(message);
                  return (
                  <li key={message.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-[#0B1F3A]">
                      {message.templateKey} · {message.channel} · {message.status}
                    </p>
                    <p className="text-slate-600">{message.body.slice(0, 180)}</p>
                    {message.error ? <p className="text-rose-700">{message.error}</p> : null}
                    {cost ? <p className="text-xs text-slate-500">{cost}</p> : null}
                    {block ? <p className="text-xs font-medium text-amber-800">{block}</p> : null}
                    {message.channel === "whatsapp" && message.waLink ? (
                      <a href={message.waLink} className="font-semibold text-[#2563EB]">
                        wa.me draft
                      </a>
                    ) : null}
                    {message.channel === "sms" && message.waLink ? (
                      <a href={message.waLink} className="font-semibold text-[#2563EB]">
                        SMS draft
                      </a>
                    ) : null}
                    {message.channel === "email" ? (
                      <a href={buildMailto(message.toAddress, message.subject, message.body)} className="ml-3 font-semibold text-[#2563EB]">
                        Email draft
                      </a>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
            </section>

            {handover ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Handover</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {handover.deliveredBy} delivers {handover.whatSold}. Value {formatZar(handover.valueZar)}.
                </p>
                {quote ? (
                  <p className="mt-2 text-sm text-slate-600">
                    {quote.reference} · {quote.kind} · {quote.status} · {formatZar(quote.amountZar)}
                  </p>
                ) : null}
                <ul className="mt-3 grid gap-2">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className={task.done ? "text-slate-400 line-through" : "text-slate-800"}>{task.title}</span>
                      <form action={toggleOnboardingTask}>
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="done" value={task.done ? "false" : "true"} />
                        <button className="h-8 rounded-md border border-slate-200 px-2 text-xs font-semibold">{task.done ? "Reopen" : "Done"}</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </CrmFrame>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-medium text-[#0B1F3A]">{value}</dd>
    </div>
  );
}
