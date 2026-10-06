import type { Metadata } from "next";
import { CommandShell } from "@/components/crm/command-shell";
import { NotificationsDesk } from "@/components/funnel/notifications-desk";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadNotificationDesk } from "@/lib/funnel/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alerts",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const data = await loadNotificationDesk({ tenantMode: tenant.mode, orgId: tenant.active.id });

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <NotificationsDesk data={data} />
    </CommandShell>
  );
}
