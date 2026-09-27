import type { Metadata } from "next";
import { CommandShell } from "@/components/crm/command-shell";
import { CompanySection } from "@/components/company-crm";
import { presentWorkspace } from "@/lib/brand/present";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jobs",
  robots: { index: false, follow: false },
};

export default async function JobsPage() {
  const { workspace, classic, sendingEnabled, tenant } = await loadCommandData();
  const brand = presentWorkspace(tenant.active);
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Jobs</h1>
      <CompanySection data={classic} section="jobs" hidePlatformName={!brand.showPlatformName} />
    </CommandShell>
  );
}
