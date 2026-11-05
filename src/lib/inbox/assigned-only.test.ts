import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  acceptInboxRealtime,
  conversationRowVisible,
  conversationVisible,
  inboxAssignedOnlyEnabled,
  inboxFilterChips,
  inboxListConstraint,
  INBOX_ASSIGNED_ONLY_SIDE_EFFECTS,
  loadInboxScopeForOrg,
  realtimeConversationIds,
  resolveInboxScope,
  selectInboxThreadId,
  sumVisibleUnread,
  unreadScope,
  type InboxScope,
  type InboxScopeClient,
} from "@/lib/inbox/assigned-only";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const EASTC = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const AGENCY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const ON = { INBOX_ASSIGNED_ONLY_ENABLED: "true" } as NodeJS.ProcessEnv;

const ROWS = [
  { id: "mine", status: "open", assignedUserId: ME, channel: "whatsapp", haystack: "Lerato Mokoena" },
  { id: "other", status: "open", assignedUserId: OTHER, channel: "whatsapp", haystack: "Thabo Ndlovu" },
  { id: "none", status: "open", assignedUserId: null, channel: "sms", haystack: "Unassigned desk" },
  { id: "closed-mine", status: "closed", assignedUserId: ME, channel: "email", haystack: "Closed Lerato" },
];

function visible(scope: InboxScope, filter: string, extras?: { channel?: string; search?: string; userId?: string | null }) {
  const userId = extras && "userId" in extras ? extras.userId ?? null : ME;
  const constraint = inboxListConstraint({ scope, filter, channel: extras?.channel, userId });
  return {
    constraint,
    ids: ROWS.filter((row) => conversationRowVisible({
      constraint,
      status: row.status,
      assignedUserId: row.assignedUserId,
      channel: row.channel,
      haystack: row.haystack,
      search: extras?.search,
    })).map((row) => row.id),
  };
}

test("the flag is on only for the exact string true after trim", () => {
  assert.equal(inboxAssignedOnlyEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(inboxAssignedOnlyEnabled({ INBOX_ASSIGNED_ONLY_ENABLED: "" } as NodeJS.ProcessEnv), false);
  assert.equal(inboxAssignedOnlyEnabled({ INBOX_ASSIGNED_ONLY_ENABLED: "   " } as NodeJS.ProcessEnv), false);
  for (const value of ["True", "TRUE", "1", "yes", "false", "true "]) {
    const enabled = value === "true " ? inboxAssignedOnlyEnabled({ INBOX_ASSIGNED_ONLY_ENABLED: value } as NodeJS.ProcessEnv) : inboxAssignedOnlyEnabled({ INBOX_ASSIGNED_ONLY_ENABLED: value } as NodeJS.ProcessEnv);
    if (value === "true ") assert.equal(enabled, true);
    else assert.equal(enabled, false, value);
  }
  assert.equal(inboxAssignedOnlyEnabled({ INBOX_ASSIGNED_ONLY_ENABLED: " true " } as NodeJS.ProcessEnv), true);
  assert.equal(inboxAssignedOnlyEnabled(ON), true);
});

test("flag off keeps the main list for an assigned_only membership", () => {
  const scope = resolveInboxScope({
    enabled: false,
    userId: ME,
    membership: { assignedOnly: true },
    membershipError: false,
    orgRole: "client_user",
  });
  assert.deepEqual(scope, { kind: "main" });
  assert.deepEqual(visible(scope, "open").ids, ["mine", "other", "none"]);
  assert.deepEqual(visible(scope, "mine").ids, ["mine"]);
  assert.deepEqual(visible(scope, "unassigned").ids, ["none"]);
  assert.deepEqual(inboxFilterChips(scope), ["open", "mine", "unassigned"]);
  assert.equal(selectInboxThreadId(scope, "other", visible(scope, "open").ids), "other");
});

test("flag on and assigned_only shows only that user's open threads", () => {
  const scope = resolveInboxScope({
    enabled: true,
    userId: ME,
    membership: { assignedOnly: true },
    membershipError: false,
    orgRole: "client_user",
  });
  assert.deepEqual(scope, { kind: "own", userId: ME });
  const open = visible(scope, "open");
  assert.equal(open.constraint.assignedUserId, ME);
  assert.equal(open.constraint.unassigned, false);
  assert.equal(open.constraint.outboxInsert, false);
  assert.equal(open.constraint.sends, false);
  assert.equal(open.constraint.autoAssign, false);
  assert.deepEqual(open.ids, ["mine"]);
  assert.deepEqual(visible(scope, "mine").ids, ["mine"]);
  assert.deepEqual(visible(scope, "unassigned").ids, ["mine"]);
  assert.equal(visible(scope, "unassigned").constraint.filter, "open");
  assert.deepEqual(visible(scope, "open", { search: "Thabo" }).ids, []);
  assert.deepEqual(visible(scope, "open", { search: "unassigned" }).ids, []);
  assert.deepEqual(visible(scope, "open", { search: "Lerato" }).ids, ["mine"]);
  assert.deepEqual(visible(scope, "open", { channel: "sms" }).ids, []);
  assert.deepEqual(inboxFilterChips(scope), ["open", "mine"]);
  assert.equal(selectInboxThreadId(scope, "other", open.ids), "mine");
  assert.equal(selectInboxThreadId(scope, "none", open.ids), "mine");
  assert.equal(conversationVisible(scope, { assignedUserId: OTHER }, ME), false);
  assert.equal(conversationVisible(scope, { assignedUserId: null }, ME), false);
  assert.equal(conversationVisible(scope, { assignedUserId: ME }, ME), true);
});

test("flag on keeps the full inbox for members who are not assigned_only", () => {
  for (const orgRole of ["agency_owner", "agency_staff", "client_admin", "client_user"]) {
    const scope = resolveInboxScope({
      enabled: true,
      userId: ME,
      membership: { assignedOnly: false },
      membershipError: false,
      orgRole,
    });
    assert.deepEqual(scope, { kind: "full" }, orgRole);
    assert.deepEqual(visible(scope, "open").ids, ["mine", "other", "none"]);
    assert.deepEqual(visible(scope, "unassigned").ids, ["none"]);
    assert.deepEqual(inboxFilterChips(scope), ["open", "mine", "unassigned"]);
    assert.equal(conversationVisible(scope, { assignedUserId: OTHER }, ME), true);
  }
  const viaParent = resolveInboxScope({
    enabled: true,
    userId: ME,
    membership: null,
    membershipError: false,
    orgRole: "agency_owner",
  });
  assert.deepEqual(viaParent, { kind: "full" });
  assert.deepEqual(visible(viaParent, "open").ids, visible({ kind: "main" }, "open").ids);
});

test("flag on fails closed when the membership is missing or the lookup errors", () => {
  for (const input of [
    { membership: null, membershipError: false, orgRole: "client_user" as string | null, userId: ME },
    { membership: null, membershipError: false, orgRole: "client_admin" as string | null, userId: ME },
    { membership: null, membershipError: false, orgRole: null, userId: ME },
    { membership: null, membershipError: true, orgRole: "agency_owner" as string | null, userId: ME },
    { membership: { assignedOnly: true }, membershipError: false, orgRole: "client_user" as string | null, userId: null },
  ]) {
    const scope = resolveInboxScope({ enabled: true, ...input });
    assert.equal(scope.kind, "closed");
    assert.deepEqual(visible(scope, "open").ids, []);
    assert.deepEqual(visible(scope, "unassigned").ids, []);
    assert.equal(selectInboxThreadId(scope, "mine", ["mine"]), null);
    assert.equal(conversationVisible(scope, { assignedUserId: ME }, ME), false);
    assert.deepEqual(inboxFilterChips(scope), ["open", "mine"]);
  }
});

test("realtime and search cannot add another person's thread", () => {
  const own: InboxScope = { kind: "own", userId: ME };
  assert.equal(acceptInboxRealtime({ scope: { kind: "main" }, sessionOrgId: EASTC, rowOrgId: EASTC, table: "conversations", assignedUserId: OTHER, userId: ME }), true);
  assert.equal(acceptInboxRealtime({ scope: { kind: "full" }, sessionOrgId: EASTC, rowOrgId: EASTC, table: "conversations", assignedUserId: null, userId: ME }), true);
  assert.equal(acceptInboxRealtime({ scope: own, sessionOrgId: EASTC, rowOrgId: AGENCY, table: "conversations", assignedUserId: ME, userId: ME }), false);
  assert.equal(acceptInboxRealtime({ scope: own, sessionOrgId: EASTC, rowOrgId: EASTC, table: "conversations", assignedUserId: OTHER, userId: ME }), false);
  assert.equal(acceptInboxRealtime({ scope: own, sessionOrgId: EASTC, rowOrgId: EASTC, table: "conversations", assignedUserId: null, userId: ME }), false);
  assert.equal(acceptInboxRealtime({ scope: own, sessionOrgId: EASTC, rowOrgId: EASTC, table: "conversations", userId: ME }), false);
  assert.equal(acceptInboxRealtime({ scope: own, sessionOrgId: EASTC, rowOrgId: EASTC, table: "conversations", assignedUserId: ME, userId: ME }), true);
  assert.equal(acceptInboxRealtime({ scope: { kind: "closed" }, sessionOrgId: EASTC, rowOrgId: EASTC, table: "messages", userId: ME }), false);

  const foreign = realtimeConversationIds({
    scope: own,
    userId: ME,
    sessionOrgId: EASTC,
    ids: ["mine"],
    event: { table: "conversations", orgId: EASTC, id: "other", assignedUserId: OTHER },
  });
  assert.equal(foreign.accept, false);
  assert.deepEqual(foreign.ids, ["mine"]);
  assert.equal(foreign.outboxInsert, false);
  assert.equal(foreign.sends, false);
  assert.equal(foreign.autoAssign, false);
  assert.equal(foreign.consentChange, false);

  const searched = realtimeConversationIds({
    scope: own,
    userId: ME,
    sessionOrgId: EASTC,
    ids: ["mine"],
    event: { table: "messages", orgId: EASTC, id: "msg-other", assignedUserId: OTHER },
  });
  assert.deepEqual(searched.ids, ["mine"]);
  assert.equal(searched.outboxInsert, false);

  const ownInsert = realtimeConversationIds({
    scope: own,
    userId: ME,
    sessionOrgId: EASTC,
    ids: ["mine"],
    event: { table: "conversations", orgId: EASTC, id: "mine-2", assignedUserId: ME },
  });
  assert.deepEqual(ownInsert.ids, ["mine", "mine-2"]);
  assert.deepEqual(INBOX_ASSIGNED_ONLY_SIDE_EFFECTS, { sends: false, outboxInsert: false, consentChange: false, autoAssign: false });
});

test("unread counts fail closed and skip other assignees in restricted orgs", () => {
  assert.deepEqual(unreadScope({ enabled: false, memberships: null }), { mode: "main" });
  assert.equal(unreadScope({ enabled: true, memberships: null }).mode, "closed");
  assert.equal(unreadScope({ enabled: true, memberships: [] }).mode, "closed");
  assert.equal(unreadScope({ enabled: true, memberships: [{ orgId: "not-a-uuid", assignedOnly: true }] }).mode, "closed");
  const scoped = unreadScope({
    enabled: true,
    memberships: [
      { orgId: EASTC, assignedOnly: true },
      { orgId: AGENCY, assignedOnly: false },
    ],
  });
  assert.deepEqual(scoped, { mode: "scoped", restrictedOrgIds: [EASTC] });
  const total = sumVisibleUnread({
    restrictedOrgIds: [EASTC],
    userId: ME,
    rows: [
      { orgId: EASTC, assignedUserId: ME, unread: 2 },
      { orgId: EASTC, assignedUserId: OTHER, unread: 9 },
      { orgId: EASTC, assignedUserId: null, unread: 4 },
      { orgId: AGENCY, assignedUserId: null, unread: 1 },
    ],
  });
  assert.equal(total, 3);
});

test("scope lookup does not query when the flag is off and fails closed without a membership", async () => {
  let calls = 0;
  const client = {
    from() {
      calls += 1;
      throw new Error("flag off must not read memberships");
    },
  } as unknown as InboxScopeClient;
  assert.deepEqual(await loadInboxScopeForOrg(client, ME, EASTC, {} as NodeJS.ProcessEnv), { kind: "main" });
  assert.equal(calls, 0);

  const closed = fakeClient({
    memberships: { data: null, error: null },
    organizations: { data: { parent_org_id: null }, error: null },
  });
  assert.equal((await loadInboxScopeForOrg(closed.client, ME, EASTC, ON)).kind, "closed");

  const agency = fakeClient({
    memberships: { data: null, error: null },
    organizations: { data: { parent_org_id: AGENCY }, error: null },
    parent: { data: { role: "agency_owner" }, error: null },
  });
  assert.deepEqual(await loadInboxScopeForOrg(agency.client, ME, EASTC, ON), { kind: "full" });

  const assigned = fakeClient({
    memberships: { data: { assigned_only: true, role: "client_user" }, error: null },
  });
  assert.deepEqual(await loadInboxScopeForOrg(assigned.client, ME, EASTC, ON), { kind: "own", userId: ME });
  assert.equal(assigned.lookups, 1);
  assert.equal(agency.lookups, 3);
});

test("inbox writes consult the scope before any outbox insert", () => {
  const inbox = readFileSync(new URL("../../app/actions/inbox.ts", import.meta.url), "utf8");
  const send = inbox.slice(inbox.indexOf("export async function sendInboxReply"), inbox.indexOf("export async function addInboxNote"));
  assert.ok(send.indexOf("conversationVisible") >= 0);
  assert.ok(send.indexOf("conversationVisible") < send.indexOf('from("crm_outbox")'));
  assert.equal(inbox.includes("sending_enabled = true"), false);
  const ai = readFileSync(new URL("../../app/actions/ai-reply.ts", import.meta.url), "utf8");
  const approve = ai.slice(ai.indexOf("export async function approveAiDraft"), ai.indexOf("export async function editAiDraft"));
  assert.ok(approve.indexOf("hiddenFromAssignee") >= 0);
  assert.ok(approve.indexOf("hiddenFromAssignee") < approve.indexOf('from("crm_outbox")'));
});

function fakeClient(input: {
  memberships: { data: { assigned_only?: boolean; role?: string } | null; error: { message: string } | null };
  organizations?: { data: { parent_org_id?: string | null } | null; error: { message: string } | null };
  parent?: { data: { role?: string } | null; error: { message: string } | null };
}) {
  let lookups = 0;
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => {
                      lookups += 1;
                      if (table !== "memberships") return { data: null, error: null };
                      if (lookups === 1) return input.memberships;
                      return input.parent ?? { data: null, error: { message: "no parent membership" } };
                    },
                  };
                },
                maybeSingle: async () => {
                  lookups += 1;
                  return input.organizations ?? { data: null, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as InboxScopeClient, get lookups() { return lookups; } };
}
