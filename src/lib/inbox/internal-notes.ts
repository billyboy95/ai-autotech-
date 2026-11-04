/**
 * Staff-only notes on an inbox thread.
 * Unset, blank, or any value other than the string true keeps today's inbox
 * with no internal notes section.
 * A saved note is stored on conversation_notes for that conversation only.
 * This module does not send, does not call Meta, does not change consent,
 * does not queue the outbox, and does not turn sending_enabled on.
 */

import type { InboxNote } from "@/lib/inbox/types";

export const INBOX_INTERNAL_NOTES_FLAG = "INBOX_INTERNAL_NOTES_ENABLED";
export const INTERNAL_NOTE_LIMIT = 2000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function inboxInternalNotesEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_INTERNAL_NOTES_FLAG] ?? "").trim().toLowerCase() === "true";
}

export function parseInternalNote(value: string) {
  const body = value.trim();
  if (!body) return { ok: false as const, message: "Write a note before saving it." };
  if (body.length > INTERNAL_NOTE_LIMIT) return { ok: false as const, message: "Keep the note under 2000 characters." };
  return { ok: true as const, body };
}

/**
 * Flag, body, and assigned_only are decided here.
 * The caller writes conversation_notes only when this returns ok.
 */
export function planInternalNoteSave(input: {
  enabled: boolean;
  body: string;
  assignedOnly: boolean;
  assignedUserId: string | null;
  userId: string;
}) {
  if (!input.enabled) return { ok: false as const, message: "Internal notes are off." };
  const parsed = parseInternalNote(input.body);
  if (!parsed.ok) return parsed;
  if (input.assignedOnly && input.assignedUserId !== input.userId) {
    return { ok: false as const, message: "You only update conversations assigned to you." };
  }
  return { ok: true as const, body: parsed.body };
}

export type InternalNoteRecord = {
  id: string;
  orgId: string;
  conversationId: string;
  body: string;
  authorUserId: string;
  createdAt: string;
};

/** In-memory save used by tests. It never calls a provider. */
export function saveInternalNote(
  store: readonly InternalNoteRecord[],
  input: {
    enabled: boolean;
    id: string;
    orgId: string;
    conversationId: string;
    body: string;
    authorUserId: string;
    createdAt: string;
    assignedOnly: boolean;
    assignedUserId: string | null;
  },
) {
  const planned = planInternalNoteSave({
    enabled: input.enabled,
    body: input.body,
    assignedOnly: input.assignedOnly,
    assignedUserId: input.assignedUserId,
    userId: input.authorUserId,
  });
  if (!planned.ok) return { ok: false as const, message: planned.message, store };
  const note: InternalNoteRecord = {
    id: input.id,
    orgId: input.orgId,
    conversationId: input.conversationId,
    body: planned.body,
    authorUserId: input.authorUserId,
    createdAt: input.createdAt,
  };
  return { ok: true as const, store: [...store, note], note };
}

/** Notes for one conversation in one workspace. Flag off returns nothing. */
export function listInternalNotes(
  store: readonly InternalNoteRecord[],
  input: { enabled: boolean; orgId: string; conversationId: string },
): InboxNote[] {
  if (!input.enabled) return [];
  return store
    .filter((row) => row.orgId === input.orgId && row.conversationId === input.conversationId)
    .map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      authorUserId: row.authorUserId,
    }));
}

export function noteAuthorLabel(
  authorUserId: string | null,
  input: { userId: string | null; members: readonly { userId: string; role: string }[] },
) {
  if (!authorUserId) return "Staff";
  if (input.userId && authorUserId === input.userId) return "You";
  const member = input.members.find((row) => row.userId === authorUserId);
  if (!member) return `Staff · ${authorUserId.slice(0, 8)}`;
  const role = member.role.trim() || "Staff";
  return `${role} · ${authorUserId.slice(0, 8)}`;
}

/** Stable UTC label so a note time does not depend on the server locale. */
export function formatNoteTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hours}:${minutes} UTC`;
}
