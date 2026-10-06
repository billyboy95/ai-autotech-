import type { EnvLike } from "@/lib/automation/channels";
import { seededSnapshotOptions } from "@/lib/snapshots/catalog";
import { emptySwap, normalizeSwap, validateSwap, type BusinessSwap } from "@/lib/snapshots/swap";

export const FREE_TRIAL_FLAG = "FREE_TRIAL_ENABLED";
export const FREE_TRIAL_DAYS_FLAG = "FREE_TRIAL_DAYS";
export const DEFAULT_TRIAL_DAYS = 14;
export const TRIAL_WARN_DAYS = 2;
export const TRIAL_RATE_WINDOW_MS = 10 * 60 * 1000;
export const TRIAL_RATE_MAX = 5;
export const TRIAL_UPGRADE_HREF = "/command-centre/billing";

export const FREE_TRIAL_UNAVAILABLE = "The free trial is not available yet. Nothing was created.";

export const POPIA_TRIAL_CONSENT =
  "I consent to AI AutoTech processing my name, email, phone, and business name to open this free trial, under POPIA. I can ask for the workspace to be closed. This form does not send email, SMS, or WhatsApp.";

export type TrialNiche = {
  id: string;
  name: string;
  description: string;
};

export type TrialStatus = "trialing" | "paused";

export type TrialBanner = {
  text: string;
  tone: "warn" | "block";
  href: string;
};

export type TrialStartInput = {
  snapshotId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  password: string;
  popia: boolean;
  honeypot: string;
  limited: boolean;
};

export type TrialDecision =
  | { ok: false; code: "disabled" | "invalid" | "rate" | "used"; message: string; stored: false }
  | { ok: true; code: "honeypot"; message: string; stored: false }
  | { ok: true; code: "ready"; message: string; stored: true; swap: BusinessSwap; days: number; snapshotId: string; email: string };

export function freeTrialEnabled(env: EnvLike = process.env) {
  return String(env[FREE_TRIAL_FLAG] ?? "").trim().toLowerCase() === "true";
}

export function trialLengthDays(env: EnvLike = process.env) {
  const raw = String(env[FREE_TRIAL_DAYS_FLAG] ?? "").trim();
  if (!raw) return DEFAULT_TRIAL_DAYS;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 90) return DEFAULT_TRIAL_DAYS;
  return days;
}

export function trialNicheOptions(): TrialNiche[] {
  return seededSnapshotOptions().map(({ id, name, description }) => ({ id, name, description }));
}

export function normalizeTrialEmail(email: string) {
  return email.trim().toLowerCase();
}

export function trialRateLimited(priorHits: number[], now: number) {
  const recent = priorHits.filter((hit) => now - hit < TRIAL_RATE_WINDOW_MS);
  return recent.length >= TRIAL_RATE_MAX;
}

export function trialEmailBlock(status: TrialStatus | null) {
  if (status === "trialing") return "idempotent" as const;
  if (status === "paused") return "used" as const;
  return "ok" as const;
}

export function trialEndsAt(start: Date, days: number) {
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + days);
  return end;
}

export function trialDaysLeft(endsAt: string | Date, now = new Date()) {
  const end = endsAt instanceof Date ? endsAt.getTime() : new Date(endsAt).getTime();
  const ms = end - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export function trialBanner(input: { status: string; endsAt: string | Date; now?: Date }): TrialBanner | null {
  if (input.status === "paused") {
    return {
      tone: "block",
      href: TRIAL_UPGRADE_HREF,
      text: "This free trial has ended. The workspace is read-only. Your data is still here. Upgrade on the billing page. Nothing is charged.",
    };
  }
  if (input.status !== "trialing") return null;
  const days = trialDaysLeft(input.endsAt, input.now);
  const label = days === 1 ? "1 day left" : `${days} days left`;
  return {
    tone: "warn",
    href: TRIAL_UPGRADE_HREF,
    text: `Free trial: ${label}. Upgrade on the billing page. Plans stay in sandbox. Nothing is charged.`,
  };
}

export type TrialClockRow = {
  status: TrialStatus;
  endsAt: string;
  warningNotifiedAt: string | null;
};

export function planTrialExpiry(rows: TrialClockRow[], now: Date, warnDays = TRIAL_WARN_DAYS) {
  const warnBefore = now.getTime() + warnDays * 86_400_000;
  const pause: TrialClockRow[] = [];
  const warn: TrialClockRow[] = [];
  for (const row of rows) {
    if (row.status !== "trialing") continue;
    const end = new Date(row.endsAt).getTime();
    if (end <= now.getTime()) pause.push(row);
    else if (!row.warningNotifiedAt && end <= warnBefore) warn.push(row);
  }
  return { pause, warn, deleted: 0 as const };
}

function passwordIssue(password: string) {
  if (password.length < 8 || password.length > 72) return "Choose a password of 8 to 72 characters. No email is sent.";
  return "";
}

export function decideTrialStart(input: TrialStartInput, env: EnvLike = process.env): TrialDecision {
  if (!freeTrialEnabled(env)) {
    return { ok: false, code: "disabled", message: FREE_TRIAL_UNAVAILABLE, stored: false };
  }
  if (input.honeypot.trim()) {
    return { ok: true, code: "honeypot", message: "Your trial request was received.", stored: false };
  }
  if (!input.popia) {
    return { ok: false, code: "invalid", message: "POPIA consent is required.", stored: false };
  }
  const contact = input.contactName.trim();
  if (contact.length < 2 || contact.length > 80) {
    return { ok: false, code: "invalid", message: "Give your name.", stored: false };
  }
  const passwordError = passwordIssue(input.password);
  if (passwordError) return { ok: false, code: "invalid", message: passwordError, stored: false };
  const niches = new Set(trialNicheOptions().map((niche) => niche.id));
  if (!niches.has(input.snapshotId)) {
    return { ok: false, code: "invalid", message: "Pick a niche.", stored: false };
  }
  const swap = normalizeSwap({
    ...emptySwap(input.businessName),
    name: input.businessName,
    email: normalizeTrialEmail(input.email),
    phone: input.phone,
  });
  const issues = validateSwap(swap);
  if (issues.length) return { ok: false, code: "invalid", message: issues[0], stored: false };
  if (!swap.email) return { ok: false, code: "invalid", message: "The email address is not usable.", stored: false };
  if (!swap.phone) return { ok: false, code: "invalid", message: "The phone number is not usable.", stored: false };
  if (input.limited) {
    return { ok: false, code: "rate", message: "Too many trial requests. Please try again later.", stored: false };
  }
  return {
    ok: true,
    code: "ready",
    message: "",
    stored: true,
    swap,
    days: trialLengthDays(env),
    snapshotId: input.snapshotId,
    email: swap.email,
  };
}

export function trialAlreadyUsedMessage() {
  return "This email already used a free trial. Nothing new was created.";
}
