import type { Metadata } from "next";
import { SetupInterview } from "@/components/bots/setup-interview";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { isBotAssistantEnabled } from "@/lib/bots/flag";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Setup",
  robots: { index: false, follow: false },
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <SetupInterview orgSlug={tenant.active.slug} polishEnabled={isBotAssistantEnabled()} notice={params.notice} />
    </CommandShell>
  );
}
