import type { Metadata } from "next";
import { LeadOnboardingChat } from "@/components/bots/lead-onboarding";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lead Agent",
  robots: { index: false, follow: false },
};

export default async function LeadAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string; started?: string; team?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <LeadOnboardingChat
        orgSlug={tenant.active.slug}
        notice={params.notice}
        started={params.started === "1"}
        teamSlug={params.team || ""}
      />
    </CommandShell>
  );
}
