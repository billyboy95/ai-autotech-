import { matchesInboxList, parseInboxChannel, parseInboxFilter, windowExpiry } from "@/lib/inbox/rules";
import type { InboxData, InboxThread } from "@/lib/inbox/types";

const PREVIEW_ORG = "00000000-0000-4000-8000-0000000000aa";
const PREVIEW_USER = "00000000-0000-4000-8000-0000000000bb";
const OPEN_WA = "00000000-0000-4000-8000-000000000001";
const OPEN_SMS = "00000000-0000-4000-8000-000000000002";
const EXPIRED_WA = "00000000-0000-4000-8000-000000000003";

const now = new Date("2026-09-26T12:00:00.000Z");

const threads: Record<string, InboxThread> = {
  [OPEN_WA]: {
    id: OPEN_WA,
    channel: "whatsapp",
    status: "open",
    assignedUserId: PREVIEW_USER,
    connectionId: "preview-wa",
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
    notes: [{ id: "preview-note", body: "Asked for the prospectus. Not sent to the contact.", createdAt: now.toISOString() }],
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
    connectionId: "preview-wa",
    windowExpiresAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    contact: {
      id: "preview-expired",
      name: "Amina Patel",
      email: "amina@example.com",
      phone: "+27825550222",
      whatsapp: "+27825550222",
      company: "",
      tags: [],
      stage: "Contacted",
      leadId: null,
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
};

export function previewInbox(query: {
  filter?: string;
  channel?: string;
  id?: string;
  notice?: string | null;
  brandSlug?: string | null;
}): InboxData {
  const filter = parseInboxFilter(query.filter);
  const channel = parseInboxChannel(query.channel);
  const list = [
    { id: OPEN_WA, channel: "whatsapp", status: "open", assignedUserId: PREVIEW_USER, unread: 1, preview: "Can I still apply for the October intake?", name: "Lerato Mokoena", window: threads[OPEN_WA].windowExpiresAt },
    { id: OPEN_SMS, channel: "sms", status: "open", assignedUserId: null, unread: 0, preview: "Please call the practice.", name: "Thabo Ndlovu", window: null },
    { id: EXPIRED_WA, channel: "whatsapp", status: "open", assignedUserId: null, unread: 2, preview: "Thanks, I will think about it.", name: "Amina Patel", window: threads[EXPIRED_WA].windowExpiresAt },
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
    conversations: list.map((item) => ({
      id: item.id,
      channel: item.channel,
      status: item.status,
      assignedUserId: item.assignedUserId,
      unread: item.unread,
      lastMessageAt: now.toISOString(),
      windowExpiresAt: item.window,
      contactName: item.name,
      preview: item.preview,
    })),
    thread: selected ? threads[selected] : null,
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
    connections: [{ id: "preview-wa", channel: "whatsapp", label: "Preview WhatsApp · 1000 free from 1 Oct 2026" }],
    members: [{ userId: PREVIEW_USER, role: "client_admin" }],
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
