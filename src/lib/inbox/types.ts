import type { AiDraftView, AiReplyMode } from "@/lib/ai-reply/types";
import type { InboxFilter } from "@/lib/inbox/rules";

export type InboxListItem = {
  id: string;
  channel: string;
  status: string;
  assignedUserId: string | null;
  connectionId: string | null;
  unread: number;
  lastMessageAt: string | null;
  windowExpiresAt: string | null;
  contactName: string;
  preview: string;
  /** Phone or WhatsApp from the list contact. Empty unless INBOX_SEARCH_ENABLED is the string true. */
  phone: string;
  /** Email from the list contact. Empty unless INBOX_SEARCH_ENABLED is the string true. */
  email: string;
  /** Contact tags for the list filter. Empty unless INBOX_TAG_FILTER_ENABLED is the string true. */
  tags: string[];
  /** Lead tags for the list filter. Empty unless that flag is on. Used only when the contact has none. */
  leadTags: string[];
};

export type InboxMessage = {
  id: string;
  direction: "in" | "out";
  body: string;
  status: string;
  channel: string;
  waCategory: string;
  costCents: number;
  providerMessageId: string;
  createdAt: string;
};

export type InboxNote = {
  id: string;
  body: string;
  createdAt: string;
  authorUserId: string | null;
};

export type InboxConsent = {
  channel: string;
  purpose: string;
  status: string;
};

export type InboxContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  company: string;
  tags: string[];
  /** Lead tags when the inbox contact panel loaded them. Empty when that flag is off. */
  leadTags?: string[];
  stage: string;
  leadId: string | null;
};

export type InboxThread = {
  id: string;
  channel: string;
  status: string;
  assignedUserId: string | null;
  connectionId: string | null;
  windowExpiresAt: string | null;
  contact: InboxContact | null;
  messages: InboxMessage[];
  notes: InboxNote[];
  consents: InboxConsent[];
};

export type InboxTemplateOption = {
  id: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  waCategory: string;
  approved: boolean;
};

export type InboxConnectionOption = {
  id: string;
  channel: string;
  label: string;
};

/** Monthly free service messages for one WhatsApp number. used is null when the count could not be read. */
export type InboxWaServiceMeter = {
  connectionId: string;
  label: string;
  used: number | null;
  allowance: number;
  timezone: string;
  monthKey: string;
};

export type InboxWhatsappNumber = {
  id: string;
  displayName: string;
  last4: string;
  label: string;
};

export type InboxMemberOption = {
  userId: string;
  role: string;
};

export type InboxTeamStatsAgent = {
  key: string;
  label: string;
  assigned: number;
  replies: number;
};

export type InboxTeamStatsBreach = {
  conversationId: string;
  contactName: string;
  ageMs: number;
};

export type InboxQuickReply = {
  id: string;
  label: string;
  body: string;
};

export type InboxPresencePeer = {
  userId: string;
  name: string;
  state: "viewing" | "typing";
  conversationId: string;
};

/** Null when INBOX_TEAM_STATS_ENABLED is not the string true. */
export type InboxTeamStats = {
  slaHours: number;
  medianFirstResponseMs: number | null;
  repliedCount: number;
  awaitingFirstReply: number;
  openCount: number;
  slaBreaches: InboxTeamStatsBreach[];
  agents: InboxTeamStatsAgent[];
  messagesLoaded: boolean;
  truncated: boolean;
};

export type InboxData = {
  preview: boolean;
  orgId: string;
  orgSlug: string;
  userId: string | null;
  assignedOnly: boolean;
  sendingEnabled: boolean;
  filter: InboxFilter;
  channel: string;
  /** True only when INBOX_MULTI_NUMBER_ENABLED is the string true. */
  multiNumber: boolean;
  /** Selected WhatsApp channel_connections id. Empty means all numbers. */
  number: string;
  whatsappNumbers: InboxWhatsappNumber[];
  conversations: InboxListItem[];
  thread: InboxThread | null;
  templates: InboxTemplateOption[];
  connections: InboxConnectionOption[];
  members: InboxMemberOption[];
  /** Null unless INBOX_TEAM_STATS_ENABLED is the string true. */
  teamStats: InboxTeamStats | null;
  /** True only when INBOX_WA_WINDOW_ENABLED is the string true. */
  waWindowEnabled: boolean;
  /** True only when INBOX_WA_METERING_ENABLED is the string true. */
  waMeteringEnabled: boolean;
  /** Empty unless INBOX_WA_METERING_ENABLED is the string true. */
  waTimezone: string;
  /** Empty unless INBOX_WA_METERING_ENABLED is the string true. */
  waMeters: InboxWaServiceMeter[];
  /** True only when INBOX_QUICK_UX_ENABLED is the string true. */
  quickUx: boolean;
  /** True only when INBOX_BULK_ACTIONS_ENABLED is the string true. */
  bulkActions: boolean;
  /** True only when INBOX_CONTACT_PANEL_ENABLED is the string true. */
  contactPanel: boolean;
  /** True only when INBOX_INTERNAL_NOTES_ENABLED is the string true. */
  internalNotes: boolean;
  /** True only when INBOX_TEMPLATES_PICKER_ENABLED is the string true. */
  templatesPicker: boolean;
  /** True only when INBOX_SEARCH_ENABLED is the string true. */
  search: boolean;
  /** True only when INBOX_TAG_FILTER_ENABLED is the string true. */
  tagFilter: boolean;
  /** Empty unless INBOX_QUICK_UX_ENABLED is the string true. */
  quickReplies: InboxQuickReply[];
  /**
   * Other people on open threads. Empty unless INBOX_QUICK_UX_ENABLED is the string true.
   * Preview simulates peers. A signed-in inbox starts empty and fills from the existing inbox channel.
   */
  presence: InboxPresencePeer[];
  /** Server clock for the WhatsApp window. Preview uses the fixture time. */
  loadedAt: string;
  serviceUsed: number;
  notice: string | null;
  aiEnabled: boolean;
  aiMode: AiReplyMode;
  aiRequireHuman: boolean;
  draft: AiDraftView | null;
};
