import { inboxBulkActionsEnabled } from "@/lib/inbox/bulk";
import { inboxContactPanelEnabled } from "@/lib/inbox/contact-panel";
import { inboxInternalNotesEnabled } from "@/lib/inbox/internal-notes";
import { inboxSearchEnabled, searchListFields } from "@/lib/inbox/search";
import { inboxTagFilterEnabled, listTagFields } from "@/lib/inbox/tag-filter";
import { inboxTemplatesPickerEnabled } from "@/lib/inbox/templates-picker";
import { inboxMultiNumberEnabled, matchesInboxNumber, parseInboxNumber, resolveInboxNumber, whatsappNumberParts } from "@/lib/inbox/numbers";
import { matchesInboxList, parseInboxChannel, parseInboxFilter, windowExpiry } from "@/lib/inbox/rules";
import { buildInboxTeamStats, inboxTeamStatsEnabled, type TeamStatsMessage } from "@/lib/inbox/team-stats";
import { inboxQuickUxEnabled, previewInboxPresence, quickRepliesForWorkspace } from "@/lib/inbox/quick-ux";
import { inboxWaWindowEnabled } from "@/lib/inbox/wa-window";
import {
  buildServiceMeters,
  countServiceSendsByConnection,
  inboxWaMeteringEnabled,
  waMeterNumbers,
  WA_METER_TIMEZONE,
  type ServiceSendRow,
} from "@/lib/inbox/wa-metering";
import type { InboxData, InboxTeamStats, InboxThread, InboxWhatsappNumber } from "@/lib/inbox/types";

const PREVIEW_ORG = "00000000-0000-4000-8000-0000000000aa";
const PREVIEW_USER = "00000000-0000-4000-8000-0000000000bb";
const OPEN_WA = "00000000-0000-4000-8000-000000000001";
const OPEN_SMS = "00000000-0000-4000-8000-000000000002";
const EXPIRED_WA = "00000000-0000-4000-8000-000000000003";
const DESK_WA = "00000000-0000-4000-8000-000000000004";
const PREVIEW_WA = "preview-wa";
const PREVIEW_WA_DESK = "preview-wa-desk";

const previewNumbers: InboxWhatsappNumber[] = [
  { id: PREVIEW_WA, displayName: "Admissions", identifier: "10000000000101", displayPhone: "+27115550101" },
  { id: PREVIEW_WA_DESK, displayName: "Front desk", identifier: "10000000000199", displayPhone: "+27825550199" },
].map((row) => ({ id: row.id, ...whatsappNumberParts(row) }));

const now = new Date("2026-09-26T12:00:00.000Z");

const threads: Record<string, InboxThread> = {
  [OPEN_WA]: {
    id: OPEN_WA,
    channel: "whatsapp",
    status: "open",
    assignedUserId: PREVIEW_USER,
    connectionId: PREVIEW_WA,
    windowExpiresAt: windowExpiry(now),
    contact: {
      id: "preview-contact",
      name: "Lerato Mokoena",
      email: "lerato@eastc.example",
      phone: "+27115550101",
      whatsapp: "+27115550101",
      company: "EASTC",
      tags: ["admissions"],
      stage: "Enquiry",
      leadId: "preview-lead",
    },
    messages: [
      {
        id: "preview-in",
        direction: "in",
        body: "Can I still apply for the October intake?",
        status: "received",
        channel: "whatsapp",
        waCategory: "service",
        costCents: 0,
        providerMessageId: "wamid.preview",
        createdAt: now.toISOString(),
      },
      {
        id: "preview-out",
        direction: "out",
        body: "Thanks Lerato. This reply is held in the outbox.",
        status: "held",
        channel: "whatsapp",
        waCategory: "service",
        costCents: 0,
        providerMessageId: "outbox:msg_preview",
        createdAt: now.toISOString(),
      },
    ],
    notes: [{
      id: "preview-note",
      body: "Asked for the prospectus. Not sent to the contact.",
      createdAt: now.toISOString(),
      authorUserId: PREVIEW_USER,
    }],
    consents: [
      { channel: "whatsapp", purpose: "service", status: "opted_in" },
      { channel: "whatsapp", purpose: "marketing", status: "opted_out" },
      { channel: "email", purpose: "marketing", status: "requested" },
    ],
  },
  [OPEN_SMS]: {
    id: OPEN_SMS,
    channel: "sms",
    status: "open",
    assignedUserId: null,
    connectionId: null,
    windowExpiresAt: null,
    contact: {
      id: "preview-sms",
      name: "Thabo Ndlovu",
      email: "",
      phone: "+27825550199",
      whatsapp: "",
      company: "Ndlovu Dental",
      tags: ["dental"],
      stage: "New",
      leadId: null,
    },
    messages: [
      {
        id: "preview-sms-in",
        direction: "in",
        body: "Please call the practice.",
        status: "received",
        channel: "sms",
        waCategory: "",
        costCents: 0,
        providerMessageId: "sms.preview",
        createdAt: now.toISOString(),
      },
    ],
    notes: [],
    consents: [{ channel: "sms", purpose: "service", status: "opted_in" }],
  },
  [EXPIRED_WA]: {
    id: EXPIRED_WA,
    channel: "whatsapp",
    status: "open",
    assignedUserId: null,
    connectionId: PREVIEW_WA,
    windowExpiresAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    contact: {
      id: "preview-expired",
      name: "Amina Patel",
      email: "amina@example.com",
      phone: "+27825550222",
      whatsapp: "+27825550222",
      company: "",
      tags: [],
      leadTags: ["follow-up"],
      stage: "Contacted",
      leadId: "preview-lead-amina",
    },
    messages: [
      {
        id: "preview-old",
        direction: "in",
        body: "Thanks, I will think about it.",
        status: "received",
        channel: "whatsapp",
        waCategory: "service",
        costCents: 0,
        providerMessageId: "wamid.old",
        createdAt: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
      },
    ],
    notes: [],
    consents: [],
  },
  [DESK_WA]: {
    id: DESK_WA,
    channel: "whatsapp",
    status: "open",
    assignedUserId: null,
    connectionId: PREVIEW_WA_DESK,
    windowExpiresAt: windowExpiry(now),
    contact: {
      id: "preview-desk",
      name: "Sipho Dlamini",
      email: "",
      phone: "+27825550199",
      whatsapp: "+27825550199",
      company: "Dlamini Panel",
      tags: ["workshop"],
      stage: "Booked",
      leadId: null,
    },
    messages: [
      {
        id: "preview-desk-in",
        direction: "in",
        body: "The bakkie is ready for collection.",
        status: "received",
        channel: "whatsapp",
        waCategory: "service",
        costCents: 0,
        providerMessageId: "wamid.desk",
        createdAt: now.toISOString(),
      },
    ],
    notes: [],
    consents: [{ channel: "whatsapp", purpose: "service", status: "opted_in" }],
  },
};

export function previewInbox(query: {
  filter?: string;
  channel?: string;
  id?: string;
  number?: string;
  multiNumber?: boolean;
  /** Explicit override. Omit to follow INBOX_TEAM_STATS_ENABLED. */
  teamStats?: boolean;
  /** Explicit override. Omit to follow INBOX_WA_WINDOW_ENABLED. */
  waWindow?: boolean;
  /** Explicit override. Omit to follow INBOX_QUICK_UX_ENABLED. */
  quickUx?: boolean;
  /** Explicit override. Omit to follow INBOX_BULK_ACTIONS_ENABLED. */
  bulkActions?: boolean;
  /** Explicit override. Omit to follow INBOX_CONTACT_PANEL_ENABLED. */
  contactPanel?: boolean;
  /** Explicit override. Omit to follow INBOX_INTERNAL_NOTES_ENABLED. */
  internalNotes?: boolean;
  /** Explicit override. Omit to follow INBOX_TEMPLATES_PICKER_ENABLED. */
  templatesPicker?: boolean;
  /** Explicit override. Omit to follow INBOX_SEARCH_ENABLED. */
  search?: boolean;
  /** Explicit override. Omit to follow INBOX_TAG_FILTER_ENABLED. */
  tagFilter?: boolean;
  /** Explicit override. Omit to follow INBOX_WA_METERING_ENABLED. */
  waMetering?: boolean;
  notice?: string | null;
  brandSlug?: string | null;
}): InboxData {
  const filter = parseInboxFilter(query.filter);
  const channel = parseInboxChannel(query.channel);
  const multiNumber = query.multiNumber ?? inboxMultiNumberEnabled();
  const teamStatsOn = query.teamStats ?? inboxTeamStatsEnabled();
  const waWindowEnabled = query.waWindow ?? inboxWaWindowEnabled();
  const quickUx = query.quickUx ?? inboxQuickUxEnabled();
  const bulkActions = query.bulkActions ?? inboxBulkActionsEnabled();
  const contactPanel = query.contactPanel ?? inboxContactPanelEnabled();
  const internalNotes = query.internalNotes ?? inboxInternalNotesEnabled();
  const templatesPicker = query.templatesPicker ?? inboxTemplatesPickerEnabled();
  const search = query.search ?? inboxSearchEnabled();
  const tagFilter = query.tagFilter ?? inboxTagFilterEnabled();
  const waMeteringEnabled = query.waMetering ?? inboxWaMeteringEnabled();
  const whatsappNumbers = multiNumber ? previewNumbers : [];
  const number = multiNumber
    ? resolveInboxNumber(parseInboxNumber(query.number), whatsappNumbers.map((item) => item.id))
    : "";
  const list = [
    { id: OPEN_WA, connectionId: PREVIEW_WA, channel: "whatsapp", status: "open", assignedUserId: PREVIEW_USER, unread: 1, preview: "Can I still apply for the October intake?", name: "Lerato Mokoena", window: threads[OPEN_WA].windowExpiresAt },
    { id: OPEN_SMS, connectionId: null, channel: "sms", status: "open", assignedUserId: null, unread: 0, preview: "Please call the practice.", name: "Thabo Ndlovu", window: null },
    { id: EXPIRED_WA, connectionId: PREVIEW_WA, channel: "whatsapp", status: "open", assignedUserId: null, unread: 2, preview: "Thanks, I will think about it.", name: "Amina Patel", window: threads[EXPIRED_WA].windowExpiresAt },
    ...(multiNumber
      ? [{ id: DESK_WA, connectionId: PREVIEW_WA_DESK, channel: "whatsapp", status: "open", assignedUserId: null, unread: 1, preview: "The bakkie is ready for collection.", name: "Sipho Dlamini", window: threads[DESK_WA].windowExpiresAt }]
      : []),
  ].filter((item) => {
    if (!query.brandSlug || query.brandSlug === "ai-autotech") return true;
    const company = threads[item.id]?.contact?.company ?? "";
    if (query.brandSlug === "eastc") return /eastc/i.test(company);
    return false;
  }).filter((item) => matchesInboxList({
    status: item.status,
    assignedUserId: item.assignedUserId,
    channel: item.channel,
    filter,
    channelFilter: channel,
    userId: PREVIEW_USER,
  })).filter((item) => matchesInboxNumber({
    enabled: multiNumber,
    numberId: number,
    channel: item.channel,
    connectionId: item.connectionId,
  }));
  const selected = query.id && list.some((item) => item.id === query.id) ? query.id : list[0]?.id;
  return {
    preview: true,
    orgId: PREVIEW_ORG,
    orgSlug: "preview",
    userId: PREVIEW_USER,
    assignedOnly: false,
    sendingEnabled: false,
    filter,
    channel,
    multiNumber,
    number,
    whatsappNumbers,
    conversations: list.map((item) => {
      const contact = threads[item.id]?.contact;
      const address = searchListFields(contact, search);
      const listedTags = listTagFields(contact, tagFilter);
      return {
        id: item.id,
        channel: item.channel,
        status: item.status,
        assignedUserId: item.assignedUserId,
        connectionId: item.connectionId,
        unread: item.unread,
        lastMessageAt: now.toISOString(),
        windowExpiresAt: item.window,
        contactName: item.name,
        preview: item.preview,
        phone: address.phone,
        email: address.email,
        tags: listedTags.tags,
        leadTags: listedTags.leadTags,
      };
    }),
    thread: threadForPreview(selected, internalNotes),
    templates: [
      {
        id: "preview-template",
        name: "Enrolment follow-up",
        channel: "whatsapp",
        subject: "",
        body: "Hi {{name}}, your application is still open. Reply YES and we will send the next step.",
        waCategory: "utility",
        approved: true,
      },
      {
        id: "preview-draft",
        name: "Open day invite",
        channel: "whatsapp",
        subject: "",
        body: "Join us on campus this Saturday.",
        waCategory: "marketing",
        approved: false,
      },
    ],
    connections: [{ id: PREVIEW_WA, channel: "whatsapp", label: "Preview WhatsApp · 1000 free from 1 Oct 2026" }],
    members: [{ userId: PREVIEW_USER, role: "client_admin" }],
    teamStats: teamStatsOn ? previewTeamStats(list) : null,
    waWindowEnabled,
    ...previewWaMetering(waMeteringEnabled, {
      whatsappNumbers,
      thread: selected ? threads[selected] ?? null : null,
    }),
    quickUx,
    bulkActions,
    contactPanel,
    internalNotes,
    templatesPicker,
    search,
    tagFilter,
    quickReplies: quickUx ? quickRepliesForWorkspace(null) : [],
    presence: quickUx ? previewInboxPresence(OPEN_WA, EXPIRED_WA) : [],
    loadedAt: now.toISOString(),
    serviceUsed: 12,
    notice: query.notice ?? "Preview inbox. Connect Supabase to load this workspace. Nothing here is delivered.",
    aiEnabled: false,
    aiMode: "draft_only",
    aiRequireHuman: true,
    draft: selected === OPEN_WA
      ? {
          id: "00000000-0000-4000-8000-0000000000d1",
          status: "pending_review",
          body: "Thanks Lerato. Applications for the October intake are still open.",
          consentOk: true,
          failure: "",
          reason: "",
          outboxStatus: "",
          createdAt: now.toISOString(),
        }
      : null,
  };
}

function threadForPreview(id: string | undefined, internalNotes: boolean): InboxThread | null {
  if (!id) return null;
  const thread = threads[id];
  if (!thread) return null;
  if (internalNotes) return thread;
  return { ...thread, notes: [] };
}

function previewWaMetering(
  enabled: boolean,
  input: { whatsappNumbers: InboxWhatsappNumber[]; thread: InboxThread | null },
) {
  if (!enabled) return { waMeteringEnabled: false as const, waTimezone: "", waMeters: [] };
  const connections = [{ id: PREVIEW_WA, channel: "whatsapp", label: "Preview WhatsApp · 1000 free from 1 Oct 2026" }];
  const numbers = waMeterNumbers({
    connections,
    whatsappNumbers: input.whatsappNumbers,
    threadChannel: input.thread?.channel,
    threadConnectionId: input.thread?.connectionId,
  });
  const rows: ServiceSendRow[] = [];
  for (const thread of Object.values(threads)) {
    for (const message of thread.messages) {
      rows.push({
        direction: message.direction,
        channel: message.channel,
        waCategory: message.waCategory,
        status: message.status,
        createdAt: message.createdAt,
        connectionId: thread.connectionId,
      });
    }
  }
  const counts = countServiceSendsByConnection(rows, { now, timezone: WA_METER_TIMEZONE });
  // Preview has no database. The admissions number reuses the fixture counter (serviceUsed).
  counts[PREVIEW_WA] = 12;
  return {
    waMeteringEnabled: true as const,
    waTimezone: WA_METER_TIMEZONE,
    waMeters: buildServiceMeters({ numbers, counts, timezone: WA_METER_TIMEZONE, now }),
  };
}

function previewTeamStats(list: { id: string; status: string; assignedUserId: string | null; name: string }[]): InboxTeamStats {
  const messages: TeamStatsMessage[] = [];
  for (const item of list) {
    const thread = threads[item.id];
    if (!thread) continue;
    for (const message of thread.messages) {
      messages.push({
        conversationId: item.id,
        direction: message.direction,
        createdAt: message.createdAt,
        status: message.status,
        sentByUserId: message.id === "preview-out" ? PREVIEW_USER : null,
      });
    }
  }
  return buildInboxTeamStats({
    now,
    conversations: list.map((item) => ({
      id: item.id,
      status: item.status,
      assignedUserId: item.assignedUserId,
      contactName: item.name,
      lastMessageAt: now.toISOString(),
    })),
    messages,
    members: [{ userId: PREVIEW_USER, role: "client_admin" }],
    userId: PREVIEW_USER,
    messagesLoaded: true,
    truncated: false,
  });
}
