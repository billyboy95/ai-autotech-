import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FREE_TRIAL_UNAVAILABLE, freeTrialEnabled } from "@/lib/trial/trial";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open trial",
  robots: { index: false, follow: false },
};

export default async function OpenTrialPage() {
  if (!freeTrialEnabled()) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
        <section data-testid="trial-unavailable" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Not available</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{FREE_TRIAL_UNAVAILABLE}</p>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/login?next=/start/open");
  }
  const claim = await supabase.rpc("claim_free_trial");
  const slug = (claim.data as { slug?: string } | null)?.slug;
  if (!claim.error && slug) {
    redirect(`/command-centre?org=${encodeURIComponent(slug)}`);
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Open your trial</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {claim.error?.message || "This sign-in does not have a free trial yet."} Nothing was charged.
        </p>
        <Link href="/start" className="mt-4 inline-block text-sm font-semibold text-[#2563EB]">
          Back to the trial form
        </Link>
      </section>
    </main>
  );
}
