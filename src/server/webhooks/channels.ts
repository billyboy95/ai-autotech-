import { decideInbound, decideMetaChallenge, type ConnectionRow } from "@/lib/channels/inbound";
import { stopAddress } from "@/lib/compliance/stop";
import { usageForSend } from "@/lib/compliance/usage";
import { newId } from "@/lib/automation/ids";
import { loadConnectionForWebhook } from "@/server/workers/channel-secrets";
import { withOrg } from "@/server/workers/with-org";
import { recordInboundThread, recordThreadOutbound } from "@/server/webhooks/inbox";

function missingTable(message: string) {
  const text = message.toLowerCase();
  return text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find");
}

export async function receiveChannelWebhook(input: {
  provider: string;
  connectionId: string;
  rawBody: string;
  signature: string | null;
  sharedSecret: string | null;
}) {
  const connection = await loadConnectionForWebhook(input.connectionId);
  const decision = decideInbound({ ...input, connection });
  if (!decision.ok) return { status: decision.status, body: { ok: false, error: decision.error } };
  if ("challenge" in decision) return { status: 200, body: { ok: true } };

  const saved = await withOrg(decision.orgId).from("inbound_events").insert({
    channel_connection_id: decision.connectionId,
    provider: input.provider,
    provider_message_id: decision.message.providerMessageId,
    channel: decision.message.channel,
    from_address: decision.message.from,
    body: decision.message.body,
    raw: { provider: input.provider },
  });
  if (saved.error && !missingTable(saved.error.message) && !/duplicate|unique/i.test(saved.error.message)) {
    return { status: 500, body: { ok: false, error: "Could not store the inbound event." } };
  }

  const thread = await recordInboundThread({
    orgId: decision.orgId,
    connectionId: decision.connectionId,
    channel: decision.message.channel,
    from: decision.message.from,
    body: decision.message.body,
    providerMessageId: decision.message.providerMessageId,
    stop: Boolean(decision.stop),
  });
  if (!thread.ok && !thread.missing) {
    return { status: 500, body: { ok: false, error: "Could not store the inbox message." } };
  }

  if (decision.stop) {
    await applyStop(
      decision.orgId,
      decision.connectionId,
      decision.message.channel,
      decision.stop,
      thread.ok ? { conversationId: thread.conversationId } : null,
    );
  }
  return {
    status: 200,
    body: { ok: true, orgId: decision.orgId, stopped: Boolean(decision.stop), conversationId: thread.ok ? thread.conversationId : null },
  };
}

export async function metaWebhookChallenge(input: {
  connectionId: string;
  mode: string | null;
  token: string | null;
  challenge: string | null;
}) {
  const connection = await loadConnectionForWebhook(input.connectionId);
  const verifyToken = connection?.secret?.verifyToken || "";
  const decision = decideMetaChallenge({ ...input, verifyToken });
  if (!decision.ok) return { status: decision.status, body: "" };
  return { status: 200, body: decision.challenge };
}

async function applyStop(
  orgId: string,
  connectionId: string,
  channel: string,
  stop: { addresses: string[]; ack: string },
  thread: { conversationId: string } | null,
) {
  const consentChannel = channel === "email" ? "email" : channel === "whatsapp" ? "whatsapp" : "sms";
  for (const address of stop.addresses) {
    const normalized = stopAddress(consentChannel, address);
    if (!normalized) continue;
    const consent = await withOrg(orgId).from("contact_consents").insert({
      channel: consentChannel,
      purpose: "marketing",
      status: "opted_out",
      basis: "consent",
      address: normalized,
      source: "keyword",
      evidence: { keyword: "stop" },
      captured_at: new Date().toISOString(),
      withdrawn_at: new Date().toISOString(),
    });
    if (consent.error && !missingTable(consent.error.message)) throw new Error(consent.error.message);
    const suppressed = await withOrg(orgId).from("suppressions").upsert(
      { channel: consentChannel, address: normalized, reason: "stop_keyword" },
      { onConflict: "org_id,channel,address" },
    );
    if (suppressed.error && !missingTable(suppressed.error.message)) throw new Error(suppressed.error.message);
  }

  const org = await withOrg(orgId, "id").from("organizations").select("sending_enabled").maybeSingle();
  const sending = Boolean((org.data as { sending_enabled?: boolean } | null)?.sending_enabled);
  const address = stop.addresses[0] || "";
  const id = newId("msg");
  const usage = usageForSend({ orgId, channel: consentChannel, purpose: "service", sourceId: id });
  const outbox = await withOrg(orgId).from("crm_outbox").insert({
    id,
    lead_id: null,
    template_key: "opt_out_ack",
    channel: consentChannel === "email" ? "email" : consentChannel === "sms" ? "sms" : "whatsapp",
    to_address: address,
    subject: "",
    body: stop.ack,
    status: sending ? "queued" : "held",
    purpose: "service",
    provider: "dry_run",
    error: sending ? "" : "Held. Sending is off for this workspace.",
    channel_connection_id: connectionId,
    conversation_id: thread?.conversationId || null,
    cost_cents: usage.costCents,
    provider_id: id,
  });
  const outboxChannel = consentChannel === "email" ? "email" : consentChannel === "sms" ? "sms" : "whatsapp";
  if (outbox.error && !missingTable(outbox.error.message)) {
    if (/check constraint|conversation_id|provider_id|column/i.test(outbox.error.message)) {
      await withOrg(orgId).from("crm_outbox").insert({
        id,
        lead_id: null,
        template_key: "opt_out_ack",
        channel: outboxChannel === "sms" ? "whatsapp" : outboxChannel,
        to_address: address,
        subject: "",
        body: stop.ack,
        status: "queued",
        provider: "dry_run",
        provider_id: id,
        error: "Held opt-out acknowledgement. Nothing was sent.",
      });
    }
  }
  if (thread) {
    await recordThreadOutbound({
      orgId,
      conversationId: thread.conversationId,
      channel: outboxChannel,
      body: stop.ack,
      outboxId: id,
      providerId: id,
      status: sending ? "queued" : "held",
      waCategory: outboxChannel === "whatsapp" ? "service" : "",
      costCents: usage.costCents,
      connectionId,
    });
  }
  const ledger = await withOrg(orgId).from("usage_ledger").insert({
    meter: usage.meter,
    quantity: usage.quantity,
    unit_cost_cents: usage.unitCostCents,
    unit_price_cents: usage.unitPriceCents,
    cost_cents: usage.costCents,
    source_type: "outbox",
    source_id: id,
    channel_connection_id: connectionId,
  });
  if (ledger.error && !missingTable(ledger.error.message) && !/duplicate|unique/i.test(ledger.error.message)) {
    throw new Error(ledger.error.message);
  }
}

export type { ConnectionRow };
