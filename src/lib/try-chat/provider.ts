import { createOpenAiCompatibleProvider, type ReplyProvider } from "@/lib/ai-reply/provider";

export const TRY_MAX_TOKENS = 400;
export const TRY_UNCONFIGURED_MESSAGE =
  "This test chat is not connected to a model yet. Nothing was sent and nothing was charged.";

export function tryProviderEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    AI_REPLY_BASE_URL: String(env.TRY_AI_BASE_URL ?? "").trim(),
    AI_REPLY_API_KEY: String(env.TRY_AI_API_KEY ?? "").trim(),
    AI_REPLY_MODEL: String(env.TRY_AI_MODEL ?? "").trim() || "gpt-4o-mini",
  };
}

export function createTryProvider(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch): ReplyProvider {
  return createOpenAiCompatibleProvider(tryProviderEnv(env), fetchImpl, {
    maxTokens: TRY_MAX_TOKENS,
    unconfiguredMessage: TRY_UNCONFIGURED_MESSAGE,
  });
}
