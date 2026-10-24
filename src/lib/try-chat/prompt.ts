import { buildReplyMessages } from "@/lib/ai-reply/prompt";
import { DEFAULT_AI_REPLY_SETTINGS, type AiReplySettings } from "@/lib/ai-reply/types";
import type { BotConfig } from "@/lib/bots/catalog-types";

export const TRY_BANNER = "Test mode. No real messages or payments.";
export const TRY_GO_LIVE_HREF = "/command-centre/setup";

export type TryGrounding = {
  orgName: string;
  botName: string;
  botDescription: string;
  config: BotConfig;
  templateName: string;
  templateDescription: string;
  industry: string;
  department: string;
  capabilities: string[];
};

export function tryDraftSettings(grounding: TryGrounding): AiReplySettings {
  return {
    ...DEFAULT_AI_REPLY_SETTINGS,
    enabled: true,
    mode: "draft_only",
    tone: grounding.config.tone,
    systemPrompt: groundingFacts(grounding),
    maxAutoPerHour: 500,
    channels: ["whatsapp"],
    requireHumanBeforeSend: true,
  };
}

export function groundingFacts(grounding: TryGrounding) {
  const hours = grounding.config.workingHours;
  return [
    "You are this business's AI employee in a sandbox test chat.",
    TRY_BANNER,
    "Nothing you say is sent on WhatsApp, email, or SMS. You cannot take payment.",
    "Do not invent prices, fees, quotes, discounts, or currency amounts. If asked what it costs, say the business confirms prices and this test does not quote them.",
    "Use only the facts below. If a fact is missing, say you do not have it.",
    `Business: ${grounding.orgName.trim() || "This workspace"}.`,
    `Agent: ${grounding.botName.trim() || "AI employee"}. ${grounding.botDescription.trim()}`.trim(),
    grounding.templateName.trim() ? `Template: ${grounding.templateName.trim()}. ${grounding.templateDescription.trim()}`.trim() : "",
    grounding.industry.trim() ? `Industry: ${grounding.industry.trim()}.` : "",
    grounding.department.trim() ? `Department: ${grounding.department.trim()}.` : "",
    grounding.config.tone.trim() ? `Tone: ${grounding.config.tone.trim()}.` : "",
    `Hours: ${hours.start} to ${hours.end} (${hours.timezone}).`,
    `Pipeline: ${grounding.config.pipeline}. Stage: ${grounding.config.stage}.`,
    grounding.capabilities.length ? `Can help with: ${grounding.capabilities.join(", ")}.` : "",
    'To book a TEST appointment, reply with only this JSON: {"tool":"book","name":"","phone":"","email":"","when":""}',
    'To save a TEST lead, reply with only this JSON: {"tool":"capture_lead","name":"","phone":"","email":"","company":"","note":""}',
    "No other tools exist. Do not claim a message was sent or a payment was taken.",
  ].filter(Boolean).join("\n");
}

export function buildTryPrompt(input: {
  grounding: TryGrounding;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
}) {
  return buildReplyMessages({
    settings: tryDraftSettings(input.grounding),
    brandName: input.grounding.orgName,
    senderName: input.grounding.botName,
    channel: "test chat",
    contactName: "Visitor",
    messages: [
      ...input.history.map((item) => ({
        direction: item.role === "user" ? "in" as const : "out" as const,
        body: item.content,
      })),
      { direction: "in" as const, body: input.message },
    ],
  });
}
