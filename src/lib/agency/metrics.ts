import { johannesburgDateKey } from "@/lib/automation/ids";

/** Half-open period [from, to). Same definition as public.period_metrics_for_org. */
export type PeriodInput = {
  from: string;
  to: string;
  leads: Array<{
    createdAt: string;
    stage: string;
    valueZar: number;
    wonAt?: string | null;
    stageChangedAt?: string | null;
  }>;
  messages: Array<{
    conversationId: string;
    direction: "in" | "out";
    channel: string;
    status: string;
    createdAt: string;
    outboxId?: string | null;
  }>;
  usage: Array<{
    meter: string;
    quantity: number;
    unitPriceCents: number;
    costCents: number;
    occurredAt: string;
  }>;
  consents: Array<{
    status: "opted_in" | "opted_out" | "requested";
    capturedAt: string;
    withdrawnAt?: string | null;
  }>;
  failedWorkflows: Array<{ updatedAt: string }>;
  outbox: Array<{ id: string; status: string; createdAt: string }>;
  subscriptionStatus: string | null;
};

export type PeriodMetrics = {
  newLeads: number;
  medianFirstResponseSeconds: number | null;
  openPipelineZar: number;
  wonZar: number;
  messagesByChannel: Record<string, number>;
  waSmsCostCents: number;
  waSmsBilledCents: number;
  optOutRate: number;
  optedOut: number;
  consentDecisions: number;
  blockedConsentCount: number;
  failedWorkflowRuns: number;
  outboxHeld: number;
  subscriptionStatus: string | null;
  unansweredOver2h: number;
  failedMessages: number;
  sparkline: number[];
};

export const CHANNELS = ["whatsapp", "sms", "email", "facebook", "instagram"] as const;
const OPEN_EXCLUDED = new Set(["Lost", "Won", "Onboarding/Handover"]);
const WON_STAGES = new Set(["Won", "Onboarding/Handover"]);
const NOT_A_REPLY = new Set(["blocked_consent", "cancelled", "failed"]);
const WA_SMS_METERS = new Set(["sms", "wa_marketing", "wa_utility", "wa_service"]);
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const PHASE_FROM = "2026-08-31T22:00:00.000Z";
export const PHASE_TO = "2026-09-03T22:00:00.000Z";

export const eastcPeriodFixture: PeriodInput = {
  from: PHASE_FROM,
  to: PHASE_TO,
  leads: [
    { createdAt: "2026-09-01T06:00:00.000Z", stage: "New", valueZar: 1000 },
    {
      createdAt: "2026-09-02T08:00:00.000Z",
      stage: "Won",
      valueZar: 2500,
      wonAt: "2026-09-02T13:00:00.000Z",
      stageChangedAt: "2026-09-02T13:00:00.000Z",
    },
    { createdAt: "2026-08-20T08:00:00.000Z", stage: "New", valueZar: 400 },
    { createdAt: "2026-09-03T07:00:00.000Z", stage: "Lost", valueZar: 900 },
    { createdAt: "2026-09-05T07:00:00.000Z", stage: "New", valueZar: 5000 },
  ],
  messages: [
    { conversationId: "conv-a", direction: "in", channel: "whatsapp", status: "received", createdAt: "2026-09-01T06:00:00.000Z" },
    { conversationId: "conv-a", direction: "out", channel: "whatsapp", status: "sent", createdAt: "2026-09-01T06:01:30.000Z" },
    { conversationId: "conv-b", direction: "in", channel: "sms", status: "received", createdAt: "2026-09-01T10:00:00.000Z" },
    {
      conversationId: "conv-b",
      direction: "out",
      channel: "sms",
      status: "blocked_consent",
      createdAt: "2026-09-02T10:00:00.000Z",
      outboxId: "ob-blocked",
    },
    { conversationId: "conv-c", direction: "in", channel: "email", status: "received", createdAt: "2026-09-03T20:30:00.000Z" },
    { conversationId: "conv-d", direction: "in", channel: "whatsapp", status: "received", createdAt: "2026-09-02T07:00:00.000Z" },
    { conversationId: "conv-d", direction: "out", channel: "whatsapp", status: "sent", createdAt: "2026-09-02T07:03:30.000Z" },
    { conversationId: "conv-e", direction: "out", channel: "whatsapp", status: "failed", createdAt: "2026-09-02T09:00:00.000Z" },
  ],
  usage: [
    { meter: "sms", quantity: 2, unitPriceCents: 36, costCents: 36, occurredAt: "2026-09-01T08:00:00.000Z" },
    { meter: "wa_utility", quantity: 1, unitPriceCents: 26, costCents: 13, occurredAt: "2026-09-02T08:00:00.000Z" },
    { meter: "email", quantity: 4, unitPriceCents: 2, costCents: 4, occurredAt: "2026-09-02T08:00:00.000Z" },
    { meter: "sms", quantity: 9, unitPriceCents: 36, costCents: 162, occurredAt: "2026-08-01T08:00:00.000Z" },
  ],
  consents: [
    { status: "opted_in", capturedAt: "2026-09-01T06:00:00.000Z" },
    { status: "opted_out", capturedAt: "2026-09-01T07:00:00.000Z", withdrawnAt: "2026-09-02T07:00:00.000Z" },
    { status: "opted_out", capturedAt: "2026-08-01T07:00:00.000Z", withdrawnAt: "2026-08-02T07:00:00.000Z" },
  ],
  failedWorkflows: [{ updatedAt: "2026-09-02T08:00:00.000Z" }],
  outbox: [
    { id: "ob-blocked", status: "blocked_consent", createdAt: "2026-09-02T10:00:00.000Z" },
    { id: "ob-blocked-2", status: "blocked_consent", createdAt: "2026-09-02T11:00:00.000Z" },
    { id: "ob-held-1", status: "held", createdAt: "2026-09-01T08:00:00.000Z" },
    { id: "ob-held-2", status: "held", createdAt: "2026-08-01T08:00:00.000Z" },
    { id: "ob-sent", status: "sent", createdAt: "2026-09-01T08:00:00.000Z" },
  ],
  subscriptionStatus: "past_due",
};

export const zentrixPeriodFixture: PeriodInput = {
  from: PHASE_FROM,
  to: PHASE_TO,
  leads: [{ createdAt: "2026-09-02T09:00:00.000Z", stage: "New", valueZar: 100 }],
  messages: [],
  usage: [],
  consents: [],
  failedWorkflows: [],
  outbox: [],
  subscriptionStatus: "active",
};

function inRange(iso: string | null | undefined, from: string, to: string) {
  if (!iso) return false;
  const time = Date.parse(iso);
  return time >= Date.parse(from) && time < Date.parse(to);
}

function addUtcDays(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function sparklineDays(from: string, to: string) {
  const start = johannesburgDateKey(new Date(from));
  const end = johannesburgDateKey(new Date(to));
  const days: string[] = [];
  let cursor = start;
  while (cursor < end && days.length < 400) {
    days.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return days.slice(-31);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function emptyChannels() {
  return Object.fromEntries(CHANNELS.map((channel) => [channel, 0]));
}

/** Per-workspace dashboard numbers for one period. The SQL rollup uses the same rules. */
export function periodMetrics(input: PeriodInput): PeriodMetrics {
  const { from, to } = input;
  const newLeads = input.leads.filter((lead) => inRange(lead.createdAt, from, to));
  const days = sparklineDays(from, to);
  const sparkline = days.map(
    (day) => newLeads.filter((lead) => johannesburgDateKey(new Date(lead.createdAt)) === day).length,
  );

  const openPipelineZar = input.leads
    .filter((lead) => !OPEN_EXCLUDED.has(lead.stage) && Date.parse(lead.createdAt) < Date.parse(to))
    .reduce((sum, lead) => sum + lead.valueZar, 0);
  const wonZar = input.leads
    .filter((lead) => {
      const when = lead.wonAt || lead.stageChangedAt || lead.createdAt;
      return WON_STAGES.has(lead.stage) && inRange(when, from, to);
    })
    .reduce((sum, lead) => sum + lead.valueZar, 0);

  const messagesByChannel = emptyChannels();
  for (const message of input.messages) {
    if (!inRange(message.createdAt, from, to)) continue;
    messagesByChannel[message.channel] = (messagesByChannel[message.channel] ?? 0) + 1;
  }

  const inbounds = input.messages.filter((message) => message.direction === "in" && inRange(message.createdAt, from, to));
  const seconds: number[] = [];
  let unansweredOver2h = 0;
  const toMs = Date.parse(to);
  for (const inbound of inbounds) {
    const inboundMs = Date.parse(inbound.createdAt);
    const reply = input.messages
      .filter(
        (message) =>
          message.direction === "out" &&
          message.conversationId === inbound.conversationId &&
          Date.parse(message.createdAt) >= inboundMs &&
          !NOT_A_REPLY.has(message.status),
      )
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))[0];
    if (reply) seconds.push((Date.parse(reply.createdAt) - inboundMs) / 1000);
    const repliedInTime = reply ? Date.parse(reply.createdAt) <= inboundMs + TWO_HOURS_MS : false;
    if (!repliedInTime && inboundMs + TWO_HOURS_MS <= toMs) unansweredOver2h += 1;
  }

  const waSms = input.usage.filter((row) => WA_SMS_METERS.has(row.meter) && inRange(row.occurredAt, from, to));
  const optedOut = input.consents.filter(
    (row) => row.status === "opted_out" && inRange(row.withdrawnAt || row.capturedAt, from, to),
  ).length;
  const consentDecisions = input.consents.filter(
    (row) => inRange(row.capturedAt, from, to) || (row.status === "opted_out" && inRange(row.withdrawnAt || row.capturedAt, from, to)),
  ).length;
  const linkedOutbox = new Set(input.messages.map((message) => message.outboxId).filter((id): id is string => Boolean(id)));
  const blockedMessages = input.messages.filter(
    (message) => message.status === "blocked_consent" && inRange(message.createdAt, from, to),
  ).length;
  const blockedOutbox = input.outbox.filter(
    (row) => row.status === "blocked_consent" && inRange(row.createdAt, from, to) && !linkedOutbox.has(row.id),
  ).length;

  return {
    newLeads: newLeads.length,
    medianFirstResponseSeconds: median(seconds),
    openPipelineZar,
    wonZar,
    messagesByChannel,
    waSmsCostCents: waSms.reduce((sum, row) => sum + row.costCents, 0),
    waSmsBilledCents: waSms.reduce((sum, row) => sum + row.unitPriceCents * row.quantity, 0),
    optOutRate: consentDecisions === 0 ? 0 : Math.round((optedOut / consentDecisions) * 10000) / 10000,
    optedOut,
    consentDecisions,
    blockedConsentCount: blockedMessages + blockedOutbox,
    failedWorkflowRuns: input.failedWorkflows.filter((row) => inRange(row.updatedAt, from, to)).length,
    outboxHeld: input.outbox.filter((row) => row.status === "held").length,
    subscriptionStatus: input.subscriptionStatus,
    unansweredOver2h,
    failedMessages: input.messages.filter((message) => message.status === "failed" && inRange(message.createdAt, from, to)).length,
    sparkline,
  };
}

export type RedFlag = "no_reply_2h" | "failures" | "past_due";

export function redFlags(metrics: PeriodMetrics): RedFlag[] {
  const flags: RedFlag[] = [];
  if (metrics.unansweredOver2h > 0) flags.push("no_reply_2h");
  if (metrics.failedWorkflowRuns > 0 || metrics.failedMessages > 0) flags.push("failures");
  if (metrics.subscriptionStatus === "past_due") flags.push("past_due");
  return flags;
}

export function formatDuration(seconds: number | null) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  if (minutes < 60) return remain ? `${minutes}m ${remain}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const minuteRemain = minutes % 60;
  return minuteRemain ? `${hours}h ${minuteRemain}m` : `${hours}h`;
}

export function formatCents(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(cents / 100);
}

export function messageSummary(counts: Record<string, number>) {
  const labels: Record<string, string> = { whatsapp: "WA", sms: "SMS", email: "Email", facebook: "FB", instagram: "IG" };
  return CHANNELS.map((channel) => `${labels[channel]} ${counts[channel] ?? 0}`).join(" · ");
}

export function parsePeriodMetrics(value: unknown): PeriodMetrics | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const channels = emptyChannels();
  const rawChannels = row.messages_by_channel;
  if (rawChannels && typeof rawChannels === "object") {
    for (const [key, count] of Object.entries(rawChannels as Record<string, unknown>)) {
      channels[key] = Number(count) || 0;
    }
  }
  const sparkline = Array.isArray(row.sparkline) ? row.sparkline.map((item) => Number(item) || 0) : [];
  const medianValue = row.median_first_response_seconds;
  return {
    newLeads: Number(row.new_leads) || 0,
    medianFirstResponseSeconds: medianValue == null ? null : Number(medianValue),
    openPipelineZar: Number(row.open_pipeline_zar) || 0,
    wonZar: Number(row.won_zar) || 0,
    messagesByChannel: channels,
    waSmsCostCents: Number(row.wa_sms_cost_cents) || 0,
    waSmsBilledCents: Number(row.wa_sms_billed_cents) || 0,
    optOutRate: Number(row.opt_out_rate) || 0,
    optedOut: Number(row.opted_out) || 0,
    consentDecisions: Number(row.consent_decisions) || 0,
    blockedConsentCount: Number(row.blocked_consent_count) || 0,
    failedWorkflowRuns: Number(row.failed_workflow_runs) || 0,
    outboxHeld: Number(row.outbox_held) || 0,
    subscriptionStatus: row.subscription_status == null || row.subscription_status === "" ? null : String(row.subscription_status),
    unansweredOver2h: Number(row.unanswered_over_2h) || 0,
    failedMessages: Number(row.failed_messages) || 0,
    sparkline,
  };
}

export function metricsMatch(left: PeriodMetrics, right: PeriodMetrics) {
  const keys = Object.keys(left) as (keyof PeriodMetrics)[];
  return keys.every((key) => {
    const a = left[key];
    const b = right[key];
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.001;
    return JSON.stringify(a) === JSON.stringify(b);
  });
}

export function zonedDayStart(ymd: string) {
  return new Date(`${ymd}T00:00:00+02:00`).toISOString();
}

export function periodBounds(input: { from?: string; to?: string } | null | undefined, now = new Date()) {
  const toDay = input?.to && /^\d{4}-\d{2}-\d{2}$/.test(input.to) ? input.to : johannesburgDateKey(now);
  const fromDay = input?.from && /^\d{4}-\d{2}-\d{2}$/.test(input.from) ? input.from : addUtcDays(toDay, -13);
  return {
    from: zonedDayStart(fromDay),
    to: zonedDayStart(addUtcDays(toDay, 1)),
    fromDay,
    toDay,
  };
}
