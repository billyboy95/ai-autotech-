/**
 * Tag filter on the /command-centre/inbox conversation list.
 * Unset, blank, or any value other than the string true keeps today's list:
 * no tag chips and no tag filter.
 * The filter runs in the browser on conversations already loaded for the
 * current open, mine, unassigned, channel, and number view. It also runs
 * after conversation search when that flag is on.
 * A thread matches when its contact tags include any chosen tag. Lead tags
 * are used only when the contact has none, the same rule as the contact panel.
 * Several chosen tags match with OR. Choosing tags does not write them.
 * This module does not send, does not call Meta, does not insert crm_outbox,
 * does not change consent or assignment, and does not turn sending_enabled on.
 */

import { panelTags } from "@/lib/inbox/contact-panel";

export const INBOX_TAG_FILTER_FLAG = "INBOX_TAG_FILTER_ENABLED";

export function inboxTagFilterEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_TAG_FILTER_FLAG] ?? "").trim().toLowerCase() === "true";
}

export type InboxTagFields = {
  tags?: readonly string[];
  leadTags?: readonly string[];
};

/** Contact columns on the conversation list. Search and tag filter add fields only when that flag is on. */
export function inboxListContactEmbed(search: boolean, tagFilter: boolean) {
  const fields = ["first_name", "last_name"];
  if (search) fields.push("email", "phone_e164", "whatsapp_e164");
  if (tagFilter) fields.push("tags", "lead_id");
  return `crm_contacts(${fields.join(", ")})`;
}

const INBOX_LIST_SELECT_PREFIX = "id, channel, status, assigned_user_id, unread_count, last_message_at, wa_window_expires_at, contact_id, channel_connection_id, ";

/**
 * Literal selects. A computed string makes the database client drop the contact
 * join type, so each flag pair is its own string.
 */
export function inboxListSelect(search: boolean, tagFilter: boolean) {
  if (search && tagFilter) {
    return `${INBOX_LIST_SELECT_PREFIX}crm_contacts(first_name, last_name, email, phone_e164, whatsapp_e164, tags, lead_id)` as const;
  }
  if (search) {
    return `${INBOX_LIST_SELECT_PREFIX}crm_contacts(first_name, last_name, email, phone_e164, whatsapp_e164)` as const;
  }
  if (tagFilter) {
    return `${INBOX_LIST_SELECT_PREFIX}crm_contacts(first_name, last_name, tags, lead_id)` as const;
  }
  return `${INBOX_LIST_SELECT_PREFIX}crm_contacts(first_name, last_name)` as const;
}

export function listTagFields(
  contact: { tags?: readonly string[] | null; leadTags?: readonly string[] | null } | null | undefined,
  enabled: boolean,
) {
  if (!enabled || !contact) return { tags: [] as string[], leadTags: [] as string[] };
  return {
    tags: Array.isArray(contact.tags) ? contact.tags.map((tag) => String(tag)) : [],
    leadTags: Array.isArray(contact.leadTags) ? contact.leadTags.map((tag) => String(tag)) : [],
  };
}

/** Tags the list filter uses. Contact tags win. Lead tags fill in only when the contact has none. */
export function resolvedListTags(contactTags: readonly string[], leadTags: readonly string[]) {
  return panelTags(contactTags, leadTags).tags;
}

export function normalizeTagKey(tag: string) {
  return tag.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Lowercase keys for the chosen chips. Blank and duplicate choices drop out. */
export function normalizeSelectedTags(selected: readonly string[]) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of selected) {
    const key = normalizeTagKey(String(value));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tags.push(key);
  }
  return tags;
}

export function conversationMatchesTags(item: InboxTagFields, selected: readonly string[]) {
  const wanted = normalizeSelectedTags(selected);
  if (!wanted.length) return true;
  const have = new Set(resolvedListTags(item.tags ?? [], item.leadTags ?? []).map((tag) => normalizeTagKey(tag)));
  return wanted.some((tag) => have.has(tag));
}

export function filterInboxByTags<T extends InboxTagFields>(items: readonly T[], selected: readonly string[]): readonly T[] {
  if (!normalizeSelectedTags(selected).length) return items;
  return items.filter((item) => conversationMatchesTags(item, selected));
}

/** Flag off returns the list unchanged, even if a selection was passed in. */
export function inboxListForTags<T extends InboxTagFields>(enabled: boolean, items: readonly T[], selected: readonly string[]): readonly T[] {
  if (!enabled) return items;
  return filterInboxByTags(items, selected);
}

export function tagFilterChoices(items: readonly InboxTagFields[]) {
  const seen = new Map<string, string>();
  for (const item of items) {
    for (const tag of resolvedListTags(item.tags ?? [], item.leadTags ?? [])) {
      const key = normalizeTagKey(tag);
      if (!key || seen.has(key)) continue;
      seen.set(key, tag.trim().replace(/\s+/g, " "));
    }
  }
  return [...seen.values()].sort((left, right) => left.localeCompare(right));
}

/** Chips for tags on this list, plus any chosen tag that is no longer on the list. */
export function tagFilterChips(choices: readonly string[], selected: readonly string[]) {
  return tagFilterChoices([
    { tags: choices, leadTags: [] },
    { tags: selected, leadTags: [] },
  ]);
}

export function toggleTagSelection(selected: readonly string[], tag: string) {
  const key = normalizeTagKey(tag);
  if (!key) return [...selected];
  const has = selected.some((item) => normalizeTagKey(item) === key);
  if (has) return selected.filter((item) => normalizeTagKey(item) !== key);
  return [...selected, tag.trim().replace(/\s+/g, " ")];
}

/** Lead ids to read when the contact has no tags. Contacts that already have tags are skipped. */
export function leadIdsForTagLookup(items: readonly { leadId: string; tags: readonly string[] }[]) {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (resolvedListTags(item.tags, []).length) continue;
    const id = item.leadId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function mergeLeadTags<T extends { leadId: string; tags: readonly string[]; leadTags: readonly string[] }>(
  items: readonly T[],
  rows: readonly { id?: unknown; tags?: unknown }[],
): T[] {
  const leads = new Map<string, string[]>();
  for (const row of rows) {
    const id = String(row.id || "").trim();
    if (!id) continue;
    leads.set(id, Array.isArray(row.tags) ? row.tags.map((tag) => String(tag)) : []);
  }
  return items.map((item) => {
    if (resolvedListTags(item.tags, []).length) return item;
    const id = item.leadId.trim();
    if (!id || !leads.has(id)) return item;
    return { ...item, leadTags: leads.get(id) ?? [] };
  });
}
