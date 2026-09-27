import type { Metadata } from "next";
import { TeamRecommendationView } from "@/components/bots/team-recommendation";
import { loadPublicTeam } from "@/lib/bots/public-team";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recommended team",
  robots: { index: false, follow: false },
};

export default async function PublicTeamPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const recommendation = await loadPublicTeam(token);
  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-10 text-[#111827]">
      <div className="mx-auto grid max-w-2xl gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">AIOS</p>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Recommended team</h1>
        {recommendation ? (
          <TeamRecommendationView recommendation={recommendation} />
        ) : (
          <p className="text-sm text-slate-700">This team link is not active. Ask the person who sent it for a new link.</p>
        )}
      </div>
    </main>
  );
}
