import type { Metadata } from "next";
import { ComputerPanel } from "@/components/bots/computer-panel";
import { CommandShell } from "@/components/crm/command-shell";
import { loadCommandData } from "@/lib/automation/page-data";
import { loadComputerView } from "@/lib/computers/load";
import { clampTick } from "@/lib/computers/meter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Computer",
  robots: { index: false, follow: false },
};

export default async function AgentComputerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ org?: string; viewOnly?: string; tick?: string; notice?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [{ workspace, sendingEnabled }, computer] = await Promise.all([
    loadCommandData(),
    loadComputerView({
      org: query.org,
      slug,
      viewOnly: query.viewOnly !== "0",
      tick: clampTick(query.tick),
      notice: query.notice,
    }),
  ]);

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled} requestedSlug={query.org}>
      <ComputerPanel data={computer} />
    </CommandShell>
  );
}
