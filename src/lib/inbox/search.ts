/**
 * Conversation list search on /command-centre/inbox.
 * Unset, blank, or any value other than the string true keeps today's list:
 * no search box and no query filter.
 * The filter runs in the browser on conversations already loaded for the
 * current open, mine, unassigned, channel, and number view.
 * It matches the contact name, the phone or email on that list contact,
 * and the last-message preview. Typing does not refetch.
 * This module does not send, does not call Meta, does not insert crm_outbox,
 * does not change consent or assignment, and does not turn sending_enabled on.
 */

export const INBOX_SEARCH_FLAG = "INBOX_SEARCH_ENABLED";
export const INBOX_SEARCH_DEBOUNCE_MS = 250;
/** Newest stored message bodies read once when the flag is on. Not a new table. */
export const INBOX_SEARCH_PREVIEW_CAP = 400;
const MIN_PHONE_DIGITS = 4;

export function inboxSearchEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_SEARCH_FLAG] ?? "").trim().toLowerCase() === "true";
}

export type InboxSearchFields = {
  contactName: string;
  preview: string;
  phone?: string;
  email?: string;
};

export function normalizeInboxSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

/** Empty text applies immediately. A typed query waits so the list is not filtered on every key. */
export function searchApplyDelay(query: string) {
  return normalizeInboxSearchQuery(query) ? INBOX_SEARCH_DEBOUNCE_MS : 0;
}

export function searchListFields(
  contact: { email?: string | null; phone?: string | null; whatsapp?: string | null } | null | undefined,
  enabled: boolean,
) {
  if (!enabled || !contact) return { phone: "", email: "" };
  const phone = [...new Set([contact.phone, contact.whatsapp].map((part) => String(part || "").trim()).filter(Boolean))].join(" ");
  return { phone, email: String(contact.email || "").trim() };
}

export function conversationMatchesSearch(item: InboxSearchFields, query: string) {
  const needle = normalizeInboxSearchQuery(query);
  if (!needle) return true;
  const phone = item.phone ?? "";
  const email = item.email ?? "";
  const text = [item.contactName, email, phone, item.preview].join("\n").toLowerCase();
  if (text.includes(needle)) return true;
  const needleDigits = needle.replace(/\D/g, "");
  if (needleDigits.length < MIN_PHONE_DIGITS) return false;
  return phone.replace(/\D/g, "").includes(needleDigits);
}

export function filterInboxConversations<T extends InboxSearchFields>(items: readonly T[], query: string): readonly T[] {
  if (!normalizeInboxSearchQuery(query)) return items;
  return items.filter((item) => conversationMatchesSearch(item, query));
}

/** Flag off returns the list unchanged. Flag on filters that same list. */
export function inboxListForSearch<T extends InboxSearchFields>(enabled: boolean, items: readonly T[], query: string): readonly T[] {
  if (!enabled) return items;
  return filterInboxConversations(items, query);
}

/** Rows must be newest first. The first non-empty body for a conversation wins. */
export function latestMessagePreviews(rows: readonly { conversation_id?: unknown; body?: unknown }[]) {
  const previews: Record<string, string> = {};
  for (const row of rows) {
    const id = String(row.conversation_id || "");
    if (!id || previews[id]) continue;
    const body = String(row.body || "").replace(/\s+/g, " ").trim();
    if (!body) continue;
    previews[id] = body.slice(0, 240);
  }
  return previews;
}

export function withMessagePreviews<T extends { id: string; preview: string }>(
  items: readonly T[],
  previews: Readonly<Record<string, string>>,
): T[] {
  return items.map((item) => {
    if (item.preview.trim()) return item;
    const next = previews[item.id];
    if (!next) return item;
    return { ...item, preview: next };
  });
}
