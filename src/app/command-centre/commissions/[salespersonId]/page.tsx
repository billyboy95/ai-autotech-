import type { Metadata } from "next";
import { StatementView } from "@/components/commissions/statement-view";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadCommissionStatement } from "@/lib/commissions/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commission statement",
  robots: { index: false, follow: false },
};

export default async function CommissionStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ salespersonId: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const [{ salespersonId }, query] = await Promise.all([params, searchParams]);
  const [{ workspace, sendingEnabled }, statement] = await Promise.all([
    loadCommandData(),
    loadCommissionStatement(salespersonId, query.org),
  ]);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={query.org}>
      <StatementView data={statement} />
    </CommandShell>
  );
}
