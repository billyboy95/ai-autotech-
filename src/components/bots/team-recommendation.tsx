"use client";

import { buildRecommendedTeam } from "@/app/actions/bots";
import { formatZar } from "@/lib/automation/ids";
import type { TeamRecommendation } from "@/lib/bots/recommend";

function money(cents: number) {
  return formatZar(cents / 100);
}

export function TeamRecommendationView({
  recommendation,
  orgSlug,
  build = false,
  publicPath,
}: {
  recommendation: TeamRecommendation;
  orgSlug?: string;
  build?: boolean;
  publicPath?: string | null;
}) {
  const heading = recommendation.start.length === 3 ? "Start with these 3" : "Start with these";
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">{recommendation.templateName}</p>
        <h2 className="mt-1 font-display text-xl font-bold text-[#0B1F3A]">Recommended AI team</h2>
        <p className="mt-1 text-sm text-slate-700">Placeholder prices, to be confirmed by Billy. Sandbox only. Nothing is sent.</p>
      </div>
      {recommendation.start.length === 0 ? (
        <p className="text-sm text-slate-700">This budget does not cover an agent yet. Choose a higher monthly budget, then build the team.</p>
      ) : (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-[#0B1F3A]">{heading}</h3>
            <p className="text-sm text-slate-600">
              {money(recommendation.monthlyPriceCents)} / month
              {recommendation.savingPercent > 0 ? ` · Save ${recommendation.savingPercent}% vs buying separately` : ""}
            </p>
          </div>
          <ul className="grid gap-2">
            {recommendation.start.map((agent) => (
              <li key={agent.slug} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                <p className="font-semibold text-[#0B1F3A]">{agent.name}</p>
                <p className="text-sm text-slate-600">{agent.why}</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">{money(agent.monthlyPriceCents)} / month · Placeholder price</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {recommendation.later.length ? (
        <section className="grid gap-2">
          <h3 className="font-display text-lg font-bold text-[#0B1F3A]">Add these later</h3>
          <ul className="grid gap-2">
            {recommendation.later.map((agent) => (
              <li key={agent.slug} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="font-semibold text-[#0B1F3A]">{agent.name}</p>
                <p className="text-slate-600">{agent.why}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {publicPath ? (
        <p className="text-sm text-slate-600">
          Prospect link <a className="font-semibold text-[#2563EB]" href={publicPath}>{publicPath}</a>
        </p>
      ) : null}
      {build && orgSlug && recommendation.start.length ? (
        <form action={buildRecommendedTeam}>
          <input type="hidden" name="slug" value={orgSlug} />
          <input type="hidden" name="bots" value={recommendation.start.map((agent) => agent.slug).join(",")} />
          <input type="hidden" name="return_to" value="/command-centre/setup" />
          <button className="inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]">Build my team</button>
        </form>
      ) : null}
    </div>
  );
}
