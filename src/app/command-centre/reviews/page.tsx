import type { Metadata } from "next";
import Link from "next/link";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews",
  robots: { index: false, follow: false },
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled } = await loadCommandData();
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <div className="grid gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Reviews</h1>
          <p className="text-sm text-slate-500">Reputation stays in the CRM. Review agents draft requests and replies. Nothing is posted and nothing is sent.</p>
        </div>
        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">No review requests are queued in this preview. Open the reputation agents when you want a draft.</p>
          <Link href="/command-centre/bots/review-requests" className="mt-3 inline-flex text-sm font-semibold text-[#2563EB]">Review Requests agent</Link>
        </section>
      </div>
    </CommandShell>
  );
}
