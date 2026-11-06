/**
 * Open / Mine / Unassigned / Closed on the /command-centre/inbox list.
 * Off unless INBOX_STATUS_ASSIGNEE_FILTERS_ENABLED is the exact string true
 * after trimming spaces. True, TRUE, 1, and yes stay off.
 * With the flag off, Closed is not a chip and filter=closed is ignored.
 * Open, Mine, and Unassigned stay the list main already shows.
 * Open means not closed (open or pending). Mine is assigned_user_id = the
 * current user. Unassigned is assigned_user_id null. Closed is status closed.
 * Choosing a chip does not assign, close, change consent, insert crm_outbox,
 * call a provider, or turn sending_enabled on.
 */

import { parseInboxFilter, type InboxFilter } from "@/lib/inbox/rules";

export const INBOX_STATUS_ASSIGNEE_FILTERS_FLAG = "INBOX_STATUS_ASSIGNEE_FILTERS_ENABLED";

export function inboxStatusAssigneeFiltersEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_STATUS_ASSIGNEE_FILTERS_FLAG] ?? "").trim() === "true";
}

/** Closed is accepted only while the flag is on. Anything else uses today's parser. */
export function parseStatusAssigneeFilter(value: string | undefined | null, enabled: boolean): InboxFilter {
  if (enabled && value === "closed") return "closed";
  return parseInboxFilter(value);
}

export function inboxStatusFilterChips(enabled: boolean): InboxFilter[] {
  const chips: InboxFilter[] = ["open", "mine", "unassigned"];
  if (enabled) chips.push("closed");
  return chips;
}

export function inboxFilterLabel(filter: InboxFilter) {
  if (filter === "open") return "Open";
  if (filter === "mine") return "Mine";
  if (filter === "unassigned") return "Unassigned";
  if (filter === "closed") return "Closed";
  return "Snoozed";
}

export type ConversationListPlan = {
  filter: InboxFilter;
  excludeClosed: boolean;
  onlyClosed: boolean;
  assignedUserId: string | null;
  unassigned: boolean;
};

/**
 * The list read already on main: hide closed, then optionally match the assignee.
 * Closed replaces that read only when the flag is on and the chip is Closed.
 */
export function conversationListQuery(input: {
  enabled: boolean;
  filter: string | null | undefined;
  userId: string | null;
}): ConversationListPlan {
  const filter = parseStatusAssigneeFilter(input.filter, input.enabled);
  if (filter === "closed") {
    return {
      filter,
      excludeClosed: false,
      onlyClosed: true,
      assignedUserId: null,
      unassigned: false,
    };
  }
  return {
    filter,
    excludeClosed: true,
    onlyClosed: false,
    assignedUserId: filter === "mine" && input.userId ? input.userId : null,
    unassigned: filter === "unassigned",
  };
}

export function inboxFilterHref(input: {
  orgSlug: string;
  filter: string;
  channel: string;
  id?: string;
  statusFiltersEnabled: boolean;
}) {
  const filter = parseStatusAssigneeFilter(input.filter, input.statusFiltersEnabled);
  const params = new URLSearchParams();
  if (input.orgSlug && input.orgSlug !== "preview") params.set("org", input.orgSlug);
  if (filter !== "open") params.set("filter", filter);
  if (input.channel) params.set("channel", input.channel);
  if (input.id) params.set("id", input.id);
  const qs = params.toString();
  return qs ? `/command-centre/inbox?${qs}` : "/command-centre/inbox";
}
