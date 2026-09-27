import type { Metadata } from "next";
import { ReviewsDesk } from "@/components/reviews/reviews-desk";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadReviewDesk } from "@/lib/reviews/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews",
  robots: { index: false, follow: false },
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; rating?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, desk] = await Promise.all([
    loadCommandData(),
    loadReviewDesk({ org: params.org, rating: params.rating, notice: params.notice }),
  ]);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <ReviewsDesk data={desk} />
    </CommandShell>
  );
}
