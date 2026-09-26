import assert from "node:assert/strict";
import test from "node:test";
import { proveAutomation } from "@/lib/automation/scenario";
import { createInitialState } from "@/lib/automation/engine";
import { consentOk, withinBusinessHours } from "@/lib/workflows/conditions";
import { isWorkflowEngineEnabled } from "@/lib/workflows/flag";
import { signWebhookBody } from "@/lib/workflows/hmac";
import { phase1SnapshotWorkflows, phase1Workflows } from "@/lib/workflows/phase1";
import { proveAutomationViaWorkflows } from "@/lib/workflows/replay";
import { claimDueRuns, createWorkflowStore, dryRunWorkflow, emitEvent, enqueueEvent, pump } from "@/lib/workflows/runner";
import type { Step, WorkflowDefinition } from "@/lib/workflows/types";
import { emptyLead } from "@/lib/automation/types";

function outboxSignature(state: ReturnType<typeof proveAutomation>["state"]) {
  return state.outbox
    .map((message) => `${message.leadId}|${message.templateKey}|${message.channel}|${message.status}`)
    .sort();
}

function leadSignature(state: ReturnType<typeof proveAutomation>["state"]) {
  return state.leads
    .map((lead) =>
      [
        lead.id,
        lead.stage,
        lead.ownerName,
        lead.lostReason,
        lead.sequenceStep,
        lead.valueZar,
        lead.bookedAt,
        lead.repliedAt ? "replied" : "",
        lead.wonAt ? "won" : "",
      ].join("|"),
    )
    .sort();
}

test("phase 1 stage, sequence, and outbox match after the workflow migration path", () => {
  const phase1 = proveAutomation();
  const migrated = proveAutomationViaWorkflows();
  assert.deepEqual(outboxSignature(migrated), outboxSignature(phase1.state));
  assert.deepEqual(leadSignature(migrated), leadSignature(phase1.state));
  assert.equal(migrated.handovers.length, phase1.state.handovers.length);
  assert.equal(migrated.tasks.length, phase1.state.tasks.length);
  assert.equal(migrated.quotes.length, phase1.state.quotes.length);
  assert.ok(migrated.quotes.every((quote) => quote.status === "Draft"));
  assert.ok(migrated.outbox.every((message) => message.status !== "sent"));
  assert.equal(migrated.leads.find((lead) => lead.id === "lead-thabo")?.stage, "Onboarding/Handover");
  assert.equal(migrated.leads.find((lead) => lead.id === "lead-cafe")?.stage, "Lost");
});

test("one event enqueued twice creates exactly one run", () => {
  const workflow = phase1Workflows().find((item) => item.asset_key === "workflow:form-submitted");
  assert.ok(workflow);
  const store = createWorkflowStore(createInitialState(), [workflow]);
  const event = emitEvent(store, {
    id: "evt-once",
    type: "form.submitted",
    subjectId: "lead-1",
    occurredAt: "2026-09-26T08:00:00.000Z",
    idempotencyKey: "form-lead-1",
  });
  assert.equal(enqueueEvent(store, event), 1);
  assert.equal(enqueueEvent(store, event), 0);
  const again = emitEvent(store, {
    id: "evt-other",
    type: "form.submitted",
    subjectId: "lead-1",
    occurredAt: "2026-09-26T08:00:00.000Z",
    idempotencyKey: "form-lead-1",
  });
  assert.equal(again.id, event.id);
  assert.equal(enqueueEvent(store, again), 0);
  assert.equal(store.runs.length, 1);
  assert.equal(store.runs[0].dedupeKey, `${workflow.id}:lead-1:evt-once`);
});

test("a failed step stays in the run log and a later try succeeds", () => {
  const workflow: WorkflowDefinition = {
    id: "workflow:flaky",
    asset_key: "workflow:flaky",
    name: "Flaky",
    active: true,
    trigger_type: "webhook.inbound",
    trigger: {},
    steps: [
      { id: "work", title: "Work", action: { kind: "notify_user", text: "done" }, next: "end" },
      { id: "end", title: "End", action: { kind: "end" } },
    ],
  };
  const store = createWorkflowStore(createInitialState(), [workflow]);
  const event = emitEvent(store, {
    id: "evt-flaky",
    type: "webhook.inbound",
    subjectId: "lead-1",
    occurredAt: "2026-09-26T08:00:00.000Z",
  });
  enqueueEvent(store, event);
  const now = new Date("2026-09-26T08:00:00.000Z");
  pump(store, now, {
    baseRetryMs: 1000,
    failStep(step, attempt) {
      if (step.id === "work" && attempt < 1) throw new Error("upstream timed out");
    },
  });
  assert.equal(store.logs.some((log) => log.stepId === "work" && log.status === "failed" && log.error.includes("upstream")), true);
  assert.equal(store.runs[0].status, "pending");
  const retryAt = new Date(store.runs[0].nextRunAt);
  pump(store, retryAt, { baseRetryMs: 1000 });
  assert.equal(store.runs[0].status, "succeeded");
  assert.equal(store.logs.some((log) => log.stepId === "work" && log.status === "ok"), true);
  assert.equal(store.alerts.length, 0);
});

test("three failed tries mark the run failed and raise an alert", () => {
  const workflow: WorkflowDefinition = {
    id: "workflow:broken",
    asset_key: "workflow:broken",
    name: "Broken",
    active: true,
    trigger_type: "webhook.inbound",
    trigger: {},
    steps: [{ id: "work", title: "Work", action: { kind: "notify_user", text: "nope" }, next: "end" }],
  };
  const store = createWorkflowStore(createInitialState(), [workflow]);
  enqueueEvent(
    store,
    emitEvent(store, { id: "evt-broken", type: "webhook.inbound", subjectId: "lead-1", occurredAt: "2026-09-26T08:00:00.000Z" }),
  );
  let now = new Date("2026-09-26T08:00:00.000Z");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    pump(store, now, {
      baseRetryMs: 1000,
      failStep(step) {
        if (step.id === "work") throw new Error("still broken");
      },
    });
    now = new Date(store.runs[0].nextRunAt);
  }
  assert.equal(store.runs[0].status, "failed");
  assert.equal(store.logs.filter((log) => log.status === "failed").length, 3);
  assert.equal(store.alerts.length, 1);
  assert.match(store.alerts[0].message, /3 tries/);
});

test("dry run resolves steps and does not send or queue", () => {
  const fetches = 0;
  const workflow = phase1Workflows().find((item) => item.asset_key === "workflow:assign-and-ack");
  assert.ok(workflow);
  const state = createInitialState();
  state.leads.push(
    emptyLead({
      id: "lead-dry",
      name: "Amina",
      createdAt: "2026-09-26T08:00:00.000Z",
      phone: "0820000001",
      email: "amina@example.co.za",
      enrolled: true,
      stage: "New",
    }),
  );
  const before = state.outbox.length;
  const preview = dryRunWorkflow(workflow, state, "lead-dry", new Date("2026-09-26T08:00:00.000Z"));
  assert.equal(fetches, 0);
  assert.equal(state.outbox.length, before);
  assert.equal(preview.sent, false);
  assert.ok(preview.steps.some((step) => step.id === "send-ack" && step.detail.sent === false));
  assert.equal(preview.steps.some((step) => step.detail.delivered === true), false);
});

test("webhook action is signed and not delivered", () => {
  const workflow: WorkflowDefinition = {
    id: "workflow:hook",
    asset_key: "workflow:hook",
    name: "Hook",
    active: true,
    trigger_type: "webhook.inbound",
    trigger: {},
    steps: [
      { id: "post", title: "Post", action: { kind: "webhook_out", url: "https://example.com/hooks/workflow" }, next: "end" },
      { id: "end", title: "End", action: { kind: "end" } },
    ],
  };
  const store = createWorkflowStore(createInitialState(), [workflow]);
  enqueueEvent(
    store,
    emitEvent(store, { id: "evt-hook", type: "webhook.inbound", subjectId: "lead-1", occurredAt: "2026-09-26T08:00:00.000Z" }),
  );
  pump(store, new Date("2026-09-26T08:00:00.000Z"), { signingSecret: "test-key" });
  assert.equal(store.memory.webhooks.length, 1);
  assert.equal(store.memory.webhooks[0].delivered, false);
  const expected = signWebhookBody("test-key", store.memory.webhooks[0].body);
  assert.equal(store.memory.webhooks[0].signature, expected);
});

test("wait duration retries the run only after the delay", () => {
  const workflow: WorkflowDefinition = {
    id: "workflow:wait",
    asset_key: "workflow:wait",
    name: "Wait",
    active: true,
    trigger_type: "form.submitted",
    trigger: {},
    steps: [
      { id: "hold", title: "Hold", action: { kind: "wait", mode: "duration", hours: 2 }, next: "note" },
      { id: "note", title: "Note", action: { kind: "notify_user", text: "later" }, next: "end" },
      { id: "end", title: "End", action: { kind: "end" } },
    ],
  };
  const store = createWorkflowStore(createInitialState(), [workflow]);
  const start = new Date("2026-09-26T08:00:00.000Z");
  enqueueEvent(store, emitEvent(store, { id: "evt-wait", type: "form.submitted", subjectId: "lead-1", occurredAt: start.toISOString() }));
  pump(store, start);
  assert.equal(store.runs[0].status, "waiting");
  assert.equal(store.memory.notifications.length, 0);
  pump(store, new Date(start.getTime() + 60 * 60 * 1000));
  assert.equal(store.memory.notifications.length, 0);
  pump(store, new Date(start.getTime() + 2 * 60 * 60 * 1000));
  assert.equal(store.runs[0].status, "succeeded");
  assert.equal(store.memory.notifications.length, 1);
});

test("claim takes at most 100 due runs and skips ones already running", () => {
  const workflow = phase1Workflows()[0];
  const store = createWorkflowStore(createInitialState(), [workflow]);
  for (let index = 0; index < 120; index += 1) {
    const event = emitEvent(store, {
      id: `evt-${index}`,
      type: "lead.created",
      subjectId: `lead-${index}`,
      occurredAt: "2026-09-26T08:00:00.000Z",
    });
    enqueueEvent(store, event);
  }
  const first = claimDueRuns(store, new Date("2026-09-26T08:00:00.000Z"), 100);
  assert.equal(first.length, 100);
  assert.ok(first.every((run) => run.status === "running"));
  const second = claimDueRuns(store, new Date("2026-09-26T08:00:00.000Z"), 100);
  assert.equal(second.length, 20);
});

test("business hours use Africa/Johannesburg and consent blocks a suppressed channel", () => {
  const monday = new Date("2026-09-21T08:00:00.000Z");
  const saturday = new Date("2026-09-26T08:00:00.000Z");
  assert.equal(withinBusinessHours(monday), true);
  assert.equal(withinBusinessHours(saturday), false);
  const state = createInitialState();
  const lead = emptyLead({
    id: "lead-1",
    name: "Amina",
    createdAt: monday.toISOString(),
    phone: "0820000001",
    marketingConsent: false,
  });
  assert.equal(consentOk(state, lead, "whatsapp"), false);
  lead.marketingConsent = true;
  assert.equal(consentOk(state, lead, "whatsapp"), true);
});

test("the workflow engine flag stays off unless it is explicitly enabled", () => {
  assert.equal(isWorkflowEngineEnabled({}), false);
  assert.equal(isWorkflowEngineEnabled({ WORKFLOW_ENGINE_ENABLED: "false" }), false);
  assert.equal(isWorkflowEngineEnabled({ WORKFLOW_ENGINE_ENABLED: "true" }), true);
});

test("converted workflows cover the phase 1 triggers and stay free of private payload keys", () => {
  const keys = phase1SnapshotWorkflows().map((workflow) => workflow.asset_key);
  assert.ok(keys.includes("workflow:assign-and-ack"));
  assert.ok(keys.includes("workflow:pipeline-cron"));
  assert.ok(keys.includes("workflow:appointment-booked"));
  const encoded = JSON.stringify(phase1SnapshotWorkflows());
  assert.equal(encoded.includes("@"), false);
  assert.equal(/secret|token|password|credential/i.test(encoded), false);
  const steps = phase1Workflows().flatMap((workflow) => workflow.steps);
  assert.ok(steps.some((step: Step) => step.yes && step.no));
});
