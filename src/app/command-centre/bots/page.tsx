import type { Metadata } from "next";
import { BotStoreView } from "@/components/bots/bot-store-view";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadBotStore } from "@/lib/bots/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent store",
  robots: { index: false, follow: false },
};

export default async function BotsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, store] = await Promise.all([
    loadCommandData(),
    loadBotStore({ org: params.org, notice: params.notice }),
  ]);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <BotStoreView data={store} />
    </CommandShell>
  );
}
