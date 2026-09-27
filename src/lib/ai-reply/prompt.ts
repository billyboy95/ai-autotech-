import type { AiReplySettings } from "@/lib/ai-reply/types";

export const CONTEXT_MESSAGE_LIMIT = 12;

const DEFAULT_INSTRUCTION = "You draft a short reply for a business inbox. Write only the reply the business would send. Do not claim a message was already sent. Do not invent prices, legal promises, or opt-in status.";

export function recentThread<T>(messages: T[], limit = CONTEXT_MESSAGE_LIMIT) {
  if (limit <= 0) return [];
  return messages.slice(-limit);
}

export function buildReplyMessages(input: {
  settings: AiReplySettings;
  brandName: string;
  senderName: string;
  channel: string;
  contactName: string;
  messages: { direction: "in" | "out"; body: string }[];
}) {
  const brand = input.brandName.trim() || "This workspace";
  const sender = input.senderName.trim() || brand;
  const system = [
    input.settings.systemPrompt.trim() || DEFAULT_INSTRUCTION,
    `Workspace: ${brand}. Sender name: ${sender}.`,
    `Channel: ${input.channel}.`,
    input.settings.tone.trim() ? `Tone: ${input.settings.tone.trim()}.` : "",
    "Do not include a subject line.",
  ].filter(Boolean).join("\n");

  const history = recentThread(input.messages).map((message) => {
    const who = message.direction === "in" ? "Customer" : "Workspace";
    return `${who}: ${message.body}`;
  }).join("\n");

  return [
    { role: "system" as const, content: system },
    {
      role: "user" as const,
      content: `Contact: ${input.contactName.trim() || "Customer"}\n\n${history || "No earlier messages."}\n\nDraft the next reply.`,
    },
  ];
}
