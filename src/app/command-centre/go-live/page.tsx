import type { Metadata } from "next";
import { GoliveChecklistPanel } from "@/components/golive/golive-checklist-panel";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadPackApplied } from "@/lib/golive/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Go-live checklist",
  robots: { index: false, follow: false },
};

export default async function GoliveChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const packs = await loadPackApplied(tenant.mode);
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <GoliveChecklistPanel
        tenantMode={tenant.mode}
        orgSlug={tenant.active.slug}
        workspaceSendingEnabled={tenant.active.sendingEnabled || sendingEnabled}
        educationApplied={packs.education}
        zentrixApplied={packs.zentrix}
      />
    </CommandShell>
  );
}
