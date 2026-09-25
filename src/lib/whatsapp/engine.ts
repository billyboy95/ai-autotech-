import { generateText } from "ai";
import { runBrain, type BrainOutput } from "./brain";
import { typingDelayMs } from "./humanize";
import { isOptOut } from "./rules";
import { sendHandoverAlert } from "./alerts";
import {
  getOrCreateConversation,
  handoverHours,
  insertMessage,
  isPaused,
  latestInboundId,
  loadMessages,
  patchConversation,
  refreshConversation,
  splitHistory,
  syncCrmLead,
  updateMessageMeta,
  type Conversation,
  type MessageRow,
} from "./store";

/**
 * Orchestration shared by the Meta webhook and the simulator:
 * store inbound → honour opt-out / pause → debounce → brain → persist lead + handover → deliver bubbles.
 */

export type InboundInput = {
  waId: string;
  channel: "whatsapp" | "simulator";
  isTest: boolean;
  profileName?: string;
  waMessageId?: string | null;
  type: string; // text | audio | image | ...
  text: string; // text body, caption, or (simulator) the "voice note" words
  mediaId?: string | null;
  /** Simulator only: pretend transcription failed. */
  simUnplayable?: boolean;
};

export type Transport = {
  /** Show typing / mark read. */
  typing?: (inboundWaId: string | null) => Promise<void>;
  /** Deliver one bubble; returns provider message id. */
  send?: (text: string) => Promise<string | null>;
  /** Actually sleep for typing delays (webhook) or just report them (simulator). */
  realDelays: boolean;
  debounceMs: number;
  transcribe?: (mediaId: string) => Promise<string | null>;
};

export type EngineResult =
  | { status: "duplicate" | "superseded" | "paused" | "opted_out_silent" | "ignored"; conversationId?: string }
  | {
      status: "replied";
      conversationId: string;
      bubbles: Array<{ text: string; delayMs: number }>;
      brain: Omit<BrainOutput, "bubbles">;
      alert?: { sent: boolean; detail: string };
    };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function describeInbound(row: MessageRow): { text: string; note?: string } {
  const meta = row.meta as { transcript?: string; transcribe_failed?: boolean; caption?: string };
  switch (row.type) {
    case "text":
    case "button":
    case "interactive":
      return { text: row.body };
    case "audio":
      if (meta.transcript) return { text: `[voice note, transcribed] ${meta.transcript}` };
      return {
        text: "[sent a voice note]",
        note: "The lead sent a voice note you could NOT listen to. Reply naturally: say you can't play it on your side right now, you'll get Billy to listen, and ask if they can type the gist quickly. Don't pretend you heard it.",
      };
    case "image":
    case "video":
    case "document":
      return {
        text: `[sent ${row.type === "image" ? "a photo" : row.type === "video" ? "a video" : "a document"}${meta.caption ? ` with caption: "${meta.caption}"` : ""}]`,
        note: `The lead sent ${row.type === "image" ? "a photo" : "a " + row.type} you can't see. Say you'll get Billy to have a look; if there's a caption, respond to it. Don't pretend you saw it.`,
      };
    case "location":
      return { text: `[shared a location] ${row.body}` };
    case "sticker":
      return { text: "[sent a sticker]" };
    default:
      return { text: row.body || `[sent a ${row.type} message]` };
  }
}

export async function transcribeWithGateway(data: Uint8Array, mimeType: string): Promise<string | null> {
  try {
    const res = await generateText({
      model: process.env.WHATSAPP_TRANSCRIBE_MODEL || "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this WhatsApp voice note word for word in its original language. Return only the transcript. If it's silent or unintelligible, return exactly: UNINTELLIGIBLE" },
            { type: "file", mediaType: mimeType, data },
          ],
        },
      ],
      maxOutputTokens: 800,
      maxRetries: 1,
    });
    const t = res.text.trim();
    if (!t || /UNINTELLIGIBLE/i.test(t)) return null;
    return t.slice(0, 2000);
  } catch (e) {
    console.warn("transcription failed", (e as Error).message);
    return null;
  }
}

export async function handleInbound(input: InboundInput, transport: Transport): Promise<EngineResult> {
  const started = Date.now();
  const conv = await getOrCreateConversation({
    waId: input.waId,
    channel: input.channel,
    profileName: input.profileName,
    isTest: input.isTest,
  });

  const stored = await insertMessage(conv.id, {
    direction: "in",
    author: "lead",
    type: input.type,
    body: input.type === "audio" ? "[voice note]" : input.text,
    waMessageId: input.waMessageId ?? null,
    mediaId: input.mediaId ?? null,
    meta: input.type !== "text" && input.text ? { caption: input.text } : {},
  });
  if (!stored) return { status: "duplicate", conversationId: conv.id };
  await patchConversation(conv.id, { message_count: conv.message_count + 1 });

  // Voice notes: transcribe (free-ish via the same gateway) before anything else.
  if (input.type === "audio") {
    let transcript: string | null = null;
    if (input.channel === "simulator") transcript = input.simUnplayable || !input.text.trim() ? null : input.text.trim();
    else if (input.mediaId && transport.transcribe && process.env.WHATSAPP_TRANSCRIBE !== "0") transcript = await transport.transcribe(input.mediaId);
    await updateMessageMeta(stored.id, {
      body: transcript ? `[voice note] ${transcript}` : "[voice note]",
      meta: transcript ? { transcript } : { transcribe_failed: true },
    });
    stored.meta = transcript ? { transcript } : { transcribe_failed: true };
  }

  const text = input.type === "audio" ? ((stored.meta as { transcript?: string }).transcript ?? "") : input.text;

  // Paused (handover or Billy typing himself): store only. Record opt-outs silently.
  if (isPaused(conv)) {
    if (isOptOut(text)) {
      await patchConversation(conv.id, { opted_out: true, opted_out_at: new Date().toISOString(), status: conv.is_test ? "test" : "opted_out" });
      return { status: "opted_out_silent", conversationId: conv.id };
    }
    return { status: "paused", conversationId: conv.id };
  }

  // Reactions and stickers alone don't need an answer.
  if (input.type === "reaction" || (input.type === "sticker" && conv.message_count > 0)) {
    return { status: "ignored", conversationId: conv.id };
  }

  // Debounce: people often send 2-3 quick messages. Only the newest invocation replies (to all of them).
  if (transport.debounceMs > 0) {
    await sleep(transport.debounceMs);
    const newest = await latestInboundId(conv.id);
    if (newest && newest !== stored.id) return { status: "superseded", conversationId: conv.id };
  }

  if (transport.typing) await transport.typing(input.waMessageId ?? null);

  const rows = await loadMessages(conv.id, 40);
  const { history, pending } = splitHistory(rows);
  const described = pending.map(describeInbound);
  const notes = described.map((d) => d.note).filter(Boolean);

  const fresh = await refreshConversation(conv.id);
  // A previously opted-out lead who messages again has re-engaged: reply, but keep the record.
  const brain = await runBrain({
    history,
    inbound: described.map((d) => d.text),
    lead: fresh.lead ?? {},
    profileName: fresh.profile_name,
    mediaNote: notes.join(" "),
  });

  // ---- Persist outcome ----
  const patch: Record<string, unknown> = { lead: brain.lead };
  let alert: { sent: boolean; detail: string } | undefined;
  if (brain.optOut) {
    Object.assign(patch, { opted_out: true, opted_out_at: new Date().toISOString(), status: fresh.is_test ? "test" : "opted_out" });
  } else if (fresh.opted_out) {
    Object.assign(patch, { opted_out: false, status: fresh.is_test ? "test" : "active" });
  }
  if (brain.handover) {
    const until = new Date(Date.now() + handoverHours() * 3600_000).toISOString();
    Object.assign(patch, {
      bot_paused_until: until,
      handover_reason: brain.handoverReason,
      handover_at: new Date().toISOString(),
      needs_attention: true,
      status: fresh.is_test ? "test" : "handover",
    });
  }
  await patchConversation(conv.id, patch);

  const convForCrm: Conversation = { ...fresh, lead: brain.lead };
  const flag = brain.handover ? (brain.intent === "handover_hot" ? "HOT LEAD, call now" : `HANDOVER: ${brain.handoverReason}`) : brain.optOut ? "OPTED OUT" : undefined;
  await syncCrmLead(convForCrm, brain.lead, flag);

  if (brain.handover) {
    alert = await sendHandoverAlert({
      waId: fresh.wa_id,
      profileName: fresh.profile_name,
      reason: brain.handoverReason,
      intent: brain.intent,
      lead: brain.lead as Record<string, string | undefined>,
      transcript: [
        ...history.map((h) => ({ who: h.role === "lead" ? "Lead" : h.role === "billy" ? "Billy" : "Bot", text: h.text })),
        ...described.map((d) => ({ who: "Lead", text: d.text })),
        { who: "Bot", text: brain.bubbles.join(" / ") },
      ],
      isTest: fresh.is_test,
    });
    await insertMessage(conv.id, { direction: "out", author: "system", type: "system", body: `Handover: ${brain.handoverReason}. Alert: ${alert.detail}`, status: "skipped" });
  }

  // ---- Deliver with realistic typing ----
  const bubbles = brain.bubbles.map((text, i) => ({ text, delayMs: typingDelayMs(text, i) }));
  const thinkingSpent = Date.now() - started;
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (transport.realDelays) {
      const wait = i === 0 ? Math.max(0, b.delayMs - thinkingSpent) : b.delayMs;
      if (i > 0 && transport.typing) await transport.typing(input.waMessageId ?? null);
      await sleep(wait);
      // Billy may have jumped in while we were "typing".
      if (!brain.handover) {
        const latest = await refreshConversation(conv.id);
        if (isPaused(latest) && latest.handover_reason === "Billy replied manually") break;
      }
    }
    let providerId: string | null = null;
    let status = "sent";
    if (transport.send) {
      try {
        providerId = await transport.send(b.text);
      } catch (e) {
        status = "failed";
        console.error("whatsapp send failed", (e as Error).message);
      }
    }
    await insertMessage(conv.id, {
      direction: "out",
      author: "bot",
      body: b.text,
      waMessageId: providerId,
      status,
      meta: i === 0 ? { intent: brain.intent, flags: brain.flags, model: brain.model, usage: brain.usage } : {},
    });
  }

  const { bubbles: _omit, ...rest } = brain;
  void _omit;
  return { status: "replied", conversationId: conv.id, bubbles, brain: rest, alert };
}

/** Billy replied from the WhatsApp Business app (coexistence echo): pause the bot on that thread. */
export async function handleBusinessEcho(input: { waId: string; waMessageId: string; text: string }) {
  const conv = await getOrCreateConversation({ waId: input.waId, channel: "whatsapp", isTest: false });
  const stored = await insertMessage(conv.id, {
    direction: "out",
    author: "billy",
    body: input.text || "[message from WhatsApp Business app]",
    waMessageId: input.waMessageId,
    status: "sent",
  });
  if (!stored) return { status: "duplicate" as const };
  const until = new Date(Date.now() + handoverHours() * 3600_000).toISOString();
  await patchConversation(conv.id, {
    bot_paused_until: until,
    handover_reason: "Billy replied manually",
    needs_attention: false,
    status: conv.is_test ? "test" : conv.opted_out ? "opted_out" : "handover",
  });
  return { status: "paused" as const };
}
