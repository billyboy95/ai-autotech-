import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SignupAttribution } from "@/components/referrals/public-forms";
import { REFERRAL_COOKIE, readReferralCode } from "@/lib/referrals/codes";
import { recordReferralClick } from "@/server/workers/referrals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const code = readReferralCode(params.ref) || readReferralCode((await cookies()).get(REFERRAL_COOKIE)?.value);
  if (code) await recordReferralClick(code, "signup");

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Sign up</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">Bring your referral with you</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          A referral code stays in a first-party cookie for 60 days. Sign in, then attribute the workspace you belong to. The reward is a sandbox ledger entry after the first successful payment and the hold period.
        </p>
        {code ? <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">Referral code {code}</p> : null}
        <SignupAttribution code={code} />
        <Link href="/login?next=/signup" className="mt-4 inline-block text-sm font-semibold text-[#2563EB]">
          Sign in first
        </Link>
      </section>
    </main>
  );
}
