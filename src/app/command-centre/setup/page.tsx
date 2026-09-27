import type { Metadata } from "next";
import { SetupInterview } from "@/components/bots/setup-interview";
import { SetupReady } from "@/components/bots/setup-ready";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Setup",
  robots: { index: false, follow: false },
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string; team?: string; paid?: string }>;
}) {
  const params = await searchParams;
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const ready = params.paid === "1" && params.team;
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      {ready ? (
        <SetupReady orgSlug={tenant.active.slug} teamSlug={params.team || ""} notice={params.notice} />
      ) : (
        <SetupInterview orgSlug={tenant.active.slug} notice={params.notice} />
      )}
    </CommandShell>
  );
}
