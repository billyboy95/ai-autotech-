import type { Metadata } from "next";
import { AgentRoster } from "@/components/bots/agent-roster";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadBotStore } from "@/lib/bots/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live agents",
  robots: { index: false, follow: false },
};

export default async function LiveAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, store] = await Promise.all([
    loadCommandData(),
    loadBotStore({ org: params.org, notice: null }),
  ]);
  const live = store.bots.filter((bot) => bot.installedStatus === "trial" || bot.installedStatus === "active");
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <AgentRoster
        title="Live agents"
        intro="Agents on a trial or active in this workspace. They draft and open tasks across the CRM. Nothing is sent."
        bots={live}
      />
    </CommandShell>
  );
}
