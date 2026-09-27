import { toE164 } from "@/lib/automation/channels";
import { evaluateSend } from "@/lib/compliance/send-gate";
export const REVIEW_REQUEST_BODY =
  "Hi {{name}}, how did we do at {{sender}}? Please leave a short review: {{link}}";

export function reviewRequestConsentText(senderName: string) {
  const sender = senderName.trim() || "This workspace";
  return `I confirm that this person agreed to a review request from ${sender} on this channel, and that they can reply STOP to opt out. This draft is not sent.`;
}

export function reviewPublicPath(slugOrToken: string) {
  return `/r/${slugOrToken}`;
}

export function canManageReviews(role: string | null | undefined) {
  return role === "agency_owner" || role === "agency_staff" || role === "client_admin";
}

export function missingReviewTable(message: string) {
  const text = message.toLowerCase();
  const missing = text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find");
  return missing && (text.includes("review") || text.includes("public_review"));
}

export function filterByRating<T extends { rating: number }>(rows: T[], rating: string | number | null | undefined) {
  const text = String(rating ?? "").trim();
  if (!/^[1-5]$/.test(text)) return { rows, rating: null as number | null };
  const value = Number(text);
  return { rows: rows.filter((row) => row.rating === value), rating: value };
}

export function reviewAggregate(rows: { rating: number }[]) {
  if (!rows.length) return { count: 0, average: null as number | null };
  const sum = rows.reduce((total, row) => total + row.rating, 0);
  return { count: rows.length, average: Math.round((sum / rows.length) * 10) / 10 };
}

export function normalizeReviewAddress(channel: string, address: string) {
  if (channel === "email") {
    const email = address.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return email;
  }
  if (channel !== "sms") return null;
  const phone = toE164(address);
  if (!/^\+[0-9]{8,15}$/.test(phone)) return null;
  return phone;
}

export function planReviewRequest(input: {
  channel: string;
  address: string;
  name: string;
  subject: string;
  body: string;
  senderName: string;
  consent: boolean;
  consentText: string;
  expectedConsentText: string;
  existingConsent: "opted_in" | "opted_out" | "requested" | "none";
  suppressed: boolean;
}) {
  const consentText = input.consentText.trim();
  if (!input.consent || consentText.length < 12 || consentText !== input.expectedConsentText.trim()) {
    return { ok: false as const, error: "Consent is required before a review request can be drafted. Nothing was written to the outbox." };
  }
  if (input.channel !== "email" && input.channel !== "sms") {
    return { ok: false as const, error: "Choose email or SMS. Nothing was written to the outbox." };
  }
  const address = normalizeReviewAddress(input.channel, input.address);
  if (!address) {
    return {
      ok: false as const,
      error: input.channel === "email"
        ? "Enter a valid email address. Nothing was written to the outbox."
        : "Enter a valid mobile number. Nothing was written to the outbox.",
    };
  }
  if (input.name.trim().length > 80) {
    return { ok: false as const, error: "The name is too long. Nothing was written to the outbox." };
  }
  if (input.suppressed || input.existingConsent === "opted_out") {
    return { ok: false as const, error: "This person has opted out or is suppressed. Nothing was written to the outbox." };
  }
  const sender = input.senderName.trim() || "This workspace";
  let body = input.body.trim() || REVIEW_REQUEST_BODY;
  if (!body.includes("{{link}}")) body = `${body}\n{{link}}`;
  const decision = evaluateSend({
    sendingEnabled: true,
    channel: input.channel,
    purpose: "marketing",
    senderName: sender,
    suppressed: false,
    consent: "opted_in",
    basis: "consent",
    body,
  });
  if (decision.status === "blocked_consent") {
    return { ok: false as const, error: `${decision.reason} Nothing was written to the outbox.` };
  }
  const subject = input.channel === "email" ? (input.subject.trim() || "How did we do?") : input.subject.trim();
  return {
    ok: true as const,
    channel: input.channel,
    address,
    subject,
    body: decision.body,
    consentText,
    status: "draft" as const,
    sends: false as const,
  };
}

export function planPublicReview(input: { rating: unknown; name: string; comment: string; honeypot?: string }) {
  if (input.honeypot?.trim()) return { ok: false as const, error: "The review could not be saved." };
  const raw = String(input.rating ?? "").trim();
  if (!/^[1-5]$/.test(raw)) return { ok: false as const, error: "Choose a rating from 1 to 5." };
  const name = input.name.trim();
  const comment = input.comment.trim();
  if (name.length > 80) return { ok: false as const, error: "The name is too long." };
  if (comment.length > 500) return { ok: false as const, error: "Keep the comment under 500 characters." };
  return { ok: true as const, rating: Number(raw), name, comment };
}

export function planManualReview(input: { rating: unknown; name: string; comment: string; source: string }) {
  const planned = planPublicReview({ rating: input.rating, name: input.name, comment: input.comment });
  if (!planned.ok) return planned;
  const source = input.source.trim();
  if (source !== "manual" && source !== "google" && source !== "facebook") {
    return { ok: false as const, error: "Choose manual, Google, or Facebook. Nothing was stored." };
  }
  return { ...planned, source };
}
