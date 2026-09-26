"use server";

import { createInitialState } from "@/lib/automation/engine";
import { loadWorkspace } from "@/lib/automation/service";
import { emptyLead } from "@/lib/automation/types";
import { phase1Workflows } from "@/lib/workflows/phase1";
import { dryRunWorkflow } from "@/lib/workflows/runner";
import type { WorkflowDefinition } from "@/lib/workflows/types";

export async function previewWorkflow(assetKey: string, contactId: string, stepsJson: string) {
  const known = phase1Workflows().find((workflow) => workflow.asset_key === assetKey);
  const workflow = workflowFromPreview(assetKey, known, stepsJson);
  if (!workflow) return { ok: false as const, error: "That workflow could not be read.", sent: false as const, steps: [] };

  let state = createInitialState();
  try {
    const workspace = await loadWorkspace();
    state = workspace.state;
  } catch {
    state = createInitialState();
  }
  const subjectId = contactId.trim() || "sample-contact";
  if (!state.leads.some((lead) => lead.id === subjectId)) {
    state = {
      ...state,
      leads: [
        emptyLead({
          id: subjectId,
          name: "Sample contact",
          createdAt: new Date().toISOString(),
          stage: "New",
          enrolled: true,
        }),
        ...state.leads,
      ],
    };
  }
  const preview = dryRunWorkflow(workflow, state, subjectId, new Date());
  return {
    ok: true as const,
    sent: false as const,
    error: "",
    steps: preview.steps.map((step) => ({
      id: step.id,
      title: step.title,
      status: step.status,
      detail: JSON.stringify(step.detail),
    })),
  };
}

function workflowFromPreview(assetKey: string, known: WorkflowDefinition | undefined, stepsJson: string): WorkflowDefinition | null {
  if (!known) return null;
  try {
    const steps = JSON.parse(stepsJson) as WorkflowDefinition["steps"];
    if (!Array.isArray(steps) || steps.some((step) => !step || typeof step.id !== "string")) return known;
    return { ...known, steps };
  } catch {
    return known;
  }
}
