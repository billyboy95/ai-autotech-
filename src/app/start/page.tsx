import type { Metadata } from "next";
import Link from "next/link";
import { StartTrialForm } from "@/components/trial/start-form";
import { FREE_TRIAL_UNAVAILABLE, freeTrialEnabled, trialNicheOptions } from "@/lib/trial/trial";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (!freeTrialEnabled()) {
    return { title: "Free trial", robots: { index: false, follow: false } };
  }
  return {
    title: "Start a free trial",
    description: "Open a sandbox workspace from a niche template. Nothing is sent and nothing is charged.",
  };
}

export default function StartTrialPage() {
  if (!freeTrialEnabled()) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
        <section data-testid="trial-unavailable" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Free trial</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">Not available</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{FREE_TRIAL_UNAVAILABLE}</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#2563EB]">
            Back to AI AutoTech
          </Link>
        </section>
      </main>
    );
  }

  const niches = trialNicheOptions();
  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-10">
      <section className="mx-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Free trial</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">Try a workspace</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Pick a niche. We copy that template into a sandbox workspace and swap in your business. The trial runs for 14 days unless FREE_TRIAL_DAYS says otherwise. Sending stays off. Nothing is charged.
        </p>
        <div className="mt-5">
          <StartTrialForm niches={niches} />
        </div>
      </section>
    </main>
  );
}
