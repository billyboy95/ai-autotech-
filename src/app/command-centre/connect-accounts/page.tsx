import type { Metadata } from "next";
import { AccountCards } from "@/components/connect/account-cards";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadConnectAccounts } from "@/lib/connect/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect accounts",
  robots: { index: false, follow: false },
};

export default async function ConnectAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const data = await loadConnectAccounts({ mode: tenant.mode, orgId: tenant.active.id });
  const notice = params.notice || data.notice;
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <AccountCards orgSlug={tenant.active.slug} cards={data.cards} notice={notice} preview={data.preview} />
    </CommandShell>
  );
}
