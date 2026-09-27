import type { Metadata } from "next";
import Link from "next/link";
import { readReferralCode } from "@/lib/referrals/codes";
import { recordReferralClick } from "@/server/workers/referrals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI business audit",
  description: "Start an AI business audit. A referral code on this link is stored for 60 days.",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const code = readReferralCode(params.ref);
  if (code) await recordReferralClick(code, "audit");

  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-10">
      <section className="mx-auto grid w-full max-w-xl gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Public audit</p>
        <h1 className="font-display text-3xl font-bold text-[#0B1F3A]">AI business audit</h1>
        <p className="text-sm leading-6 text-slate-600">
          This page is the public audit link. A referral code in the address is stored in a first-party cookie for 60 days and attached when the audit is saved.
        </p>
        {code ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">Referral code {code}</p> : null}
        <p className="text-sm leading-6 text-slate-600">
          The audit intake is <span className="font-semibold">/api/public/audit</span>. The same code is read from the cookie or from <span className="font-semibold">tracking.ref</span>.
        </p>
        <Link href="/signup" className="text-sm font-semibold text-[#2563EB]">Create a workspace</Link>
      </section>
    </main>
  );
}
