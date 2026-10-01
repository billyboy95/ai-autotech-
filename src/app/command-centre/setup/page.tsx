import type { Metadata } from "next";
import { SetupInterview } from "@/components/bots/setup-interview";
import { SetupReady } from "@/components/bots/setup-ready";
import { OwnerBootstrapPanel } from "@/components/owner/owner-bootstrap-panel";
import { OpsSecretsPanel } from "@/components/ops/ops-secrets-panel";
import { GoLiveWizard } from "@/components/setup/go-live-wizard";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { isBillingSandboxEnabled } from "@/lib/billing/flag";
import { loadConnectAccounts } from "@/lib/connect/load";
import { cronSecretPresent, loadAgencyOwnerClaim, ownerEmailsSet, payfastMerchantState } from "@/lib/ops/readiness";
import { buildSetupWizard, channelsFromConnect } from "@/lib/setup/wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Setup",
  robots: { index: false, follow: false },
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string; team?: string; paid?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const connect = await loadConnectAccounts({ mode: tenant.mode, orgId: tenant.active.id });
  const wizard = buildSetupWizard({
    tenantMode: tenant.mode,
    ownerEmailsSet: ownerEmailsSet(),
    ownerClaim: await loadAgencyOwnerClaim(tenant.mode),
    cronConfigured: cronSecretPresent(),
    billingSandbox: isBillingSandboxEnabled(),
    payfastMerchant: payfastMerchantState(),
    channels: channelsFromConnect(connect),
  });
  const ready = params.paid === "1" && params.team;
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <div className="grid gap-6">
        <GoLiveWizard model={wizard} orgSlug={tenant.active.slug} />
        <OwnerBootstrapPanel tenantMode={tenant.mode} orgSlug={tenant.active.slug} />
        <OpsSecretsPanel tenantMode={tenant.mode} orgSlug={tenant.active.slug} />
        {ready ? (
          <SetupReady orgSlug={tenant.active.slug} teamSlug={params.team || ""} notice={params.notice} />
        ) : (
          <SetupInterview orgSlug={tenant.active.slug} notice={params.notice} />
        )}
      </div>
    </CommandShell>
  );
}
