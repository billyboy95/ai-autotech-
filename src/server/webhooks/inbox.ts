import { contactLookup, planInboundThread, windowExpiry } from "@/lib/inbox/rules";
import { openServiceDatabase } from "@/server/workers/service-db";
import { withOrg } from "@/server/workers/with-org";

function missingRelation(message: string) {
  const text = message.toLowerCase();
  return text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find") || text.includes("record_workflow_event");
}

export type InboundThreadResult =
  | { ok: true; conversationId: string; contactId: string; messageId: string; duplicate: boolean }
  | { ok: false; missing: boolean };

/**
 * Stores an inbound provider message on the workspace thread and records
 * message.inbound (and opt_out.received for STOP) for the workflow engine.
 * Does not send a reply.
 */
export async function recordInboundThread(input: {
  orgId: string;
  connectionId: string;
  channel: string;
  from: string;
  body: string;
  providerMessageId: string;
  stop: boolean;
  now?: Date;
}): Promise<InboundThreadResult> {
  const now = input.now ?? new Date();
  try {
    const contact = await findOrCreateContact(input.orgId, input.channel, input.from);
    if (!contact) return { ok: false, missing: true };
    const existing = await findConversation(input.orgId, contact.id, input.channel, input.connectionId);
    const plan = planInboundThread({
      now,
      channel: input.channel,
      body: input.body,
      providerMessageId: input.providerMessageId,
      stop: input.stop,
      existing: existing ? { id: existing.id, unreadCount: existing.unreadCount } : null,
    });

    let conversationId = existing?.id || "";
    if (!conversationId) {
      const created = await withOrg(input.orgId).from("conversations").insert({
        contact_id: contact.id,
        channel: plan.channel,
        channel_connection_id: input.connectionId,
        status: "open",
        last_message_at: plan.lastMessageAt,
        unread_count: 1,
        wa_window_expires_at: plan.waWindowExpiresAt,
      }).select("id").single();
      if (created.error) {
        if (missingRelation(created.error.message)) return { ok: false, missing: true };
        throw new Error(created.error.message);
      }
      conversationId = String(created.data.id);
    }

    const inserted = await withOrg(input.orgId).from("messages").insert({
      conversation_id: conversationId,
      direction: plan.message.direction,
      channel: plan.message.channel,
      body: plan.message.body,
      provider_message_id: plan.message.providerMessageId,
      status: plan.message.status,
      wa_category: plan.message.waCategory,
      cost_cents: plan.message.costCents,
    }).select("id").single();

    let messageId = "";
    let duplicate = false;
    if (inserted.error) {
      if (missingRelation(inserted.error.message)) return { ok: false, missing: true };
      if (!/duplicate|unique/i.test(inserted.error.message)) throw new Error(inserted.error.message);
      duplicate = true;
      const prior = await withOrg(input.orgId)
        .from("messages")
        .select("id")
        .eq("provider_message_id", plan.message.providerMessageId)
        .limit(1);
      messageId = String((prior.data as { id?: string }[] | null)?.[0]?.id || "");
    } else {
      messageId = String(inserted.data.id);
      if (existing) {
        const patch: Record<string, unknown> = {
          status: "open",
          last_message_at: plan.lastMessageAt,
          unread_count: plan.unreadCount,
          updated_at: plan.lastMessageAt,
        };
        if (plan.waWindowExpiresAt) patch.wa_window_expires_at = plan.waWindowExpiresAt;
        const updated = await withOrg(input.orgId).from("conversations").update(patch).eq("id", conversationId);
        if (updated.error && !missingRelation(updated.error.message)) throw new Error(updated.error.message);
      }
    }

    await recordWorkflowEvents({
      orgId: input.orgId,
      types: plan.events,
      contactId: contact.id,
      leadId: contact.leadId,
      conversationId,
      messageId,
      channel: plan.channel,
      connectionId: input.connectionId,
      providerMessageId: input.providerMessageId,
      body: input.body,
    });

    return { ok: true, conversationId, contactId: contact.id, messageId, duplicate };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (missingRelation(message)) return { ok: false, missing: true };
    throw error;
  }
}

export async function recordThreadOutbound(input: {
  orgId: string;
  conversationId: string;
  channel: string;
  body: string;
  outboxId: string;
  providerId: string;
  status: "held" | "queued" | "blocked_consent";
  waCategory: string;
  costCents: number;
  connectionId: string | null;
  templateId?: string | null;
  userId?: string | null;
}) {
  const saved = await withOrg(input.orgId).from("messages").insert({
    conversation_id: input.conversationId,
    direction: "out",
    channel: input.channel,
    body: input.body,
    template_id: input.templateId || null,
    provider_message_id: input.providerId ? `outbox:${input.providerId}` : `outbox:${input.outboxId}`,
    status: input.status,
    wa_category: input.waCategory,
    cost_cents: input.costCents,
    sent_by_user_id: input.userId || null,
    outbox_id: input.outboxId,
  }).select("id").single();
  if (saved.error && !missingRelation(saved.error.message) && !/duplicate|unique/i.test(saved.error.message)) {
    throw new Error(saved.error.message);
  }
  if (!saved.error) {
    const stamped = new Date().toISOString();
    await withOrg(input.orgId).from("conversations").update({
      last_message_at: stamped,
      updated_at: stamped,
    }).eq("id", input.conversationId);
  }
  return saved.error ? null : String(saved.data.id);
}

async function findOrCreateContact(orgId: string, channel: string, from: string) {
  const lookup = contactLookup(channel, from);
  const existing = await findContact(orgId, lookup);
  if (existing === "missing") return null;
  if (existing) return existing;
  const created = await withOrg(orgId).from("crm_contacts").insert({
    first_name: "",
    last_name: "",
    email: lookup.email,
    phone_e164: lookup.phone,
    whatsapp_e164: lookup.whatsapp,
    company: "",
    tags: [],
    custom: lookup.externalId ? { external_id: lookup.externalId } : {},
  }).select("id, lead_id").single();
  if (created.error) {
    if (missingRelation(created.error.message)) return null;
    if (/duplicate|unique/i.test(created.error.message)) {
      const again = await findContact(orgId, lookup);
      if (again && again !== "missing") return again;
    }
    throw new Error(created.error.message);
  }
  return { id: String(created.data.id), leadId: stringOrNull(created.data.lead_id) };
}

async function findContact(
  orgId: string,
  lookup: { email: string; phone: string; whatsapp: string; externalId: string },
) {
  const query = withOrg(orgId).from("crm_contacts").select("id, lead_id");
  const filtered = lookup.email
    ? query.eq("email", lookup.email)
    : lookup.phone
      ? query.eq("phone_e164", lookup.phone)
      : query.filter("custom->>external_id", "eq", lookup.externalId);
  const found = await filtered.limit(1);
  if (found.error) {
    if (missingRelation(found.error.message)) return "missing" as const;
    throw new Error(found.error.message);
  }
  const row = (found.data as { id?: string; lead_id?: string | null }[] | null)?.[0];
  if (!row?.id) return null;
  return { id: String(row.id), leadId: stringOrNull(row.lead_id) };
}

async function findConversation(orgId: string, contactId: string, channel: string, connectionId: string) {
  const found = await withOrg(orgId)
    .from("conversations")
    .select("id, unread_count, wa_window_expires_at")
    .eq("contact_id", contactId)
    .eq("channel", channel)
    .eq("channel_connection_id", connectionId)
    .order("last_message_at", { ascending: false })
    .limit(1);
  if (found.error) {
    if (missingRelation(found.error.message)) return null;
    throw new Error(found.error.message);
  }
  const row = (found.data as { id?: string; unread_count?: number }[] | null)?.[0];
  if (!row?.id) return null;
  return { id: String(row.id), unreadCount: Number(row.unread_count || 0) };
}

async function recordWorkflowEvents(input: {
  orgId: string;
  types: Array<"message.inbound" | "opt_out.received">;
  contactId: string;
  leadId: string | null;
  conversationId: string;
  messageId: string;
  channel: string;
  connectionId: string;
  providerMessageId: string;
  body: string;
}) {
  const db = openServiceDatabase();
  if (!db) return;
  const subjectId = input.leadId || input.contactId;
  const payload = {
    channel: input.channel,
    conversation_id: input.conversationId,
    contact_id: input.contactId,
    message_id: input.messageId,
    lead_id: input.leadId,
    provider_message_id: input.providerMessageId,
    body: input.body.slice(0, 1000),
  };
  for (const type of input.types) {
    const recorded = await db.rpc("record_workflow_event", {
      p_org: input.orgId,
      p_type: type,
      p_subject_type: input.leadId ? "lead" : "contact",
      p_subject_id: subjectId,
      p_payload: payload,
      p_idempotency_key: `${type}:${input.connectionId}:${input.providerMessageId || input.messageId}`,
    });
    if (recorded.error && !missingRelation(recorded.error.message)) {
      throw new Error(recorded.error.message);
    }
  }
}

function stringOrNull(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

export { windowExpiry };
