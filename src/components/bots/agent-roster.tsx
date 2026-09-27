import Link from "next/link";
import { PageLead } from "@/components/ui/page-lead";
import type { StoreBotCard } from "@/lib/bots/preview";
import { DEPARTMENT_LABELS } from "@/lib/bots/catalog";

export function AgentRoster({
  title,
  intro,
  bots,
}: {
  title: string;
  intro: string;
  bots: StoreBotCard[];
}) {
  return (
    <div className="grid gap-4">
      <PageLead title={title} body={intro} action="Build the full team" href="/command-centre/lead-agent" />
      {bots.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">No agents are running yet. Use Build the full team above. Nothing is sent.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {bots.map((bot) => (
            <li key={bot.slug} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                <Link href={`/command-centre/bots/${bot.slug}`} className="hover:text-[#2563EB]">{bot.name}</Link>
              </h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                {DEPARTMENT_LABELS[bot.department as keyof typeof DEPARTMENT_LABELS] || bot.department}
                {bot.installedStatus ? ` · ${bot.installedStatus}` : ""}
              </p>
              <p className="mt-2 text-sm text-slate-600">{bot.description}</p>
              {bot.installedStatus ? (
                <Link href={`/command-centre/bots/${bot.slug}/computer`} className="mt-3 inline-flex text-sm font-semibold text-[#2563EB]">View computer</Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
