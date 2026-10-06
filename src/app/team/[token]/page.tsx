import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { TeamRecommendationView } from "@/components/bots/team-recommendation";
import { PublicAuditReport } from "@/components/funnel/public-audit-report";
import { ResultsCallLink } from "@/components/funnel/results-call-link";
import { TeamAccept } from "@/components/referrals/public-forms";
import { loadPublicTeam } from "@/lib/bots/public-team";
import { isShareToken } from "@/lib/bots/share-token";
import { isSalesFunnelEnabled } from "@/lib/funnel/flag";
import { fixtureAuditReport, fixtureResultsCallUrl, FIXTURE_AUDIT_TOKEN, FIXTURE_COPY } from "@/lib/funnel/preview";
import { REFERRAL_COOKIE, readReferralCode } from "@/lib/referrals/codes";
import { recordReferralClick } from "@/server/workers/referrals";
import { loadApprovedShareReport, resultsCallForShareToken } from "@/server/workers/funnel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const code = readReferralCode(query.ref) || readReferralCode((await cookies()).get(REFERRAL_COOKIE)?.value);
  if (code) await recordReferralClick(code, "team");

  if (token === FIXTURE_AUDIT_TOKEN) {
    const report = fixtureAuditReport();
    return (
      <main className="min-h-screen bg-[#F3F4F6] px-4 py-10 text-[#111827]">
        <div className="mx-auto grid max-w-2xl gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">AIOS</p>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Sample audit report</h1>
          <p className="text-sm leading-6 text-slate-600">{FIXTURE_COPY}</p>
          <PublicAuditReport
            title={report.title}
            narrative={report.narrative}
            sections={report.sections}
            resultsCallUrl={fixtureResultsCallUrl()}
          />
        </div>
      </main>
    );
  }

  if (isShareToken(token)) {
    const recommendation = await loadPublicTeam(token);
    const report = isSalesFunnelEnabled() ? await loadApprovedShareReport(token) : null;
    const resultsCallUrl = isSalesFunnelEnabled() ? await resultsCallForShareToken(token) : null;
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
          {report ? <PublicAuditReport {...report} /> : resultsCallUrl ? <ResultsCallLink href={resultsCallUrl} /> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Team</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">Join this workspace</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in with the invited email, then accept. A referral code on this link is stored for 60 days and attributed when you join. No message is sent from this page.
        </p>
        {code ? <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">Referral code {code}</p> : null}
        <TeamAccept token={token} code={code} />
        <Link href={`/login?next=${encodeURIComponent(`/team/${token}`)}`} className="mt-4 inline-block text-sm font-semibold text-[#2563EB]">
          Sign in first
        </Link>
      </section>
    </main>
  );
}
