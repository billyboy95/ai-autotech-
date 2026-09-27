import type { Metadata } from "next";
import { TeamView } from "@/components/bots/team-view";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadBotStore } from "@/lib/bots/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, store] = await Promise.all([
    loadCommandData(),
    loadBotStore({ org: params.org, notice: null }),
  ]);
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <TeamView departments={store.departments} bots={store.bots} />
    </CommandShell>
  );
}
