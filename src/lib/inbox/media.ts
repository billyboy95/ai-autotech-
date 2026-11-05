/**
 * Read-only media on an open /command-centre/inbox thread.
 * Unset, blank, or any value other than the string true keeps today's thread:
 * no thumbnails and no attachment chips.
 * messages.media is jsonb from phase 2e. This module only reads that value.
 * It does not send, does not upload, does not call Meta, does not insert
 * crm_outbox, does not change consent or assignment, and does not turn
 * sending_enabled on.
 */

export const INBOX_MEDIA_FLAG = "INBOX_MEDIA_ENABLED";

export const INBOX_MESSAGE_COLUMNS =
  "id, direction, body, status, channel, wa_category, cost_cents, provider_message_id, created_at" as const;

export const INBOX_MESSAGE_COLUMNS_WITH_MEDIA =
  "id, direction, body, status, channel, wa_category, cost_cents, provider_message_id, created_at, media" as const;

const MAX_ATTACHMENTS = 8;
const MAX_URL_LENGTH = 2000;
const MAX_LABEL_LENGTH = 180;

const URL_KEYS = ["url", "link", "href", "src", "media_url", "mediaUrl"] as const;
const STRONG_NAME_KEYS = ["filename", "file_name", "fileName"] as const;
const WEAK_NAME_KEYS = ["caption", "name", "title"] as const;
const NAME_KEYS = [...STRONG_NAME_KEYS, ...WEAK_NAME_KEYS] as const;
const MIME_KEYS = ["mime", "mime_type", "mimeType", "content_type", "contentType"] as const;
const LIST_KEYS = ["attachments", "files", "items", "media"] as const;
const NESTED_KEYS = ["image", "sticker", "document", "video", "audio", "file", "link"] as const;
const MEDIA_TYPES = new Set(["image", "sticker", "document", "video", "audio", "file", "link", "attachment"]);
const FILE_TYPES = new Set(["document", "video", "audio", "file", "link", "attachment"]);
const SKIP_TYPES = new Set([
  "text",
  "button",
  "reaction",
  "system",
  "unsupported",
  "contacts",
  "interactive",
  "location",
  "order",
]);
const IMAGE_EXT = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;
const GRAPH_HOSTS = new Set(["graph.facebook.com", "graph.whatsapp.com", "graph.instagram.com"]);

export type InboxAttachment = {
  id: string;
  kind: "image" | "file";
  url: string;
  filename: string;
  mime: string;
};

/**
 * Fixture jsonb for the open preview thread. The same parser reads messages.media.
 * The image is a file already in this app. The document link is not fetched here.
 */
export const PREVIEW_MESSAGE_MEDIA = {
  attachments: [
    {
      type: "image",
      url: "/icons/aios-192.png",
      mime_type: "image/png",
      filename: "lerato-id.png",
    },
    {
      type: "document",
      url: "https://example.com/october-intake.pdf",
      mime_type: "application/pdf",
      filename: "october-intake.pdf",
    },
    {
      type: "image",
      url: "javascript:alert(1)",
      mime_type: "image/jpeg",
      filename: "blocked.jpg",
    },
  ],
};

export function inboxMediaEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_MEDIA_FLAG] ?? "").trim().toLowerCase() === "true";
}

/** Attachments already stored on one message. Empty, null, and plain text stay empty. */
export function parseMessageMedia(value: unknown): InboxAttachment[] {
  const parsed: InboxAttachment[] = [];
  for (const item of collect(value, 0)) {
    if (parsed.length >= MAX_ATTACHMENTS) break;
    const attachment = parseOne(item, parsed.length);
    if (attachment) parsed.push(attachment);
  }
  return parsed;
}

function collect(value: unknown, depth: number): unknown[] {
  if (depth > 4 || value == null) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return collect(JSON.parse(trimmed) as unknown, depth + 1);
      } catch {
        return [];
      }
    }
    return [trimmed];
  }
  if (Array.isArray(value)) return value.flatMap((item) => collect(item, depth + 1));
  if (typeof value !== "object") return [];
  return fromRecord(value as Record<string, unknown>, depth);
}

function fromRecord(record: Record<string, unknown>, depth: number): unknown[] {
  for (const key of LIST_KEYS) {
    if (Array.isArray(record[key]) && record[key].length > 0) {
      return record[key].flatMap((item) => collect(item, depth + 1));
    }
  }
  const nested: Record<string, unknown>[] = [];
  for (const key of NESTED_KEYS) {
    const part = record[key];
    if (!part || typeof part !== "object" || Array.isArray(part)) continue;
    nested.push(mergePart(record, part as Record<string, unknown>, key));
  }
  if (nested.length) return nested;
  return hasAttachmentShape(record) ? [record] : [];
}

function mergePart(parent: Record<string, unknown>, part: Record<string, unknown>, key: string) {
  const merged: Record<string, unknown> = { ...part, type: text(part.type) || key };
  if (!rawString(merged, URL_KEYS)) {
    const url = rawString(parent, URL_KEYS);
    if (url) merged.url = url;
  }
  if (!firstString(merged, NAME_KEYS)) {
    const name = firstString(parent, NAME_KEYS);
    if (name) merged.filename = name;
  }
  if (!firstString(merged, MIME_KEYS)) {
    const mime = firstString(parent, MIME_KEYS);
    if (mime) merged.mime = mime;
  }
  return merged;
}

function hasAttachmentShape(record: Record<string, unknown>) {
  const type = normalizedType(record);
  if (SKIP_TYPES.has(type) && !rawString(record, URL_KEYS)) return false;
  if (rawString(record, URL_KEYS) || firstString(record, STRONG_NAME_KEYS) || firstString(record, MIME_KEYS)) return true;
  return MEDIA_TYPES.has(type);
}

function parseOne(value: unknown, index: number): InboxAttachment | null {
  if (typeof value === "string") {
    const url = safeMediaUrl(value);
    if (!url) return null;
    return attachment(index, url, "", "");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const type = normalizedType(record);
  if (SKIP_TYPES.has(type) && !firstString(record, URL_KEYS)) return null;
  const url = safeMediaUrl(rawString(record, URL_KEYS));
  const mime = clip(firstString(record, MIME_KEYS).toLowerCase());
  const named = clip(firstString(record, STRONG_NAME_KEYS));
  const weak = clip(firstString(record, WEAK_NAME_KEYS));
  const filename = named || (url || mime || MEDIA_TYPES.has(type) ? weak : "");
  if (!url && !filename && !mime && !MEDIA_TYPES.has(type)) return null;
  return attachment(index, url, filename, mime, type);
}

function attachment(index: number, url: string, filename: string, mime: string, type = ""): InboxAttachment {
  const kind = imageKind(type, mime, url) ? "image" : "file";
  return {
    id: `media-${index}`,
    kind,
    url,
    filename: filename || (kind === "image" && !url ? "Image" : ""),
    mime,
  };
}

function imageKind(type: string, mime: string, url: string) {
  if (type === "image" || type === "sticker") return mime !== "image/svg+xml";
  if (FILE_TYPES.has(type)) return false;
  if (mime === "image/svg+xml") return false;
  if (mime.startsWith("image/")) return true;
  if (mime) return false;
  return Boolean(url) && imagePath(url);
}

/** http(s) or a same-origin path. Graph API hosts and token query strings are dropped. */
export function safeMediaUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return "";
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\") && !trimmed.includes("..")) {
    return /^\/[A-Za-z0-9._~/-]+$/.test(trimmed) ? trimmed : "";
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  if (url.username || url.password) return "";
  if (GRAPH_HOSTS.has(url.hostname.toLowerCase())) return "";
  if (url.searchParams.has("access_token")) return "";
  return url.toString();
}

function imagePath(url: string) {
  if (url.startsWith("/")) return IMAGE_EXT.test(url);
  try {
    return IMAGE_EXT.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function normalizedType(record: Record<string, unknown>) {
  return firstString(record, ["type", "kind"]).toLowerCase();
}

function rawString(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return "";
}

function firstString(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = text(record[key]);
    if (value && !looksLikeUrl(value)) return value;
  }
  return "";
}

function looksLikeUrl(value: string) {
  return /^(https?:|javascript:|data:|blob:|file:)?\/\//i.test(value) || /^[a-z]+:/i.test(value) || value.startsWith("/");
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clip(value: string) {
  return value.length > MAX_LABEL_LENGTH ? value.slice(0, MAX_LABEL_LENGTH) : value;
}
