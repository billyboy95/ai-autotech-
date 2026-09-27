import type { Metadata } from "next";
import { CommandShell } from "@/components/crm/command-shell";
import { PageLead } from "@/components/ui/page-lead";
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
        <PageLead
          title="Reviews"
          body="No review requests are waiting. Open the Review Requests agent and start a trial. It drafts a request. Nothing is posted and nothing is sent."
          action="Open Review Requests"
          href="/command-centre/bots/review-requests"
        />
      </div>
    </CommandShell>
  );
}
