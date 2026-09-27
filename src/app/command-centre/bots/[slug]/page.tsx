import type { Metadata } from "next";
import { BotDetailView } from "@/components/bots/bot-detail-view";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadBotDetail } from "@/lib/bots/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bot",
  robots: { index: false, follow: false },
};

export default async function BotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ org?: string; notice?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [{ workspace, sendingEnabled }, detail] = await Promise.all([
    loadCommandData(),
    loadBotDetail({ org: query.org, slug, notice: query.notice }),
  ]);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={query.org}>
      <BotDetailView data={detail} />
    </CommandShell>
  );
}
