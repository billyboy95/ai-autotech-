/**
 * WhatsApp category, cost, and the monthly free service-message counter.
 * Unset, blank, or any value other than the string true keeps today's inbox.
 * The counter reads wa_service_sends_this_month when the org timezone is
 * Africa/Johannesburg. Otherwise it counts outbound service messages in the
 * org timezone. No Meta call. sending_enabled is not turned on. Nothing is sent.
 */

import { WHATSAPP_FREE_SERVICE_PER_MONTH, WHATSAPP_SERVICE_PRICING_START } from "@/lib/automation/compliance";
import { formatInboxCost, inboxCost } from "@/lib/inbox/rules";
import type { InboxWaServiceMeter } from "@/lib/inbox/types";

export const INBOX_WA_METERING_FLAG = "INBOX_WA_METERING_ENABLED";
export const WA_METER_TIMEZONE = "Africa/Johannesburg";
export const WA_SERVICE_COUNT_STATUSES = ["queued", "held", "sent"] as const;

const CATEGORIES = ["marketing", "utility", "authentication", "service"] as const;
export type KnownWaCategory = (typeof CATEGORIES)[number];

const COUNTED = new Set<string>(WA_SERVICE_COUNT_STATUSES);

export function inboxWaMeteringEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_WA_METERING_FLAG] ?? "").trim().toLowerCase() === "true";
}

export function knownWaCategory(value: string): KnownWaCategory | "" {
  const category = value.trim().toLowerCase();
  return (CATEGORIES as readonly string[]).includes(category) ? (category as KnownWaCategory) : "";
}

export function meteringTimezone(value: string | null | undefined) {
  const zone = String(value ?? "").trim();
  if (!zone) return WA_METER_TIMEZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone }).format(0);
    return zone;
  } catch {
    return WA_METER_TIMEZONE;
  }
}

export function monthKeyInZone(now: Date, timezone: string) {
  const zone = meteringTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function zoneOffsetMs(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  let hour = value("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second"));
  return asUtc - date.getTime();
}

/** First instant of a calendar month in the given timezone, as a UTC Date. */
export function zonedMonthStart(year: number, month: number, timezone: string) {
  const zone = meteringTimezone(timezone);
  const utcGuess = Date.UTC(year, month - 1, 1, 0, 0, 0);
  const start = new Date(utcGuess - zoneOffsetMs(new Date(utcGuess), zone));
  return new Date(utcGuess - zoneOffsetMs(start, zone));
}

export function monthWindow(now: Date, timezone: string) {
  const zone = meteringTimezone(timezone);
  const monthKey = monthKeyInZone(now, zone);
  const [year, month] = monthKey.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return {
    monthKey,
    timezone: zone,
    start: zonedMonthStart(year, month, zone).toISOString(),
    end: zonedMonthStart(nextYear, nextMonth, zone).toISOString(),
  };
}

export type WaOutboundMeter = {
  category: KnownWaCategory;
  cents: number;
  source: "stored" | "estimated";
  label: string;
};

/**
 * Outbound WhatsApp only. Blank category, inbound, and other channels return null
 * so the thread can hide the line. A stored cost (including R0.00 service) wins.
 * A billable category stored at 0 cents uses the rate card and is marked estimated.
 */
export function outboundWaMessageMeter(
  message: { direction: string; channel: string; waCategory: string; costCents: number },
  now: Date,
): WaOutboundMeter | null {
  if (message.direction !== "out" || message.channel !== "whatsapp") return null;
  const category = knownWaCategory(message.waCategory);
  if (!category) return null;
  const raw = Number(message.costCents);
  if (!Number.isFinite(raw)) return null;
  const stored = Math.max(0, Math.round(raw));
  if (stored > 0 || category === "service") {
    return {
      category,
      cents: stored,
      source: "stored",
      label: `WhatsApp · ${formatInboxCost({ cents: stored, label: category })}`,
    };
  }
  const estimate = inboxCost({
    channel: "whatsapp",
    waCategory: category,
    now,
    serviceSendsThisMonth: 0,
  });
  const rand = `R${(estimate.cents / 100).toFixed(2)}`;
  return {
    category,
    cents: estimate.cents,
    source: "estimated",
    label: `WhatsApp · ${category} · est. ${rand}`,
  };
}

export type ServiceSendRow = {
  direction: string;
  channel: string;
  waCategory: string;
  status: string;
  createdAt: string;
  connectionId: string | null;
};

/** Outbound WhatsApp service rows in queued, held, or sent, for the calendar month. */
export function countServiceSendsByConnection(
  rows: readonly ServiceSendRow[],
  input: { now: Date; timezone: string },
) {
  const month = monthKeyInZone(input.now, input.timezone);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.connectionId) continue;
    if (row.direction !== "out" || row.channel !== "whatsapp") continue;
    if (knownWaCategory(row.waCategory) !== "service") continue;
    if (!COUNTED.has(row.status)) continue;
    const at = new Date(row.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    if (monthKeyInZone(at, input.timezone) !== month) continue;
    counts[row.connectionId] = (counts[row.connectionId] ?? 0) + 1;
  }
  return counts;
}

export function waMeterNumbers(input: {
  connections: readonly { id: string; channel: string; label: string }[];
  whatsappNumbers: readonly { id: string; label: string }[];
  threadChannel?: string;
  threadConnectionId?: string | null;
}) {
  const labels = new Map<string, string>();
  for (const item of input.connections) {
    if (item.channel === "whatsapp" && item.id) labels.set(item.id, item.label);
  }
  for (const item of input.whatsappNumbers) {
    if (item.id) labels.set(item.id, item.label);
  }
  if (input.threadChannel === "whatsapp" && input.threadConnectionId && !labels.has(input.threadConnectionId)) {
    labels.set(input.threadConnectionId, "This WhatsApp number");
  }
  return [...labels.entries()].map(([id, label]) => ({ id, label }));
}

export function buildServiceMeters(input: {
  numbers: readonly { id: string; label: string }[];
  counts: Record<string, number> | null;
  timezone: string;
  now: Date;
}): InboxWaServiceMeter[] {
  const timezone = meteringTimezone(input.timezone);
  const monthKey = monthKeyInZone(input.now, timezone);
  return [...input.numbers]
    .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
    .map((number) => ({
      connectionId: number.id,
      label: number.label,
      used: input.counts == null ? null : (input.counts[number.id] ?? 0),
      allowance: WHATSAPP_FREE_SERVICE_PER_MONTH,
      timezone,
      monthKey,
    }));
}

export function serviceCounterText(meter: Pick<InboxWaServiceMeter, "label" | "used" | "allowance" | "monthKey">) {
  if (meter.used == null) return `${meter.label} · counter unavailable this month.`;
  return `${meter.label} · ${meter.used} / ${meter.allowance} free service messages · ${meter.monthKey}`;
}

export function freeServiceStartNote(monthKey: string) {
  const start = WHATSAPP_SERVICE_PRICING_START.slice(0, 7);
  if (!monthKey || monthKey >= start) return "";
  return "The 1,000 free service messages per WhatsApp number start on 1 Oct 2026. Nothing is sent.";
}
