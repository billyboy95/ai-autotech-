import { inboundStopPlan, parseInboundPayload, verifySharedSecret, verifyWebhookSignature, type InboundMessage } from "@/lib/channels/webhook";
import type { StopPlan } from "@/lib/compliance/stop";

export type ConnectionRow = {
  id: string;
  orgId: string;
  channel: string;
  provider: string;
  identifier: string;
  displayName: string;
  secret: {
    token?: string;
    apiKey?: string;
    apiSecret?: string;
    clientId?: string;
    webhookSecret?: string;
    verifyToken?: string;
    appSecret?: string;
  } | null;
  senderName: string;
};

export type InboundDecision =
  | { ok: false; status: number; error: string }
  | { ok: true; challenge: string }
  | {
      ok: true;
      orgId: string;
      connectionId: string;
      message: InboundMessage;
      stop: StopPlan | null;
    };

export function decideInbound(input: {
  provider: string;
  connection: ConnectionRow | null;
  rawBody: string;
  signature: string | null;
  sharedSecret: string | null;
}): InboundDecision {
  if (!input.connection) return { ok: false, status: 404, error: "Unknown channel connection." };
  const expected = input.provider.toLowerCase();
  const actual = input.connection.provider.toLowerCase();
  if (expected !== actual && !(expected === "whatsapp" && actual === "meta_cloud")) {
    return { ok: false, status: 404, error: "This connection does not belong to that provider." };
  }
  const secret = input.connection.secret;
  const signingSecret = secret?.webhookSecret || secret?.appSecret || secret?.apiSecret || "";
  const signed = verifyWebhookSignature({ secret: signingSecret, rawBody: input.rawBody, signature: input.signature });
  const shared = verifySharedSecret(signingSecret, input.sharedSecret);
  if (!signed && !shared) return { ok: false, status: 401, error: "Webhook signature was rejected." };

  const message = parseInboundPayload(input.connection.provider, input.rawBody);
  if (!message) return { ok: false, status: 400, error: "No inbound message was found." };
  const stop = inboundStopPlan({
    channel: message.channel,
    from: message.from,
    body: message.body,
    senderName: input.connection.senderName,
  });
  return {
    ok: true,
    orgId: input.connection.orgId,
    connectionId: input.connection.id,
    message,
    stop,
  };
}

export function decideMetaChallenge(input: { mode: string | null; token: string | null; challenge: string | null; verifyToken: string }) {
  if (input.mode !== "subscribe" || !input.challenge) return { ok: false as const, status: 400 };
  if (!verifySharedSecret(input.verifyToken, input.token)) return { ok: false as const, status: 401 };
  return { ok: true as const, challenge: input.challenge };
}
