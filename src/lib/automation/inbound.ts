import type { InboundEvent } from "@/lib/automation/types";

export function normalizeInbound(body: unknown): InboundEvent | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const payload = asRecord(record.payload);
  const rawType = String(record.type || record.event || payload?.event || "").trim();
  const type = mapType(rawType);
  if (!type) return null;

  const scheduled = asRecord(payload?.scheduled_event);
  const email = stringValue(record.email, payload?.email, asRecord(payload?.invitee)?.email);
  const phone = stringValue(record.phone, payload?.phone, payload?.text_phone);
  const leadId = stringValue(record.leadId, record.lead_id, payload?.leadId, payload?.utm_content);
  const startsAt = stringValue(record.startsAt, record.starts_at, scheduled?.start_time, payload?.start_time);
  const text = stringValue(record.text, record.message, payload?.text, payload?.body);
  const valueZar = numberValue(record.valueZar, record.value_zar, payload?.valueZar);
  const whatSold = stringValue(record.whatSold, record.what_sold, payload?.whatSold);

  return {
    type,
    leadId: leadId || undefined,
    email: email || undefined,
    phone: phone || undefined,
    startsAt: startsAt || undefined,
    text: text || undefined,
    valueZar,
    whatSold: whatSold || undefined,
  };
}

function mapType(value: string): InboundEvent["type"] | null {
  const name = value.toLowerCase();
  if (name === "booking.created" || name === "invitee.created" || name === "booking_created") return "booking.created";
  if (name === "reply.received" || name === "message.received" || name === "whatsapp.inbound") return "reply.received";
  if (name === "audit.completed" || name === "audit_completed") return "audit.completed";
  if (name === "proposal.sent" || name === "proposal_sent") return "proposal.sent";
  return null;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}
