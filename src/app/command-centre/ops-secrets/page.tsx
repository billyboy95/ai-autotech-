import type { Metadata } from "next";
import { OpsSecretsPanel } from "@/components/ops/ops-secrets-panel";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ops secrets",
  robots: { index: false, follow: false },
};

export default async function OpsSecretsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <OpsSecretsPanel tenantMode={tenant.mode} orgSlug={tenant.active.slug} />
    </CommandShell>
  );
}
