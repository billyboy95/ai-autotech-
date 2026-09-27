export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderResult =
  | { ok: true; text: string; model: string }
  | { ok: false; failure: "provider_unconfigured" | "provider_error"; message: string };

export type ReplyProvider = {
  configured: () => boolean;
  model: string;
  complete: (messages: ChatMessage[]) => Promise<ProviderResult>;
};

export function replyProviderConfig(env: NodeJS.ProcessEnv) {
  const base = (env.AI_REPLY_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/$/, "");
  return {
    apiKey: (env.AI_REPLY_API_KEY || "").trim(),
    baseUrl: base || "https://api.openai.com/v1",
    model: (env.AI_REPLY_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini",
  };
}

export function createOpenAiCompatibleProvider(
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch,
): ReplyProvider {
  const config = replyProviderConfig(env);
  return {
    model: config.model,
    configured: () => Boolean(config.apiKey),
    async complete(messages) {
      if (!config.apiKey) {
        return {
          ok: false,
          failure: "provider_unconfigured",
          message: "AI_REPLY_API_KEY is not set. The draft was saved as provider_unconfigured. Nothing was sent.",
        };
      }
      try {
        const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0.4,
            messages,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) {
          return {
            ok: false,
            failure: "provider_error",
            message: `The reply provider returned ${response.status}. Nothing was sent.`,
          };
        }
        const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
        const text = payload.choices?.[0]?.message?.content?.trim() || "";
        if (!text) {
          return { ok: false, failure: "provider_error", message: "The reply provider returned an empty draft. Nothing was sent." };
        }
        return { ok: true, text, model: config.model };
      } catch {
        return { ok: false, failure: "provider_error", message: "The reply provider could not be reached. Nothing was sent." };
      }
    },
  };
}
