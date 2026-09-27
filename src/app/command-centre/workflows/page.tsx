import type { Metadata } from "next";
import { CommandShell } from "@/components/crm/command-shell";
import { WorkflowBuilder } from "@/components/workflow-builder";
import { presentWorkspace } from "@/lib/brand/present";
import { loadCommandData } from "@/lib/automation/page-data";
import { phase1SnapshotWorkflows } from "@/lib/workflows/phase1";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workflows",
  robots: { index: false, follow: false },
};

export default async function WorkflowsPage() {
  const { workspace, sendingEnabled, tenant } = await loadCommandData();
  const contacts = workspace.state.leads.map((lead) => ({ id: lead.id, name: lead.name, stage: lead.stage }));
  const brand = presentWorkspace(tenant.active);
  const workflows = brand.showPlatformName ? phase1SnapshotWorkflows() : [];

  return (
    <CommandShell setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <WorkflowBuilder workflows={workflows} contacts={contacts} sendingEnabled={sendingEnabled} />
    </CommandShell>
  );
}
