/**
 * Inbox snooze for /command-centre/inbox.
 * Off unless INBOX_SNOOZE_ENABLED is the exact string true after trim.
 * True, TRUE, 1, yes, blank, and unset stay off.
 * With the flag off, the list, chips, and thread fetch stay the ones main
 * already uses. Snooze does not insert crm_outbox, call a provider, or
 * change consent.
 */

import { formatWhen } from "@/lib/automation/ids";

export const INBOX_SNOOZE_FLAG = "INBOX_SNOOZE_ENABLED";

export const INBOX_SNOOZE_MIGRATION = "supabase/migrations/20261117120000_inbox_snooze.sql";

export const SNOOZE_COLUMN_MISSING =
  "Snooze needs conversations.snoozed_until. Apply supabase/migrations/20261117120000_inbox_snooze.sql after Billy says yes. Nothing was sent.";

export const INBOX_SNOOZE_SIDE_EFFECTS = {
  sends: false,
  outboxInsert: false,
  consentChange: false,
} as const;

export const SNOOZE_PRESETS = [
  { id: "1h", label: "1 hour" },
  { id: "later_today", label: "Later today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "next_week", label: "Next week" },
  { id: "clear", label: "Clear snooze" },
] as const;

export type SnoozePreset = (typeof SNOOZE_PRESETS)[number]["id"];

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function inboxSnoozeEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_SNOOZE_FLAG] ?? "").trim() === "true";
}

export function missingSnoozeColumn(message: string) {
  const text = message.toLowerCase();
  return text.includes("snoozed_until") && (text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find"));
}

export function isSnoozeActive(snoozedUntil: string | null | undefined, now: Date) {
  if (!snoozedUntil) return false;
  const time = new Date(snoozedUntil).getTime();
  if (!Number.isFinite(time) || !Number.isFinite(now.getTime())) return false;
  return time > now.getTime();
}

export function activeSnoozeLabel(snoozedUntil: string | null | undefined, now: Date) {
  if (!isSnoozeActive(snoozedUntil, now) || !snoozedUntil) return null;
  return formatWhen(snoozedUntil);
}

export function parseSnoozePreset(value: string | null | undefined): SnoozePreset | null {
  const preset = String(value ?? "").trim();
  if (preset === "1h" || preset === "later_today" || preset === "tomorrow" || preset === "next_week" || preset === "clear") {
    return preset;
  }
  return null;
}

export function snoozeUntil(preset: SnoozePreset, now: Date) {
  if (!Number.isFinite(now.getTime())) return null;
  if (preset === "clear") return null;
  if (preset === "1h") return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const parts = johannesburgParts(now);
  if (preset === "later_today") {
    const later = atJohannesburg(parts.year, parts.month, parts.day, 18, 0);
    if (later.getTime() > now.getTime()) return later.toISOString();
    const next = addDays(parts.year, parts.month, parts.day, 1);
    return atJohannesburg(next.year, next.month, next.day, 9, 0).toISOString();
  }
  if (preset === "tomorrow") {
    const next = addDays(parts.year, parts.month, parts.day, 1);
    return atJohannesburg(next.year, next.month, next.day, 9, 0).toISOString();
  }
  const index = WEEKDAY[parts.weekday];
  if (index == null) return null;
  let delta = (8 - index) % 7;
  if (delta === 0) delta = 7;
  const monday = addDays(parts.year, parts.month, parts.day, delta);
  return atJohannesburg(monday.year, monday.month, monday.day, 9, 0).toISOString();
}

export function planInboxSnooze(input: { preset: string | null | undefined; now: Date }) {
  const preset = parseSnoozePreset(input.preset);
  if (!preset || !Number.isFinite(input.now.getTime())) {
    return { ok: false as const, message: "Choose a snooze time.", ...INBOX_SNOOZE_SIDE_EFFECTS };
  }
  const until = snoozeUntil(preset, input.now);
  if (preset !== "clear" && !until) {
    return { ok: false as const, message: "Choose a snooze time.", ...INBOX_SNOOZE_SIDE_EFFECTS };
  }
  return {
    ok: true as const,
    preset,
    snoozedUntil: until,
    notice: until ? `Snoozed until ${formatWhen(until)}. Nothing was sent.` : "Snooze cleared. Nothing was sent.",
    ...INBOX_SNOOZE_SIDE_EFFECTS,
  };
}

function johannesburgParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const bag = new Map(fmt.formatToParts(now).map((part) => [part.type, part.value]));
  let hour = Number(bag.get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.get("year")),
    month: Number(bag.get("month")),
    day: Number(bag.get("day")),
    hour,
    minute: Number(bag.get("minute")),
    weekday: bag.get("weekday") || "",
  };
}

function atJohannesburg(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(Date.UTC(year, month - 1, day, hour - 2, minute, 0, 0));
}

function addDays(year: number, month: number, day: number, days: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}
