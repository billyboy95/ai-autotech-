/**
 * WhatsApp 24-hour customer-care window for the inbox composer.
 * Unset, blank, or any value other than the string true keeps today's inbox:
 * no countdown and no template-gate UI.
 * The window is the latest inbound customer WhatsApp message (messages.direction
 * "in", messages.channel "whatsapp") plus 24 hours, using messages.created_at.
 * No new table. This module does not send, does not call Meta, and does not
 * turn sending_enabled on.
 */

import { whatsappComposeGate, windowCountdown, windowExpiry } from "@/lib/inbox/rules";

export const INBOX_WA_WINDOW_FLAG = "INBOX_WA_WINDOW_ENABLED";

export function inboxWaWindowEnabled(env: NodeJS.ProcessEnv = process.env) {
  return String(env[INBOX_WA_WINDOW_FLAG] ?? "").trim().toLowerCase() === "true";
}

export type WaWindowMessage = {
  direction: string;
  channel: string;
  createdAt: string;
  waCategory?: string;
};

export type CustomerCareWindow = {
  open: boolean;
  inboundAt: string | null;
  expiresAt: string | null;
  countdown: string | null;
  category: string;
};

export type WaCareState = {
  visible: boolean;
  care: CustomerCareWindow | null;
  blocked: boolean;
  prompt: string;
  category: string;
};

/** Latest customer WhatsApp inbound. Outbound and other channels do not open the window. */
export function latestInboundWhatsapp(messages: readonly WaWindowMessage[]) {
  let latest: { at: number; iso: string; category: string } | null = null;
  for (const message of messages) {
    if (message.direction !== "in" || message.channel !== "whatsapp") continue;
    const at = new Date(message.createdAt).getTime();
    if (!Number.isFinite(at)) continue;
    if (!latest || at >= latest.at) {
      latest = {
        at,
        iso: new Date(at).toISOString(),
        category: message.waCategory?.trim() || "service",
      };
    }
  }
  return latest;
}

export function customerCareWindow(messages: readonly WaWindowMessage[], now: Date): CustomerCareWindow {
  const latest = latestInboundWhatsapp(messages);
  if (!latest) {
    return { open: false, inboundAt: null, expiresAt: null, countdown: null, category: "service" };
  }
  const expiresAt = windowExpiry(new Date(latest.at));
  const open = new Date(expiresAt).getTime() > now.getTime();
  return {
    open,
    inboundAt: latest.iso,
    expiresAt,
    countdown: open ? windowCountdown(expiresAt, now) : null,
    category: latest.category || "service",
  };
}

export function waCareState(input: {
  enabled: boolean;
  threadChannel: string;
  replyChannel: string;
  messages: readonly WaWindowMessage[];
  now: Date;
  template: { approved: boolean; waCategory: string } | null;
}): WaCareState {
  if (!input.enabled || input.threadChannel !== "whatsapp") {
    return { visible: false, care: null, blocked: false, prompt: "", category: "" };
  }
  const care = customerCareWindow(input.messages, input.now);
  const category = (input.template?.waCategory || care.category || "service").trim() || "service";
  if (input.replyChannel !== "whatsapp") {
    return { visible: true, care, blocked: false, prompt: "", category };
  }
  const gate = whatsappComposeGate({
    channel: "whatsapp",
    now: input.now,
    windowExpiresAt: care.expiresAt,
    template: input.template ? { approved: input.template.approved } : null,
  });
  return {
    visible: true,
    care,
    blocked: !gate.ok,
    prompt: gate.ok ? "" : gate.message,
    category,
  };
}
