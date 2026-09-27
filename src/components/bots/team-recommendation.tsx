"use client";

import { formatZar } from "@/lib/automation/ids";
import { PREMIUM_MODEL_NOTE, SEND_MARKUP_MULTIPLIER, SETUP_LINES, TOPUP_CENTS, TOPUP_HOURS, tierLabel } from "@/lib/pricing/price-sheet";
import type { TeamRecommendation } from "@/lib/bots/recommend";

function money(cents: number) {
  return formatZar(cents / 100);
}

function moneyExact(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
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
  const discount = recommendation.savingPercent > 0
    ? `minus ${recommendation.savingPercent}% team discount`
    : "no team discount under 3 agents";
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">{recommendation.templateName}</p>
        <h2 className="mt-1 font-display text-xl font-bold text-[#0B1F3A]">Recommended AI team</h2>
        <p className="mt-1 text-sm text-slate-700">Placeholder prices, to be confirmed by Billy. Sandbox only. Nothing is sent.</p>
      </div>
      <section className="grid gap-2 rounded-lg bg-[#0B1F3A] px-4 py-4 text-white">
        <p className="text-sm font-semibold">Monthly total</p>
        <p className="font-display text-3xl font-bold">{moneyExact(recommendation.monthlyPriceCents)} <span className="text-base font-semibold">/ month</span></p>
        <p className="text-sm text-slate-100">
          Platform {money(recommendation.platformFeeCents)} plus agents {money(recommendation.separateTotalCents)}, {discount}.
          {" "}{recommendation.pooledHours} computer-hours pooled.
        </p>
      </section>
      <section className="grid gap-3">
        <h3 className="font-display text-lg font-bold text-[#0B1F3A]">The full team</h3>
        <ul className="grid gap-2">
          {recommendation.agents.map((agent) => (
            <li key={agent.slug} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="font-semibold text-[#0B1F3A]">{agent.name}</p>
              <p className="text-sm text-slate-700">{agent.why}</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">{tierLabel(agent.tier)} · {money(agent.monthlyPriceCents)} / month · {agent.includedHours}h · Placeholder price</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-2">
        <h3 className="font-display text-lg font-bold text-[#0B1F3A]">Extras</h3>
        <ul className="grid gap-1 text-sm text-slate-700">
          <li>Computer-time top-up {money(TOPUP_CENTS)} per {TOPUP_HOURS} hours.</li>
          <li>{PREMIUM_MODEL_NOTE}</li>
          <li>WhatsApp, SMS, and email sends at {SEND_MARKUP_MULTIPLIER}× provider cost. Placeholder. Not part of the monthly total.</li>
          <li>Once-off {SETUP_LINES.quick_start.label} {money(SETUP_LINES.quick_start.cents)}, or {SETUP_LINES.team_setup.label} {money(SETUP_LINES.team_setup.cents)}. Placeholder. Not part of the monthly total.</li>
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
