import type { EnvLike } from "@/lib/automation/channels";
import { johannesburgDateKey, newId, toWaDigits } from "@/lib/automation/ids";
import type { Channel, MessageCategory, OutboxMessage, Prospect, Suppression } from "@/lib/automation/types";

/** South Africa per-message card. Service matches utility. ZAR is not implied. */
export const WHATSAPP_MARKETING_USD = 0.0379;
export const WHATSAPP_SERVICE_USD = 0.0095;
export const WHATSAPP_FREE_SERVICE_PER_MONTH = 1000;
export const WHATSAPP_SERVICE_PRICING_START = "2026-10-01";

const OPT_OUT = /\b(stopall|unsubscribe|optout|opt-out|opt\s+out|stop)\b/i;

export function messageCategory(templateKey: string): MessageCategory {
  if (templateKey.startsWith("ack_") || templateKey.startsWith("audit_reminder")) return "service";
  return "marketing";
}

export function isOptOutText(text: string) {
  return OPT_OUT.test(text);
}

export function normalizeAddress(channel: Channel, address: string) {
  const raw = address.trim();
  if (!raw) return "";
  if (channel === "email") return raw.toLowerCase();
  return toWaDigits(raw) || raw.toLowerCase();
}

export function matchingSuppression(suppressions: Suppression[], channel: Channel, address: string) {
  const key = normalizeAddress(channel, address);
  if (!key) return undefined;
  return suppressions.find((item) => item.address === key && (item.channel === "" || item.channel === channel));
}

export function addSuppression(existing: Suppression[], address: string, now: Date, reason: string): Suppression[] {
  if (!address || existing.some((item) => item.address === address && item.channel === "")) return existing;
  return [...existing, { id: newId("sup"), address, channel: "", reason, createdAt: now.toISOString() }];
}

export function optOutAddresses(inputs: Array<{ channel: Channel; value: string }>) {
  const keys = new Set<string>();
  for (const input of inputs) {
    const key = normalizeAddress(input.channel, input.value);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function marketingFooter(owner: string) {
  const who = owner.trim();
  const identity = who && !/ai autotech/i.test(who) ? `AI AutoTech · ${who}` : "AI AutoTech";
  return `\n\n${identity}\nReply STOP to opt out.`;
}

export function ensureMarketingFooter(body: string, owner: string) {
  if (/reply\s+stop/i.test(body) && /ai autotech/i.test(body)) return body;
  return `${body.trimEnd()}${marketingFooter(owner)}`;
}

export function marketingConsentFor(
  state: {
    leads: Array<{ id: string; marketingConsent?: boolean }>;
    prospects: Array<Pick<Prospect, "id" | "marketingConsent"> & Partial<Pick<Prospect, "consentBasis" | "status">>>;
  },
  message: { leadId: string; prospectId: string | null },
) {
  if (message.leadId) {
    const lead = state.leads.find((item) => item.id === message.leadId);
    if (lead) return lead.marketingConsent === true;
  }
  if (message.prospectId) {
    const prospect = state.prospects.find((item) => item.id === message.prospectId);
    if (prospect) {
      if (prospect.marketingConsent === true) return true;
      if (prospect.consentBasis === "existing_customer" && prospect.status !== "stopped") return true;
    }
  }
  return false;
}

export function countCloudServiceSends(outbox: OutboxMessage[], now: Date) {
  const month = johannesburgDateKey(now).slice(0, 7);
  return outbox.filter((message) => {
    if (message.channel !== "whatsapp" || message.provider !== "whatsapp_cloud" || !message.sentAt) return false;
    if (message.costCategory !== "whatsapp_service" && message.costCategory !== "whatsapp_service_free") return false;
    return johannesburgDateKey(new Date(message.sentAt)).slice(0, 7) === month;
  }).length;
}

export function previewSendBlock(input: {
  category: MessageCategory;
  channel: Channel;
  to: string;
  marketingConsent: boolean;
  suppressions: Suppression[];
}) {
  if (matchingSuppression(input.suppressions, input.channel, input.to)) return "Opted out. This send stays blocked.";
  if (input.category === "marketing" && input.marketingConsent !== true) {
    return "Marketing needs a recorded opt-in before it can send.";
  }
  return "";
}

export type SendQuote = {
  costUsd: number | null;
  costZar: number | null;
  costCategory: string;
};

export function quoteSendCost(input: {
  channel: Channel;
  provider: string;
  category: MessageCategory;
  status: string;
  sentAt: Date;
  serviceSendsThisMonth: number;
  env: EnvLike;
}): SendQuote {
  if (input.provider === "wa.me") return { costUsd: 0, costZar: null, costCategory: "wa.me" };
  if (input.status !== "sent") return { costUsd: null, costZar: null, costCategory: "" };

  if (input.channel === "whatsapp" && input.provider === "whatsapp_cloud") {
    return quoteWhatsApp(input);
  }
  if (input.channel === "sms") return configuredZar(input.env.SMS_COST_ZAR, "sms");
  if (input.channel === "email") return configuredZar(input.env.EMAIL_COST_ZAR, "email");
  return { costUsd: null, costZar: null, costCategory: "" };
}

function quoteWhatsApp(input: {
  category: MessageCategory;
  sentAt: Date;
  serviceSendsThisMonth: number;
  env: EnvLike;
}): SendQuote {
  const marketingUsd = positiveAmount(input.env.WHATSAPP_MARKETING_USD) ?? WHATSAPP_MARKETING_USD;
  const serviceUsd = positiveAmount(input.env.WHATSAPP_SERVICE_USD) ?? WHATSAPP_SERVICE_USD;
  const rate = positiveAmount(input.env.WHATSAPP_USDZAR);
  if (input.category === "marketing") return priced(marketingUsd, "whatsapp_marketing", rate);

  const started = johannesburgDateKey(input.sentAt) >= WHATSAPP_SERVICE_PRICING_START;
  if (!started || input.serviceSendsThisMonth < WHATSAPP_FREE_SERVICE_PER_MONTH) {
    return { costUsd: 0, costZar: null, costCategory: "whatsapp_service_free" };
  }
  return priced(serviceUsd, "whatsapp_service", rate);
}

function priced(usd: number, costCategory: string, rate: number | null): SendQuote {
  return {
    costUsd: usd,
    costZar: rate == null ? null : Math.round(usd * rate * 100) / 100,
    costCategory,
  };
}

function configuredZar(raw: string | undefined, costCategory: string): SendQuote {
  if (raw == null || raw.trim() === "") return { costUsd: null, costZar: null, costCategory: "" };
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return { costUsd: null, costZar: null, costCategory: "" };
  return { costUsd: null, costZar: amount, costCategory };
}

function positiveAmount(raw: string | undefined) {
  if (raw == null || raw.trim() === "") return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

export function formatSendCost(message: { costUsd: number | null; costZar: number | null; costCategory: string }) {
  if (!message.costCategory) return "";
  const parts = [message.costCategory.replaceAll("_", " ")];
  if (message.costUsd != null) parts.push(`USD ${message.costUsd.toFixed(4)}`);
  if (message.costZar != null) parts.push(`R ${message.costZar.toFixed(2)}`);
  return parts.join(" · ");
}
