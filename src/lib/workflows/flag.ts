import type { EnvLike } from "@/lib/automation/channels";

/** Off unless WORKFLOW_ENGINE_ENABLED=true. Phase 1 automations keep running until then. */
export function isWorkflowEngineEnabled(env: EnvLike = process.env) {
  return String(env.WORKFLOW_ENGINE_ENABLED ?? "").trim().toLowerCase() === "true";
}
