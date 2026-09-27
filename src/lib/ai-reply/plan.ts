import { planInboxReply, type InboxTemplateChoice } from "@/lib/inbox/rules";
import type { ConsentStatus } from "@/lib/compliance/send-gate";
import type { ChatMessage, ReplyProvider } from "@/lib/ai-reply/provider";
import type { AiReplySettings } from "@/lib/ai-reply/types";

export type DraftRecord = {
  persist: boolean;
  status: "pending_review" | "failed";
  draftBody: string;
  consentOk: boolean;
  modelMeta: Record<string, unknown>;
  notice: string;
};

export async function prepareDraft(input: {
  settings: AiReplySettings;
  channel: string;
  consent: { ok: boolean; reason: string };
  draftsLastHour: number;
  hasInbound: boolean;
  provider: ReplyProvider;
  contextMessages: ChatMessage[];
}): Promise<DraftRecord> {
  if (!input.settings.enabled) {
    return {
      persist: false,
      status: "failed",
      draftBody: "",
      consentOk: false,
      modelMeta: { failure: "disabled" },
      notice: "Conversation AI is off for this workspace. An agency owner or client admin can turn drafts on. Nothing was sent.",
    };
  }
  if (!input.hasInbound) {
    return {
      persist: false,
      status: "failed",
      draftBody: "",
      consentOk: false,
      modelMeta: { failure: "no_inbound" },
      notice: "There is no inbound message to answer. Nothing was sent.",
    };
  }
  if (!input.consent.ok) {
    return {
      persist: true,
      status: "failed",
      draftBody: "",
      consentOk: false,
      modelMeta: { failure: "consent_denied", reason: input.consent.reason },
      notice: input.consent.reason,
    };
  }
  if (!input.settings.channels.includes(input.channel)) {
    return {
      persist: true,
      status: "failed",
      draftBody: "",
      consentOk: true,
      modelMeta: {
        failure: "channel_not_allowed",
        reason: "Conversation AI is not allowed on this channel.",
      },
      notice: "Conversation AI is not allowed on this channel. Nothing was sent.",
    };
  }
  if (input.draftsLastHour >= input.settings.maxAutoPerHour) {
    return {
      persist: false,
      status: "failed",
      draftBody: "",
      consentOk: true,
      modelMeta: { failure: "rate_limited" },
      notice: "This workspace has reached its AI draft limit for the hour. Nothing was sent.",
    };
  }
  if (!input.provider.configured()) {
    return {
      persist: true,
      status: "failed",
      draftBody: "",
      consentOk: true,
      modelMeta: {
        failure: "provider_unconfigured",
        provider: "openai-compatible",
        reason: "AI_REPLY_API_KEY is not set.",
      },
      notice: "AI_REPLY_API_KEY is not set. The draft was saved as provider_unconfigured. Nothing was sent.",
    };
  }

  let result;
  try {
    result = await input.provider.complete(input.contextMessages);
  } catch {
    result = { ok: false as const, failure: "provider_error" as const, message: "The reply provider could not be reached. Nothing was sent." };
  }
  if (!result.ok) {
    return {
      persist: true,
      status: "failed",
      draftBody: "",
      consentOk: true,
      modelMeta: {
        failure: result.failure,
        provider: "openai-compatible",
        model: input.provider.model,
        reason: result.message,
      },
      notice: result.message,
    };
  }
  return {
    persist: true,
    status: "pending_review",
    draftBody: result.text,
    consentOk: true,
    modelMeta: { provider: "openai-compatible", model: result.model },
    notice: "Draft saved for review. Nothing was sent.",
  };
}

export type ApprovalPlan =
  | { ok: false; queue: false; code: "consent" | "status" | "empty" | "channel" | "use_template" | "send" | "disabled"; message: string }
  | { ok: true; queue: false; draftStatus: "approved"; message: string }
  | {
      ok: true;
      queue: true;
      draftStatus: "queued";
      reply: Extract<ReturnType<typeof planInboxReply>, { ok: true }>;
      message: string;
    };

export function planDraftApproval(input: {
  settings: AiReplySettings;
  sendingEnabled: boolean;
  consentOk: boolean;
  draftStatus: string;
  body: string;
  now: Date;
  channel: string;
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
}): ApprovalPlan {
  if (!input.settings.enabled) {
    return { ok: false, queue: false, code: "disabled", message: "Conversation AI is off for this workspace. Nothing was queued." };
  }
  if (!input.consentOk) {
    return { ok: false, queue: false, code: "consent", message: "This draft has no channel opt-in. Nothing was queued." };
  }
  if (input.draftStatus !== "pending_review") {
    return { ok: false, queue: false, code: "status", message: "Only a draft waiting for review can be approved." };
  }
  const body = input.body.trim();
  if (!body) return { ok: false, queue: false, code: "empty", message: "Write a draft before approving it." };
  if (!input.settings.channels.includes(input.channel)) {
    return { ok: false, queue: false, code: "channel", message: "Conversation AI is not allowed on this channel. Nothing was queued." };
  }
  if (input.settings.mode !== "queue_outbox") {
    return {
      ok: true,
      queue: false,
      draftStatus: "approved",
      message: "Draft approved. It stays in the inbox and was not queued.",
    };
  }
  if (!input.toAddress.trim()) {
    return { ok: false, queue: false, code: "empty", message: "This contact has no address on that channel. Nothing was queued." };
  }

  const reply = planInboxReply({
    now: input.now,
    sendingEnabled: input.sendingEnabled,
    channel: input.channel,
    body,
    toAddress: input.toAddress,
    conversationId: input.conversationId,
    contactId: input.contactId,
    leadId: input.leadId,
    connectionId: input.connectionId,
    userId: input.userId,
    senderName: input.senderName,
    windowExpiresAt: input.windowExpiresAt,
    template: input.template,
    suppressed: input.suppressed,
    consent: input.consent,
    basis: input.basis,
    serviceSendsThisMonth: input.serviceSendsThisMonth,
  });
  if (!reply.ok) {
    const code = reply.code === "use_template" ? "use_template" : reply.code === "channel" ? "channel" : "empty";
    return { ok: false, queue: false, code, message: reply.message };
  }
  const outboxStatus = String(reply.outbox.status);
  const messageStatus = String(reply.message.status);
  if (outboxStatus === "blocked_consent" || messageStatus === "blocked_consent") {
    return { ok: false, queue: false, code: "consent", message: reply.outbox.error || reply.notice };
  }
  if (outboxStatus === "sent" || messageStatus === "sent") {
    return { ok: false, queue: false, code: "send", message: "Refusing to mark this draft sent." };
  }
  const held = reply.outbox.status === "held";
  return {
    ok: true,
    queue: true,
    draftStatus: "queued",
    reply,
    message: held
      ? "Queued in the outbox and held. Sending is off, so nothing was delivered."
      : "Queued in the outbox. This screen did not deliver it.",
  };
}

export function cronSkipReason(env: { AI_REPLY_CRON_ENABLED?: string }) {
  if (env.AI_REPLY_CRON_ENABLED !== "true") return "flag_off" as const;
  return null;
}

export function draftEligibleForAutoQueue(input: {
  settings: AiReplySettings;
  sendingEnabled: boolean;
  draft: { status: string; consentOk: boolean };
}) {
  if (!input.settings.enabled) return false;
  if (input.settings.mode !== "queue_outbox") return false;
  if (input.settings.requireHumanBeforeSend) return false;
  if (!input.sendingEnabled) return false;
  if (input.draft.status !== "pending_review") return false;
  if (!input.draft.consentOk) return false;
  return true;
}
