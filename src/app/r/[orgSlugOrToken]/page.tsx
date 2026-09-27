import type { Metadata } from "next";
import { ReviewForm } from "@/components/reviews/review-form";
import { loadPublicReview } from "@/lib/reviews/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review",
  robots: { index: false, follow: false },
};

export default async function PublicReviewPage({ params }: { params: Promise<{ orgSlugOrToken: string }> }) {
  const { orgSlugOrToken } = await params;
  const page = await loadPublicReview(orgSlugOrToken);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4 py-10">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Review</p>
        {page.kind === "missing" ? (
          <>
            <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">Review page</h1>
            <p className="mt-3 text-sm text-slate-600">{page.message}</p>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">{page.orgName}</h1>
            <p className="mt-2 text-sm text-slate-600">Leave a short review for {page.senderName}.</p>
            <ReviewForm page={page} />
          </>
        )}
      </section>
    </main>
  );
}
