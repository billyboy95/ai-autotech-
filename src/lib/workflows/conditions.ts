import { isSendEnabled, type EnvLike } from "@/lib/automation/channels";
import { matchingSuppression } from "@/lib/automation/compliance";
import type { AutomationState, LeadRecord } from "@/lib/automation/types";
import { DEFAULT_TIMEZONE, type Condition, type DomainEvent } from "@/lib/workflows/types";

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function withinBusinessHours(
  now: Date,
  timezone = DEFAULT_TIMEZONE,
  window: { start?: string; end?: string; days?: number[] } = {},
) {
  const start = minutes(window.start || "08:00");
  const end = minutes(window.end || "17:00");
  const days = window.days?.length ? window.days : [1, 2, 3, 4, 5];
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = WEEKDAY[bag.weekday] ?? 0;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const clock = hour * 60 + Number(bag.minute);
  return days.includes(weekday) && clock >= start && clock < end;
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  return hour * 60 + (minute || 0);
}

export function consentOk(state: AutomationState, lead: LeadRecord | undefined, channel: "whatsapp" | "email" | "sms") {
  if (!lead) return false;
  const address = channel === "email" ? lead.email : lead.whatsapp || lead.phone;
  if (!address.trim()) return false;
  if (matchingSuppression(state.suppressions || [], channel, address)) return false;
  return lead.marketingConsent === true;
}

export function evaluateCondition(
  condition: Condition | undefined,
  input: {
    state: AutomationState;
    lead: LeadRecord | undefined;
    event: DomainEvent;
    now: Date;
    tags: Set<string>;
    env?: EnvLike;
    timezone?: string;
  },
): boolean {
  if (!condition) return true;
  switch (condition.kind) {
    case "and":
      return condition.all.every((item) => evaluateCondition(item, input));
    case "or":
      return condition.any.some((item) => evaluateCondition(item, input));
    case "not":
      return !evaluateCondition(condition.of, input);
    case "has_tag":
      return input.tags.has(condition.tag);
    case "stage_is":
      return input.lead?.stage === condition.stage;
    case "consent_ok":
      return consentOk(input.state, input.lead, condition.channel);
    case "within_business_hours":
      return withinBusinessHours(input.now, condition.timezone || input.timezone || DEFAULT_TIMEZONE, condition);
    case "reply_received":
      return Boolean(input.lead?.repliedAt);
    case "field_compare":
      return compareField(condition, input);
    default:
      return false;
  }
}

function compareField(
  condition: Extract<Condition, { kind: "field_compare" }>,
  input: {
    state: AutomationState;
    lead: LeadRecord | undefined;
    event: DomainEvent;
    now: Date;
    env?: EnvLike;
  },
) {
  const actual = fieldValue(condition.field, input);
  if (condition.cmp === "present") return actual !== null && actual !== "";
  if (condition.cmp === "absent") return actual === null || actual === "";
  const expected = resolveExpected(condition.value, input);
  if (actual === null || expected === null) return false;
  if (condition.cmp === "contains") return actual.includes(expected);
  if (condition.cmp === "eq") return actual === expected;
  if (condition.cmp === "neq") return actual !== expected;
  const left = Number(actual);
  const right = Number(expected);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (condition.cmp === "gte") return left >= right;
  if (condition.cmp === "lte") return left <= right;
  if (condition.cmp === "gt") return left > right;
  return left < right;
}

function resolveExpected(
  value: string | undefined,
  input: { state: AutomationState; lead: LeadRecord | undefined; event: DomainEvent; now: Date; env?: EnvLike },
) {
  if (!value) return "";
  if (value.startsWith("$")) return fieldValue(value.slice(1), input);
  return value;
}

function fieldValue(
  field: string,
  input: { state: AutomationState; lead: LeadRecord | undefined; event: DomainEvent; now: Date; env?: EnvLike },
) {
  const lead = input.lead;
  const settings = input.state.settings;
  if (field === "stale_cutoff_hours") return String((7 + settings.staleGraceDays) * 24);
  if (field === "proposal_followup_hours") return String(settings.proposalFollowupDays * 24);
  if (field === "event_stage") return text(input.event.payload.stage);
  if (field === "event_value") return text(input.event.payload.value_zar);
  if (!lead) return null;
  if (field === "age_hours") return String((input.now.getTime() - new Date(lead.createdAt).getTime()) / 36e5);
  if (field === "sequence_step") return String(lead.sequenceStep);
  if (field === "hours_until_booking") {
    if (!lead.bookedAt) return null;
    return String((new Date(lead.bookedAt).getTime() - input.now.getTime()) / 36e5);
  }
  if (field === "proposal_age_hours") {
    if (!lead.proposalSentAt) return null;
    return String((input.now.getTime() - new Date(lead.proposalSentAt).getTime()) / 36e5);
  }
  if (field === "ack_ready") return ackReady(input.state, lead.id, input.env) ? "true" : "false";
  if (field === "day7_queued") return day7Queued(input.state, lead.id) ? "true" : "false";
  if (field === "handover_open") return input.state.handovers.some((item) => item.leadId === lead.id) ? "true" : "false";
  if (field === "enrolled") return lead.enrolled ? "true" : "false";
  if (field === "owner_name") return lead.ownerName.trim();
  if (field === "booked_at") return lead.bookedAt || "";
  if (field === "replied_at") return lead.repliedAt || "";
  if (field === "stage") return lead.stage;
  if (field === "value_zar") return String(lead.valueZar);
  if (field === "marketing_consent") return lead.marketingConsent ? "true" : "false";
  if (field === "source") return lead.source;
  if (field === "qr_source") return lead.qrSource;
  const record = lead as unknown as Record<string, unknown>;
  const raw = record[field];
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function ackReady(state: AutomationState, leadId: string, env?: EnvLike) {
  const acks = state.outbox.filter(
    (message) => message.leadId === leadId && message.templateKey.startsWith("ack_") && message.status !== "cancelled" && message.status !== "failed",
  );
  if (!acks.length) return false;
  if (isSendEnabled(env)) return acks.some((message) => message.status === "sent");
  return true;
}

function day7Queued(state: AutomationState, leadId: string) {
  return state.outbox.some(
    (message) => message.leadId === leadId && message.templateKey.startsWith("nudge_day7") && message.status !== "cancelled",
  );
}
