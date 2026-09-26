import type { Metadata } from "next";
import { saveAutomationSettings } from "@/app/actions/automation";
import { CrmFrame } from "@/components/crm/frame";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const { workspace, sendingEnabled } = await loadCommandData();
  const settings = workspace.state.settings;
  const rules = [0, 1, 2].map((index) => settings.rules[index]);

  return (
    <CrmFrame setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Automation settings</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          This command centre has no login, on purpose. Anyone with the URL can read lead names, phone numbers, and audit answers.
          Keep the link private.
        </p>
      </div>
      <form action={saveAutomationSettings} className="grid max-w-3xl gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Default owner
          <input name="defaultOwner" defaultValue={settings.defaultOwner} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Assignment
          <select name="strategy" defaultValue={settings.strategy} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            <option value="fixed">Always the default owner</option>
            <option value="round_robin">Round-robin across the team</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Team, comma separated
          <input name="team" defaultValue={settings.team.join(", ")} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Booking link (Calendly, Cal.com, or Google)
          <input name="bookingUrl" defaultValue={settings.bookingUrl} placeholder="https://cal.com/ai-autotech/audit" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField name="proposalFollowupDays" label="Proposal follow-up days" value={settings.proposalFollowupDays} />
          <NumberField name="staleGraceDays" label="Days after day 7 before Lost" value={settings.staleGraceDays} />
          <NumberField name="stuckAfterDays" label="Days before a lead looks stuck" value={settings.stuckAfterDays} />
        </div>
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-[#0B1F3A]">Assignment rules</legend>
          <p className="text-xs text-slate-500">A matching rule wins before round-robin. Leave a row blank to ignore it.</p>
          {rules.map((rule, index) => (
            <div key={rule?.id || index} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
              <input type="hidden" name={`rule_id_${index}`} value={rule?.id || `rule-${index}`} />
              <input name={`rule_name_${index}`} defaultValue={rule?.name || ""} placeholder="Name" className="h-10 rounded-md border border-slate-200 px-2 text-sm" />
              <input name={`rule_source_${index}`} defaultValue={rule?.matchSource || ""} placeholder="source" className="h-10 rounded-md border border-slate-200 px-2 text-sm" />
              <input name={`rule_qr_${index}`} defaultValue={rule?.matchQrSource || ""} placeholder="qr_source" className="h-10 rounded-md border border-slate-200 px-2 text-sm" />
              <input name={`rule_owner_${index}`} defaultValue={rule?.owner || ""} placeholder="Owner" className="h-10 rounded-md border border-slate-200 px-2 text-sm" />
            </div>
          ))}
        </fieldset>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Onboarding checklist, one task per line
          <textarea name="checklist" rows={6} defaultValue={settings.checklist.join("\n")} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <button className="h-10 w-fit rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white">Save settings</button>
      </form>
    </CrmFrame>
  );
}

function NumberField({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {label}
      <input name={name} type="number" min={0} defaultValue={value} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
    </label>
  );
}
