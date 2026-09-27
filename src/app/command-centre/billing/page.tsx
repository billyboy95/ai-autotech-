import type { Metadata } from "next";
import { CommandShell } from "@/components/crm/command-shell";
import { WorkspaceBillingPanel } from "@/components/workspace-billing-panel";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadBillingPage } from "@/lib/billing/load";
import { safeResolveWorkspace } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, tenant] = await Promise.all([
    loadCommandData(),
    safeResolveWorkspace(params.org),
  ]);
  const preview = tenant.mode === "preview" || tenant.active.id.startsWith("preview-");
  const billing = await loadBillingPage({
    orgId: preview ? null : tenant.active.id,
    orgName: tenant.active.name,
    slug: tenant.active.slug,
    email: tenant.userEmail || "",
    role: tenant.role,
    preview,
  });

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Billing</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Sandbox checkout only. PayFast can open a subscription form when BILLING_SANDBOX is on and the merchant id is 10000100. Sending stays off.
        </p>
      </div>
      <WorkspaceBillingPanel billing={billing} />
    </CommandShell>
  );
}
