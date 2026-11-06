/**
 * Multi-number WhatsApp filter for the unified inbox.
 * Unset, blank, or any value other than the string true keeps today's inbox.
 * This module does not send, does not call Meta, and does not turn sending on.
 * Labels come from channel_connections.display_name plus the display phone
 * or the phone number id already stored on the connection.
 */

export const INBOX_MULTI_NUMBER_FLAG = "INBOX_MULTI_NUMBER_ENABLED";

const NUMBER_ID = /^[A-Za-z0-9_-]{1,80}$/;

export type WhatsappNumberParts = {
  displayName: string;
  last4: string;
  label: string;
};

export function inboxMultiNumberEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_MULTI_NUMBER_FLAG] ?? "").trim().toLowerCase() === "true";
}

/** Empty, "all", or an unsafe token means every number. */
export function parseInboxNumber(value: string | undefined | null) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.toLowerCase() === "all") return "";
  if (!NUMBER_ID.test(raw)) return "";
  return raw;
}

/** A number filter is applied only when the id belongs to this workspace. */
export function resolveInboxNumber(requested: string, connectionIds: readonly string[]) {
  if (!requested) return "";
  return connectionIds.includes(requested) ? requested : "";
}

export function displayPhoneFromConfig(config: unknown) {
  const row = configObject(config);
  for (const key of ["displayPhone", "display_phone", "phone"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function whatsappNumberParts(input: {
  displayName?: string | null;
  identifier?: string | null;
  displayPhone?: string | null;
}): WhatsappNumberParts {
  const displayName = String(input.displayName ?? "").trim();
  const identifier = String(input.identifier ?? "").trim();
  const displayPhone = String(input.displayPhone ?? "").trim();
  const phoneDigits = displayPhone.replace(/\D/g, "");
  const idDigits = identifier.replace(/\D/g, "");
  const digits = phoneDigits.length >= 4 ? phoneDigits : idDigits;
  const last4 = digits.length >= 4 ? digits.slice(-4) : "";
  const name = displayName || (last4 ? "WhatsApp" : identifier || "WhatsApp");
  const label = last4 && !name.endsWith(last4) ? `${name} · ${last4}` : name;
  return { displayName, last4, label };
}

export function matchesInboxNumber(input: {
  enabled: boolean;
  numberId: string;
  channel: string;
  connectionId: string | null;
}) {
  if (!input.enabled || !input.numberId) return true;
  return input.channel === "whatsapp" && input.connectionId === input.numberId;
}

/** Inbox links. The number query is omitted unless the flag is on and a number is chosen. */
export function inboxHref(input: {
  orgSlug?: string;
  filter?: string;
  channel?: string;
  id?: string;
  number?: string;
  multiNumber?: boolean;
}) {
  const params = new URLSearchParams();
  if (input.orgSlug && input.orgSlug !== "preview") params.set("org", input.orgSlug);
  if (input.filter && input.filter !== "open") params.set("filter", input.filter);
  if (input.channel) params.set("channel", input.channel);
  if (input.multiNumber && input.number) params.set("number", input.number);
  if (input.id) params.set("id", input.id);
  const qs = params.toString();
  return qs ? `/command-centre/inbox?${qs}` : "/command-centre/inbox";
}

function configObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
    return {};
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}
