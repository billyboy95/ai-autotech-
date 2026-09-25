import { generateText, Output, type ModelMessage } from "ai";
import { z } from "zod";
import { buildSystemPrompt, type LeadFacts } from "./persona";
import { claimsHuman, isBotQuestion, isOptOut, looksAngry, looksLegal, mentionsAi, wantsHuman } from "./rules";
import { findUnpublishedAmounts, humanize } from "./humanize";
import { SITE } from "./knowledge";

/**
 * The reply brain. Shared by the Meta webhook and the CRM simulator so both behave identically.
 * LLM: Vercel AI Gateway via the AI SDK (OIDC on Vercel, or AI_GATEWAY_API_KEY elsewhere).
 */

export const DEFAULT_MODEL = "openai/gpt-5-mini";
export const FALLBACK_MODELS = ["google/gemini-3.1-flash-lite", "openai/gpt-6-luna"];

export type Intent =
  | "chat"
  | "handover_human"
  | "handover_angry"
  | "handover_complex"
  | "handover_hot"
  | "opt_out"
  | "spam";

export type HistoryItem = { role: "lead" | "bot" | "billy"; text: string };

export type BrainInput = {
  history: HistoryItem[]; // oldest first, NOT including the new inbound messages
  inbound: string[]; // new lead message(s) not yet answered (already transcribed/described for media)
  lead: LeadFacts;
  profileName?: string;
  mediaNote?: string;
  now?: Date;
};

export type BrainOutput = {
  bubbles: string[];
  intent: Intent;
  handover: boolean;
  handoverReason: string;
  optOut: boolean;
  lead: LeadFacts;
  flags: string[];
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

const schema = z.object({
  reply: z.string().describe('WhatsApp reply. Bubbles separated by " || ". Short, casual, one question max.'),
  intent: z.enum(["chat", "handover_human", "handover_angry", "handover_complex", "handover_hot", "opt_out", "spam"]),
  handover_reason: z.string().describe("Short note for Billy if handing over, else empty"),
  lead: z.object({
    name: z.string(),
    business: z.string(),
    industry: z.string(),
    pain: z.string(),
    budget: z.string(),
    timeline: z.string(),
    email: z.string(),
  }),
});

export function sastParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", hour12: false }).format(now),
  );
  return { label: fmt.format(now), hour: Number.isFinite(hour) ? hour % 24 : 12 };
}

const OPT_OUT_REPLY = "No problem, I won't message you again. If you ever need us, just drop a message here.";
const OPT_OUT_REPLY_AF = "Geen probleem, ek sal jou nie weer boodskappe stuur nie. As jy ons ooit nodig het, stuur net 'n boodskap hier.";

function honestBotReply(afrikaans: boolean) {
  return afrikaans
    ? ["Goeie vraag, ek is Billy se AI-assistent by AI Auto Tech", "Ek kan aanhou help, of wil jy hê Billy moet jou self kontak?"]
    : ["Fair question, I'm Billy's AI assistant at AI Auto Tech", "Happy to keep helping, or want me to get Billy to message you himself?"];
}

function looksAfrikaans(text: string) {
  return /\b(ek|jy|julle|nie|asseblief|dankie|goeie|môre|more|hoeveel|kos|besigheid|wil|graag|soek|praat|hallo|baie|ons|het|is dit)\b/i.test(
    text,
  ) && /\b(ek|jy|nie|dankie|asseblief|besigheid|hoeveel|goeie)\b/i.test(text);
}

function mergeLead(prev: LeadFacts, next: Partial<Record<keyof LeadFacts, string>>): LeadFacts {
  const out: LeadFacts = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    const val = (v ?? "").trim();
    if (!val || /^(unknown|n\/a|none|not (provided|given|mentioned)|-)$/i.test(val)) continue;
    (out as Record<string, string>)[k] = val.slice(0, 200);
  }
  return out;
}

export async function runBrain(input: BrainInput): Promise<BrainOutput> {
  const latest = input.inbound.join("\n").trim();
  const allLeadText = [...input.history.filter((h) => h.role === "lead").map((h) => h.text), latest].join(" ");
  const afrikaans = looksAfrikaans(latest);

  // 1. Opt-out: deterministic, no LLM.
  if (isOptOut(latest)) {
    return {
      bubbles: [afrikaans || /nee dankie|asseblief/i.test(latest) ? OPT_OUT_REPLY_AF : OPT_OUT_REPLY],
      intent: "opt_out",
      handover: false,
      handoverReason: "",
      optOut: true,
      lead: input.lead,
      flags: ["rule:opt_out"],
      model: "rules",
    };
  }

  // 2. Rule-based signals the LLM must respect.
  const botQuestion = isBotQuestion(latest);
  let forced: { intent: Intent; reason: string } | null = null;
  if (looksAngry(latest)) forced = { intent: "handover_angry", reason: "Lead sounds upset or abusive" };
  else if (looksLegal(latest)) forced = { intent: "handover_complex", reason: "Legal / contract / refund topic" };
  else if (wantsHuman(latest)) forced = { intent: "handover_human", reason: "Lead asked for Billy / a person" };

  const { label, hour } = sastParts(input.now);
  const instructions = buildSystemPrompt({
    nowSast: label,
    hourSast: hour,
    lead: input.lead,
    profileName: input.profileName,
    isFirstReply: !input.history.some((h) => h.role !== "lead"),
    botQuestion,
    forcedHandover: forced?.reason,
    mediaNote: input.mediaNote,
  });

  const messages: ModelMessage[] = [];
  for (const h of input.history.slice(-24)) {
    if (h.role === "lead") messages.push({ role: "user", content: h.text });
    else messages.push({ role: "assistant", content: h.role === "billy" ? `[Billy, typing himself] ${h.text}` : h.text });
  }
  messages.push({ role: "user", content: latest || "(empty message)" });

  const model = process.env.WHATSAPP_BOT_MODEL || DEFAULT_MODEL;
  const usedEmoji = /\p{Extended_Pictographic}/u.test(allLeadText);

  let parsed: z.infer<typeof schema> | null = null;
  let usage: BrainOutput["usage"];
  let flags: string[] = [];
  let correction = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateText({
      model,
      instructions: correction ? `${instructions}\n\nCORRECTION FROM YOUR LAST DRAFT: ${correction}` : instructions,
      messages,
      output: Output.object({ schema }),
      temperature: model.startsWith("openai/gpt-5") ? undefined : 0.7,
      reasoning: "minimal",
      maxOutputTokens: 1200,
      maxRetries: 2,
      providerOptions: { gateway: { models: FALLBACK_MODELS.filter((m) => m !== model) } },
    });
    parsed = result.output;
    usage = { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens };

    const bad = findUnpublishedAmounts(parsed.reply);
    const lies = claimsHuman(parsed.reply);
    const dodge = botQuestion && !mentionsAi(parsed.reply);
    if (!bad.length && !lies && !dodge) break;
    flags.push(bad.length ? `guard:amount(${bad.join(",")})` : lies ? "guard:claims_human" : "guard:bot_dodge");
    correction = bad.length
      ? `You mentioned ${bad.join(", ")}, which is not a published price or fact. Only "from R8,999/month excl. VAT" (AI employees/teams) and "from R14,999/month excl. VAT" (voice agents) exist. Rewrite without it.`
      : "You implied you are Billy or a human, or dodged the bot question. Rewrite: say honestly you're Billy's AI assistant.";
    if (attempt === 1) parsed = null; // still bad after a retry → fall back below
  }

  let intent: Intent = forced?.intent ?? parsed?.intent ?? "chat";
  if (parsed?.intent?.startsWith("handover") && !forced) intent = parsed.intent;
  if (parsed?.intent === "opt_out") intent = "opt_out";

  let bubbles: string[];
  if (!parsed) {
    bubbles = botQuestion
      ? honestBotReply(afrikaans)
      : ["Good question, Billy will give you the exact details", `Easiest is the free audit, about 5 min: ${SITE.audit}`];
    flags.push("fallback_reply");
  } else {
    const h = humanize(parsed.reply, { allowEmoji: usedEmoji });
    bubbles = h.bubbles;
    flags = [...flags, ...h.flags];
    if (!bubbles.length) {
      bubbles = botQuestion ? honestBotReply(afrikaans) : ["Sorry, missed that. What can I help with?"];
      flags.push("empty_reply");
    }
  }

  const handover = intent.startsWith("handover");
  return {
    bubbles,
    intent,
    handover,
    handoverReason: handover ? parsed?.handover_reason || forced?.reason || intent.replace("handover_", "") : "",
    optOut: intent === "opt_out",
    lead: parsed ? mergeLead(input.lead, parsed.lead) : input.lead,
    flags,
    model,
    usage,
  };
}
