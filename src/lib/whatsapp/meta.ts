import crypto from "node:crypto";

/** WhatsApp Cloud API helpers (Meta Graph API). No SDK, just fetch. */

const GRAPH = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || "v25.0"}`;

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Verify X-Hub-Signature-256 = "sha256=" + HMAC_SHA256(app secret, raw body). Fails closed. */
export function verifySignature(rawBody: string, header: string | null, secret = process.env.WHATSAPP_APP_SECRET) {
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

async function graph(path: string, body: unknown) {
  const res = await fetch(`${GRAPH()}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json.error as { message?: string; code?: number } | undefined) ?? {};
    throw new Error(`Graph ${res.status} ${err.code ?? ""} ${err.message ?? "request failed"}`.trim());
  }
  return json;
}

/** Plain text message inside the 24h customer service window. */
export async function sendText(to: string, text: string, replyToId?: string) {
  const json = await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
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
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return null;
  const meta = await fetch(`${GRAPH()}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!meta.ok) return null;
  const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!info.url || (info.file_size ?? 0) > 16 * 1024 * 1024) return null;
  const file = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!file.ok) return null;
  return { data: new Uint8Array(await file.arrayBuffer()), mimeType: (info.mime_type || "audio/ogg").split(";")[0] };
}

// ---- Webhook payload types (subset) ----

export type WaInboundMessage = {
  from: string;
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

export type WaEcho = { from: string; to: string; id: string; timestamp: string; type: string; text?: { body: string } };

export type WaChangeValue = {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
  messages?: WaInboundMessage[];
  message_echoes?: WaEcho[];
  statuses?: unknown[];
};

export type WaWebhook = {
  object?: string;
  entry?: Array<{ id: string; changes?: Array<{ field: string; value: WaChangeValue }> }>;
};
