import type { Metadata } from "next";
import Link from "next/link";
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
        <Link href="/command-centre/go-live" data-testid="golive-checklist-link" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-[#2563EB]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Go-live</p>
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Go-live checklist</h2>
          <p className="mt-1 text-sm text-slate-700">
            Open the checklist for migrations, owner bootstrap, ops secrets, packs, and sending. Status only. Nothing is sent.
          </p>
        </Link>
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
