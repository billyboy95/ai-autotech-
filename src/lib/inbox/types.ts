import type { InboxFilter } from "@/lib/inbox/rules";

export type InboxListItem = {
  id: string;
  channel: string;
  status: string;
  assignedUserId: string | null;
  unread: number;
  lastMessageAt: string | null;
  windowExpiresAt: string | null;
  contactName: string;
  preview: string;
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

export type InboxMemberOption = {
  userId: string;
  role: string;
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
  conversations: InboxListItem[];
  thread: InboxThread | null;
  templates: InboxTemplateOption[];
  connections: InboxConnectionOption[];
  members: InboxMemberOption[];
  serviceUsed: number;
  notice: string | null;
};
