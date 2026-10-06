import type { Metadata } from "next";
import { CommandShell } from "@/components/crm/command-shell";
import { ApprovalQueueDesk } from "@/components/sales-agents/approval-queue";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadApprovalQueue } from "@/lib/sales-agents/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Approval queue",
  robots: { index: false, follow: false },
};

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ org?: string; notice?: string }> }) {
  const params = await searchParams;
  const { sendingEnabled, tenant } = await loadCommandData();
  const data = await loadApprovalQueue({
    tenantMode: tenant.mode,
    orgId: tenant.active.id,
    sendingEnabled,
  });
  const notice = params.notice === "fixture"
    ? "Fixture only. SALES_AGENTS_ENABLED is unset, so that tap stored nothing."
    : params.notice === "held"
      ? "That draft stayed in the queue. Nothing was sent."
      : data.notice;

  return (
    <CommandShell sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <ApprovalQueueDesk data={{ ...data, notice }} />
    </CommandShell>
  );
}
