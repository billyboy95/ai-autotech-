import type { LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Picks the cheapest good LLM that is configured. Order:
 * 1. WHATSAPP_LLM_PROVIDER forces one of: gateway | google | groq | github | openai-compatible | pollinations
 * 2. GOOGLE_GENERATIVE_AI_API_KEY → Gemini (free tier on Google AI Studio)
 * 3. GROQ_API_KEY → Groq (free tier)
 * 4. GITHUB_MODELS_TOKEN → GitHub Models (free, rate-limited)
 * 5. Vercel AI Gateway (OIDC on Vercel or AI_GATEWAY_API_KEY). Needs a card on the Vercel team for the $5/month free credit.
 * "pollinations" is an anonymous free endpoint for simulator testing only; never use it for real leads.
 */

export type ResolvedModel = { model: LanguageModel; id: string; provider: string; structured: boolean };

export function resolveModel(kind: "chat" | "transcribe" = "chat", providerOverride?: string): ResolvedModel {
  const forced = providerOverride || process.env.WHATSAPP_LLM_PROVIDER;
  const provider =
    forced ||
    (process.env.GOOGLE_GENERATIVE_AI_API_KEY
      ? "google"
      : process.env.GROQ_API_KEY
        ? "groq"
        : process.env.GITHUB_MODELS_TOKEN
          ? "github"
          : process.env.WHATSAPP_LLM_BASE_URL
            ? "openai-compatible"
            : "gateway");
  const override = providerOverride ? undefined : kind === "chat" ? process.env.WHATSAPP_BOT_MODEL : process.env.WHATSAPP_TRANSCRIBE_MODEL;

  switch (provider) {
    case "google": {
      const id = override || (kind === "chat" ? "gemini-2.5-flash" : "gemini-2.5-flash-lite");
      return { model: createGoogleGenerativeAI()(id), id: `google/${id}`, provider, structured: true };
    }
    case "groq": {
      const id = override || "openai/gpt-oss-120b";
      return { model: createGroq()(id), id: `groq/${id}`, provider, structured: true };
    }
    case "github": {
      const id = override || "openai/gpt-4.1-mini";
      const p = createOpenAICompatible({
        name: "github-models",
        baseURL: "https://models.github.ai/inference",
        apiKey: process.env.GITHUB_MODELS_TOKEN,
        supportsStructuredOutputs: true,
      });
      return { model: p(id), id: `github/${id}`, provider, structured: true };
    }
    case "openai-compatible": {
      const id = override || process.env.WHATSAPP_LLM_MODEL || "gpt-4o-mini";
      const p = createOpenAICompatible({
        name: "custom",
        baseURL: process.env.WHATSAPP_LLM_BASE_URL || "",
        apiKey: process.env.WHATSAPP_LLM_API_KEY,
      });
      return { model: p(id), id: `custom/${id}`, provider, structured: false };
    }
    case "pollinations": {
      const id = override || "openai";
      const p = createOpenAICompatible({ name: "pollinations", baseURL: "https://text.pollinations.ai/openai" });
      return { model: p(id), id: `pollinations/${id}`, provider, structured: false };
    }
    default: {
      const id = override || (kind === "chat" ? "openai/gpt-5-mini" : "google/gemini-2.5-flash-lite");
      return { model: id, id, provider: "gateway", structured: true };
    }
  }
}

/** Optional second provider when the primary fails (e.g. AI Gateway has no card yet). */
export function fallbackModel(kind: "chat" | "transcribe" = "chat"): ResolvedModel | null {
  const p = process.env.WHATSAPP_LLM_FALLBACK;
  return p ? resolveModel(kind, p) : null;
}
