import { assessReplyConsent, latestChannelConsents } from "@/lib/ai-reply/consent";
import { prepareDraft } from "@/lib/ai-reply/plan";
import type { ReplyProvider } from "@/lib/ai-reply/provider";
import { assessTryLink, tryAccessStatus } from "@/lib/try-chat/access";
import { bookingReply, planSandboxBooking } from "@/lib/try-chat/booking";
import { leadReply, planLeadCapture } from "@/lib/try-chat/lead";
import { guardTryReply, TRY_PRICE_REFUSAL } from "@/lib/try-chat/prices";
import { buildTryPrompt, tryDraftSettings } from "@/lib/try-chat/prompt";
import { TRY_UNCONFIGURED_MESSAGE } from "@/lib/try-chat/provider";
import { recentTryHits, tryRateLimited } from "@/lib/try-chat/rate";
import type { TryStore } from "@/lib/try-chat/store";
import { parseTryTool } from "@/lib/try-chat/tools";

export const TRY_REFUSED_TOOL =
  "That action is not available in test mode. I can book a TEST appointment or save a TEST lead. Nothing was sent and nothing was charged.";

const MODEL_FAILED = "The model could not reply. Nothing was sent and nothing was charged.";

export function tryChatDoesNotSend() {
  const consent = assessReplyConsent({
    channel: "whatsapp",
    consents: latestChannelConsents([]),
    suppressed: false,
    inboundStop: false,
  });
  return { sends: false as const, consentOk: consent.ok };
}

export type TryHandleResult = {
  status: number;
  ipHits: number[];
  linkHits: number[];
  body: {
    ok: boolean;
    message: string;
    reply: string;
    tool: "book" | "capture_lead" | null;
  };
};

function result(
  status: number,
  message: string,
  ipHits: number[],
  linkHits: number[],
  extra: { ok?: boolean; reply?: string; tool?: "book" | "capture_lead" | null } = {},
): TryHandleResult {
  return {
    status,
    ipHits,
    linkHits,
    body: {
      ok: extra.ok ?? status < 400,
      message,
      reply: extra.reply ?? "",
      tool: extra.tool ?? null,
    },
  };
}

function visitorText(draft: string, notice: string) {
  const text = draft.trim();
  if (text) return text;
  if (/AI_REPLY_API_KEY|provider_unconfigured/i.test(notice)) return TRY_UNCONFIGURED_MESSAGE;
  return MODEL_FAILED;
}

export async function readTryHistory(input: {
  slug: string;
  tokenHash: string;
  now: Date;
  store: TryStore;
}) {
  const slug = input.slug.trim().toLowerCase();
  const loaded = await input.store.load({ slug, tokenHash: input.tokenHash });
  const access = assessTryLink({
    link: loaded?.link ?? null,
    slug,
    tokenHash: input.tokenHash,
    now: input.now,
  });
  if (!access.ok || !loaded) {
    const code = access.ok ? "missing" : access.code;
    return {
      status: tryAccessStatus(code),
      body: { ok: false, message: access.ok ? "This test link is not active." : access.message, messages: [] as { role: "user" | "assistant"; content: string }[] },
    };
  }
  return {
    status: 200,
    body: { ok: true, message: "", messages: loaded.history },
  };
}

export async function handleTryMessage(input: {
  slug: string;
  token: string;
  tokenHash: string;
  message: string;
  now: Date;
  ipHits: number[];
  linkHits: number[];
  store: TryStore;
  provider: ReplyProvider;
}): Promise<TryHandleResult> {
  const slug = input.slug.trim().toLowerCase();
  const message = input.message.trim().slice(0, 2000);
  const nowMs = input.now.getTime();
  const ipHits = recentTryHits(input.ipHits, nowMs);
  const linkHits = recentTryHits(input.linkHits, nowMs);
  if (!message) return result(400, "Enter a message.", ipHits, linkHits);
  if (tryRateLimited(ipHits, nowMs) || tryRateLimited(linkHits, nowMs)) {
    return result(429, "Too many messages. Please wait a minute.", ipHits, linkHits);
  }
  const nextIp = [...ipHits, nowMs];
  const nextLink = [...linkHits, nowMs];

  const loaded = await input.store.load({ slug, tokenHash: input.tokenHash });
  const access = assessTryLink({
    link: loaded?.link ?? null,
    slug,
    tokenHash: input.tokenHash,
    now: input.now,
  });
  if (!access.ok || !loaded) {
    const code = access.ok ? "missing" : access.code;
    const messageText = access.ok ? "This test link is not active." : access.message;
    return result(tryAccessStatus(code), messageText, nextIp, nextLink);
  }

  const sandbox = tryChatDoesNotSend();
  if (sandbox.sends || sandbox.consentOk) {
    return result(403, TRY_REFUSED_TOOL, nextIp, nextLink);
  }

  let draft = "";
  if (!input.provider.configured()) {
    draft = TRY_UNCONFIGURED_MESSAGE;
  } else {
    const prepared = await prepareDraft({
      settings: tryDraftSettings(loaded.grounding),
      channel: "whatsapp",
      consent: { ok: true, reason: "Sandbox test. Nothing is sent." },
      draftsLastHour: 0,
      hasInbound: true,
      provider: input.provider,
      contextMessages: buildTryPrompt({
        grounding: loaded.grounding,
        history: loaded.history,
        message,
      }),
    });
    draft = visitorText(prepared.draftBody, prepared.notice);
  }

  const parsed = parseTryTool(draft);
  let reply = guardTryReply(draft);
  let tool: "book" | "capture_lead" | null = null;
  let booking = null;
  let lead = null;
  if (parsed.kind === "refused") {
    reply = TRY_REFUSED_TOOL;
  } else if (parsed.kind === "tool" && parsed.call.name === "book") {
    const planned = planSandboxBooking({ ...parsed.call, name: parsed.call.nameField, now: input.now });
    if (!planned.ok) reply = planned.message;
    else {
      booking = planned.plan;
      tool = "book";
      reply = bookingReply(planned.plan);
    }
  } else if (parsed.kind === "tool" && parsed.call.name === "capture_lead") {
    const planned = planLeadCapture({ ...parsed.call, name: parsed.call.nameField });
    if (!planned.ok) reply = planned.message;
    else {
      lead = planned.plan;
      tool = "capture_lead";
      reply = leadReply(planned.plan);
    }
  }

  if (reply !== TRY_PRICE_REFUSAL && parsed.kind === "text") reply = guardTryReply(reply);

  const saved = await input.store.commit({
    linkId: loaded.link.id,
    userMessage: message,
    assistantMessage: reply.slice(0, 4000),
    booking,
    lead,
    now: input.now,
  });
  if (!saved.ok) {
    const status = saved.code === "tool_failed" ? 422 : tryAccessStatus(saved.code);
    return result(status, saved.message, nextIp, nextLink);
  }
  return result(200, reply, nextIp, nextLink, { ok: true, reply, tool });
}
