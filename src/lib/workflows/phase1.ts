import type { Action, Condition, Step, WorkflowDefinition, WorkflowRule } from "@/lib/workflows/types";

const QR_RULE: WorkflowRule = {
  name: "Billy phone QR",
  match_source: "",
  match_qr_source: "billy_phone_qr",
  owner: "Billy",
};

const ASSIGN: Action = {
  kind: "assign_owner",
  strategy: "fixed",
  default_owner: "Billy",
  rules: [QR_RULE],
};

const LOST_REASON = "No reply after the day 1, day 3 and day 7 follow-ups.";

function step(partial: Step): Step {
  return partial;
}

function and(all: Condition[]): Condition {
  return { kind: "and", all };
}

function or(any: Condition[]): Condition {
  return { kind: "or", any };
}

function not(of: Condition): Condition {
  return { kind: "not", of };
}

function field(fieldName: string, cmp: "eq" | "neq" | "gte" | "lte" | "gt" | "lt" | "present" | "absent", value?: string): Condition {
  return { kind: "field_compare", field: fieldName, cmp, value };
}

const END = step({ id: "end", title: "End", action: { kind: "end" } });

const PIPELINE_CRON: Step[] = [
  step({
    id: "enrolled",
    title: "Lead is enrolled",
    condition: field("enrolled", "eq", "true"),
    yes: "owner",
    no: "end",
  }),
  step({
    id: "owner",
    title: "Owner is missing",
    condition: field("owner_name", "absent"),
    yes: "assign",
    no: "open",
  }),
  step({ id: "assign", title: "Assign owner", action: ASSIGN, next: "open" }),
  step({
    id: "open",
    title: "Still open for follow-up",
    condition: and([
      not({ kind: "reply_received" }),
      not({ kind: "stage_is", stage: "Lost" }),
      not({ kind: "stage_is", stage: "Won" }),
      not({ kind: "stage_is", stage: "Onboarding/Handover" }),
    ]),
    yes: "follow-new",
    no: "stage-ack",
  }),
  step({
    id: "follow-new",
    title: "New lead sequence window",
    condition: and([
      or([{ kind: "stage_is", stage: "New" }, { kind: "stage_is", stage: "Contacted" }]),
      field("booked_at", "absent"),
    ]),
    yes: "ack",
    no: "audit",
  }),
  step({
    id: "ack",
    title: "Acknowledgement due",
    condition: field("sequence_step", "lt", "1"),
    yes: "send-ack",
    no: "day1",
  }),
  step({ id: "send-ack", title: "Queue acknowledgement", action: { kind: "send_message", sequence_step: "ack" }, next: "day1" }),
  step({
    id: "day1",
    title: "Day 1 nudge due",
    condition: and([field("age_hours", "gte", "24"), field("sequence_step", "lt", "2")]),
    yes: "send-day1",
    no: "day3",
  }),
  step({ id: "send-day1", title: "Queue day 1 nudge", action: { kind: "send_message", sequence_step: "day1" }, next: "day3" }),
  step({
    id: "day3",
    title: "Day 3 nudge due",
    condition: and([field("age_hours", "gte", "72"), field("sequence_step", "lt", "3")]),
    yes: "send-day3",
    no: "day7",
  }),
  step({ id: "send-day3", title: "Queue day 3 nudge", action: { kind: "send_message", sequence_step: "day3" }, next: "day7" }),
  step({
    id: "day7",
    title: "Day 7 nudge due",
    condition: and([field("age_hours", "gte", "168"), field("sequence_step", "lt", "4")]),
    yes: "send-day7",
    no: "audit",
  }),
  step({ id: "send-day7", title: "Queue day 7 nudge", action: { kind: "send_message", sequence_step: "day7" }, next: "audit" }),
  step({
    id: "audit",
    title: "Audit is within a day",
    condition: and([
      { kind: "stage_is", stage: "Audit booked" },
      field("hours_until_booking", "gt", "0"),
      field("hours_until_booking", "lte", "24"),
    ]),
    yes: "send-audit",
    no: "proposal",
  }),
  step({
    id: "send-audit",
    title: "Queue audit reminder",
    action: { kind: "send_message", sequence_step: "audit_reminder" },
    next: "proposal",
  }),
  step({
    id: "proposal",
    title: "Proposal follow-up due",
    condition: and([{ kind: "stage_is", stage: "Proposal sent" }, field("proposal_age_hours", "gte", "$proposal_followup_hours")]),
    yes: "send-proposal",
    no: "stage-ack",
  }),
  step({
    id: "send-proposal",
    title: "Queue proposal follow-up",
    action: { kind: "send_message", sequence_step: "proposal_followup" },
    next: "stage-ack",
  }),
  step({
    id: "stage-ack",
    title: "Acknowledgement is queued",
    condition: and([{ kind: "stage_is", stage: "New" }, field("ack_ready", "eq", "true")]),
    yes: "to-contacted",
    no: "stage-lost",
  }),
  step({ id: "to-contacted", title: "Move to Contacted", action: { kind: "move_stage", stage: "Contacted" }, next: "stage-lost" }),
  step({
    id: "stage-lost",
    title: "No reply after the sequence",
    condition: and([
      not({ kind: "reply_received" }),
      field("booked_at", "absent"),
      or([{ kind: "stage_is", stage: "New" }, { kind: "stage_is", stage: "Contacted" }]),
      field("day7_queued", "eq", "true"),
      field("age_hours", "gte", "$stale_cutoff_hours"),
    ]),
    yes: "to-lost",
    no: "handover-check",
  }),
  step({
    id: "to-lost",
    title: "Move to Lost",
    action: { kind: "move_stage", stage: "Lost", lost_reason: LOST_REASON },
    next: "handover-check",
  }),
  step({
    id: "handover-check",
    title: "Won deal has a handover",
    condition: and([{ kind: "stage_is", stage: "Won" }, field("handover_open", "eq", "true")]),
    yes: "to-handover",
    no: "end",
  }),
  step({ id: "to-handover", title: "Move into handover", action: { kind: "move_stage", stage: "Onboarding/Handover" }, next: "end" }),
  END,
];

function workflow(
  assetKey: string,
  name: string,
  trigger: WorkflowDefinition["trigger_type"],
  steps: Step[],
  triggerConfig: Record<string, unknown> = {},
  active = true,
): WorkflowDefinition {
  return {
    id: assetKey,
    asset_key: assetKey,
    name,
    active,
    trigger_type: trigger,
    trigger: triggerConfig,
    steps,
  };
}

export function phase1Workflows(): WorkflowDefinition[] {
  return [
    workflow("workflow:assign-and-ack", "Assign owner and queue acknowledgement", "lead.created", [
      step({ id: "assign", title: "Assign owner", action: ASSIGN, next: "send-ack" }),
      step({ id: "send-ack", title: "Queue acknowledgement", action: { kind: "send_message", sequence_step: "ack" }, next: "end" }),
      END,
    ]),
    workflow("workflow:pipeline-cron", "Stage rules, follow-ups, and handover", "schedule.cron", PIPELINE_CRON),
    workflow("workflow:appointment-booked", "Audit booked", "appointment.booked", [
      step({ id: "stop", title: "Stop follow-up nudges", action: { kind: "update_field", field: "cancel_nudges", value: "true" }, next: "book" }),
      step({ id: "book", title: "Store the booking time", action: { kind: "update_field", field: "booked_at", from_event: "starts_at" }, next: "stage" }),
      step({ id: "stage", title: "Move to Audit booked", action: { kind: "move_stage", stage: "Audit booked" }, next: "soon" }),
      step({
        id: "soon",
        title: "Reminder window",
        condition: and([field("hours_until_booking", "gt", "0"), field("hours_until_booking", "lte", "24")]),
        yes: "remind",
        no: "end",
      }),
      step({ id: "remind", title: "Queue audit reminder", action: { kind: "send_message", sequence_step: "audit_reminder" }, next: "end" }),
      END,
    ]),
    workflow("workflow:message-inbound", "Reply received", "message.inbound", [
      step({ id: "stop", title: "Stop follow-up nudges", action: { kind: "update_field", field: "cancel_nudges", value: "true" }, next: "reply" }),
      step({ id: "reply", title: "Record the reply", action: { kind: "update_field", field: "replied_at", value: "$now" }, next: "promote" }),
      step({
        id: "promote",
        title: "Still New",
        condition: { kind: "stage_is", stage: "New" },
        yes: "contacted",
        no: "end",
      }),
      step({ id: "contacted", title: "Move to Contacted", action: { kind: "move_stage", stage: "Contacted" }, next: "end" }),
      END,
    ]),
    workflow("workflow:opt-out", "Opt-out received", "opt_out.received", [
      step({ id: "stop", title: "Suppress and stop", action: { kind: "update_field", field: "opt_out", value: "true" }, next: "end" }),
      END,
    ]),
    workflow("workflow:stage-changed", "Stage change", "lead.stage_changed", [
      step({
        id: "won",
        title: "Marked won",
        condition: field("event_stage", "eq", "Won"),
        yes: "do-handover",
        no: "apply",
      }),
      step({ id: "do-handover", title: "Open handover", action: { kind: "handover" }, next: "end" }),
      step({
        id: "apply",
        title: "Apply the stage",
        action: { kind: "move_stage", from_event: true, value_from_event: true },
        next: "end",
      }),
      END,
    ]),
    workflow("workflow:tag-added", "Tag added", "contact.tag_added", [
      step({ id: "tag", title: "Add the tag", action: { kind: "add_tag", from_event: true }, next: "end" }),
      END,
    ]),
    workflow("workflow:form-submitted", "Form submitted", "form.submitted", [
      step({ id: "note", title: "Tell the owner", action: { kind: "notify_user", text: "A form was submitted." }, next: "end" }),
      END,
    ]),
    workflow("workflow:invoice-paid", "Invoice paid", "invoice.paid", [
      step({ id: "note", title: "Tell the owner", action: { kind: "notify_user", text: "An invoice was marked paid." }, next: "end" }),
      END,
    ]),
    workflow(
      "workflow:no-reply",
      "No reply",
      "message.no_reply",
      [
        step({
          id: "quiet",
          title: "Still no reply",
          condition: not({ kind: "reply_received" }),
          yes: "note",
          no: "end",
        }),
        step({ id: "note", title: "Tell the owner", action: { kind: "notify_user", text: "No reply yet." }, next: "end" }),
        END,
      ],
      { after_hours: 24 },
    ),
    workflow("workflow:webhook-inbound", "Inbound webhook", "webhook.inbound", [
      step({ id: "note", title: "Tell the owner", action: { kind: "notify_user", text: "An inbound webhook arrived." }, next: "end" }),
      END,
    ]),
  ];
}

export type SnapshotWorkflow = {
  asset_key: string;
  name: string;
  active: boolean;
  trigger_type: string;
  trigger: Record<string, unknown>;
  steps: Step[];
};

export function toSnapshotWorkflow(workflow: WorkflowDefinition): SnapshotWorkflow {
  return {
    asset_key: workflow.asset_key,
    name: workflow.name,
    active: workflow.active,
    trigger_type: workflow.trigger_type,
    trigger: workflow.trigger,
    steps: workflow.steps,
  };
}

export function phase1SnapshotWorkflows(): SnapshotWorkflow[] {
  return phase1Workflows().map(toSnapshotWorkflow);
}
