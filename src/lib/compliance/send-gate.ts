export type OutboundChannel = "email" | "sms" | "whatsapp" | "voice";
export type OutboundPurpose = "marketing" | "service" | "transactional";
export type ConsentStatus = "opted_in" | "opted_out" | "requested" | "none";

export type SendDecision = {
  allowed: boolean;
  status: "ready" | "blocked_sending" | "blocked_consent";
  reason: string;
  body: string;
};

function footer(channel: OutboundChannel, senderName: string) {
  const sender = senderName.trim() || "This business";
  if (channel === "email") {
    return `\n\n${sender}. To opt out, use the unsubscribe link (/unsubscribe) or reply STOP.`;
  }
  if (channel === "voice") return "";
  return `\n${sender}: reply STOP to opt out`;
}

function withIdentity(body: string, channel: OutboundChannel, senderName: string) {
  const line = footer(channel, senderName);
  if (!line) return body;
  if (body.includes("reply STOP to opt out") || body.includes("To opt out")) return body;
  return `${body.trimEnd()}${line}`;
}

/**
 * POPIA send check. Marketing needs opt-in, or an existing customer who has not opted out.
 * A suppression or opt-out blocks every purpose. Sending stays off until the workspace switch is on.
 * Allowed messages carry the sender name and an opt-out.
 */
export function evaluateSend(input: {
  sendingEnabled: boolean;
  channel: OutboundChannel;
  purpose: OutboundPurpose;
  senderName: string;
  suppressed: boolean;
  consent: ConsentStatus;
  basis?: "consent" | "existing_customer" | null;
  body: string;
}): SendDecision {
  const body = withIdentity(input.body, input.channel, input.senderName);
  if (!input.sendingEnabled) {
    return { allowed: false, status: "blocked_sending", reason: "Sending is off for this workspace.", body };
  }
  if (input.suppressed || input.consent === "opted_out") {
    return { allowed: false, status: "blocked_consent", reason: "Recipient is opted out or suppressed.", body };
  }
  if (input.purpose === "marketing") {
    const existingCustomer = input.basis === "existing_customer";
    const optedIn = input.consent === "opted_in";
    if (!optedIn && !existingCustomer) {
      return {
        allowed: false,
        status: "blocked_consent",
        reason: "Marketing needs opt-in, or an existing customer who was offered an opt-out.",
        body,
      };
    }
  }
  if (!input.senderName.trim()) {
    return { allowed: false, status: "blocked_consent", reason: "A sender name is required on every outbound message.", body };
  }
  return { allowed: true, status: "ready", reason: "Compliant.", body };
}
