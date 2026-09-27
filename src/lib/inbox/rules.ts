import { WHATSAPP_FREE_SERVICE_PER_MONTH, WHATSAPP_SERVICE_PRICING_START } from "@/lib/automation/compliance";
import { johannesburgDateKey, newId, toWaDigits } from "@/lib/automation/ids";
import { evaluateSend, type ConsentStatus, type OutboundChannel, type OutboundPurpose } from "@/lib/compliance/send-gate";
import { DEFAULT_UNIT_COST_CENTS, usageForSend } from "@/lib/compliance/usage";

export const INBOX_CHANNELS = ["whatsapp", "sms", "email", "facebook", "instagram"] as const;
export type InboxChannel = (typeof INBOX_CHANNELS)[number];
export type InboxFilter = "open" | "mine" | "unassigned";
export type WaCategory = "" | "marketing" | "utility" | "authentication" | "service";

const ORG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;
export const USE_TEMPLATE = "Free-form WhatsApp is outside the 24-hour window. Use an approved template.";

export function parseInboxFilter(value: string | undefined | null): InboxFilter {
  if (value === "mine" || value === "unassigned") return value;
  return "open";
}

export function parseInboxChannel(value: string | undefined | null): InboxChannel | "" {
  if (value && (INBOX_CHANNELS as readonly string[]).includes(value)) return value as InboxChannel;
  return "";
}

export function matchesInboxList(input: {
  status: string;
  assignedUserId: string | null;
  channel: string;
  filter: InboxFilter;
  channelFilter: string;
  userId: string | null;
}) {
  if (input.channelFilter && input.channel !== input.channelFilter) return false;
  if (input.status === "closed") return false;
  if (input.filter === "mine") return Boolean(input.userId) && input.assignedUserId === input.userId;
  if (input.filter === "unassigned") return input.assignedUserId == null;
  return input.status === "open" || input.status === "pending";
}

export function windowExpiry(inboundAt: Date) {
  return new Date(inboundAt.getTime() + WHATSAPP_WINDOW_MS).toISOString();
}

export function whatsappWindowOpen(expiresAt: string | null | undefined, now: Date) {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  return Number.isFinite(time) && time > now.getTime();
}

export function windowCountdown(expiresAt: string | null | undefined, now: Date) {
  if (!whatsappWindowOpen(expiresAt, now) || !expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export function whatsappComposeGate(input: {
  channel: string;
  now: Date;
  windowExpiresAt: string | null;
  template: { approved: boolean } | null;
}) {
  if (input.channel !== "whatsapp") return { ok: true as const };
  if (input.template) {
    if (!input.template.approved) {
      return { ok: false as const, code: "use_template" as const, message: "Use an approved WhatsApp template. This template is not approved." };
    }
    return { ok: true as const };
  }
  if (whatsappWindowOpen(input.windowExpiresAt, input.now)) return { ok: true as const };
  return { ok: false as const, code: "use_template" as const, message: USE_TEMPLATE };
}

export function johannesburgMonthStartIso(now: Date) {
  const key = johannesburgDateKey(now);
  const [year, month] = key.split("-");
  return `${year}-${month}-01T00:00:00+02:00`;
}

export function serviceAllowanceLabel(input: { now: Date; used: number; hasNumber: boolean }) {
  if (!input.hasNumber) return "Connect a WhatsApp number to see the free service-message counter.";
  const used = Math.max(0, input.used);
  const started = johannesburgDateKey(input.now) >= WHATSAPP_SERVICE_PRICING_START;
  if (!started) {
    return `Service messages are free until 1 Oct 2026. From then, ${WHATSAPP_FREE_SERVICE_PER_MONTH} per WhatsApp number are free each month. ${used} service messages recorded this month.`;
  }
  const left = Math.max(0, WHATSAPP_FREE_SERVICE_PER_MONTH - used);
  return `${used} of ${WHATSAPP_FREE_SERVICE_PER_MONTH} free service messages used this month on this number. ${left} left.`;
}

export function inboxCost(input: {
  channel: string;
  waCategory: string;
  now: Date;
  serviceSendsThisMonth: number;
}) {
  if (input.channel === "sms") return { cents: DEFAULT_UNIT_COST_CENTS.sms, label: "sms" };
  if (input.channel === "email") return { cents: DEFAULT_UNIT_COST_CENTS.email, label: "email" };
  if (input.channel !== "whatsapp") return { cents: 0, label: input.channel || "message" };
  const category = input.waCategory || "service";
  if (category === "marketing") return { cents: DEFAULT_UNIT_COST_CENTS.wa_marketing, label: "marketing" };
  if (category === "utility" || category === "authentication") {
    return { cents: DEFAULT_UNIT_COST_CENTS.wa_utility, label: category };
  }
  const started = johannesburgDateKey(input.now) >= WHATSAPP_SERVICE_PRICING_START;
  if (!started || input.serviceSendsThisMonth < WHATSAPP_FREE_SERVICE_PER_MONTH) {
    return { cents: 0, label: "service" };
  }
  return { cents: DEFAULT_UNIT_COST_CENTS.wa_service, label: "service" };
}

export function formatInboxCost(cost: { cents: number; label: string }) {
  if (cost.label === "service" && cost.cents === 0) return "service · free";
  const rand = `R${(cost.cents / 100).toFixed(2)}`;
  return `${cost.label} · ${rand}`;
}

export function contactLookup(channel: string, from: string) {
  const raw = from.trim();
  if (channel === "email") return { email: raw.toLowerCase(), phone: "", whatsapp: "", externalId: "" };
  if (channel === "facebook" || channel === "instagram") return { email: "", phone: "", whatsapp: "", externalId: raw };
  const digits = toWaDigits(raw);
  const phone = digits ? `+${digits}` : raw;
  return { email: "", phone, whatsapp: channel === "whatsapp" ? phone : "", externalId: "" };
}

export function realtimeOrgFilter(orgId: string) {
  if (!ORG_ID.test(orgId)) throw new Error("Realtime needs an organisation id.");
  return `org_id=eq.${orgId.toLowerCase()}`;
}

export function acceptRealtimeRow(sessionOrgId: string, rowOrgId: string | null | undefined) {
  if (!ORG_ID.test(sessionOrgId) || !rowOrgId) return false;
  return rowOrgId.toLowerCase() === sessionOrgId.toLowerCase();
}

export type InboxTemplateChoice = {
  id: string;
  channel: string;
  name: string;
  body: string;
  subject: string;
  waCategory: WaCategory;
  approved: boolean;
};

export type ReplyPlan =
  | { ok: false; code: "use_template" | "empty" | "channel"; message: string }
  | {
      ok: true;
      outbox: {
        id: string;
        leadId: string | null;
        contactId: string | null;
        conversationId: string;
        templateKey: string;
        channel: InboxChannel;
        toAddress: string;
        subject: string;
        body: string;
        status: "held" | "queued" | "blocked_consent";
        purpose: OutboundPurpose;
        provider: "outbox";
        providerId: string;
        error: string;
        channelConnectionId: string | null;
        costCents: number;
        messageCategory: string;
      };
      message: {
        conversationId: string;
        direction: "out";
        channel: InboxChannel;
        body: string;
        templateId: string | null;
        providerMessageId: string;
        status: "held" | "queued" | "blocked_consent";
        waCategory: WaCategory;
        costCents: number;
        sentByUserId: string | null;
        outboxId: string;
      };
      notice: string;
    };

export function planInboxReply(input: {
  now: Date;
  sendingEnabled: boolean;
  channel: string;
  body: string;
  toAddress: string;
  conversationId: string;
  contactId: string | null;
  leadId: string | null;
  connectionId: string | null;
  userId: string | null;
  senderName: string;
  windowExpiresAt: string | null;
  template: InboxTemplateChoice | null;
  suppressed: boolean;
  consent: ConsentStatus;
  basis?: "consent" | "existing_customer" | null;
  serviceSendsThisMonth: number;
}): ReplyPlan {
  const channel = parseInboxChannel(input.channel);
  if (!channel) return { ok: false, code: "channel", message: "Choose email, WhatsApp, SMS, Facebook, or Instagram." };
  if (input.template && input.template.channel !== channel) {
    return { ok: false, code: "channel", message: "That template is for a different channel." };
  }
  const template = input.template;
  const gate = whatsappComposeGate({
    channel,
    now: input.now,
    windowExpiresAt: input.windowExpiresAt,
    template: template ? { approved: template.approved } : null,
  });
  if (!gate.ok) return gate;

  const rawBody = (template && channel === "whatsapp" && !whatsappWindowOpen(input.windowExpiresAt, input.now)
    ? template.body
    : input.body
  ).trim();
  if (!rawBody) return { ok: false, code: "empty", message: "Write a message before queueing it." };

  const waCategory: WaCategory = template?.waCategory || (channel === "whatsapp" ? "service" : "");
  const purpose: OutboundPurpose = waCategory === "marketing" ? "marketing" : "service";
  const cost = inboxCost({
    channel,
    waCategory,
    now: input.now,
    serviceSendsThisMonth: input.serviceSendsThisMonth,
  });
  const id = newId("msg");
  const gated = gateBody({
    channel,
    purpose,
    senderName: input.senderName,
    suppressed: input.suppressed,
    consent: input.consent,
    basis: input.basis,
    body: rawBody,
  });
  const status = gated.blocked
    ? "blocked_consent"
    : input.sendingEnabled
      ? "queued"
      : "held";
  const error = gated.blocked
    ? gated.reason
    : status === "held"
      ? "Held. Sending is off for this workspace. Nothing was delivered."
      : "";
  const providerId = id;
  return {
    ok: true,
    outbox: {
      id,
      leadId: input.leadId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      templateKey: template?.name || "inbox_reply",
      channel,
      toAddress: input.toAddress,
      subject: template?.subject || "",
      body: gated.body,
      status,
      purpose,
      provider: "outbox",
      providerId,
      error,
      channelConnectionId: input.connectionId,
      costCents: cost.cents,
      messageCategory: waCategory || purpose,
    },
    message: {
      conversationId: input.conversationId,
      direction: "out",
      channel,
      body: gated.body,
      templateId: template?.id || null,
      providerMessageId: `outbox:${id}`,
      status,
      waCategory,
      costCents: cost.cents,
      sentByUserId: input.userId,
      outboxId: id,
    },
    notice: status === "blocked_consent"
      ? gated.reason
      : status === "held"
        ? "Queued in the outbox and held. Nothing was delivered."
        : "Queued in the outbox. Nothing was delivered from this screen.",
  };
}

function gateBody(input: {
  channel: InboxChannel;
  purpose: OutboundPurpose;
  senderName: string;
  suppressed: boolean;
  consent: ConsentStatus;
  basis?: "consent" | "existing_customer" | null;
  body: string;
}) {
  if (input.channel === "facebook" || input.channel === "instagram") {
    if (input.suppressed || input.consent === "opted_out") {
      return { blocked: true, reason: "Recipient is opted out or suppressed.", body: input.body };
    }
    if (input.purpose === "marketing" && input.consent !== "opted_in" && input.basis !== "existing_customer") {
      return { blocked: true, reason: "Marketing needs opt-in, or an existing customer who was offered an opt-out.", body: input.body };
    }
    return { blocked: false, reason: "", body: input.body };
  }
  const decision = evaluateSend({
    sendingEnabled: true,
    channel: input.channel as OutboundChannel,
    purpose: input.purpose,
    senderName: input.senderName || "This workspace",
    suppressed: input.suppressed,
    consent: input.consent,
    basis: input.basis,
    body: input.body,
  });
  if (decision.status === "blocked_consent") return { blocked: true, reason: decision.reason, body: decision.body };
  return { blocked: false, reason: "", body: decision.body };
}

export function planInboundThread(input: {
  now: Date;
  channel: string;
  body: string;
  providerMessageId: string;
  stop: boolean;
  existing: { id: string; unreadCount: number } | null;
}) {
  const channel = parseInboxChannel(input.channel) || "sms";
  const at = input.now.toISOString();
  const windowPatch = channel === "whatsapp" ? windowExpiry(input.now) : null;
  return {
    channel,
    reopen: true,
    unreadCount: (input.existing?.unreadCount || 0) + 1,
    lastMessageAt: at,
    waWindowExpiresAt: windowPatch,
    message: {
      direction: "in" as const,
      channel,
      body: input.body,
      providerMessageId: input.providerMessageId,
      status: "received" as const,
      waCategory: (channel === "whatsapp" ? "service" : "") as WaCategory,
      costCents: 0,
    },
    events: inboundEvents(input.stop),
  };
}

function inboundEvents(stop: boolean) {
  const events: Array<"message.inbound" | "opt_out.received"> = ["message.inbound"];
  if (stop) events.push("opt_out.received");
  return events;
}

export function outboxRow(plan: Extract<ReplyPlan, { ok: true }>, orgId: string) {
  const usage = usageForSend({
    orgId,
    channel: plan.outbox.channel,
    purpose: plan.outbox.purpose,
    sourceId: plan.outbox.id,
  });
  return {
    row: {
      id: plan.outbox.id,
      org_id: orgId,
      lead_id: plan.outbox.leadId,
      contact_id: plan.outbox.contactId,
      conversation_id: plan.outbox.conversationId,
      template_key: plan.outbox.templateKey,
      channel: plan.outbox.channel,
      to_address: plan.outbox.toAddress,
      subject: plan.outbox.subject,
      body: plan.outbox.body,
      status: plan.outbox.status,
      purpose: plan.outbox.purpose,
      provider: plan.outbox.provider,
      provider_id: plan.outbox.providerId,
      error: plan.outbox.error,
      channel_connection_id: plan.outbox.channelConnectionId,
      cost_cents: plan.outbox.costCents,
      message_category: plan.outbox.messageCategory,
    },
    usage: {
      ...usage,
      costCents: plan.outbox.costCents,
    },
    sends: false as const,
  };
}
