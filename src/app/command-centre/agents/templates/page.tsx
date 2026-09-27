import type { Metadata } from "next";
import { TemplateLibrary } from "@/components/bots/template-library";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadBotStore } from "@/lib/bots/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Templates",
  robots: { index: false, follow: false },
};

export default async function AgentTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; notice?: string; industry?: string; department?: string }>;
}) {
  const params = await searchParams;
  const [{ workspace, sendingEnabled }, store] = await Promise.all([
    loadCommandData(),
    loadBotStore({ org: params.org, notice: params.notice }),
  ]);
  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={params.org}>
      <TemplateLibrary data={store} industry={params.industry || ""} department={params.department || ""} />
    </CommandShell>
  );
}
