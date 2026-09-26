import { toWaDigits } from "@/lib/automation/ids";
import type { Channel } from "@/lib/automation/types";

export type EnvLike = Record<string, string | undefined>;

export function isSendEnabled(env: EnvLike = process.env) {
  return String(env.AUTOMATION_SEND_ENABLED ?? "").trim().toLowerCase() === "true";
}

export function buildWaLink(phone: string, body: string) {
  const digits = toWaDigits(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

export function buildMailto(email: string, subject: string, body: string) {
  if (!email) return "";
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

export type DeliveryRequest = {
  channel: Channel;
  to: string;
  subject: string;
  body: string;
};

export type DeliveryResult = {
  status: "queued" | "sent" | "failed";
  provider: string;
  providerId: string;
  waLink: string;
  error: string;
};
