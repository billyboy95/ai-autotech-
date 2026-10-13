import type { Metadata } from "next";
import { CommandShell } from "@/components/crm/command-shell";
import { OutreachDesk } from "@/components/outreach/outreach-desk";
import { loadCommandData } from "@/lib/automation/page-data";
import { isOutreachStage } from "@/lib/outreach/funnel";
import { loadOutreachDesk, outreachLiveMode } from "@/lib/outreach/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outreach",
  robots: { index: false, follow: false },
};

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; campaign?: string; stage?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const data = await loadOutreachDesk({
    live: outreachLiveMode(tenant),
    orgId: tenant.active.id,
    campaign: params.campaign ?? null,
  });
  const stage = params.stage === "dnc" ? "dnc" : params.stage && isOutreachStage(params.stage) ? params.stage : null;

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <OutreachDesk data={data} stageFilter={stage} notice={params.notice ?? null} />
    </CommandShell>
  );
}
