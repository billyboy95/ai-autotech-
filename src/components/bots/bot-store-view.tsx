import Link from "next/link";
import { applyBotTemplate, startBotTrial } from "@/app/actions/bots";
import { formatZar } from "@/lib/automation/ids";
import type { BotStoreData } from "@/lib/bots/preview";

function rands(cents: number) {
  return formatZar(cents / 100);
}

export function BotStoreView({ data }: { data: BotStoreData }) {
  return (
    <div data-testid="bot-store" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Bot Store</h1>
          <p className="text-sm text-slate-500">Monthly bots and team bundles. Prices are placeholders until Billy confirms them. Sandbox only.</p>
        </div>
        {data.canSeeAgency ? (
          <Link href="/command-centre/bots/agency" className="text-sm font-semibold text-[#2563EB]">
            Agency bots
          </Link>
        ) : null}
      </div>
      {data.notice ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{data.notice}</p> : null}

      {data.categories.map((category) => (
        <section key={category} className="grid gap-3">
          <h2 className="font-display text-lg font-bold capitalize text-[#0B1F3A]">{category}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.bots.filter((bot) => bot.category === category).map((bot) => (
              <article key={bot.slug} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                    <Link href={`/command-centre/bots/${bot.slug}`} className="hover:text-[#2563EB]">{bot.name}</Link>
                  </h3>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Placeholder price</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{bot.description}</p>
                <p className="mt-3 font-display text-xl font-bold text-[#0B1F3A]">{rands(bot.monthlyPriceCents)} <span className="text-sm font-semibold text-slate-500">/ month</span></p>
                <p className="text-xs text-slate-500">{bot.installedStatus ? `Installed · ${bot.installedStatus}` : "Not installed"} · {bot.engine}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <TrialForm slug={data.orgSlug} bot={bot.slug} intent="trial" label="Start trial" />
                  <TrialForm slug={data.orgSlug} bot={bot.slug} intent="buy" label="Buy (sandbox)" />
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="grid gap-3">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Team bundles</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.bundles.map((bundle) => (
            <article key={bundle.slug} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#0B1F3A]">{bundle.name}</h3>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Placeholder price</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{bundle.description}</p>
              <p className="mt-2 text-sm text-slate-500">{bundle.botNames.join(", ")}</p>
              <p className="mt-3 text-sm text-slate-500">
                <span className="line-through">{rands(bundle.separateTotalCents)}</span>
                {" "}
                <span className="font-display text-xl font-bold text-[#0B1F3A]">{rands(bundle.bundlePriceCents)}</span>
                <span> / month</span>
              </p>
              <p className="text-sm font-semibold text-emerald-700">Save {bundle.savingPercent}% vs buying separately</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <TrialForm slug={data.orgSlug} bundle={bundle.slug} intent="trial" label="Start trial" />
                <TrialForm slug={data.orgSlug} bundle={bundle.slug} intent="buy" label="Buy (sandbox)" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Team templates</h2>
        <p className="text-sm text-slate-500">One click starts the sandbox trial and applies pipelines, stages, workflows, and bot settings. Sending stays off.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {data.templates.map((template) => (
            <article key={template.slug} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">{template.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{template.description}</p>
              <form action={applyBotTemplate} className="mt-3">
                <input type="hidden" name="slug" value={data.orgSlug} />
                <input type="hidden" name="template" value={template.slug} />
                <input type="hidden" name="return_to" value="/command-centre/bots" />
                <button className="h-10 rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold text-white">Apply template</button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrialForm({
  slug,
  bot,
  bundle,
  intent,
  label,
}: {
  slug: string;
  bot?: string;
  bundle?: string;
  intent: "trial" | "buy";
  label: string;
}) {
  return (
    <form action={startBotTrial}>
      <input type="hidden" name="slug" value={slug} />
      {bot ? <input type="hidden" name="bot" value={bot} /> : null}
      {bundle ? <input type="hidden" name="bundle" value={bundle} /> : null}
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="return_to" value="/command-centre/bots" />
      <button className={`h-10 rounded-md px-3 text-sm font-semibold ${intent === "buy" ? "bg-[#2563EB] text-white" : "border border-slate-200 text-slate-700"}`}>
        {label}
      </button>
    </form>
  );
}
