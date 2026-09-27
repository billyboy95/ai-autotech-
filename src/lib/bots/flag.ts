import { replyProviderConfig } from "@/lib/ai-reply/provider";

/** Off unless BOT_ASSISTANT_ENABLED=true. Also off when AI_REPLY_API_KEY is missing. */
export function isBotAssistantEnabled(env: NodeJS.ProcessEnv = process.env) {
  const flag = String(env.BOT_ASSISTANT_ENABLED ?? "").trim().toLowerCase() === "true";
  if (!flag) return false;
  return Boolean(replyProviderConfig(env).apiKey);
}
