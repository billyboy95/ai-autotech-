import type { Metadata } from "next";
import { BotAgencyView } from "@/components/bots/bot-agency-view";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadAgencyBots } from "@/lib/bots/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agency bots",
  robots: { index: false, follow: false },
};

export default async function AgencyBotsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, agency] = await Promise.all([
    loadCommandData(),
    loadAgencyBots({ org: params.org }),
  ]);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <BotAgencyView data={agency} />
    </CommandShell>
  );
}
