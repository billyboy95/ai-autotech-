export const AI_REPLY_CHANNELS = ["whatsapp", "sms", "email", "facebook", "instagram"] as const;
export type AiReplyChannel = (typeof AI_REPLY_CHANNELS)[number];
export type AiReplyMode = "draft_only" | "queue_outbox";

export type AiReplySettings = {
  enabled: boolean;
  mode: AiReplyMode;
  tone: string;
  systemPrompt: string;
  maxAutoPerHour: number;
  channels: string[];
  requireHumanBeforeSend: boolean;
};

export const DEFAULT_AI_REPLY_SETTINGS: AiReplySettings = {
  enabled: false,
  mode: "draft_only",
  tone: "",
  systemPrompt: "",
  maxAutoPerHour: 20,
  channels: [...AI_REPLY_CHANNELS],
  requireHumanBeforeSend: true,
};

export type AiDraftView = {
  id: string;
  status: string;
  body: string;
  consentOk: boolean;
  failure: string;
  reason: string;
  outboxStatus: string;
  createdAt: string;
};

export function canManageAiReplies(role: string | null | undefined) {
  return role === "agency_owner" || role === "client_admin";
}

export function parseAiReplySettings(value: unknown): AiReplySettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_AI_REPLY_SETTINGS, channels: [...DEFAULT_AI_REPLY_SETTINGS.channels] };
  const row = value as Record<string, unknown>;
  const mode = row.mode === "queue_outbox" ? "queue_outbox" : "draft_only";
  const max = Number(row.max_auto_per_hour ?? row.maxAutoPerHour ?? DEFAULT_AI_REPLY_SETTINGS.maxAutoPerHour);
  const channels = Array.isArray(row.channels)
    ? row.channels.map(String).filter((item) => (AI_REPLY_CHANNELS as readonly string[]).includes(item))
    : [...DEFAULT_AI_REPLY_SETTINGS.channels];
  return {
    enabled: row.enabled === true,
    mode,
    tone: String(row.tone || "").slice(0, 200),
    systemPrompt: String(row.system_prompt || row.systemPrompt || "").slice(0, 4000),
    maxAutoPerHour: Number.isFinite(max) ? Math.min(500, Math.max(0, Math.trunc(max))) : DEFAULT_AI_REPLY_SETTINGS.maxAutoPerHour,
    channels,
    requireHumanBeforeSend: row.require_human_before_send !== false && row.requireHumanBeforeSend !== false,
  };
}

export function parseAiDraft(value: unknown): AiDraftView | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!row.id) return null;
  const meta = row.model_meta && typeof row.model_meta === "object" ? row.model_meta as Record<string, unknown> : {};
  return {
    id: String(row.id),
    status: String(row.status || ""),
    body: String(row.draft_body || row.body || ""),
    consentOk: row.consent_ok === true || row.consentOk === true,
    failure: typeof meta.failure === "string" ? meta.failure : "",
    reason: typeof meta.reason === "string" ? meta.reason : "",
    outboxStatus: typeof meta.outboxStatus === "string" ? meta.outboxStatus : "",
    createdAt: String(row.created_at || row.createdAt || ""),
  };
}

export function missingAiTable(message: string) {
  const text = message.toLowerCase();
  const missing = text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find");
  return missing && (text.includes("ai_reply") || text.includes("ai_drafts") || text.includes("ai_reply_drafts_last_hour"));
}
