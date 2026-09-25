import crypto from "node:crypto";

/**
 * WhatsApp Cloud API helpers. No SDK, just fetch.
 * Direct Meta (default): Graph API + WHATSAPP_TOKEN, webhooks signed with X-Hub-Signature-256 (WHATSAPP_APP_SECRET).
 * Via Kapso (free coexistence BSP, Meta-compatible proxy): set KAPSO_API_KEY (+ KAPSO_WEBHOOK_SECRET); same payloads.
 */

const GRAPH = () =>
  process.env.WHATSAPP_API_BASE ||
  (process.env.KAPSO_API_KEY ? "https://api.kapso.ai/meta/whatsapp/v24.0" : `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || "v25.0"}`);

function authHeaders(): Record<string, string> {
  if (process.env.KAPSO_API_KEY) return { "X-API-Key": process.env.KAPSO_API_KEY };
  return { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
}

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && (process.env.WHATSAPP_TOKEN || process.env.KAPSO_API_KEY));
}

function safeEqualHex(given: string, expected: string) {
  if (!/^[0-9a-f]+$/i.test(given) || given.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Verify the webhook came from Meta (X-Hub-Signature-256 = "sha256=" + HMAC_SHA256(app secret, raw body))
 * or from Kapso's Meta forwarding (X-Webhook-Signature = hex HMAC_SHA256(webhook secret, raw body)). Fails closed.
 */
export function verifySignature(
  rawBody: string,
  metaHeader: string | null,
  kapsoHeader: string | null = null,
  appSecret = process.env.WHATSAPP_APP_SECRET,
  kapsoSecret = process.env.KAPSO_WEBHOOK_SECRET,
) {
  if (metaHeader && appSecret && metaHeader.startsWith("sha256=")) {
    const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
    return safeEqualHex(metaHeader.slice("sha256=".length), expected);
  }
  if (kapsoHeader && kapsoSecret) {
    const expected = crypto.createHmac("sha256", kapsoSecret).update(rawBody, "utf8").digest("hex");
    return safeEqualHex(kapsoHeader.replace(/^sha256=/, ""), expected);
  }
  return false;
}

async function graph(path: string, body: unknown) {
  const res = await fetch(`${GRAPH()}/${path}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json.error as { message?: string; code?: number } | undefined) ?? {};
    throw new Error(`Graph ${res.status} ${err.code ?? ""} ${err.message ?? "request failed"}`.trim());
  }
  return json;
}

/** BSUIDs look like "ZA.1234..." (country code + period); phone numbers are digits only. */
export const isBsuid = (id: string) => /^[A-Z]{2}\./.test(id);

/** Plain text message inside the 24h customer service window. `to` may be a phone number or a BSUID. */
export async function sendText(to: string, text: string, replyToId?: string) {
  const json = await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    ...(isBsuid(to) ? { recipient: to } : { to }),
    type: "text",
    text: { body: text, preview_url: /https?:\/\//.test(text) },
    ...(replyToId ? { context: { message_id: replyToId } } : {}),
  });
  const messages = (json.messages as Array<{ id: string }> | undefined) ?? [];
  return messages[0]?.id ?? null;
}

/** Mark the lead's message as read and show "typing..." (Meta hides it after ~25s or when we send). */
export async function markReadAndType(messageId: string) {
  try {
    await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    });
  } catch (e) {
    console.warn("typing indicator failed", (e as Error).message);
  }
}

/** Download inbound media (voice note, image) as bytes. */
export async function downloadMedia(mediaId: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
  if (!whatsappConfigured()) return null;
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const meta = await fetch(`${GRAPH()}/${mediaId}${process.env.KAPSO_API_KEY ? `?phone_number_id=${pid}` : ""}`, { headers: authHeaders() });
  if (!meta.ok) return null;
  const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!info.url || (info.file_size ?? 0) > 16 * 1024 * 1024) return null;
  const file = await fetch(info.url, { headers: authHeaders() });
  if (!file.ok) return null;
  return { data: new Uint8Array(await file.arrayBuffer()), mimeType: (info.mime_type || "audio/ogg").split(";")[0] };
}

// ---- Webhook payload types (subset) ----

export type WaInboundMessage = {
  from?: string; // phone number; can be omitted for users with usernames (BSUID rollout 2026)
  from_user_id?: string; // business-scoped user id, always present
  group_id?: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  audio?: { id: string; mime_type?: string; voice?: boolean };
  image?: { id: string; caption?: string; mime_type?: string };
  video?: { id: string; caption?: string };
  document?: { id: string; caption?: string; filename?: string };
  sticker?: { id: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: unknown[];
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
  reaction?: { emoji?: string; message_id?: string };
};

export type WaEcho = { from: string; to?: string; to_user_id?: string; id: string; timestamp: string; type: string; text?: { body: string } };

export type WaChangeValue = {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ wa_id?: string; user_id?: string; profile?: { name?: string; username?: string } }>;
  messages?: WaInboundMessage[];
  message_echoes?: WaEcho[];
  statuses?: unknown[];
};

export type WaWebhook = {
  object?: string;
  entry?: Array<{ id: string; changes?: Array<{ field: string; value: WaChangeValue }> }>;
};
