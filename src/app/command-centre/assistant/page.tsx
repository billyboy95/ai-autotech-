import type { Metadata } from "next";
import { HomeChatPanel } from "@/components/home-chat/panel";
import { CommandShell } from "@/components/crm/command-shell";
import { PageLead } from "@/components/ui/page-lead";
import { loadCommandData } from "@/lib/automation/page-data";
import { homeChatDisplayMode } from "@/lib/home-chat/flag";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assistant",
  robots: { index: false, follow: false },
};

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const mode = homeChatDisplayMode({ tenantMode: tenant.mode });
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <div className="grid gap-4">
        <PageLead
          title="Assistant"
          body="Type what you want done. Follow-ups and tasks stay drafts. Nothing is sent and nothing is charged."
          action="Open the pipeline"
          href="/command-centre/pipeline"
        />
        <HomeChatPanel mode={mode} orgSlug={tenant.active.slug} />
      </div>
    </CommandShell>
  );
}
