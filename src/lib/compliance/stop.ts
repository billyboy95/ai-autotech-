import { toE164 } from "@/lib/automation/channels";

const COMMANDS = new Set(["stop", "unsubscribe", "opt out", "opt-out", "optout", "stopall", "stop all"]);

/** Whole-message opt-out. STOP, UNSUBSCRIBE, OPT OUT, and STOPALL. */
export function isStopCommand(text: string) {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.!]+$/g, "")
    .replace(/\s+/g, " ");
  return COMMANDS.has(normalized);
}

export function stopAddress(channel: string, value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (channel === "email") return raw.toLowerCase();
  return toE164(raw) || raw.toLowerCase();
}

export function optOutAck(senderName: string) {
  const sender = senderName.trim() || "This business";
  return `${sender}: you are opted out. We will not send further marketing. Reply START only if you want messages again.`;
}

export type StopPlan = {
  suppressed: boolean;
  addresses: string[];
  ack: string;
};

export function planStop(input: { text: string; channel: string; address: string; senderName: string }): StopPlan | null {
  if (!isStopCommand(input.text)) return null;
  const address = stopAddress(input.channel === "email" ? "email" : "sms", input.address);
  return {
    suppressed: true,
    addresses: address ? [address] : [],
    ack: optOutAck(input.senderName),
  };
}
