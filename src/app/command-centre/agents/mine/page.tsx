import type { Metadata } from "next";
import { AgentRoster } from "@/components/bots/agent-roster";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadBotStore } from "@/lib/bots/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My agents",
  robots: { index: false, follow: false },
};

export default async function MyAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, store] = await Promise.all([
    loadCommandData(),
    loadBotStore({ org: params.org, notice: null }),
  ]);
  const mine = store.bots.filter((bot) => Boolean(bot.installedStatus));
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <AgentRoster
        title="My agents"
        intro="Every agent installed on this workspace, including paused ones. Nothing is sent."
        bots={mine}
      />
    </CommandShell>
  );
}
