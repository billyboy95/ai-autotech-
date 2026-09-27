import type { Metadata } from "next";
import { CommandShell } from "@/components/crm/command-shell";
import { InboxView } from "@/components/inbox/inbox-view";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadInbox } from "@/lib/inbox/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inbox | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; filter?: string; channel?: string; id?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, data] = await Promise.all([
    loadCommandData(),
    loadInbox({
      org: params.org,
      filter: params.filter,
      channel: params.channel,
      id: params.id,
      notice: null,
    }),
  ]);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <InboxView data={data} banner={params.error || params.notice || null} bannerTone={params.error ? "error" : "ok"} />
    </CommandShell>
  );
}
