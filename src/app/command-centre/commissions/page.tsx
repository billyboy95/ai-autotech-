import type { Metadata } from "next";
import { CommissionsDesk } from "@/components/commissions/commissions-desk";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadCommissionDesk } from "@/lib/commissions/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commissions",
  robots: { index: false, follow: false },
};

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, desk] = await Promise.all([
    loadCommandData(),
    loadCommissionDesk(params.org),
  ]);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <CommissionsDesk data={desk} />
    </CommandShell>
  );
}
