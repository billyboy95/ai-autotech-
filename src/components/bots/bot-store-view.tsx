import Link from "next/link";
import { applyBotTemplate, startBotTrial } from "@/app/actions/bots";
import { Advanced } from "@/components/ui/advanced";
import { PageLead } from "@/components/ui/page-lead";
import { formatZar } from "@/lib/automation/ids";
import { DEPARTMENT_LABELS } from "@/lib/bots/catalog";
import type { BotStoreData } from "@/lib/bots/preview";

function rands(cents: number) {
  return formatZar(cents / 100);
}

export function BotStoreView({ data }: { data: BotStoreData }) {
  return (
    <div data-testid="bot-store" className="grid gap-4">
      <PageLead
        title="Agent store"
        body="Agents and bots are the same thing. The fastest start is a whole team. Prices are placeholders until Billy confirms them. Sandbox only."
        action="Set up a team"
        href="/command-centre/setup"
      />
      {data.notice ? <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{data.notice}</p> : null}

      {data.departments.map((department) => (
        <section key={department} className="grid gap-3">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{DEPARTMENT_LABELS[department as keyof typeof DEPARTMENT_LABELS] || department}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.bots.filter((bot) => bot.department === department).map((bot) => (
              <article key={bot.slug} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                    <Link href={`/command-centre/bots/${bot.slug}`} className="hover:text-[#2563EB]">{bot.name}</Link>
                  </h3>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Placeholder price</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{bot.description}</p>
                <p className="mt-3 font-display text-xl font-bold text-[#0B1F3A]">{rands(bot.monthlyPriceCents)} <span className="text-sm font-semibold text-slate-700">/ month</span></p>
                <p className="text-xs text-slate-700">{bot.installedStatus ? `Installed · ${bot.installedStatus}` : "Not installed"} · {bot.engine}</p>
                <div className="mt-3">
                  <TrialForm slug={data.orgSlug} bot={bot.slug} intent="trial" label="Start trial" />
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
              <p className="mt-2 text-sm text-slate-700">{bundle.botNames.join(", ")}</p>
              <p className="mt-3 text-sm text-slate-700">
                <span className="line-through">{rands(bundle.separateTotalCents)}</span>
                {" "}
                <span className="font-display text-xl font-bold text-[#0B1F3A]">{rands(bundle.bundlePriceCents)}</span>
                <span> / month</span>
              </p>
              <p className="text-sm font-semibold text-emerald-700">{`Save ${bundle.savingPercent}% vs buying separately`}</p>
              <div className="mt-3">
                <TrialForm slug={data.orgSlug} bundle={bundle.slug} intent="trial" label="Start trial" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Team templates</h2>
          <Link href="/command-centre/agents/templates" className="text-sm font-semibold text-[#2563EB]">All industry templates</Link>
        </div>
        <p className="text-sm text-slate-700">One click starts the sandbox trial and applies pipelines, stages, workflows, and agent settings. Sending stays off.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {data.templates.filter((template) => !template.industry).map((template) => (
            <article key={template.slug} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">{template.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{template.description}</p>
              <form action={applyBotTemplate} className="mt-3">
                <input type="hidden" name="slug" value={data.orgSlug} />
                <input type="hidden" name="template" value={template.slug} />
                <input type="hidden" name="return_to" value="/command-centre/bots" />
                <button className="inline-flex h-11 items-center rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]">Apply template</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <Advanced>
        <p className="text-sm text-slate-700">Buy stays in the sandbox. Nothing is charged. A team from setup is usually the better start.</p>
        {data.canSeeAgency ? (
          <Link href="/command-centre/bots/agency" className="text-sm font-semibold text-[#2563EB]">Agent MRR</Link>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {data.bots.map((bot) => (
            <TrialForm key={bot.slug} slug={data.orgSlug} bot={bot.slug} intent="buy" label={`Buy ${bot.name}`} />
          ))}
          {data.bundles.map((bundle) => (
            <TrialForm key={bundle.slug} slug={data.orgSlug} bundle={bundle.slug} intent="buy" label={`Buy ${bundle.name}`} />
          ))}
        </div>
      </Advanced>
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
      <button className={`inline-flex h-11 items-center rounded-md px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] ${intent === "buy" ? "bg-[#2563EB] text-white" : "border border-slate-300 text-[#0B1F3A]"}`}>
        {label}
      </button>
    </form>
  );
}
