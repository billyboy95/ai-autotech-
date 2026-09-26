import { loadWorkspace, runAutomationJob, saveWorkspace } from "@/lib/automation/service";
import { isWorkflowEngineEnabled } from "@/lib/workflows/flag";
import { phase1Workflows } from "@/lib/workflows/phase1";
import { dispatchEvent } from "@/lib/workflows/runner";
import { CLAIM_LIMIT, type TriggerType, type WorkflowDefinition } from "@/lib/workflows/types";
import { openServiceDatabase } from "@/server/workers/service-db";

const SKIPPED = "WORKFLOW_ENGINE_ENABLED is off. Phase 1 automations still run from /api/cron/automation.";

type ClaimedRun = {
  id?: string;
  asset_key?: string;
  subject_id?: string;
  event_id?: string;
  event_type?: string;
  event_payload?: Record<string, unknown>;
  definition?: { steps?: WorkflowDefinition["steps"] };
};

export async function runWorkflowCron() {
  if (!isWorkflowEngineEnabled()) {
    return { ok: true as const, skipped: true, executed: 0, claimed: 0, reason: SKIPPED, sendingEnabled: false };
  }

  const claimed = await claimDueRuns();
  if (claimed.rows.length) {
    const executed = await executeClaimed(claimed.rows);
    return { ok: executed.ok, skipped: false, executed: executed.count, claimed: claimed.rows.length, error: executed.error, sendingEnabled: false };
  }

  const job = await runAutomationJob();
  if (!job.ok) {
    return { ok: false as const, skipped: false, executed: 0, claimed: 0, error: job.error, sendingEnabled: false };
  }
  return { ok: true as const, skipped: false, executed: job.events.length, claimed: 0, claimError: claimed.error, events: job.events, sendingEnabled: false };
}

async function claimDueRuns() {
  const db = openServiceDatabase();
  if (!db) return { rows: [] as ClaimedRun[], error: "" };
  const result = await db.rpc("claim_due_workflow_runs", { p_limit: CLAIM_LIMIT });
  if (result.error) {
    const missing = /claim_due_workflow_runs|schema cache|does not exist/i.test(result.error.message);
    return { rows: [] as ClaimedRun[], error: missing ? "" : result.error.message };
  }
  const rows = Array.isArray(result.data) ? (result.data as ClaimedRun[]) : [];
  return { rows, error: "" };
}

async function executeClaimed(rows: ClaimedRun[]) {
  try {
    const workspace = await loadWorkspace();
    if (!workspace.automationReady) return { ok: false as const, count: 0, error: workspace.setupError || "Workflow data is not ready." };
    const now = new Date();
    let state = workspace.state;
    for (const row of rows) {
      const workflow = definitionFor(row);
      if (!workflow || !row.subject_id) continue;
      state = dispatchEvent(state, [workflow], {
        type: (row.event_type || workflow.trigger_type) as TriggerType,
        subjectId: row.subject_id,
        occurredAt: now.toISOString(),
        id: row.event_id || `claimed-${row.id || row.subject_id}`,
        payload: row.event_payload || {},
      }).state;
    }
    await saveWorkspace(workspace.state, state);
    return { ok: true as const, count: rows.length, error: undefined };
  } catch (error) {
    return { ok: false as const, count: 0, error: error instanceof Error ? error.message : "Could not execute claimed workflow runs." };
  }
}

function definitionFor(row: ClaimedRun): WorkflowDefinition | null {
  const known = phase1Workflows().find((workflow) => workflow.asset_key === row.asset_key);
  const steps = Array.isArray(row.definition?.steps) ? row.definition.steps : known?.steps;
  if (!known && !steps?.length) return null;
  return {
    id: row.asset_key || known?.id || "workflow:claimed",
    asset_key: row.asset_key || known?.asset_key || "workflow:claimed",
    name: known?.name || row.asset_key || "Claimed workflow",
    active: true,
    trigger_type: (row.event_type as TriggerType) || known?.trigger_type || "schedule.cron",
    trigger: known?.trigger || {},
    steps: steps || [],
  };
}
