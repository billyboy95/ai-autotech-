import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isStopCommand, planStop } from "@/lib/compliance/stop";

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function signBody(secret: string, rawBody: string) {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

/** Meta uses X-Hub-Signature-256. Other providers may send the same hex HMAC. */
export function verifyWebhookSignature(input: { secret: string; rawBody: string; signature: string | null }) {
  const secret = input.secret.trim();
  const signature = (input.signature || "").trim();
  if (!secret || !signature) return false;
  const expected = signBody(secret, input.rawBody);
  const given = signature.startsWith("sha256=") ? signature : `sha256=${signature}`;
  return safeEqual(expected, given);
}

export function verifySharedSecret(expected: string, given: string | null) {
  if (!expected || !given) return false;
  return safeEqual(expected, given);
}

export type InboundMessage = {
  providerMessageId: string;
  from: string;
  body: string;
  channel: "whatsapp" | "sms" | "email" | "facebook" | "instagram";
};

export function parseInboundPayload(provider: string, raw: string): InboundMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  const name = provider.toLowerCase();

  if (name === "meta_cloud" || name === "whatsapp" || name === "meta") {
    const entry = first(record.entry);
    const change = first(asRecord(entry)?.changes);
    const value = asRecord(asRecord(change)?.value);
    const message = first(value?.messages);
    const messageRecord = asRecord(message);
    if (messageRecord) {
      const text = asRecord(messageRecord.text);
      const channel = name === "meta" ? socialChannel(record) : "whatsapp";
      return {
        providerMessageId: stringValue(messageRecord.id),
        from: stringValue(messageRecord.from),
        body: stringValue(text?.body, messageRecord.body),
        channel,
      };
    }
  }

  const from = stringValue(record.from, record.msisdn, record.source, record.sender, record.email);
  const body = stringValue(record.body, record.text, record.message, record.content);
  if (!from && !body) return null;
  const channel = name === "resend" || name === "smtp" ? "email" : name === "meta" ? "facebook" : "sms";
  return {
    providerMessageId: stringValue(record.id, record.messageId, record.message_id),
    from,
    body,
    channel,
  };
}

export function inboundStopPlan(input: { channel: string; from: string; body: string; senderName: string }) {
  if (!isStopCommand(input.body)) return null;
  return planStop({
    text: input.body,
    channel: input.channel,
    address: input.from,
    senderName: input.senderName,
  });
}

function socialChannel(record: Record<string, unknown>): "facebook" | "instagram" {
  const object = stringValue(record.object).toLowerCase();
  return object.includes("instagram") ? "instagram" : "facebook";
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function first(value: unknown) {
  return Array.isArray(value) ? value[0] : undefined;
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}
