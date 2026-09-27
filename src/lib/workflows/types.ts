import type { SequenceStep } from "@/lib/automation/templates";

export const TRIGGER_TYPES = [
  "lead.created",
  "lead.stage_changed",
  "contact.tag_added",
  "form.submitted",
  "message.inbound",
  "message.no_reply",
  // Public calendar booking records this existing trigger. There is no appointment_booked value.
  "appointment.booked",
  "invoice.paid",
  "opt_out.received",
  "schedule.cron",
  "webhook.inbound",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export type FieldCompare = {
  kind: "field_compare";
  field: string;
  cmp: "eq" | "neq" | "gte" | "lte" | "gt" | "lt" | "contains" | "present" | "absent";
  value?: string;
};

export type Condition =
  | FieldCompare
  | { kind: "has_tag"; tag: string }
  | { kind: "stage_is"; stage: string }
  | { kind: "consent_ok"; channel: "whatsapp" | "email" | "sms" }
  | { kind: "within_business_hours"; timezone?: string; start?: string; end?: string; days?: number[] }
  | { kind: "reply_received" }
  | { kind: "and"; all: Condition[] }
  | { kind: "or"; any: Condition[] }
  | { kind: "not"; of: Condition };

export type AssignmentStrategy = "fixed" | "round_robin" | "least_loaded";

export type WorkflowRule = {
  name: string;
  match_source: string;
  match_qr_source: string;
  owner: string;
};

export type Action =
  | { kind: "send_message"; sequence_step: SequenceStep }
  | { kind: "move_stage"; stage?: string; from_event?: boolean; lost_reason?: string; value_from_event?: boolean }
  | { kind: "assign_owner"; strategy: AssignmentStrategy; default_owner?: string; rules?: WorkflowRule[] }
  | { kind: "add_tag"; tag?: string; from_event?: boolean }
  | { kind: "remove_tag"; tag: string }
  | { kind: "create_task"; title: string }
  | { kind: "update_field"; field: string; value?: string; from_event?: string }
  | { kind: "wait"; mode: "duration" | "until_time" | "until_event"; hours?: number; at?: string; event?: string; timeout_hours?: number }
  | { kind: "notify_user"; text: string }
  | { kind: "webhook_out"; url: string }
  | { kind: "handover" }
  | { kind: "end" };

export type Step = {
  id: string;
  title: string;
  condition?: Condition;
  yes?: string;
  no?: string;
  action?: Action;
  next?: string;
};

export type WorkflowDefinition = {
  id: string;
  asset_key: string;
  name: string;
  active: boolean;
  trigger_type: TriggerType;
  trigger: Record<string, unknown>;
  steps: Step[];
};

export type DomainEvent = {
  id: string;
  orgId: string;
  type: TriggerType;
  subjectType: string;
  subjectId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  idempotencyKey: string;
};

export type RunStatus = "pending" | "running" | "waiting" | "succeeded" | "failed" | "cancelled";

export type WorkflowRun = {
  id: string;
  orgId: string;
  workflowId: string;
  subjectId: string;
  eventId: string;
  dedupeKey: string;
  status: RunStatus;
  cursor: string;
  nextRunAt: string;
  attempt: number;
  context: Record<string, unknown>;
  lastError: string;
};

export type StepLog = {
  id: string;
  runId: string;
  stepId: string;
  status: "ok" | "failed" | "skipped" | "waiting" | "dry_run";
  attempt: number;
  error: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type WorkflowAlert = {
  id: string;
  runId: string;
  message: string;
  createdAt: string;
};

export const CLAIM_LIMIT = 100;
export const MAX_ATTEMPTS = 3;
export const DEFAULT_TIMEZONE = "Africa/Johannesburg";

export function dedupeKey(workflowId: string, subjectId: string, eventId: string) {
  return `${workflowId}:${subjectId}:${eventId}`;
}
