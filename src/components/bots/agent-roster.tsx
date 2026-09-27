import Link from "next/link";
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
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">{title}</h1>
        <p className="text-sm text-slate-500">{intro}</p>
      </div>
      {bots.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">No agents in this list yet. Start a sandbox trial from the agent store. Nothing is sent.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {bots.map((bot) => (
            <li key={bot.slug} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                <Link href={`/command-centre/bots/${bot.slug}`} className="hover:text-[#2563EB]">{bot.name}</Link>
              </h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {DEPARTMENT_LABELS[bot.department as keyof typeof DEPARTMENT_LABELS] || bot.department}
                {bot.installedStatus ? ` · ${bot.installedStatus}` : ""}
              </p>
              <p className="mt-2 text-sm text-slate-600">{bot.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
