import { missingAiTable, parseAiDraft, parseAiReplySettings } from "@/lib/ai-reply/types";
import {
  conversationRowVisible,
  conversationVisible,
  inboxAssignedOnlyEnabled,
  inboxListConstraint,
  resolveInboxScope,
  selectInboxThreadId,
  sumVisibleUnread,
  unreadScope,
  type InboxScope,
} from "@/lib/inbox/assigned-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { inboxBulkActionsEnabled } from "@/lib/inbox/bulk";
import { inboxContactPanelEnabled } from "@/lib/inbox/contact-panel";
import { inboxInternalNotesEnabled } from "@/lib/inbox/internal-notes";
import { inboxSearchEnabled, INBOX_SEARCH_PREVIEW_CAP, latestMessagePreviews, searchListFields, withMessagePreviews } from "@/lib/inbox/search";
import { INBOX_MESSAGE_COLUMNS, INBOX_MESSAGE_COLUMNS_WITH_MEDIA, inboxMediaEnabled, parseMessageMedia } from "@/lib/inbox/media";
import { inboxOutboundMediaEnabled } from "@/lib/inbox/outbound-media";
import { inboxListSelect, inboxTagFilterEnabled, leadIdsForTagLookup, listTagFields, mergeLeadTags } from "@/lib/inbox/tag-filter";
import { inboxTemplatesPickerEnabled } from "@/lib/inbox/templates-picker";
import { displayPhoneFromConfig, inboxMultiNumberEnabled, parseInboxNumber, resolveInboxNumber, whatsappNumberParts } from "@/lib/inbox/numbers";
import { INBOX_TEAM_STATS_MESSAGE_CAP, buildInboxTeamStats, inboxTeamStatsEnabled, type TeamStatsMessage } from "@/lib/inbox/team-stats";
import { inboxQuickUxEnabled, quickRepliesForWorkspace } from "@/lib/inbox/quick-ux";
import { inboxWaWindowEnabled } from "@/lib/inbox/wa-window";
import {
  buildServiceMeters,
  countServiceSendsByConnection,
  inboxWaMeteringEnabled,
  meteringTimezone,
  monthWindow,
  waMeterNumbers,
  WA_METER_TIMEZONE,
  type ServiceSendRow,
} from "@/lib/inbox/wa-metering";
import { contactLookup, matchesInboxList, parseInboxChannel, parseInboxFilter } from "@/lib/inbox/rules";
import { activeSnoozeLabel, inboxSnoozeEnabled, missingSnoozeColumn, SNOOZE_COLUMN_MISSING } from "@/lib/inbox/snooze";
import { conversationListQuery, inboxStatusAssigneeFiltersEnabled, parseStatusAssigneeFilter } from "@/lib/inbox/status-filter";
import { previewInbox } from "@/lib/inbox/preview";
import type { InboxConsent, InboxContact, InboxData, InboxListItem, InboxMessage, InboxNote, InboxThread } from "@/lib/inbox/types";

export async function loadInboxUnread() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return 0;
  try {
    const supabase = await createSupabaseServerClient();
    const user = await supabase.auth.getUser();
    if (!user.data.user) return 0;
    if (!inboxAssignedOnlyEnabled()) {
      const listed = await supabase.from("conversations").select("unread_count").neq("status", "closed");
      if (listed.error) return 0;
      return (listed.data ?? []).reduce((sum, row) => sum + Number(row.unread_count || 0), 0);
    }
    const memberships = await supabase.from("memberships").select("org_id, assigned_only").eq("user_id", user.data.user.id);
    const decision = unreadScope({
      enabled: true,
      memberships: memberships.error
        ? null
        : (memberships.data ?? []).map((row) => ({ orgId: String(row.org_id), assignedOnly: Boolean(row.assigned_only) })),
    });
    if (decision.mode !== "scoped") return 0;
    if (decision.restrictedOrgIds.length === 0) {
      const listed = await supabase.from("conversations").select("unread_count").neq("status", "closed");
      if (listed.error) return 0;
      return (listed.data ?? []).reduce((sum, row) => sum + Number(row.unread_count || 0), 0);
    }
    const userId = user.data.user.id;
    const mine = await supabase
      .from("conversations")
      .select("unread_count, org_id, assigned_user_id")
      .neq("status", "closed")
      .in("org_id", decision.restrictedOrgIds)
      .eq("assigned_user_id", userId);
    if (mine.error) return 0;
    const others = await supabase
      .from("conversations")
      .select("unread_count, org_id, assigned_user_id")
      .neq("status", "closed")
      .not("org_id", "in", `(${decision.restrictedOrgIds.join(",")})`);
    if (others.error) return 0;
    const rows = [...(mine.data ?? []), ...(others.data ?? [])].map((row) => ({
      orgId: String(row.org_id),
      assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
      unread: Number(row.unread_count || 0),
    }));
    return sumVisibleUnread({ restrictedOrgIds: decision.restrictedOrgIds, userId, rows });
  } catch {
    return 0;
  }
}

export async function loadInbox(query: {
  org?: string;
  filter?: string;
  channel?: string;
  id?: string;
  number?: string;
  notice?: string | null;
}): Promise<InboxData> {
  const statusFiltersEnabled = inboxStatusAssigneeFiltersEnabled();
  const snoozeEnabled = inboxSnoozeEnabled();
  const filter = query.filter === "snoozed"
    ? parseInboxFilter(query.filter, { snoozeEnabled })
    : parseStatusAssigneeFilter(query.filter, statusFiltersEnabled);
  const channel = parseInboxChannel(query.channel);
  const multiNumber = inboxMultiNumberEnabled();
  const waWindowEnabled = inboxWaWindowEnabled();
  const waMeteringEnabled = inboxWaMeteringEnabled();
  const loadedAt = new Date().toISOString();
  const tenant = await safeResolveWorkspace(query.org);
  if (
    tenant.requiresLogin
    || !tenant.role
    || !process.env.NEXT_PUBLIC_SUPABASE_URL
    || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || !tenant.scoped
    || tenant.active.id.startsWith("preview-")
  ) {
    return previewInbox({
      ...query,
      filter,
      statusFilters: statusFiltersEnabled,
      snoozeEnabled,
      channel,
      notice: query.notice,
      brandSlug: tenant.brandLocked ? tenant.active.slug : null,
    });
  }

  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id ?? null;
  const base: InboxData = {
    preview: false,
    orgId: tenant.active.id,
    orgSlug: tenant.active.slug,
    userId,
    assignedOnly: false,
    inboxScope: "main",
    sendingEnabled: tenant.active.sendingEnabled,
    filter,
    statusFiltersEnabled,
    snoozeEnabled,
    channel,
    multiNumber,
    number: "",
    whatsappNumbers: [],
    conversations: [],
    thread: null,
    templates: [],
    connections: [],
    members: [],
    teamStats: null,
    waWindowEnabled,
    waMeteringEnabled,
    waTimezone: "",
    waMeters: [],
    quickUx: false,
    bulkActions: inboxBulkActionsEnabled(),
    contactPanel: inboxContactPanelEnabled(),
    internalNotes: inboxInternalNotesEnabled(),
    templatesPicker: inboxTemplatesPickerEnabled(),
    search: inboxSearchEnabled(),
    tagFilter: inboxTagFilterEnabled(),
    media: inboxMediaEnabled(),
    outboundMedia: inboxOutboundMediaEnabled(),
    quickReplies: [],
    presence: [],
    loadedAt,
    serviceUsed: 0,
    notice: query.notice ?? null,
    aiEnabled: false,
    aiMode: "draft_only",
    aiRequireHuman: true,
    draft: null,
  };

  let scope: InboxScope = { kind: "main" };
  if (inboxQuickUxEnabled()) {
    base.quickUx = true;
    base.quickReplies = await loadQuickReplies(supabase, tenant.active.id);
  }

  if (userId) {
    const membership = await supabase
      .from("memberships")
      .select("assigned_only")
      .eq("user_id", userId)
      .eq("org_id", tenant.active.id)
      .maybeSingle();
    if (!membership.error && membership.data) base.assignedOnly = Boolean(membership.data.assigned_only);
    if (inboxAssignedOnlyEnabled()) {
      scope = resolveInboxScope({
        enabled: true,
        userId,
        membership: !membership.error && membership.data ? { assignedOnly: Boolean(membership.data.assigned_only) } : null,
        membershipError: Boolean(membership.error),
        orgRole: tenant.role,
      });
    }
  } else if (inboxAssignedOnlyEnabled()) {
    scope = { kind: "closed" };
  }
  const constraint = inboxListConstraint({ scope, filter: query.filter, channel: query.channel, userId });
  const closedList = statusFiltersEnabled && filter === "closed" && scope.kind !== "closed";
  if (inboxAssignedOnlyEnabled()) {
    base.inboxScope = scope.kind;
    if (!closedList) base.filter = constraint.filter;
    base.channel = constraint.channel;
    if (constraint.refuseAll) {
      return { ...base, conversations: [], thread: null, notice: "This login has no workspace membership on this inbox. Nothing was sent." };
    }
  }

  const connections = await supabase
    .from("channel_connections")
    .select("id, channel, display_name, identifier, public_config")
    .eq("org_id", tenant.active.id);
  if (!connections.error) {
    base.connections = (connections.data ?? []).map((row) => ({
      id: String(row.id),
      channel: String(row.channel),
      label: String(row.display_name || row.identifier || row.channel),
    }));
    if (multiNumber) {
      base.whatsappNumbers = (connections.data ?? [])
        .filter((row) => String(row.channel) === "whatsapp")
        .map((row) => ({
          id: String(row.id),
          ...whatsappNumberParts({
            displayName: String(row.display_name || ""),
            identifier: String(row.identifier || ""),
            displayPhone: displayPhoneFromConfig(row.public_config),
          }),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      base.number = resolveInboxNumber(
        parseInboxNumber(query.number),
        base.whatsappNumbers.map((item) => item.id),
      );
    }
  }

  const listPlan = conversationListQuery({ enabled: statusFiltersEnabled, filter: query.filter, userId });
  let listed = supabase
    .from("conversations")
    .select(inboxListSelect(base.search, base.tagFilter))
    .eq("org_id", tenant.active.id)
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (inboxAssignedOnlyEnabled() && scope.kind === "own") {
    listed = listed.eq("assigned_user_id", scope.userId);
    listed = closedList ? listed.eq("status", "closed") : listed.neq("status", "closed");
  } else if (inboxAssignedOnlyEnabled() && !closedList) {
    if (constraint.excludeClosed) listed = listed.neq("status", "closed");
    if (constraint.assignedUserId) listed = listed.eq("assigned_user_id", constraint.assignedUserId);
    if (constraint.unassigned) listed = listed.is("assigned_user_id", null);
  } else {
    if (listPlan.onlyClosed) listed = listed.eq("status", "closed");
    if (listPlan.excludeClosed) listed = listed.neq("status", "closed");
    if (listPlan.assignedUserId) listed = listed.eq("assigned_user_id", listPlan.assignedUserId);
    if (listPlan.unassigned) listed = listed.is("assigned_user_id", null);
  }
  if (inboxAssignedOnlyEnabled() && constraint.channel) listed = listed.eq("channel", constraint.channel);
  else if (channel) listed = listed.eq("channel", channel);
  if (base.number) listed = listed.eq("channel", "whatsapp").eq("channel_connection_id", base.number);
  const conversations = await listed;
  if (conversations.error) {
    await attachWaMeters(supabase, tenant.active.id, base);
    if (missingInboxTable(conversations.error.message)) {
      return { ...base, notice: "Inbox tables are not in this database yet. Apply phase 2e before using the inbox. Nothing was sent." };
    }
    if (snoozeEnabled && missingSnoozeColumn(conversations.error.message)) {
      return { ...base, notice: SNOOZE_COLUMN_MISSING };
    }
    return { ...base, notice: conversations.error.message };
  }

  let mapped = (conversations.data ?? []).map((row) => {
    const contact = one(row.crm_contacts) as {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone_e164?: string;
      whatsapp_e164?: string;
      tags?: string[] | null;
      lead_id?: string | null;
    } | null;
    const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ");
    const address = searchListFields(
      base.search ? { email: contact?.email, phone: contact?.phone_e164, whatsapp: contact?.whatsapp_e164 } : null,
      base.search,
    );
    const listedTags = listTagFields(
      base.tagFilter ? { tags: contact?.tags, leadTags: [] } : null,
      base.tagFilter,
    );
    return {
      id: String(row.id),
      channel: String(row.channel),
      status: String(row.status),
      assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
      connectionId: row.channel_connection_id ? String(row.channel_connection_id) : null,
      unread: Number(row.unread_count || 0),
      lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
      windowExpiresAt: row.wa_window_expires_at ? String(row.wa_window_expires_at) : null,
      snoozedUntil: null as string | null,
      snoozeLabel: null as string | null,
      contactName: name || "Unknown contact",
      preview: "",
      phone: address.phone,
      email: address.email,
      tags: listedTags.tags,
      leadTags: listedTags.leadTags,
      leadId: base.tagFilter && contact?.lead_id ? String(contact.lead_id) : "",
    };
  }).filter((item) => !inboxAssignedOnlyEnabled() || conversationRowVisible({
    constraint: closedList
      ? { ...constraint, excludeClosed: false, unassigned: false, assignedUserId: scope.kind === "own" ? scope.userId : null }
      : constraint,
    status: item.status,
    assignedUserId: item.assignedUserId,
    channel: item.channel,
    haystack: item.contactName,
  }));
  const snoozeNow = new Date();
  if (snoozeEnabled && mapped.length > 0) {
    const snoozeLookup = await supabase
      .from("conversations")
      .select("id, snoozed_until")
      .in("id", mapped.map((item) => item.id));
    if (snoozeLookup.error) {
      if (missingSnoozeColumn(snoozeLookup.error.message)) base.notice = SNOOZE_COLUMN_MISSING;
    } else {
      const untilById = new Map((snoozeLookup.data ?? []).map((row) => [String(row.id), row.snoozed_until ? String(row.snoozed_until) : null]));
      mapped = mapped.map((item) => {
        const until = untilById.get(item.id) ?? null;
        return { ...item, snoozedUntil: until, snoozeLabel: activeSnoozeLabel(until, snoozeNow) };
      });
    }
  }
  mapped = mapped.filter((item) => matchesInboxList({
    status: item.status,
    assignedUserId: item.assignedUserId,
    channel: item.channel,
    filter,
    channelFilter: channel,
    userId,
    snoozedUntil: item.snoozedUntil,
    now: snoozeNow,
    snoozeEnabled,
  }));
  const tagged = await attachInboxLeadTags(supabase, tenant.active.id, mapped, base.tagFilter);
  base.conversations = tagged.map(publishedListItem);
  base.conversations = await attachInboxSearchPreviews(supabase, tenant.active.id, base.conversations, base.search);

  const visibleIds = base.conversations.map((item) => item.id);
  const selected = inboxAssignedOnlyEnabled()
    ? selectInboxThreadId(scope, query.id, visibleIds)
    : (query.id && visibleIds.includes(query.id) ? query.id : visibleIds[0]);
  if (selected) {
    const thread = await loadThread(supabase, tenant.active.id, selected, base.contactPanel, base.internalNotes, base.media, snoozeEnabled);
    if (thread && (!inboxAssignedOnlyEnabled() || conversationVisible(scope, { assignedUserId: thread.assignedUserId }, userId))) {
      base.thread = thread;
    }
  }

  const [templates, members] = await Promise.all([
    supabase.from("message_templates").select("id, name, channel, subject, body, wa_category, wa_status, active").eq("org_id", tenant.active.id).eq("active", true),
    supabase.from("memberships").select("user_id, role").eq("org_id", tenant.active.id),
  ]);
  if (!templates.error) {
    base.templates = (templates.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name || "Template"),
      channel: String(row.channel),
      subject: String(row.subject || ""),
      body: String(row.body || ""),
      waCategory: String(row.wa_category || ""),
      approved: String(row.wa_status || "") === "approved" || String(row.channel) !== "whatsapp",
    }));
  }
  if (!members.error) {
    base.members = (members.data ?? []).map((row) => ({ userId: String(row.user_id), role: String(row.role) }));
  }

  const connectionId = base.thread?.connectionId || base.connections.find((item) => item.channel === "whatsapp")?.id || null;
  if (connectionId && isUuid(connectionId)) {
    const counted = await supabase.rpc("wa_service_sends_this_month", { p_org: tenant.active.id, p_connection: connectionId });
    if (!counted.error && typeof counted.data === "number") base.serviceUsed = counted.data;
  }

  try {
    const settings = await supabase.from("ai_reply_settings").select("*").eq("org_id", tenant.active.id).maybeSingle();
    if (!settings.error && settings.data) {
      const parsed = parseAiReplySettings(settings.data);
      base.aiEnabled = parsed.enabled;
      base.aiMode = parsed.mode;
      base.aiRequireHuman = parsed.requireHumanBeforeSend;
    } else if (settings.error && !missingAiTable(settings.error.message)) {
      base.notice = base.notice || settings.error.message;
    }
    if (base.thread) {
      const drafts = await supabase
        .from("ai_drafts")
        .select("id, status, draft_body, consent_ok, model_meta, created_at")
        .eq("conversation_id", base.thread.id)
        .eq("org_id", tenant.active.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!drafts.error) base.draft = parseAiDraft(drafts.data?.[0] ?? null);
    }
  } catch {
    // A missing Conversation AI migration must not take down the inbox.
  }
  await attachWaMeters(supabase, tenant.active.id, base);
  if (inboxTeamStatsEnabled()) {
    base.teamStats = await loadInboxTeamStats(supabase, tenant.active.id, base);
  }
  return base;
}

async function attachWaMeters(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  base: InboxData,
) {
  if (!base.waMeteringEnabled) return;
  try {
    const loaded = await loadWaServiceMeters(supabase, orgId, base);
    base.waTimezone = loaded.timezone;
    base.waMeters = loaded.meters;
  } catch {
    base.waTimezone = WA_METER_TIMEZONE;
    base.waMeters = [];
  }
}

async function loadWaServiceMeters(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  base: InboxData,
) {
  const timezone = await readMeterTimezone(supabase, orgId);
  const now = new Date();
  const numbers = waMeterNumbers({
    connections: base.connections,
    whatsappNumbers: base.whatsappNumbers,
    threadChannel: base.thread?.channel,
    threadConnectionId: base.thread?.connectionId,
  });
  if (numbers.length === 0) return { timezone, meters: [] };
  const counts = timezone === WA_METER_TIMEZONE
    ? await serviceCountsFromRpc(supabase, orgId, numbers)
    : null;
  const resolved = counts ?? await serviceCountsFromMessages(supabase, orgId, timezone, now);
  return {
    timezone,
    meters: buildServiceMeters({ numbers, counts: resolved, timezone, now }),
  };
}

async function readMeterTimezone(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
) {
  try {
    const org = await supabase.from("organizations").select("timezone").eq("id", orgId).maybeSingle();
    if (org.error || !org.data) return WA_METER_TIMEZONE;
    return meteringTimezone(String((org.data as { timezone?: string }).timezone || ""));
  } catch {
    return WA_METER_TIMEZONE;
  }
}

async function serviceCountsFromRpc(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  numbers: readonly { id: string }[],
) {
  if (!isUuid(orgId)) return null;
  const counts: Record<string, number> = {};
  for (const number of numbers) {
    if (!isUuid(number.id)) return null;
    const counted = await supabase.rpc("wa_service_sends_this_month", { p_org: orgId, p_connection: number.id });
    const used = rpcCount(counted.data);
    if (counted.error || used == null) return null;
    counts[number.id] = used;
  }
  return counts;
}

async function serviceCountsFromMessages(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  timezone: string,
  now: Date,
) {
  if (!isUuid(orgId)) return null;
  const window = monthWindow(now, timezone);
  const listed = await supabase
    .from("messages")
    .select("created_at, status, direction, channel, wa_category, conversations!inner(channel_connection_id)")
    .eq("org_id", orgId)
    .eq("channel", "whatsapp")
    .eq("direction", "out")
    .eq("wa_category", "service")
    .in("status", ["queued", "held", "sent"])
    .gte("created_at", window.start)
    .lt("created_at", window.end)
    .limit(5000);
  if (listed.error || !listed.data) return null;
  const rows: ServiceSendRow[] = (listed.data as Record<string, unknown>[]).map((row) => ({
    direction: String(row.direction || ""),
    channel: String(row.channel || ""),
    waCategory: String(row.wa_category || ""),
    status: String(row.status || ""),
    createdAt: String(row.created_at || ""),
    connectionId: connectionIdFromJoin(row.conversations),
  }));
  return countServiceSendsByConnection(rows, { now, timezone });
}

function connectionIdFromJoin(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const id = (row as { channel_connection_id?: string | null }).channel_connection_id;
  return id ? String(id) : null;
}

function rpcCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

async function loadQuickReplies(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
) {
  try {
    const org = await supabase.from("organizations").select("settings").eq("id", orgId).maybeSingle();
    if (org.error || !org.data) return quickRepliesForWorkspace(null);
    return quickRepliesForWorkspace(org.data.settings);
  } catch {
    return quickRepliesForWorkspace(null);
  }
}

async function loadInboxTeamStats(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  data: InboxData,
) {
  const ids = data.conversations.map((item) => item.id);
  let messages: TeamStatsMessage[] = [];
  let messagesLoaded = true;
  let truncated = false;
  if (ids.length > 0) {
    const listed = await supabase
      .from("messages")
      .select("conversation_id, direction, status, created_at, sent_by_user_id")
      .eq("org_id", orgId)
      .in("conversation_id", ids)
      .order("created_at", { ascending: true })
      .limit(INBOX_TEAM_STATS_MESSAGE_CAP);
    if (listed.error) {
      messagesLoaded = false;
    } else {
      const rows = listed.data ?? [];
      truncated = rows.length >= INBOX_TEAM_STATS_MESSAGE_CAP;
      messages = rows.map((row) => ({
        conversationId: String(row.conversation_id),
        direction: row.direction === "out" ? "out" : "in",
        createdAt: String(row.created_at || ""),
        status: String(row.status || ""),
        sentByUserId: row.sent_by_user_id ? String(row.sent_by_user_id) : null,
      }));
    }
  }
  return buildInboxTeamStats({
    now: new Date(),
    conversations: data.conversations,
    messages,
    members: data.members,
    userId: data.userId,
    messagesLoaded,
    truncated,
  });
}

async function attachInboxLeadTags(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  conversations: (InboxListItem & { leadId: string })[],
  enabled: boolean,
) {
  if (!enabled) return conversations;
  const ids = leadIdsForTagLookup(conversations);
  if (!isUuid(orgId) || ids.length === 0) return conversations;
  try {
    const listed = await supabase.from("crm_leads").select("id, tags").eq("org_id", orgId).in("id", ids);
    if (listed.error || !listed.data) return conversations;
    return mergeLeadTags(conversations, listed.data);
  } catch {
    return conversations;
  }
}

function publishedListItem(row: InboxListItem & { leadId: string }): InboxListItem {
  return {
    id: row.id,
    channel: row.channel,
    status: row.status,
    assignedUserId: row.assignedUserId,
    connectionId: row.connectionId,
    unread: row.unread,
    lastMessageAt: row.lastMessageAt,
    windowExpiresAt: row.windowExpiresAt,
    snoozedUntil: row.snoozedUntil,
    snoozeLabel: row.snoozeLabel,
    contactName: row.contactName,
    preview: row.preview,
    phone: row.phone,
    email: row.email,
    tags: row.tags,
    leadTags: row.leadTags,
  };
}

async function attachInboxSearchPreviews(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  conversations: InboxListItem[],
  enabled: boolean,
) {
  if (!enabled) return conversations;
  const ids = conversations.map((item) => item.id).filter(isUuid);
  if (!isUuid(orgId) || ids.length === 0) return conversations;
  try {
    const listed = await supabase
      .from("messages")
      .select("conversation_id, body, created_at")
      .eq("org_id", orgId)
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(INBOX_SEARCH_PREVIEW_CAP);
    if (listed.error || !listed.data) return conversations;
    return withMessagePreviews(conversations, latestMessagePreviews(listed.data));
  } catch {
    return conversations;
  }
}

async function loadThread(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  id: string,
  contactPanel = false,
  internalNotes = false,
  mediaEnabled = false,
  snoozeEnabled = false,
): Promise<InboxThread | null> {
  const conversation = await supabase
    .from("conversations")
    .select(`id, channel, status, assigned_user_id, channel_connection_id, wa_window_expires_at, contact_id${snoozeEnabled ? ", snoozed_until" : ""}, crm_contacts(id, first_name, last_name, email, phone_e164, whatsapp_e164, company, tags, lead_id)`)
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (conversation.error || !conversation.data) return null;
  const row = conversation.data as unknown as {
    id: string;
    channel: string;
    status: string;
    assigned_user_id: string | null;
    channel_connection_id: string | null;
    wa_window_expires_at: string | null;
    contact_id: string | null;
    snoozed_until?: string | null;
    crm_contacts: unknown;
  };
  const contactRow = one(row.crm_contacts) as {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_e164?: string;
    whatsapp_e164?: string;
    company?: string;
    tags?: string[] | null;
    lead_id?: string | null;
  } | null;
  let stage = "";
  let leadTags: string[] = [];
  if (contactRow?.lead_id) {
    const lead = await supabase.from("crm_leads").select("stage").eq("id", contactRow.lead_id).eq("org_id", orgId).maybeSingle();
    if (!lead.error && lead.data) stage = String(lead.data.stage || "");
  }
  if (contactPanel && contactRow?.lead_id) {
    const tagged = await supabase.from("crm_leads").select("tags").eq("id", contactRow.lead_id).eq("org_id", orgId).maybeSingle();
    if (!tagged.error && Array.isArray(tagged.data?.tags)) {
      leadTags = tagged.data.tags.map((tag: unknown) => String(tag));
    }
  }
  const contact: InboxContact | null = contactRow?.id
    ? {
        id: String(contactRow.id),
        name: [contactRow.first_name, contactRow.last_name].filter(Boolean).join(" ") || "Contact",
        email: String(contactRow.email || ""),
        phone: String(contactRow.phone_e164 || ""),
        whatsapp: String(contactRow.whatsapp_e164 || ""),
        company: String(contactRow.company || ""),
        tags: Array.isArray(contactRow.tags) ? contactRow.tags.map(String) : [],
        leadTags,
        stage,
        leadId: contactRow.lead_id ? String(contactRow.lead_id) : null,
      }
    : null;

  const [messages, notes, consents] = await Promise.all([
    loadThreadMessages(supabase, id, mediaEnabled),
    internalNotes
      ? supabase.from("conversation_notes").select("id, body, created_at, author_user_id").eq("conversation_id", id).eq("org_id", orgId).order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    contact ? supabase.from("contact_consents").select("channel, purpose, status, captured_at").eq("contact_id", contact.id).order("captured_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    id: String(row.id),
    channel: String(row.channel),
    status: String(row.status),
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    connectionId: row.channel_connection_id ? String(row.channel_connection_id) : null,
    windowExpiresAt: row.wa_window_expires_at ? String(row.wa_window_expires_at) : null,
    snoozedUntil: row.snoozed_until ? String(row.snoozed_until) : null,
    snoozeLabel: snoozeEnabled ? activeSnoozeLabel(row.snoozed_until ? String(row.snoozed_until) : null, new Date()) : null,
    contact,
    messages: messages.rows.map((row) => mapMessage(row, messages.withMedia)),
    notes: ((notes.error ? [] : notes.data ?? []) as Record<string, unknown>[]).map(mapNote),
    consents: consentRows(consents.data),
  };
}

async function loadThreadMessages(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  id: string,
  mediaEnabled: boolean,
) {
  const listed = mediaEnabled
    ? await supabase.from("messages").select(INBOX_MESSAGE_COLUMNS_WITH_MEDIA).eq("conversation_id", id).order("created_at", { ascending: true })
    : await supabase.from("messages").select(INBOX_MESSAGE_COLUMNS).eq("conversation_id", id).order("created_at", { ascending: true });
  if (mediaEnabled && listed.error) {
    const plain = await supabase.from("messages").select(INBOX_MESSAGE_COLUMNS).eq("conversation_id", id).order("created_at", { ascending: true });
    return { rows: messageRows(plain.data), withMedia: false };
  }
  return { rows: messageRows(listed.data), withMedia: mediaEnabled && !listed.error };
}

function messageRows(data: unknown) {
  return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
}

function mapMessage(row: Record<string, unknown>, withMedia: boolean): InboxMessage {
  return {
    id: String(row.id),
    direction: row.direction === "out" ? "out" : "in",
    body: String(row.body || ""),
    status: String(row.status || ""),
    channel: String(row.channel || ""),
    waCategory: String(row.wa_category || ""),
    costCents: Number(row.cost_cents || 0),
    providerMessageId: String(row.provider_message_id || ""),
    createdAt: String(row.created_at || ""),
    media: withMedia ? parseMessageMedia(row.media) : [],
  };
}

function mapNote(row: Record<string, unknown>): InboxNote {
  return {
    id: String(row.id),
    body: String(row.body || ""),
    createdAt: String(row.created_at || ""),
    authorUserId: row.author_user_id ? String(row.author_user_id) : null,
  };
}

function consentRows(data: unknown): InboxConsent[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const rows: InboxConsent[] = [];
  for (const row of data as { channel?: string; purpose?: string; status?: string }[]) {
    const key = `${row.channel}:${row.purpose}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ channel: String(row.channel || ""), purpose: String(row.purpose || ""), status: String(row.status || "") });
  }
  return rows;
}

function one<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function missingInboxTable(message: string) {
  const text = message.toLowerCase();
  return text.includes("conversations") && (text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find"));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function threadAddress(channel: string, contact: { email: string; phone: string; whatsapp: string }) {
  if (channel === "email") return contact.email;
  if (channel === "whatsapp") return contact.whatsapp || contact.phone;
  if (channel === "sms") return contact.phone;
  const lookup = contactLookup(channel, contact.phone || contact.email);
  return lookup.externalId || lookup.phone || lookup.email;
}
