import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PayfastRedirect } from "@/components/payfast/redirect-form";
import { splitPersonName } from "@/lib/aios/public-intake";
import { BUSINESS_EMAIL } from "@/lib/brand/contact";
import { onceOffCheckout } from "@/lib/payfast/checkout";
import { packagePriceLabel, servicePackage } from "@/lib/services/catalog";
import { markQuoteAccepted, readQuoteByToken } from "@/server/services/quotes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PayFast checkout",
  robots: { index: false, follow: false },
};

export default async function QuotePayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const loaded = await readQuoteByToken(token);
  if (!loaded.configured) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
        <p className="text-sm text-slate-700">Quote storage is not configured. Nothing was charged. Email {BUSINESS_EMAIL}.</p>
      </main>
    );
  }
  if (!loaded.quote) notFound();
  if (loaded.quote.status === "paid") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
        <p className="text-sm text-slate-700">This quote is already paid.</p>
      </main>
    );
  }
  if (loaded.quote.status === "requested") await markQuoteAccepted(token);
  const pack = servicePackage(loaded.quote.packageCode);
  const person = splitPersonName(loaded.quote.contactName);
  const checkout = onceOffCheckout({
    paymentId: `svc_${loaded.quote.id}`,
    amountCents: loaded.quote.amountCents,
    itemName: pack?.name || "Service",
    itemDescription: pack
      ? `${packagePriceLabel(pack)}. Prices exclude VAT.`
      : "Service quote. Prices exclude VAT.",
    firstName: person.firstName,
    lastName: person.lastName,
    email: loaded.quote.email,
    customStr1: loaded.quote.id,
    customStr2: loaded.quote.packageCode,
    returnPath: `/quotes/${token}?billing=return`,
    cancelPath: `/quotes/${token}?billing=cancel`,
  });
  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">PayFast once-off checkout</h1>
        {checkout.ok && checkout.actionUrl && checkout.fields ? (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {checkout.sandbox ? "PayFast sandbox is the default. No live charge is sent unless PAYFAST_MODE is live." : "PAYFAST_MODE is live. This opens the live PayFast checkout."} Nothing has been charged yet.
            </p>
            <PayfastRedirect action={checkout.actionUrl} fields={checkout.fields} />
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {checkout.message} Email <a className="font-semibold" href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a>.
          </p>
        )}
        <Link href={`/quotes/${token}`} className="mt-4 inline-block text-sm font-semibold text-[#2563EB]">
          Back to the quote
        </Link>
      </section>
    </main>
  );
}
