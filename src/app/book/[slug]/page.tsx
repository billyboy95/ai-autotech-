import type { Metadata } from "next";
import Link from "next/link";
import { BookingForm } from "@/components/calendars/booking-form";
import { loadPublicBooking } from "@/lib/calendars/public";
import { locationLabel } from "@/lib/calendars/slots";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book",
  robots: { index: false, follow: false },
};

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await loadPublicBooking(slug);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4 py-10">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Book</p>
        {page.kind === "missing" ? (
          <>
            <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">Booking link</h1>
            <p className="mt-3 text-sm text-slate-600">{page.message}</p>
          </>
        ) : null}
        {page.kind === "org" ? (
          <>
            <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">{page.orgName}</h1>
            <p className="mt-2 text-sm text-slate-600">Choose a time with {page.senderName}. No payment is taken here.</p>
            {page.links.length === 0 ? <p className="mt-4 text-sm text-slate-500">No open booking links yet.</p> : null}
            <ul className="mt-4 grid gap-2">
              {page.links.map((link) => (
                <li key={link.slug}>
                  <Link href={`/book/${link.slug}`} className="block rounded-md border border-slate-200 px-3 py-3 text-sm hover:bg-slate-50">
                    <span className="font-semibold text-[#0B1F3A]">{link.name}</span>
                    <span className="mt-1 block text-slate-500">{link.durationMinutes} min · {locationLabel(link.locationMode)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {page.kind === "link" ? (
          <>
            <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">{page.eventName}</h1>
            <p className="mt-2 text-sm text-slate-600">{page.orgName} · {page.calendarName}</p>
            <BookingForm page={page} />
          </>
        ) : null}
      </section>
    </main>
  );
}
