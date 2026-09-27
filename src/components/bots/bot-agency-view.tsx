import Link from "next/link";
import { PageLead } from "@/components/ui/page-lead";
import { formatZar } from "@/lib/automation/ids";
import type { AgencyBotData } from "@/lib/bots/preview";

export function BotAgencyView({ data }: { data: AgencyBotData }) {
  return (
    <div data-testid="bot-agency" className="grid gap-4">
      <div>
        <PageLead
          title="Agent MRR"
          body="See which workspaces run which agents. The amount is sandbox MRR and is not charged."
          action="Set up a team"
          href="/command-centre/setup"
        />
      </div>
      {data.notice ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{data.notice}</p> : null}
      {!data.allowed ? null : (
        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-700">Sandbox MRR {formatZar(data.totalMrrCents / 100)} / month</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="py-2 pr-3">Workspace</th>
                  <th className="py-2 pr-3">Bot</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Sandbox MRR</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr><td className="py-3 text-slate-700" colSpan={4}>No workspace has an agent yet. Use Set up a team above, then come back.</td></tr>
                ) : null}
                {data.rows.map((row) => (
                  <tr key={`${row.orgSlug}-${row.botSlug}`} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-semibold text-[#0B1F3A]">
                      <Link href={`/command-centre/bots?org=${row.orgSlug}`} className="hover:text-[#2563EB]">{row.orgName}</Link>
                    </td>
                    <td className="py-2 pr-3">
                      <Link href={`/command-centre/bots/${row.botSlug}?org=${row.orgSlug}`} className="hover:text-[#2563EB]">{row.botName}</Link>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{row.status}</td>
                    <td className="py-2 text-slate-700">{formatZar(row.mrrCents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
