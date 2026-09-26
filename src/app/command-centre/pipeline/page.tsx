import type { Metadata } from "next";
import { addPipelineLead } from "@/app/actions/automation";
import { CommandShell } from "@/components/crm/command-shell";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pipeline | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function PipelinePage() {
  const { workspace, sendingEnabled } = await loadCommandData();

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Pipeline</h1>
          <p className="text-sm text-slate-500">Hot leads sit at the top of each stage. Drag a card, or use Move.</p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <form action={addPipelineLead} className="grid h-fit gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">New lead</h2>
          <Field name="name" label="Name" placeholder="Thabo Ndlovu" />
          <Field name="company" label="Business" placeholder="Ndlovu Dental" />
          <Field name="phone" label="Phone / WhatsApp" placeholder="082…" />
          <Field name="email" label="Email" placeholder="thabo@…" />
          <Field name="companySize" label="Team size" placeholder="12" />
          <Field name="notes" label="Note" placeholder="Asked about WhatsApp" />
          <button className="h-10 rounded-md bg-[#2563EB] text-sm font-semibold text-white">Save and assign</button>
        </form>
        <PipelineBoard
          leads={workspace.state.leads.map((lead) => ({
            id: lead.id,
            name: lead.name,
            company: lead.company,
            phone: lead.phone,
            stage: lead.stage,
            ownerName: lead.ownerName,
            score: lead.score,
            valueZar: lead.valueZar,
            source: lead.source,
            qrSource: lead.qrSource,
          }))}
        />
      </div>
    </CommandShell>
  );
}

function Field({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {label}
      <input
        name={name}
        placeholder={placeholder}
        className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:border-[#2563EB]"
      />
    </label>
  );
}
