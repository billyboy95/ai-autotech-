"use client";

import { formatZar } from "@/lib/automation/ids";
import type { TeamRecommendation } from "@/lib/bots/recommend";

function money(cents: number) {
  return formatZar(cents / 100);
}

export function TeamRecommendationView({
  recommendation,
  publicPath,
}: {
  recommendation: TeamRecommendation;
  orgSlug?: string;
  build?: boolean;
  publicPath?: string | null;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">{recommendation.templateName}</p>
        <h2 className="mt-1 font-display text-xl font-bold text-[#0B1F3A]">Recommended AI team</h2>
        <p className="mt-1 text-sm text-slate-700">The full team. Placeholder prices, to be confirmed by Billy. Sandbox only. Nothing is sent.</p>
      </div>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-[#0B1F3A]">The full team</h3>
          <p className="text-sm text-slate-700">
            {money(recommendation.monthlyPriceCents)} / month
            {recommendation.savingPercent > 0 ? ` · Save ${recommendation.savingPercent}% vs buying separately` : ""}
          </p>
        </div>
        <ul className="grid gap-2">
          {recommendation.agents.map((agent) => (
            <li key={agent.slug} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="font-semibold text-[#0B1F3A]">{agent.name}</p>
              <p className="text-sm text-slate-700">{agent.why}</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">{money(agent.monthlyPriceCents)} / month · Placeholder price</p>
            </li>
          ))}
        </ul>
      </section>
      {publicPath ? (
        <p className="text-sm text-slate-700">
          Prospect link <a className="font-semibold text-[#2563EB]" href={publicPath}>{publicPath}</a>
        </p>
      ) : null}
    </div>
  );
}
