/**
 * One image or one document on a queued /command-centre/inbox reply.
 * Unset, blank, True, TRUE, 1, yes, or any value other than the exact string
 * true keeps today's composer: no attach control.
 * The comparison is case-sensitive after trim.
 * The file stays on the device. A queued reply stores the filename and the
 * mime type on the messages media jsonb, the same shape the thread viewer
 * already reads. crm_outbox has no media column, so the outbox row stays the
 * existing text draft.
 * This module does not upload, does not call Meta, does not change consent
 * or assignment, and does not turn sending_enabled on.
 */

import { safeMediaUrl } from "@/lib/inbox/media";

export const INBOX_OUTBOUND_MEDIA_FLAG = "INBOX_OUTBOUND_MEDIA_ENABLED";

/** One attachment. Larger files are refused here because this draft does not upload. */
export const MAX_OUTBOUND_MEDIA_BYTES = 16 * 1024 * 1024;

export const OUTBOUND_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.avif,.bmp,.pdf,.doc,.docx,.xls,.xlsx,.txt";

const MAX_FILENAME = 180;

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
};

const DOCUMENT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
};

const IMAGE_MIMES = new Set(Object.values(IMAGE_MIME));
const DOCUMENT_MIMES = new Set(Object.values(DOCUMENT_MIME));

export type OutboundMediaDraft = {
  kind: "image" | "document";
  filename: string;
  mime: string;
  /** Local chip preview only. Never stored on the queued reply. */
  previewUrl: string;
};

export type OutboundMediaInput = {
  name: string;
  type: string;
  size: number;
};

export function inboxOutboundMediaEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_OUTBOUND_MEDIA_FLAG] ?? "").trim() === "true";
}

/** One pending attachment, or null when the file is not an image or a document. */
export function attachOutboundMedia(file: OutboundMediaInput): OutboundMediaDraft | null {
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_OUTBOUND_MEDIA_BYTES) return null;
  const filename = cleanFilename(file.name);
  if (!filename) return null;
  const classified = classify(filename, cleanMime(file.type));
  if (!classified) return null;
  return { kind: classified.kind, filename, mime: classified.mime, previewUrl: "" };
}

/** Clears the pending attachment before the reply is queued. */
export function removeOutboundMedia(): null {
  return null;
}

export function revokeOutboundPreview(draft: OutboundMediaDraft | null) {
  if (!draft?.previewUrl.startsWith("blob:")) return;
  if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
  URL.revokeObjectURL(draft.previewUrl);
}

/** blob: or a stored-safe http(s) / same-origin address. Anything else is dropped. */
export function safeOutboundPreviewUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2000) return "";
  if (/[\u0000-\u001f\u007f\s"'<>]/.test(trimmed)) return "";
  if (trimmed.startsWith("blob:")) return trimmed;
  return safeMediaUrl(trimmed);
}

/**
 * Media jsonb for the queued message row.
 * Null when the flag is off or the fields are not one image or one document.
 * No url is stored. The file is not uploaded.
 */
export function queuedMessageMedia(
  enabled: boolean,
  fields: { kind: string; filename: string; mime: string },
): { attachments: Array<{ type: "image" | "document"; filename: string; mime_type: string }> } | null {
  if (!enabled) return null;
  const draft = attachOutboundMedia({ name: fields.filename, type: fields.mime, size: 1 });
  if (!draft) return null;
  if (fields.kind.trim() !== draft.kind) return null;
  return {
    attachments: [
      {
        type: draft.kind,
        filename: draft.filename,
        mime_type: draft.mime,
      },
    ],
  };
}

function classify(filename: string, rawMime: string): { kind: "image" | "document"; mime: string } | null {
  const ext = extensionOf(filename);
  const imageFromExt = IMAGE_MIME[ext] ?? "";
  const documentFromExt = DOCUMENT_MIME[ext] ?? "";
  if (rawMime === "image/svg+xml") return null;
  const mime = rawMime === "application/octet-stream" ? "" : rawMime;
  if (IMAGE_MIMES.has(mime)) {
    if (documentFromExt) return null;
    if (imageFromExt && imageFromExt !== mime) return null;
    return { kind: "image", mime };
  }
  if (DOCUMENT_MIMES.has(mime)) {
    if (imageFromExt) return null;
    if (documentFromExt && documentFromExt !== mime) return null;
    return { kind: "document", mime };
  }
  if (mime) return null;
  if (imageFromExt) return { kind: "image", mime: imageFromExt };
  if (documentFromExt) return { kind: "document", mime: documentFromExt };
  return null;
}

function extensionOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

function cleanFilename(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes("://")) return "";
  const base = trimmed.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!cleaned || cleaned === "." || cleaned === ".." || cleaned.length > MAX_FILENAME) return "";
  if (/[<>"]/.test(cleaned) || cleaned.includes("..")) return "";
  return cleaned;
}

function cleanMime(value: string) {
  const mime = value.trim().toLowerCase();
  if (!mime || mime.length > 120) return "";
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(mime)) return "";
  return mime;
}
