import { deliverMessage } from "@/lib/automation/send";
import { buildSmsLink, buildWaLink, isSendEnabled, type EnvLike } from "@/lib/automation/channels";
import { newId } from "@/lib/automation/ids";
import type { AutomationState } from "@/lib/automation/types";

export async function flushOutbox(
  state: AutomationState,
  now: Date,
  env: EnvLike = process.env,
  deliver: typeof deliverMessage = deliverMessage,
): Promise<AutomationState> {
  if (!isSendEnabled(env)) {
    return {
      ...state,
      outbox: state.outbox.map((message) => {
        if (message.channel === "whatsapp") {
          return { ...message, waLink: message.waLink || buildWaLink(message.toAddress, message.body), provider: message.provider || "outbox" };
        }
        if (message.channel === "sms") {
          return { ...message, waLink: message.waLink || buildSmsLink(message.toAddress, message.body), provider: message.provider || "outbox" };
        }
        return message;
      }),
    };
  }

  let next = state;
  for (const message of state.outbox) {
    if (message.status !== "queued" && message.status !== "approved") continue;
    if (new Date(message.scheduledFor).getTime() > now.getTime()) continue;
    const result = await deliver(
      { channel: message.channel, to: message.toAddress, subject: message.subject, body: message.body },
      env,
    );
    next = {
      ...next,
      outbox: next.outbox.map((item) =>
        item.id === message.id
          ? {
              ...item,
              status: result.status === "sent" ? "sent" : result.status === "failed" ? "failed" : item.status,
              provider: result.provider,
              providerId: result.providerId,
              waLink: result.waLink || item.waLink,
              error: result.error,
              sentAt: result.status === "sent" ? now.toISOString() : item.sentAt,
            }
          : item,
      ),
      activities:
        result.status === "sent" && message.leadId
          ? [
              ...next.activities,
              {
                id: newId("act"),
                leadId: message.leadId,
                kind: "message_sent",
                title: `Sent via ${result.provider}`,
                body: `${message.channel} · ${message.templateKey}`,
                metadata: { messageId: message.id, provider: result.provider, channel: message.channel },
                createdAt: now.toISOString(),
              },
            ]
          : next.activities,
    };
  }
  return next;
}
