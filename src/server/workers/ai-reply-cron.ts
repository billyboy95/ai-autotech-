import { assessReplyConsent, latestChannelConsents } from "@/lib/ai-reply/consent";
import { draftEligibleForAutoQueue, planDraftApproval } from "@/lib/ai-reply/plan";
import { parseAiReplySettings } from "@/lib/ai-reply/types";
import { isStopCommand } from "@/lib/compliance/stop";
import { usageForSend } from "@/lib/compliance/usage";
import { contactLookup, outboxRow } from "@/lib/inbox/rules";
import { openServiceDatabase } from "@/server/workers/service-db";

export type AiReplyCronResult = {
  ok: boolean;
  processed: number;
  queued: number;
  skipped: "flag_off" | null;
  error?: string;
};

/**
 * Optional auto-queue. Stays off unless AI_REPLY_CRON_ENABLED is the string "true".
 * Even then, a draft is queued only when the workspace mode is queue_outbox,
 * require_human_before_send is false, sending_enabled is true, and consent still holds.
 * This does not call a provider and does not mark a draft sent.
 */
export async function runAiReplyCron(env: NodeJS.ProcessEnv = process.env): Promise<AiReplyCronResult> {
  if (env.AI_REPLY_CRON_ENABLED !== "true") {
    return { ok: true, processed: 0, queued: 0, skipped: "flag_off" };
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, processed: 0, queued: 0, skipped: null, error: "Supabase service role is not configured." };
  }
  const client = openServiceDatabase();
  if (!client) {
    return { ok: false, processed: 0, queued: 0, skipped: null, error: "Supabase service role is not configured." };
  }

  const settingsRows = await client
    .from("ai_reply_settings")
    .select("*")
    .eq("enabled", true)
    .eq("mode", "queue_outbox")
    .eq("require_human_before_send", false);
  if (settingsRows.error) {
    return { ok: false, processed: 0, queued: 0, skipped: null, error: settingsRows.error.message };
  }

  let processed = 0;
  let queued = 0;
  for (const row of settingsRows.data ?? []) {
    const settings = parseAiReplySettings(row);
    const orgId = String(row.org_id || "");
    if (!orgId) continue;
    const org = await client.from("organizations").select("id, name, sender_name, sending_enabled").eq("id", orgId).maybeSingle();
    if (org.error || !org.data) continue;
    const sendingEnabled = Boolean(org.data.sending_enabled);
    if (!draftEligibleForAutoQueue({ settings, sendingEnabled, draft: { status: "pending_review", consentOk: true } })) {
      continue;
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await client.from("ai_drafts").select("model_meta").eq("org_id", orgId).gt("created_at", since);
    const used = (recent.data ?? []).filter((item) => {
      const meta = item.model_meta && typeof item.model_meta === "object" ? item.model_meta as { failure?: string } : {};
      return meta.failure !== "consent_denied";
    }).length;
    const room = Math.max(0, settings.maxAutoPerHour - used);
    if (room === 0) continue;

    const drafts = await client
      .from("ai_drafts")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "pending_review")
      .eq("consent_ok", true)
      .order("created_at", { ascending: true })
      .limit(room);
    if (drafts.error || !drafts.data) continue;

    for (const draft of drafts.data) {
      processed += 1;
      const outcome = await queueDraft(client, {
        draft,
        settings,
        sendingEnabled,
        senderName: String(org.data.sender_name || org.data.name || "This workspace"),
      });
      if (outcome === "queued") queued += 1;
    }
  }

  return { ok: true, processed, queued, skipped: null };
}

async function queueDraft(
  client: NonNullable<ReturnType<typeof openServiceDatabase>>,
  input: {
    draft: Record<string, unknown>;
    settings: ReturnType<typeof parseAiReplySettings>;
    sendingEnabled: boolean;
    senderName: string;
  },
) {
  const draftId = String(input.draft.id || "");
  const orgId = String(input.draft.org_id || "");
  const conversationId = String(input.draft.conversation_id || "");
  if (!draftEligibleForAutoQueue({
    settings: input.settings,
    sendingEnabled: input.sendingEnabled,
    draft: { status: String(input.draft.status || ""), consentOk: input.draft.consent_ok === true },
  })) {
    return "skipped" as const;
  }

  const conversation = await client
    .from("conversations")
    .select("id, org_id, contact_id, channel, channel_connection_id, wa_window_expires_at, status")
    .eq("id", conversationId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!conversation.data) return "skipped" as const;
  const current = conversation.data;
  const channel = String(current.channel);
  if (!input.settings.channels.includes(channel)) {
    await client.from("ai_drafts").update({
      status: "failed",
      model_meta: { failure: "channel_not_allowed", reason: "Conversation AI is not allowed on this channel." },
    }).eq("id", draftId).eq("org_id", orgId);
    return "skipped" as const;
  }

  const context = await loadContext(client, {
    orgId,
    conversationId,
    contactId: current.contact_id ? String(current.contact_id) : null,
    channel,
  });
  if (!context) return "skipped" as const;
  if (!context.consent.ok) {
    await client.from("ai_drafts").update({
      status: "failed",
      consent_ok: false,
      model_meta: { failure: "consent_denied", reason: context.consent.reason },
    }).eq("id", draftId).eq("org_id", orgId);
    return "skipped" as const;
  }

  const plan = planDraftApproval({
    settings: input.settings,
    sendingEnabled: input.sendingEnabled,
    consentOk: true,
    draftStatus: "pending_review",
    body: String(input.draft.draft_body || ""),
    now: new Date(),
    channel,
    toAddress: context.address,
    conversationId,
    contactId: context.contactId,
    leadId: context.leadId,
    connectionId: current.channel_connection_id ? String(current.channel_connection_id) : null,
    userId: null,
    senderName: input.senderName,
    windowExpiresAt: current.wa_window_expires_at ? String(current.wa_window_expires_at) : null,
    template: null,
    suppressed: false,
    consent: "opted_in",
    basis: "consent",
    serviceSendsThisMonth: 0,
  });
  if (!plan.ok || !plan.queue) return "skipped" as const;
  const outboxStatus = String(plan.reply.outbox.status);
  const messageStatus = String(plan.reply.message.status);
  if (outboxStatus === "sent" || messageStatus === "sent" || outboxStatus === "blocked_consent") {
    return "skipped" as const;
  }

  const drafted = outboxRow(plan.reply, orgId);
  const outbox = await client.from("crm_outbox").insert(drafted.row);
  if (outbox.error) return "skipped" as const;
  const message = await client.from("messages").insert({
    org_id: orgId,
    conversation_id: plan.reply.message.conversationId,
    direction: plan.reply.message.direction,
    channel: plan.reply.message.channel,
    body: plan.reply.message.body,
    template_id: plan.reply.message.templateId,
    provider_message_id: plan.reply.message.providerMessageId,
    status: plan.reply.message.status,
    wa_category: plan.reply.message.waCategory,
    cost_cents: plan.reply.message.costCents,
    sent_by_user_id: null,
    outbox_id: plan.reply.message.outboxId,
  });
  if (message.error) {
    await client.from("crm_outbox").update({ status: "cancelled", error: message.error.message }).eq("id", plan.reply.outbox.id).eq("org_id", orgId);
    return "skipped" as const;
  }

  const saved = await client.from("ai_drafts").update({
    status: "queued",
    consent_ok: true,
    outbox_id: plan.reply.outbox.id,
    model_meta: {
      ...(input.draft.model_meta && typeof input.draft.model_meta === "object" ? input.draft.model_meta : {}),
      outboxStatus: plan.reply.outbox.status,
      outboxId: plan.reply.outbox.id,
    },
  }).eq("id", draftId).eq("org_id", orgId);
  if (saved.error) return "skipped" as const;

  await client.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId).eq("org_id", orgId);
  const usage = usageForSend({
    orgId,
    channel: plan.reply.outbox.channel,
    purpose: plan.reply.outbox.purpose,
    sourceId: plan.reply.outbox.id,
  });
  await client.from("usage_ledger").insert({
    org_id: orgId,
    meter: usage.meter,
    quantity: usage.quantity,
    unit_cost_cents: usage.unitCostCents,
    unit_price_cents: usage.unitPriceCents,
    cost_cents: plan.reply.outbox.costCents,
    source_type: "outbox",
    source_id: plan.reply.outbox.id,
    channel_connection_id: current.channel_connection_id,
  });
  return "queued" as const;
}

async function loadContext(
  client: NonNullable<ReturnType<typeof openServiceDatabase>>,
  input: { orgId: string; conversationId: string; contactId: string | null; channel: string },
) {
  if (!input.contactId) return null;
  const [messages, contact] = await Promise.all([
    client.from("messages").select("id, direction, body").eq("conversation_id", input.conversationId).eq("org_id", input.orgId).order("created_at", { ascending: false }).limit(1),
    client.from("crm_contacts").select("id, email, phone_e164, whatsapp_e164, lead_id, custom").eq("id", input.contactId).eq("org_id", input.orgId).maybeSingle(),
  ]);
  if (!contact.data) return null;
  const inbound = (messages.data ?? []).find((row) => row.direction === "in");
  const address = addressFor(input.channel, contact.data);
  const consents = await client
    .from("contact_consents")
    .select("channel, purpose, status, captured_at")
    .eq("contact_id", contact.data.id)
    .eq("org_id", input.orgId)
    .order("captured_at", { ascending: false });
  const lookup = contactLookup(input.channel, address);
  const key = lookup.email || lookup.phone || address.trim().toLowerCase();
  const suppressed = address
    ? await client.from("suppressions").select("id").eq("org_id", input.orgId).eq("channel", input.channel).eq("address", key).limit(1)
    : { data: [] };
  return {
    contactId: String(contact.data.id),
    leadId: contact.data.lead_id ? String(contact.data.lead_id) : null,
    address,
    consent: assessReplyConsent({
      channel: input.channel,
      consents: latestChannelConsents(consents.data ?? []),
      suppressed: Boolean(suppressed.data && suppressed.data.length > 0),
      inboundStop: inbound ? isStopCommand(String(inbound.body || "")) : false,
    }),
  };
}

function addressFor(channel: string, contact: { email?: string | null; phone_e164?: string | null; whatsapp_e164?: string | null; custom?: unknown }) {
  if (channel === "email") return String(contact.email || "");
  if (channel === "whatsapp") return String(contact.whatsapp_e164 || contact.phone_e164 || "");
  if (channel === "sms") return String(contact.phone_e164 || "");
  const custom = contact.custom && typeof contact.custom === "object" ? contact.custom as { external_id?: string } : {};
  return String(custom.external_id || "");
}
