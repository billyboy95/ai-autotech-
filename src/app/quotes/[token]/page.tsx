import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BUSINESS_EMAIL } from "@/lib/brand/contact";
import { formatPackageZar, PRICE_PLACEHOLDER_LABEL, servicePackage } from "@/lib/services/catalog";
import { readQuoteByToken } from "@/server/services/quotes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accept your quote",
  robots: { index: false, follow: false },
};

export default async function QuoteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const loaded = await readQuoteByToken(token);
  if (!loaded.configured) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
        <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Quote storage is not configured</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">Nothing was charged. Email {BUSINESS_EMAIL}.</p>
        </section>
      </main>
    );
  }
  if (!loaded.quote) notFound();
  const pack = servicePackage(loaded.quote.packageCode);
  const paid = loaded.quote.status === "paid";
  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4 py-10">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Service quote</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">{pack?.name || "Quote"}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {loaded.quote.contactName}
          {loaded.quote.company ? ` · ${loaded.quote.company}` : ""}
        </p>
        <p className="mt-4 font-display text-3xl font-bold text-[#0B1F3A]">{formatPackageZar(loaded.quote.amountCents)}</p>
        <p className="mt-2 text-sm text-amber-900">{PRICE_PLACEHOLDER_LABEL} VAT is excluded.</p>
        {paid ? (
          <p className="mt-4 text-sm text-emerald-800">This quote is already marked paid. A membership upsell draft is in the CRM. Nothing else will be charged from this page.</p>
        ) : (
          <Link
            href={`/quotes/${token}/pay`}
            className="mt-5 inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white"
          >
            Accept and pay with PayFast
          </Link>
        )}
        <p className="mt-4 text-sm text-slate-600">
          Questions: <a className="font-semibold" href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a>
        </p>
      </section>
    </main>
  );
}
