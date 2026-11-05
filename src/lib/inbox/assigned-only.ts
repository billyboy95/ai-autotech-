/**
 * Assigned-only inbox scope for /command-centre/inbox.
 * Off unless INBOX_ASSIGNED_ONLY_ENABLED is the exact string true after trim.
 * True, TRUE, 1, yes, blank, and unset stay off.
 * With the flag off, the list, chips, thread fetch, and realtime refresh stay
 * the ones main already uses. Open, Mine, and Unassigned are unchanged.
 * With the flag on, a membership whose assigned_only is true only reads
 * conversations assigned to that user. Unassigned and a search string cannot
 * widen that. A missing membership fails closed. Agency owners and members
 * who are not assigned_only keep the full workspace list.
 * This module does not insert crm_outbox, call a provider, change consent,
 * or assign a thread.
 */

import { acceptRealtimeRow, parseInboxChannel, parseInboxFilter, type InboxFilter } from "@/lib/inbox/rules";

export const INBOX_ASSIGNED_ONLY_FLAG = "INBOX_ASSIGNED_ONLY_ENABLED";

const ORG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INBOX_ASSIGNED_ONLY_SIDE_EFFECTS = {
  sends: false,
  outboxInsert: false,
  consentChange: false,
  autoAssign: false,
} as const;

export type InboxScope =
  | { kind: "main" }
  | { kind: "full" }
  | { kind: "own"; userId: string }
  | { kind: "closed" };

export type InboxScopeKind = InboxScope["kind"];

type ScopeRow = { data: { assigned_only?: boolean | null; role?: string | null; parent_org_id?: string | null } | null; error: { message: string } | null };

/** Loose on purpose. A strict builder type makes the Supabase client instantiate forever. */
export type InboxScopeClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): { maybeSingle(): PromiseLike<ScopeRow> };
        maybeSingle(): PromiseLike<ScopeRow>;
      };
    };
  };
};

export function inboxAssignedOnlyEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_ASSIGNED_ONLY_FLAG] ?? "").trim() === "true";
}

export function inboxScopeFromKind(kind: InboxScopeKind, userId: string | null): InboxScope {
  if (kind === "own") return userId ? { kind: "own", userId } : { kind: "closed" };
  if (kind === "full") return { kind: "full" };
  if (kind === "closed") return { kind: "closed" };
  return { kind: "main" };
}

/**
 * Flag off is always main, even when the membership bit is set.
 * Flag on uses the membership row for this org. No row fails closed unless
 * the caller already resolved an agency role for this workspace (a parent
 * membership, not assigned_only on the child).
 */
export function resolveInboxScope(input: {
  enabled: boolean;
  userId: string | null;
  membership: { assignedOnly: boolean } | null;
  membershipError: boolean;
  orgRole: string | null;
}): InboxScope {
  if (!input.enabled) return { kind: "main" };
  if (input.membershipError || !input.userId) return { kind: "closed" };
  if (input.membership?.assignedOnly) return { kind: "own", userId: input.userId };
  if (input.membership) return { kind: "full" };
  if (input.orgRole === "agency_owner" || input.orgRole === "agency_staff") return { kind: "full" };
  return { kind: "closed" };
}

export async function loadInboxScopeForOrg(
  supabase: unknown,
  userId: string | null,
  orgId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<InboxScope> {
  const client = supabase as InboxScopeClient;
  if (!inboxAssignedOnlyEnabled(env)) return { kind: "main" };
  if (!userId || !orgId) return { kind: "closed" };
  const membership = await client.from("memberships").select("assigned_only, role").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
  if (membership.error) {
    return resolveInboxScope({ enabled: true, userId, membership: null, membershipError: true, orgRole: null });
  }
  if (membership.data) {
    return resolveInboxScope({
      enabled: true,
      userId,
      membership: { assignedOnly: Boolean(membership.data.assigned_only) },
      membershipError: false,
      orgRole: membership.data.role ? String(membership.data.role) : null,
    });
  }
  const org = await client.from("organizations").select("parent_org_id").eq("id", orgId).maybeSingle();
  if (org.error || !org.data?.parent_org_id) {
    return resolveInboxScope({ enabled: true, userId, membership: null, membershipError: Boolean(org.error), orgRole: null });
  }
  const parent = await client
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", String(org.data.parent_org_id))
    .maybeSingle();
  if (parent.error || !parent.data) {
    return resolveInboxScope({ enabled: true, userId, membership: null, membershipError: Boolean(parent.error), orgRole: null });
  }
  const role = String(parent.data.role || "");
  const orgRole = role === "agency_owner" || role === "agency_staff" ? role : null;
  return resolveInboxScope({ enabled: true, userId, membership: null, membershipError: false, orgRole });
}

export function conversationVisible(scope: InboxScope, row: { assignedUserId: string | null }, userId: string | null) {
  if (scope.kind === "closed") return false;
  if (scope.kind === "own") return Boolean(userId) && row.assignedUserId === scope.userId && row.assignedUserId === userId;
  return true;
}

export type InboxListConstraint = {
  filter: InboxFilter;
  channel: string;
  excludeClosed: boolean;
  assignedUserId: string | null;
  unassigned: boolean;
  refuseAll: boolean;
  sends: false;
  outboxInsert: false;
  consentChange: false;
  autoAssign: false;
};

/**
 * Main and full keep today's read: hide closed, then Mine or Unassigned.
 * Own always pins assigned_user_id to the member. Unassigned is ignored.
 * A search string is not a query here; callers that match text must AND it
 * and must not drop the assignee pin.
 */
export function inboxListConstraint(input: {
  scope: InboxScope;
  filter: string | null | undefined;
  channel: string | null | undefined;
  userId: string | null;
}): InboxListConstraint {
  const filter = parseInboxFilter(input.filter);
  const channel = parseInboxChannel(input.channel);
  const side = INBOX_ASSIGNED_ONLY_SIDE_EFFECTS;
  if (input.scope.kind === "closed") {
    return { ...side, filter: "open", channel, excludeClosed: true, assignedUserId: null, unassigned: false, refuseAll: true };
  }
  if (input.scope.kind === "own") {
    return {
      ...side,
      filter: filter === "unassigned" ? "open" : filter,
      channel,
      excludeClosed: true,
      assignedUserId: input.scope.userId,
      unassigned: false,
      refuseAll: false,
    };
  }
  return {
    ...side,
    filter,
    channel,
    excludeClosed: true,
    assignedUserId: filter === "mine" && input.userId ? input.userId : null,
    unassigned: filter === "unassigned",
    refuseAll: false,
  };
}

export function conversationRowVisible(input: {
  constraint: InboxListConstraint;
  status: string;
  assignedUserId: string | null;
  channel: string;
  haystack?: string;
  search?: string | null;
}) {
  if (input.constraint.refuseAll) return false;
  if (input.constraint.excludeClosed && input.status === "closed") return false;
  if (input.constraint.assignedUserId && input.assignedUserId !== input.constraint.assignedUserId) return false;
  if (input.constraint.unassigned && input.assignedUserId != null) return false;
  if (input.constraint.channel && input.channel !== input.constraint.channel) return false;
  const search = String(input.search ?? "").trim().toLowerCase();
  if (search && !String(input.haystack ?? "").toLowerCase().includes(search)) return false;
  return true;
}

export function inboxFilterChips(scope: InboxScope): InboxFilter[] {
  if (scope.kind === "own" || scope.kind === "closed") return ["open", "mine"];
  return ["open", "mine", "unassigned"];
}

export function selectInboxThreadId(scope: InboxScope, requestedId: string | null | undefined, visibleIds: string[]) {
  if (scope.kind === "closed") return null;
  if (requestedId && visibleIds.includes(requestedId)) return requestedId;
  return visibleIds[0] ?? null;
}

export function acceptInboxRealtime(input: {
  scope: InboxScope;
  sessionOrgId: string;
  rowOrgId: string | null | undefined;
  table: "conversations" | "messages" | "conversation_notes";
  assignedUserId?: string | null;
  userId: string | null;
}) {
  if (input.scope.kind === "closed") return false;
  if (!acceptRealtimeRow(input.sessionOrgId, input.rowOrgId)) return false;
  if (input.scope.kind !== "own") return true;
  if (input.table !== "conversations") return true;
  return input.assignedUserId != null && input.assignedUserId === input.scope.userId && input.assignedUserId === input.userId;
}

/** A realtime payload cannot add a thread the scope does not already allow. */
export function realtimeConversationIds(input: {
  scope: InboxScope;
  userId: string | null;
  sessionOrgId: string;
  ids: string[];
  event: {
    table: "conversations" | "messages" | "conversation_notes";
    orgId: string | null;
    id?: string | null;
    assignedUserId?: string | null;
  };
}) {
  const accept = acceptInboxRealtime({
    scope: input.scope,
    sessionOrgId: input.sessionOrgId,
    rowOrgId: input.event.orgId,
    table: input.event.table,
    assignedUserId: input.event.assignedUserId,
    userId: input.userId,
  });
  const side = INBOX_ASSIGNED_ONLY_SIDE_EFFECTS;
  if (!accept || input.event.table !== "conversations" || !input.event.id) {
    return { accept, ids: input.ids, ...side };
  }
  if (!conversationVisible(input.scope, { assignedUserId: input.event.assignedUserId ?? null }, input.userId)) {
    return { accept: false, ids: input.ids, ...side };
  }
  const ids = input.ids.includes(input.event.id) ? input.ids : [...input.ids, input.event.id];
  return { accept: true, ids, ...side };
}

export function unreadScope(input: {
  enabled: boolean;
  memberships: { orgId: string; assignedOnly: boolean }[] | null;
}): { mode: "main" } | { mode: "closed" } | { mode: "scoped"; restrictedOrgIds: string[] } {
  if (!input.enabled) return { mode: "main" };
  if (!input.memberships || input.memberships.length === 0) return { mode: "closed" };
  const restrictedOrgIds: string[] = [];
  for (const row of input.memberships) {
    if (!row.assignedOnly) continue;
    if (!ORG_ID.test(row.orgId)) return { mode: "closed" };
    restrictedOrgIds.push(row.orgId.toLowerCase());
  }
  return { mode: "scoped", restrictedOrgIds };
}

export function sumVisibleUnread(input: {
  restrictedOrgIds: string[];
  userId: string;
  rows: { orgId: string; assignedUserId: string | null; unread: number }[];
}) {
  const restricted = new Set(input.restrictedOrgIds.map((id) => id.toLowerCase()));
  return input.rows.reduce((sum, row) => {
    if (restricted.has(row.orgId.toLowerCase()) && row.assignedUserId !== input.userId) return sum;
    const unread = Number(row.unread);
    return sum + (Number.isFinite(unread) && unread > 0 ? unread : 0);
  }, 0);
}
