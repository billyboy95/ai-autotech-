/**
 * Bulk assign, close, and mark-read for the unified inbox.
 * Unset, blank, or any value other than the string true keeps today's inbox:
 * no checkboxes and no bulk toolbar.
 * These helpers only choose conversation ids and a status or assignee.
 * They do not send, do not call Meta, and do not turn sending_enabled on.
 */

export const INBOX_BULK_ACTIONS_FLAG = "INBOX_BULK_ACTIONS_ENABLED";
export const BULK_CONVERSATION_LIMIT = 50;

const CONVERSATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function inboxBulkActionsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_BULK_ACTIONS_FLAG] ?? "").trim().toLowerCase() === "true";
}

export function bulkScopeKey(input: { filter: string; channel: string; number: string }) {
  return `${input.filter}\n${input.channel}\n${input.number}`;
}

/** A filter, channel, or number change drops the previous selection. */
export function selectionForScope(input: {
  previousScope: string;
  nextScope: string;
  selected: readonly string[];
}) {
  if (input.previousScope !== input.nextScope) return [];
  return [...input.selected];
}

export function selectableConversationIds(items: readonly { id: string; status: string }[]) {
  return items.filter((item) => item.status !== "closed" && CONVERSATION_ID.test(item.id)).map((item) => item.id);
}

export function toggleBulkId(selected: readonly string[], id: string, selectableIds: readonly string[]) {
  if (!selectableIds.includes(id)) return [...selected];
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  if (selected.length >= BULK_CONVERSATION_LIMIT) return [...selected];
  return [...selected, id];
}

export function parseBulkConversationIds(values: readonly string[]) {
  const ids: string[] = [];
  const seen = new Set<string>();
  let overflow = false;
  for (const value of values) {
    for (const part of String(value).split(/[\s,]+/)) {
      const id = part.trim();
      if (!id || seen.has(id)) continue;
      if (!CONVERSATION_ID.test(id)) continue;
      if (ids.length >= BULK_CONVERSATION_LIMIT) {
        overflow = true;
        continue;
      }
      seen.add(id);
      ids.push(id);
    }
  }
  if (overflow) return { ok: false as const, message: "Select up to 50 conversations." };
  if (!ids.length) return { ok: false as const, message: "Select at least one conversation." };
  return { ok: true as const, ids };
}

/** Keep requested ids that this workspace query actually returned, in request order. */
export function bulkIdsInWorkspace(
  requested: readonly string[],
  visible: readonly { id: string; status: string }[],
) {
  const status = new Map(visible.map((row) => [row.id, row.status]));
  const ids = requested.filter((id) => status.has(id));
  return { ids, statuses: ids.map((id) => status.get(id) ?? "") };
}

/**
 * Close when any selected thread is still open or pending.
 * Reopen only when every selected thread is already closed.
 */
export function bulkStatusFor(statuses: readonly string[]): "open" | "closed" {
  if (statuses.length > 0 && statuses.every((status) => status === "closed")) return "open";
  return "closed";
}

export function bulkStatusLabel(status: "open" | "closed") {
  return status === "open" ? "Reopen" : "Close";
}

export function membershipAssignedOnly(
  rows: readonly { userId: string; role: string; assignedOnly: boolean }[],
  userId: string,
) {
  const mine = rows.find((row) => row.userId === userId);
  return Boolean(mine && mine.role === "client_user" && mine.assignedOnly);
}

export function planBulkAssign(input: {
  assignee: string;
  memberIds: readonly string[];
  assignedOnly: boolean;
  userId: string;
}) {
  const assignee = input.assignee.trim();
  if (!assignee) {
    if (input.assignedOnly) return { ok: false as const, message: "You can only assign conversations to yourself." };
    return { ok: true as const, assignee: null };
  }
  const self = Boolean(input.userId) && assignee === input.userId;
  const member = input.memberIds.includes(assignee);
  if (!CONVERSATION_ID.test(assignee) || (!member && !self)) {
    return { ok: false as const, message: "Choose a teammate in this workspace." };
  }
  if (input.assignedOnly && !self) {
    return { ok: false as const, message: "You can only assign conversations to yourself." };
  }
  return { ok: true as const, assignee };
}

function noun(count: number) {
  return count === 1 ? "conversation" : "conversations";
}

export function bulkAssignNotice(count: number, assignee: string | null) {
  if (count <= 0) return "No conversations in this workspace were updated.";
  return assignee ? `Assigned ${count} ${noun(count)}.` : `Unassigned ${count} ${noun(count)}.`;
}

export function bulkStatusNotice(count: number, status: "open" | "closed") {
  if (count <= 0) return "No conversations in this workspace were updated.";
  return status === "closed" ? `Closed ${count} ${noun(count)}.` : `Reopened ${count} ${noun(count)}.`;
}

export function bulkReadNotice(count: number) {
  if (count <= 0) return "Those conversations were already read.";
  return `Marked ${count} ${noun(count)} read.`;
}
