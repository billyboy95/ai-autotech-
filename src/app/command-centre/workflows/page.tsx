import type { Metadata } from "next";
import { CommandShell } from "@/components/crm/command-shell";
import { WorkflowBuilder } from "@/components/workflow-builder";
import { loadCommandData } from "@/lib/automation/page-data";
import { phase1SnapshotWorkflows } from "@/lib/workflows/phase1";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workflows | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function WorkflowsPage() {
  const { workspace, sendingEnabled } = await loadCommandData();
  const contacts = workspace.state.leads.map((lead) => ({ id: lead.id, name: lead.name, stage: lead.stage }));

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <WorkflowBuilder workflows={phase1SnapshotWorkflows()} contacts={contacts} sendingEnabled={sendingEnabled} />
    </CommandShell>
  );
}
