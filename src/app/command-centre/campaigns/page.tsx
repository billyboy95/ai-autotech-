import type { Metadata } from "next";
import Link from "next/link";
import { importCampaignCsv, loadDraftProspects, saveCampaignForm, setProspectConsent } from "@/app/actions/automation";
import { CommandShell } from "@/components/crm/command-shell";
import { defaultCampaignSteps } from "@/lib/automation/campaigns";
import { formatWhen } from "@/lib/automation/ids";
import { loadCommandData } from "@/lib/automation/page-data";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { AGENCY_SLUG } from "@/lib/tenant/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campaigns | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function CampaignsPage() {
  const { workspace, sendingEnabled } = await loadCommandData();
  const tenant = await safeResolveWorkspace();
  const campaigns = workspace.state.campaigns;
  const steps = defaultCampaignSteps();

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <div data-testid="campaigns" className="grid min-w-0 max-w-full grid-cols-1 gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Campaigns</h1>
          <p className="text-sm text-slate-500">
            Prospects stay off the pipeline until they reply or book. A CSV import is not marketing consent. Messages wait in the outbox while sending is off, and a marketing send stays blocked until opt-in is recorded.
          </p>
        </div>

        <form action={importCampaignCsv} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Import prospects</h2>
          <p className="text-sm text-slate-600">
            Columns: name, business, niche, website, phone, email, opening line, consent_basis. A blank consent_basis gets one consent request. A second request is blocked.
          </p>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Add to campaign
            <select name="campaignId" className="h-10 w-full min-w-0 max-w-full rounded-md border border-slate-200 px-2 text-sm font-normal">
              <option value="">New campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
          <textarea
            name="csv"
            rows={5}
            className="rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
            placeholder={"name,business,niche,website,phone,email,opening line,consent_basis\nThabo,Ndlovu Dental,dental,https://example.co.za,0825550101,thabo@example.co.za,Your front desk is still copying WhatsApp into a notebook.,"}
          />
          <label className="text-xs font-semibold text-slate-600">
            Or upload a CSV
            <input name="file" type="file" accept=".csv,text/csv" className="mt-1 block text-sm font-normal" />
          </label>
          <button className="h-10 w-fit rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white">Import and queue</button>
        </form>

        {tenant.active.slug === AGENCY_SLUG ? (
          <form action={loadDraftProspects} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">East Rand draft</h2>
            <p className="text-sm text-slate-600">
              Loads the bundled prospect list into the AI AutoTech workspace as a draft. Status stays not contacted. Sending stays off. Nothing is queued.
            </p>
            <button className="h-10 w-fit rounded-md border border-slate-200 px-4 text-sm font-semibold text-[#0B1F3A]">Load held draft</button>
          </form>
        ) : null}

        <form action={saveCampaignForm} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Sequence</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Name
              <input name="name" defaultValue="Outbound prospects" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Status
              <select name="status" defaultValue="active" className="h-10 rounded-md border border-slate-200 px-2 text-sm font-normal">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>
          {steps.map((step, index) => (
            <fieldset key={step.id} className="grid gap-2 rounded-lg bg-slate-50 p-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {index + 1}</legend>
              <div className="grid gap-2 sm:grid-cols-[140px_120px_1fr]">
                <select name={`channel_${index}`} defaultValue={step.channel} className="h-10 rounded-md border border-slate-200 px-2 text-sm">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
                <input name={`delay_${index}`} type="number" min={0} defaultValue={step.delayHours} className="h-10 rounded-md border border-slate-200 px-3 text-sm" aria-label={`Delay hours ${index + 1}`} />
                <input name={`subject_${index}`} defaultValue={step.subject} placeholder="Email subject" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
              </div>
              <textarea name={`body_${index}`} rows={3} defaultValue={step.body} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
            </fieldset>
          ))}
          <button className="h-10 w-fit rounded-md border border-slate-200 px-4 text-sm font-semibold text-[#0B1F3A]">Save sequence</button>
        </form>

        {campaigns.map((campaign) => {
          const people = workspace.state.prospects.filter((prospect) => prospect.campaignId === campaign.id);
          return (
            <section key={campaign.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                {campaign.name}{" "}
                <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">{campaign.status}</span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {campaign.steps.map((step) => `${step.channel} +${step.delayHours}h`).join(" · ") || "No steps"}
              </p>
              <div className="mt-3 min-w-0 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2">Name</th>
                      <th>Business</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Consent</th>
                      <th>Next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-3 text-slate-500">
                          No prospects yet.
                        </td>
                      </tr>
                    ) : null}
                    {people.map((prospect) => (
                      <tr key={prospect.id} className="border-t border-slate-100">
                        <td className="py-2 font-semibold text-[#0B1F3A]">{prospect.name}</td>
                        <td>{prospect.business}</td>
                        <td>{prospect.phone}</td>
                        <td>{prospect.email}</td>
                        <td>{prospect.leadId ? "In pipeline" : prospect.status}</td>
                        <td>
                          <form action={setProspectConsent}>
                            <input type="hidden" name="id" value={prospect.id} />
                            <input type="hidden" name="consent" value={prospect.marketingConsent ? "false" : "true"} />
                            <button className="font-semibold text-[#2563EB]">
                              {prospect.marketingConsent ? "Clear opt-in" : "Record opt-in"}
                            </button>
                          </form>
                        </td>
                        <td>
                          {prospect.leadId ? (
                            <Link href={`/command-centre/leads/${prospect.leadId}`} className="font-semibold text-[#2563EB]">
                              Open lead
                            </Link>
                          ) : (
                            formatWhen(prospect.createdAt)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </CommandShell>
  );
}
