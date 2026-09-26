import Link from "next/link";

export function ProvisionChecklist({
  name,
  sendingEnabled,
  planLabel,
  stages,
  invitePath,
  settingsHref,
  templatesHref,
}: {
  name: string;
  sendingEnabled: boolean;
  planLabel: string;
  stages: string[];
  invitePath: string | null;
  settingsHref: string;
  templatesHref: string;
}) {
  return (
    <div className="grid gap-4" data-testid="provision-checklist">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Workspace ready</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">{name}</h1>
        <p className="mt-2 text-sm text-slate-600">Plan placeholder: {planLabel || "Not chosen"}.</p>
        <p
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${sendingEnabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-950"}`}
          data-testid="sending-state"
        >
          {sendingEnabled ? "Sending is on" : "Sending is off"}
        </p>
      </section>

      {invitePath ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-[#0B1F3A]">Client admin invite</h2>
          <p className="mt-2 text-sm text-slate-600">Share this link with the invited email. They sign in, then accept. No message was sent.</p>
          <p className="mt-2 break-all font-mono text-sm text-[#2563EB]">{invitePath}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#0B1F3A]">Pipeline</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {stages.length ? stages.map((stage) => (
            <li key={stage} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{stage}</li>
          )) : <li className="text-sm text-slate-500">Stages appear after the snapshot migration is applied.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#0B1F3A]">Before anything goes out</h2>
        <ol className="mt-3 grid gap-3 text-sm">
          <li className="rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-[#0B1F3A]">1. Connect channels</p>
            <p className="mt-1 text-slate-600">Add WhatsApp, email, or SMS for this workspace. Secrets stay in the channel vault, not in the snapshot.</p>
            <Link href={settingsHref} className="mt-2 inline-block font-semibold text-[#2563EB]">Open channel settings</Link>
          </li>
          <li className="rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-[#0B1F3A]">2. Review templates</p>
            <p className="mt-1 text-slate-600">WhatsApp follow-ups are templates only. Editing one here marks it as a client change so a later snapshot push leaves it alone.</p>
            <Link href={templatesHref} className="mt-2 inline-block font-semibold text-[#2563EB]">Review templates</Link>
          </li>
          <li className="rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-[#0B1F3A]">3. Turn sending on</p>
            <p className="mt-1 text-slate-600">Sending stays off. An agency owner turns it on from workspace settings after the channels and templates look right. This page does not switch it on.</p>
            <Link href={settingsHref} className="mt-2 inline-block font-semibold text-[#2563EB]">Workspace settings</Link>
          </li>
        </ol>
      </section>
    </div>
  );
}
