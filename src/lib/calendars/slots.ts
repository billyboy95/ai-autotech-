export type WeeklyWindow = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export type ExceptionWindow = {
  date: string;
  available: boolean;
  startMinute: number | null;
  endMinute: number | null;
};

export type BusyRange = {
  startsAt: string;
  endsAt: string;
  bufferBefore: number;
  bufferAfter: number;
};

export type SlotInput = {
  timezone: string;
  fromDate: string;
  days: number;
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  weekly: WeeklyWindow[];
  exceptions: ExceptionWindow[];
  busy: BusyRange[];
  now?: Date;
  stepMinutes?: number;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour) % 24;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

function tzOffsetMinutes(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

export function zonedTimeToUtc(isoDate: string, minuteOfDay: number, timeZone: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMinutes(new Date(utcGuess), timeZone);
  let utc = utcGuess - offset * 60_000;
  const corrected = tzOffsetMinutes(new Date(utc), timeZone);
  if (corrected !== offset) utc = utcGuess - corrected * 60_000;
  return new Date(utc);
}

export function todayInZone(timeZone: string, now = new Date()) {
  const parts = zonedParts(now, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function weekdayOf(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function formatMinute(minute: number) {
  const hour = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function parseMinute(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatSlot(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function windowsForDate(date: string, weekly: WeeklyWindow[], exceptions: ExceptionWindow[]) {
  const matches = exceptions.filter((item) => item.date === date);
  if (matches.length) {
    if (matches.some((item) => !item.available)) return [];
    return matches
      .filter((item) => item.startMinute != null && item.endMinute != null)
      .map((item) => ({ startMinute: item.startMinute as number, endMinute: item.endMinute as number }));
  }
  const weekday = weekdayOf(date);
  return weekly
    .filter((item) => item.weekday === weekday)
    .map((item) => ({ startMinute: item.startMinute, endMinute: item.endMinute }));
}

function overlapsBusy(start: Date, end: Date, before: number, after: number, busy: BusyRange[]) {
  const left = start.getTime() - before * 60_000;
  const right = end.getTime() + after * 60_000;
  return busy.some((item) => {
    const startMs = Date.parse(item.startsAt);
    const endMs = Date.parse(item.endsAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
    const otherLeft = startMs - item.bufferBefore * 60_000;
    const otherRight = endMs + item.bufferAfter * 60_000;
    return left < otherRight && otherLeft < right;
  });
}

export function openSlots(input: SlotInput) {
  const step = input.stepMinutes && input.stepMinutes > 0 ? input.stepMinutes : 15;
  const now = input.now ?? new Date();
  const slots: string[] = [];
  for (let offset = 0; offset < input.days; offset += 1) {
    const date = addDays(input.fromDate, offset);
    for (const window of windowsForDate(date, input.weekly, input.exceptions)) {
      for (let minute = window.startMinute; minute + input.durationMinutes <= window.endMinute; minute += step) {
        const start = zonedTimeToUtc(date, minute, input.timezone);
        if (start.getTime() <= now.getTime()) continue;
        const end = new Date(start.getTime() + input.durationMinutes * 60_000);
        if (overlapsBusy(start, end, input.bufferBefore, input.bufferAfter, input.busy)) continue;
        slots.push(start.toISOString());
      }
    }
  }
  return slots;
}

export const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const LOCATION_MODES = ["phone", "video", "in_person", "custom"] as const;

export function locationLabel(mode: string) {
  if (mode === "in_person") return "In person";
  if (mode === "video") return "Video";
  if (mode === "custom") return "Custom";
  return "Phone";
}
