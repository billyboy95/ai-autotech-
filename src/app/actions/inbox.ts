"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usageForSend } from "@/lib/compliance/usage";
import type { ConsentStatus } from "@/lib/compliance/send-gate";
import { contactLookup, outboxRow, parseInboxChannel, planInboxReply, type InboxTemplateChoice, type WaCategory } from "@/lib/inbox/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function back(formData: FormData, extra?: Record<string, string>): never {
  const params = new URLSearchParams();
  for (const key of ["org", "filter", "channel"]) {
    const value = text(formData, key);
    if (value) params.set(key, value);
  }
  const id = extra?.id || text(formData, "id");
  if (id) params.set("id", id);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (key !== "id" && value) params.set(key, value);
    }
  }
  const qs = params.toString();
  redirect(qs ? `/command-centre/inbox?${qs}` : "/command-centre/inbox");
}

export async function sendInboxReply(formData: FormData) {
  const id = text(formData, "id");
  if (!id) back(formData, { error: "Choose a conversation first." });
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect("/login?next=/command-centre/inbox");

  const conversation = await supabase
    .from("conversations")
    .select("id, org_id, contact_id, channel, channel_connection_id, wa_window_expires_at, status")
    .eq("id", id)
    .maybeSingle();
  if (conversation.error || !conversation.data) back(formData, { error: "That conversation is not in this workspace." });
  const current = conversation.data;
  if (!current) back(formData, { error: "That conversation is not in this workspace." });
  const channel = parseInboxChannel(text(formData, "replyChannel")) || String(current.channel);
  const contact = current.contact_id
    ? await supabase
        .from("crm_contacts")
        .select("id, email, phone_e164, whatsapp_e164, lead_id, custom")
        .eq("id", current.contact_id)
        .eq("org_id", current.org_id)
        .maybeSingle()
    : { data: null, error: null };
  if (!contact.data) back(formData, { error: "This conversation has no contact to reply to." });

  let conversationId = String(current.id);
  let windowExpiresAt = current.wa_window_expires_at ? String(current.wa_window_expires_at) : null;
  let connectionId = text(formData, "connectionId") || (String(current.channel) === channel ? String(current.channel_connection_id || "") : "");
  if (channel !== String(current.channel) && contact.data) {
    const switched = await openChannelThread({
      supabase,
      orgId: String(current.org_id),
      contactId: String(contact.data.id),
      channel,
      connectionId: connectionId || null,
      userId: user.data.user.id,
    });
    if (!switched.ok) back(formData, { error: switched.message });
    if (switched.ok) {
      conversationId = switched.id;
      windowExpiresAt = switched.windowExpiresAt;
      connectionId = switched.connectionId || connectionId;
    }
  }

  const org = await supabase.from("organizations").select("sending_enabled, sender_name, name").eq("id", current.org_id).maybeSingle();
  const senderName = String(org.data?.sender_name || org.data?.name || "This workspace");
  const template = await loadTemplate(supabase, text(formData, "templateId"), String(current.org_id));
  const toAddress = addressFor(channel, contact.data);
  if (!toAddress) back(formData, { id: conversationId, error: "This contact has no address on that channel." });

  const consent = await latestConsent(supabase, String(contact.data.id), channel, template?.waCategory === "marketing" ? "marketing" : "service");
  const suppressed = await isSuppressed(supabase, String(current.org_id), channel, toAddress);
  const serviceSendsThisMonth = await serviceCount(supabase, String(current.org_id), connectionId);
  const plan = planInboxReply({
    now: new Date(),
    sendingEnabled: Boolean(org.data?.sending_enabled),
    channel,
    body: text(formData, "body"),
    toAddress,
    conversationId,
    contactId: String(contact.data.id),
    leadId: contact.data.lead_id ? String(contact.data.lead_id) : null,
    connectionId: connectionId || null,
    userId: user.data.user.id,
    senderName,
    windowExpiresAt,
    template,
    suppressed,
    consent: consent.status,
    basis: consent.basis,
    serviceSendsThisMonth,
  });
  if (!plan.ok) back(formData, { id: conversationId, error: plan.message });

  const drafted = outboxRow(plan, String(current.org_id));
  const outbox = await supabase.from("crm_outbox").insert(drafted.row);
  if (outbox.error) back(formData, { id: conversationId, error: outbox.error.message });

  const message = await supabase.from("messages").insert({
    org_id: current.org_id,
    conversation_id: plan.message.conversationId,
    direction: plan.message.direction,
    channel: plan.message.channel,
    body: plan.message.body,
    template_id: plan.message.templateId,
    provider_message_id: plan.message.providerMessageId,
    status: plan.message.status,
    wa_category: plan.message.waCategory,
    cost_cents: plan.message.costCents,
    sent_by_user_id: plan.message.sentByUserId,
    outbox_id: plan.message.outboxId,
  });
  if (message.error) {
    const prompt = /use template/i.test(message.error.message) ? "Free-form WhatsApp is outside the 24-hour window. Use an approved template." : message.error.message;
    back(formData, { id: conversationId, error: prompt });
  }

  await supabase.from("conversations").update({
    last_message_at: new Date().toISOString(),
    status: current.status === "closed" ? "open" : current.status,
  }).eq("id", conversationId);

  if (plan.outbox.status !== "blocked_consent") {
    const usage = usageForSend({
      orgId: String(current.org_id),
      channel: plan.outbox.channel,
      purpose: plan.outbox.purpose,
      sourceId: plan.outbox.id,
    });
    await supabase.from("usage_ledger").insert({
      org_id: current.org_id,
      meter: usage.meter,
      quantity: usage.quantity,
      unit_cost_cents: usage.unitCostCents,
      unit_price_cents: usage.unitPriceCents,
      cost_cents: plan.outbox.costCents,
      source_type: "outbox",
      source_id: plan.outbox.id,
      channel_connection_id: connectionId || null,
    });
  }

  revalidatePath("/command-centre/inbox");
  back(formData, { id: conversationId, notice: `${plan.notice} Provider id ${plan.outbox.providerId}.` });
}

export async function addInboxNote(formData: FormData) {
  const id = text(formData, "id");
  const body = text(formData, "note");
  if (!id || !body) back(formData, { error: "Write a note before saving it." });
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect("/login?next=/command-centre/inbox");
  const conversation = await supabase.from("conversations").select("id, org_id").eq("id", id).maybeSingle();
  if (!conversation.data) back(formData, { error: "That conversation is not in this workspace." });
  const saved = await supabase.from("conversation_notes").insert({
    org_id: conversation.data.org_id,
    conversation_id: id,
    body,
    author_user_id: user.data.user.id,
  });
  if (saved.error) back(formData, { error: saved.error.message });
  revalidatePath("/command-centre/inbox");
  back(formData, { notice: "Internal note saved. It was not sent." });
}

export async function assignInboxConversation(formData: FormData) {
  const id = text(formData, "id");
  const assignee = text(formData, "assignee");
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect("/login?next=/command-centre/inbox");
  const saved = await supabase
    .from("conversations")
    .update({ assigned_user_id: assignee || null })
    .eq("id", id);
  if (saved.error) back(formData, { error: saved.error.message });
  revalidatePath("/command-centre/inbox");
  back(formData, { notice: assignee ? "Conversation assigned." : "Conversation is unassigned." });
}

export async function setInboxStatus(formData: FormData) {
  const id = text(formData, "id");
  const status = text(formData, "status") === "closed" ? "closed" : "open";
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect("/login?next=/command-centre/inbox");
  const saved = await supabase.from("conversations").update({ status }).eq("id", id);
  if (saved.error) back(formData, { error: saved.error.message });
  revalidatePath("/command-centre/inbox");
  back(formData, { notice: status === "closed" ? "Conversation closed." : "Conversation reopened." });
}

export async function markInboxRead(conversationId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("conversations").update({ unread_count: 0 }).eq("id", conversationId).gt("unread_count", 0);
  revalidatePath("/command-centre/inbox");
}

async function openChannelThread(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  orgId: string;
  contactId: string;
  channel: string;
  connectionId: string | null;
  userId: string;
}) {
  const existing = await input.supabase
    .from("conversations")
    .select("id, wa_window_expires_at, channel_connection_id")
    .eq("org_id", input.orgId)
    .eq("contact_id", input.contactId)
    .eq("channel", input.channel)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.data) {
    return {
      ok: true as const,
      id: String(existing.data.id),
      windowExpiresAt: existing.data.wa_window_expires_at ? String(existing.data.wa_window_expires_at) : null,
      connectionId: input.connectionId || (existing.data.channel_connection_id ? String(existing.data.channel_connection_id) : null),
    };
  }
  const created = await input.supabase.from("conversations").insert({
    org_id: input.orgId,
    contact_id: input.contactId,
    channel: input.channel,
    channel_connection_id: input.connectionId,
    status: "open",
    assigned_user_id: input.userId,
    unread_count: 0,
  }).select("id").single();
  if (created.error || !created.data) return { ok: false as const, message: created.error?.message || "Could not open that channel." };
  return { ok: true as const, id: String(created.data.id), windowExpiresAt: null, connectionId: input.connectionId };
}

async function loadTemplate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  id: string,
  orgId: string,
): Promise<InboxTemplateChoice | null> {
  if (!id) return null;
  const found = await supabase
    .from("message_templates")
    .select("id, name, channel, subject, body, wa_category, wa_status")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (found.error || !found.data) return null;
  const category = String(found.data.wa_category || "") as WaCategory;
  return {
    id: String(found.data.id),
    channel: String(found.data.channel),
    name: String(found.data.name || "Template"),
    body: String(found.data.body || ""),
    subject: String(found.data.subject || ""),
    waCategory: category === "marketing" || category === "utility" || category === "authentication" || category === "service" ? category : "",
    approved: String(found.data.wa_status || "") === "approved" || String(found.data.channel) !== "whatsapp",
  };
}

function addressFor(channel: string, contact: { email?: string | null; phone_e164?: string | null; whatsapp_e164?: string | null; custom?: unknown }) {
  if (channel === "email") return String(contact.email || "");
  if (channel === "whatsapp") return String(contact.whatsapp_e164 || contact.phone_e164 || "");
  if (channel === "sms") return String(contact.phone_e164 || "");
  const custom = contact.custom && typeof contact.custom === "object" ? contact.custom as { external_id?: string } : {};
  return String(custom.external_id || "");
}

async function latestConsent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  contactId: string,
  channel: string,
  purpose: "marketing" | "service",
) {
  const listed = await supabase
    .from("contact_consents")
    .select("status, basis, purpose, captured_at")
    .eq("contact_id", contactId)
    .eq("channel", channel)
    .order("captured_at", { ascending: false });
  if (listed.error || !listed.data?.length) return { status: "none" as ConsentStatus, basis: null };
  const row = listed.data.find((item) => item.purpose === purpose) || listed.data[0];
  const status = row.status === "opted_in" || row.status === "opted_out" || row.status === "requested" ? row.status : "none";
  const basis = row.basis === "existing_customer" || row.basis === "consent" ? row.basis : null;
  return { status, basis };
}

async function isSuppressed(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  channel: string,
  address: string,
) {
  const lookup = contactLookup(channel, address);
  const key = lookup.email || lookup.phone || address.trim().toLowerCase();
  const found = await supabase.from("suppressions").select("id").eq("org_id", orgId).eq("channel", channel).eq("address", key).limit(1);
  return Boolean(found.data && found.data.length > 0);
}

async function serviceCount(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  connectionId: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(connectionId)) return 0;
  const counted = await supabase.rpc("wa_service_sends_this_month", { p_org: orgId, p_connection: connectionId });
  return typeof counted.data === "number" ? counted.data : 0;
}
