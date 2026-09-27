import Link from "next/link";
import { PageLead } from "@/components/ui/page-lead";
import { DEPARTMENT_LABELS, DEPARTMENT_LEADS } from "@/lib/bots/catalog";
import type { StoreBotCard } from "@/lib/bots/preview";

export function TeamView({ departments, bots }: { departments: string[]; bots: StoreBotCard[] }) {
  return (
    <div className="grid gap-4">
      <PageLead
        title="Team"
        body="People and agents share a department. Each agent reports to the human lead. Nothing is sent."
        action="Set up a team"
        href="/command-centre/setup"
      />
      {departments.map((department) => {
        const label = DEPARTMENT_LABELS[department as keyof typeof DEPARTMENT_LABELS] || department;
        const lead = DEPARTMENT_LEADS[department as keyof typeof DEPARTMENT_LEADS] || "Team lead";
        const agents = bots.filter((bot) => bot.department === department);
        return (
          <section key={department} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{label}</h2>
            <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Human</span> · {lead}</p>
            <ul className="mt-3 grid gap-2">
              {agents.map((bot) => (
                <li key={bot.slug} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <Link href={`/command-centre/bots/${bot.slug}`} className="font-semibold text-[#0B1F3A] hover:text-[#2563EB]">{bot.name}</Link>
                  <span className="text-slate-700">Agent · reports to {lead}{bot.installedStatus ? ` · ${bot.installedStatus}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
