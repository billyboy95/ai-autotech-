import type { EnvLike } from "@/lib/automation/channels";
import { newId } from "@/lib/automation/ids";
import type { AutomationState } from "@/lib/automation/types";
import { emptyMemory, performAction, type SideMemory } from "@/lib/workflows/actions";
import { evaluateCondition } from "@/lib/workflows/conditions";
import {
  CLAIM_LIMIT,
  MAX_ATTEMPTS,
  dedupeKey,
  type DomainEvent,
  type Step,
  type StepLog,
  type TriggerType,
  type WorkflowAlert,
  type WorkflowDefinition,
  type WorkflowRun,
} from "@/lib/workflows/types";

export type WorkflowStore = {
  workflows: WorkflowDefinition[];
  events: DomainEvent[];
  runs: WorkflowRun[];
  logs: StepLog[];
  alerts: WorkflowAlert[];
  state: AutomationState;
  memory: SideMemory;
};

export type PumpOptions = {
  limit?: number;
  env?: EnvLike;
  dryRun?: boolean;
  baseRetryMs?: number;
  signingSecret?: string;
  timezone?: string;
  failStep?: (step: Step, attempt: number) => void;
};

type WaitState = {
  mode: "duration" | "until_time" | "until_event";
  event?: string;
  startedAt: string;
  until: string;
};

export function createWorkflowStore(state: AutomationState, workflows: WorkflowDefinition[]): WorkflowStore {
  return {
    workflows,
    events: [],
    runs: [],
    logs: [],
    alerts: [],
    state,
    memory: emptyMemory(),
  };
}

export function emitEvent(
  store: WorkflowStore,
  input: {
    id?: string;
    orgId?: string;
    type: TriggerType;
    subjectType?: string;
    subjectId: string;
    payload?: Record<string, unknown>;
    occurredAt: string;
    idempotencyKey?: string;
  },
) {
  const idempotencyKey = input.idempotencyKey || input.id || "";
  if (idempotencyKey) {
    const existing = store.events.find((event) => event.orgId === (input.orgId || "org") && event.idempotencyKey === idempotencyKey);
    if (existing) return existing;
  }
  const event: DomainEvent = {
    id: input.id || newId("evt"),
    orgId: input.orgId || "org",
    type: input.type,
    subjectType: input.subjectType || "lead",
    subjectId: input.subjectId,
    payload: input.payload || {},
    occurredAt: input.occurredAt,
    idempotencyKey,
  };
  store.events.push(event);
  return event;
}

export function enqueueEvent(store: WorkflowStore, event: DomainEvent) {
  wakeForEvent(store, event);
  let created = 0;
  for (const workflow of store.workflows) {
    if (!workflow.active || workflow.trigger_type !== event.type) continue;
    if (event.type === "message.no_reply") {
      const after = Number(workflow.trigger.after_hours ?? 0);
      const waited = Number(event.payload.hours ?? 0);
      if (waited < after) continue;
    }
    const key = dedupeKey(workflow.id, event.subjectId, event.id);
    if (store.runs.some((run) => run.dedupeKey === key)) continue;
    store.runs.push({
      id: newId("run"),
      orgId: event.orgId,
      workflowId: workflow.id,
      subjectId: event.subjectId,
      eventId: event.id,
      dedupeKey: key,
      status: "pending",
      cursor: workflow.steps[0]?.id || "",
      nextRunAt: event.occurredAt,
      attempt: 0,
      context: {},
      lastError: "",
    });
    created += 1;
  }
  return created;
}

function wakeForEvent(store: WorkflowStore, event: DomainEvent) {
  for (const run of store.runs) {
    const wait = run.context.wait as WaitState | undefined;
    if (run.status !== "waiting" || !wait || wait.mode !== "until_event") continue;
    if (wait.event !== event.type || run.subjectId !== event.subjectId) continue;
    run.nextRunAt = event.occurredAt;
  }
}

export function claimDueRuns(store: WorkflowStore, now: Date, limit = CLAIM_LIMIT) {
  const capped = Math.min(Math.max(limit, 0), CLAIM_LIMIT);
  const due = store.runs
    .filter((run) => (run.status === "pending" || run.status === "waiting") && Date.parse(run.nextRunAt) <= now.getTime())
    .sort((left, right) => left.nextRunAt.localeCompare(right.nextRunAt) || left.id.localeCompare(right.id))
    .slice(0, capped);
  for (const run of due) run.status = "running";
  return due;
}

export function pump(store: WorkflowStore, now: Date, options: PumpOptions = {}) {
  const claimed = claimDueRuns(store, now, options.limit ?? CLAIM_LIMIT);
  for (const run of claimed) executeRun(store, run, now, options);
  return claimed.length;
}

export function runUntilIdle(store: WorkflowStore, now: Date, options: PumpOptions = {}) {
  let executed = 0;
  for (let guard = 0; guard < 20; guard += 1) {
    const count = pump(store, now, options);
    executed += count;
    if (!count) break;
  }
  return executed;
}

function executeRun(store: WorkflowStore, run: WorkflowRun, now: Date, options: PumpOptions) {
  const workflow = store.workflows.find((item) => item.id === run.workflowId);
  const event = store.events.find((item) => item.id === run.eventId);
  if (!workflow || !event) {
    failRun(store, run, null, now, options, new Error("Workflow run is missing its definition or event."));
    return;
  }

  for (let guard = 0; guard < 48; guard += 1) {
    if (!run.cursor) {
      run.status = "succeeded";
      return;
    }
    const step = workflow.steps.find((item) => item.id === run.cursor);
    if (!step) {
      failRun(store, run, null, now, options, new Error(`Missing step ${run.cursor}.`));
      return;
    }

    const waiting = run.context.wait as WaitState | undefined;
    if (waiting) {
      const decision = resolveWait(store, run, waiting, now);
      if (decision === "hold") {
        run.status = "waiting";
        return;
      }
      delete run.context.wait;
      writeLog(store, run, step, decision === "yes" ? "ok" : "skipped", "", { wait: decision });
      run.cursor = decision === "yes" ? step.yes || step.next || "" : step.no || step.next || "";
      continue;
    }

    try {
      options.failStep?.(step, run.attempt);
      const lead = store.state.leads.find((item) => item.id === run.subjectId);
      const tags = store.memory.tags.get(run.subjectId) || new Set<string>();
      if (step.condition && !evaluateCondition(step.condition, { state: store.state, lead, event, now, tags, env: options.env, timezone: options.timezone })) {
        writeLog(store, run, step, options.dryRun ? "dry_run" : "skipped", "", { branch: "no" });
        run.cursor = step.no || "";
        continue;
      }
      if (step.condition && !step.action) {
        writeLog(store, run, step, options.dryRun ? "dry_run" : "ok", "", { branch: "yes" });
        run.cursor = step.yes || step.next || "";
        continue;
      }
      if (!step.action) {
        run.cursor = step.next || step.yes || "";
        continue;
      }
      const outcome = performAction(step.action, {
        state: store.state,
        lead,
        event,
        now,
        memory: store.memory,
        env: options.env,
        dryRun: options.dryRun,
        signingSecret: options.signingSecret,
      });
      store.state = outcome.state;
      if (outcome.wait) {
        armWait(run, outcome.wait, now);
        writeLog(store, run, step, "waiting", "", outcome.detail);
        run.status = "waiting";
        return;
      }
      writeLog(store, run, step, options.dryRun ? "dry_run" : "ok", "", outcome.detail);
      if (outcome.halt) {
        run.status = "succeeded";
        run.cursor = "";
        return;
      }
      run.cursor = step.yes || step.next || "";
    } catch (error) {
      failRun(store, run, step, now, options, error);
      return;
    }
  }
  run.status = "succeeded";
  run.cursor = "";
}

function resolveWait(store: WorkflowStore, run: WorkflowRun, wait: WaitState, now: Date) {
  if (wait.mode === "until_event") {
    const arrived = store.events.some(
      (event) =>
        event.type === wait.event &&
        event.subjectId === run.subjectId &&
        event.id !== run.eventId &&
        event.occurredAt >= wait.startedAt,
    );
    if (arrived) return "yes" as const;
    if (now.getTime() >= Date.parse(wait.until)) return "no" as const;
    return "hold" as const;
  }
  if (now.getTime() >= Date.parse(wait.until)) return "yes" as const;
  return "hold" as const;
}

function armWait(run: WorkflowRun, wait: { mode: WaitState["mode"]; hours?: number; at?: string; event?: string; timeoutHours?: number }, now: Date) {
  const startedAt = now.toISOString();
  let until = startedAt;
  if (wait.mode === "duration") until = new Date(now.getTime() + (wait.hours || 0) * 36e5).toISOString();
  if (wait.mode === "until_time") until = wait.at || startedAt;
  if (wait.mode === "until_event") until = new Date(now.getTime() + (wait.timeoutHours || 24) * 36e5).toISOString();
  run.context = { ...run.context, wait: { mode: wait.mode, event: wait.event, startedAt, until } satisfies WaitState };
  run.nextRunAt = until;
  run.status = "waiting";
}

function failRun(store: WorkflowStore, run: WorkflowRun, step: Step | null, now: Date, options: PumpOptions, error: unknown) {
  const message = error instanceof Error ? error.message : "Workflow step failed.";
  run.attempt += 1;
  run.lastError = message;
  if (step) writeLog(store, run, step, "failed", message, {});
  if (run.attempt >= MAX_ATTEMPTS) {
    run.status = "failed";
    store.alerts.push({
      id: newId("alert"),
      runId: run.id,
      message: `Workflow step ${step?.id || "unknown"} failed after ${MAX_ATTEMPTS} tries. ${message}`,
      createdAt: now.toISOString(),
    });
    return;
  }
  const base = options.baseRetryMs ?? 60_000;
  run.status = "pending";
  run.nextRunAt = new Date(now.getTime() + base * 2 ** (run.attempt - 1)).toISOString();
}

function writeLog(store: WorkflowStore, run: WorkflowRun, step: Step, status: StepLog["status"], error: string, detail: Record<string, unknown>) {
  store.logs.push({
    id: newId("log"),
    runId: run.id,
    stepId: step.id,
    status,
    attempt: Math.max(run.attempt, 1),
    error,
    detail,
    createdAt: new Date().toISOString(),
  });
}

export function dispatchEvent(
  state: AutomationState,
  workflows: WorkflowDefinition[],
  input: {
    type: TriggerType;
    subjectId: string;
    subjectType?: string;
    payload?: Record<string, unknown>;
    occurredAt: string;
    id?: string;
    orgId?: string;
  },
  options: PumpOptions = {},
) {
  const store = createWorkflowStore(state, workflows);
  const event = emitEvent(store, input);
  enqueueEvent(store, event);
  runUntilIdle(store, new Date(input.occurredAt), options);
  return store;
}

export function runScheduledWorkflows(state: AutomationState, workflows: WorkflowDefinition[], now: Date, options: PumpOptions = {}) {
  const store = createWorkflowStore(state, workflows);
  for (const lead of state.leads) {
    const stamp = now.toISOString();
    const event = emitEvent(store, {
      id: `cron-${stamp}-${lead.id}`,
      type: "schedule.cron",
      subjectId: lead.id,
      subjectType: "lead",
      occurredAt: stamp,
      idempotencyKey: `cron-${stamp}-${lead.id}`,
      payload: {},
    });
    enqueueEvent(store, event);
  }
  const executed = runUntilIdle(store, now, options);
  return { state: store.state, executed, store };
}

export type DryStep = {
  id: string;
  title: string;
  status: StepLog["status"];
  detail: Record<string, unknown>;
};

export function dryRunWorkflow(
  workflow: WorkflowDefinition,
  state: AutomationState,
  subjectId: string,
  now: Date,
  payload: Record<string, unknown> = {},
) {
  const snapshot = structuredClone(state);
  const store = dispatchEvent(
    snapshot,
    [{ ...workflow, active: true }],
    {
      type: workflow.trigger_type,
      subjectId,
      occurredAt: now.toISOString(),
      id: `dry-${subjectId}`,
      payload,
    },
    { dryRun: true },
  );
  const steps: DryStep[] = store.logs.map((log) => ({
    id: log.stepId,
    title: workflow.steps.find((step) => step.id === log.stepId)?.title || log.stepId,
    status: log.status,
    detail: log.detail,
  }));
  return {
    steps,
    sent: false,
    outboxUnchanged: true,
    originalOutbox: state.outbox.length,
    planned: steps.filter((step) => step.detail.planned === true || step.detail.queued || step.detail.sequence_step),
  };
}
