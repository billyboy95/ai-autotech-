import type { Metadata } from "next";
import Link from "next/link";
import { MembershipForm } from "@/components/membership/membership-form";
import { BUSINESS_EMAIL } from "@/lib/brand/contact";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AIOS membership",
  description: "Platform R299 per month. Agents from R699 per month. Prices exclude VAT.",
};

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string; billing?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-10">
      <section className="mx-auto w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">AIOS membership</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">Platform R299. Agents from R699.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Monthly PayFast subscription. Prices exclude VAT. Sandbox is the default until PAYFAST_MODE is live. An active membership is what opens platform access after a lapse. Nothing is charged on this page until PayFast takes the payment.
        </p>
        {params.access === "required" ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
            This workspace needs an active AIOS membership before platform access continues.
          </p>
        ) : null}
        {params.billing === "return" ? (
          <p className="mt-3 text-sm text-slate-700">PayFast sent you back. The membership stays pending until the ITN is confirmed.</p>
        ) : null}
        {params.billing === "cancel" ? <p className="mt-3 text-sm text-slate-700">Checkout was cancelled. Nothing was charged.</p> : null}
        <div className="mt-5">
          <MembershipForm />
        </div>
        <p className="mt-4 text-sm text-slate-600">
          <Link href="/services" className="font-semibold text-[#2563EB]">Service quotes</Link>
          {" · "}
          <a href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a>
        </p>
      </section>
    </main>
  );
}
