"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assessReplyConsent, latestChannelConsents } from "@/lib/ai-reply/consent";
import { planDraftApproval, prepareDraft } from "@/lib/ai-reply/plan";
import { buildReplyMessages } from "@/lib/ai-reply/prompt";
import { createOpenAiCompatibleProvider } from "@/lib/ai-reply/provider";
import { canManageAiReplies, missingAiTable, parseAiReplySettings, AI_REPLY_CHANNELS } from "@/lib/ai-reply/types";
import { workspaceWriteBlock } from "@/lib/billing/guard";
import { isStopCommand } from "@/lib/compliance/stop";
import { usageForSend } from "@/lib/compliance/usage";
import { contactLookup, outboxRow } from "@/lib/inbox/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";

export type AiReplyActionState = { ok: boolean; message: string };

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

function previewNotice() {
  return "Preview inbox. Connect Supabase before using Conversation AI. Nothing was sent.";
}

export async function draftInboxWithAi(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    back(formData, { notice: previewNotice() });
  }
  const id = text(formData, "id");
  if (!id) back(formData, { error: "Choose a conversation first." });
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect("/login?next=/command-centre/inbox");

  const conversation = await supabase
    .from("conversations")
    .select("id, org_id, contact_id, channel, channel_connection_id, wa_window_expires_at")
    .eq("id", id)
    .maybeSingle();
  if (conversation.error || !conversation.data) back(formData, { error: "That conversation is not in this workspace." });
  const current = conversation.data;
  if (!current) back(formData, { error: "That conversation is not in this workspace." });
  const blocked = await workspaceWriteBlock(String(current.org_id));
  if (blocked) back(formData, { error: blocked });

  const settingsResult = await supabase.from("ai_reply_settings").select("*").eq("org_id", current.org_id).maybeSingle();
  if (settingsResult.error) {
    const message = missingAiTable(settingsResult.error.message)
      ? "Conversation AI tables are not in this database yet. Apply phase 3a. Nothing was sent."
      : settingsResult.error.message;
    back(formData, { error: message });
  }
  const settings = parseAiReplySettings(settingsResult.data);
  const channel = String(current.channel);
  const loaded = await loadThreadContext(supabase, {
    orgId: String(current.org_id),
    conversationId: String(current.id),
    contactId: current.contact_id ? String(current.contact_id) : null,
    channel,
  });
  if (!loaded.ok) back(formData, { error: loaded.message });

  const hourly = await supabase.rpc("ai_reply_drafts_last_hour", { p_org: current.org_id });
  if (hourly.error) {
    const message = missingAiTable(hourly.error.message)
      ? "Conversation AI tables are not in this database yet. Apply phase 3a. Nothing was sent."
      : hourly.error.message;
    back(formData, { error: message });
  }
  const draftsLastHour = typeof hourly.data === "number" ? hourly.data : 0;
  const org = await supabase.from("organizations").select("name, sender_name").eq("id", current.org_id).maybeSingle();
  const brandName = String(org.data?.name || "This workspace");
  const senderName = String(org.data?.sender_name || brandName);
  const provider = createOpenAiCompatibleProvider(process.env);
  const contextMessages = buildReplyMessages({
    settings,
    brandName,
    senderName,
    channel,
    contactName: loaded.contactName,
    messages: loaded.messages,
  });
  const prepared = await prepareDraft({
    settings,
    channel,
    consent: loaded.consent,
    draftsLastHour,
    hasInbound: loaded.hasInbound,
    provider,
    contextMessages,
  });
  if (!prepared.persist) back(formData, { error: prepared.notice });

  const saved = await supabase.from("ai_drafts").insert({
    org_id: current.org_id,
    conversation_id: current.id,
    inbound_message_id: loaded.inboundId,
    status: prepared.status,
    draft_body: prepared.draftBody,
    model_meta: prepared.modelMeta,
    consent_ok: prepared.consentOk,
  });
  if (saved.error) back(formData, { error: saved.error.message });
  revalidatePath("/command-centre/inbox");
  back(formData, prepared.status === "failed" ? { error: prepared.notice } : { notice: prepared.notice });
}

export async function approveAiDraft(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    back(formData, { notice: previewNotice() });
  }
  const draftId = text(formData, "draftId");
  if (!draftId) back(formData, { error: "Choose a draft first." });
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect("/login?next=/command-centre/inbox");

  const found = await supabase.from("ai_drafts").select("*").eq("id", draftId).maybeSingle();
  if (found.error || !found.data) back(formData, { error: found.error?.message || "That draft is not in this workspace." });
  const draft = found.data;
  if (!draft) back(formData, { error: "That draft is not in this workspace." });
  const blocked = await workspaceWriteBlock(String(draft.org_id));
  if (blocked) back(formData, { error: blocked });

  const settingsResult = await supabase.from("ai_reply_settings").select("*").eq("org_id", draft.org_id).maybeSingle();
  if (settingsResult.error) back(formData, { error: settingsResult.error.message });
  const settings = parseAiReplySettings(settingsResult.data);
  const conversation = await supabase
    .from("conversations")
    .select("id, org_id, contact_id, channel, channel_connection_id, wa_window_expires_at, status")
    .eq("id", draft.conversation_id)
    .eq("org_id", draft.org_id)
    .maybeSingle();
  if (!conversation.data) back(formData, { error: "That conversation is not in this workspace." });
  const current = conversation.data;
  const channel = String(current.channel);
  const loaded = await loadThreadContext(supabase, {
    orgId: String(current.org_id),
    conversationId: String(current.id),
    contactId: current.contact_id ? String(current.contact_id) : null,
    channel,
  });
  if (!loaded.ok) back(formData, { error: loaded.message });

  const org = await supabase.from("organizations").select("sending_enabled, sender_name, name").eq("id", current.org_id).maybeSingle();
  const sendingEnabled = Boolean(org.data?.sending_enabled);
  const senderName = String(org.data?.sender_name || org.data?.name || "This workspace");
  const body = text(formData, "draftBody") || String(draft.draft_body || "");
  const plan = planDraftApproval({
    settings,
    sendingEnabled,
    consentOk: loaded.consent.ok,
    draftStatus: String(draft.status),
    body,
    now: new Date(),
    channel,
    toAddress: loaded.address,
    conversationId: String(current.id),
    contactId: loaded.contactId,
    leadId: loaded.leadId,
    connectionId: current.channel_connection_id ? String(current.channel_connection_id) : null,
    userId: user.data.user.id,
    senderName,
    windowExpiresAt: current.wa_window_expires_at ? String(current.wa_window_expires_at) : null,
    template: null,
    suppressed: loaded.suppressed,
    consent: loaded.consent.ok ? "opted_in" : "none",
    basis: loaded.consent.ok ? "consent" : null,
    serviceSendsThisMonth: await serviceCount(supabase, String(current.org_id), current.channel_connection_id ? String(current.channel_connection_id) : ""),
  });

  if (!plan.ok) {
    if (plan.code === "consent") {
      await supabase.from("ai_drafts").update({
        status: "failed",
        consent_ok: false,
        draft_body: body,
        model_meta: { ...(draft.model_meta && typeof draft.model_meta === "object" ? draft.model_meta : {}), failure: "consent_denied", reason: plan.message },
      }).eq("id", draft.id).eq("org_id", draft.org_id);
    }
    back(formData, { error: plan.message });
  }

  if (!plan.queue) {
    const approved = await supabase.from("ai_drafts").update({
      status: "approved",
      draft_body: body,
      consent_ok: true,
    }).eq("id", draft.id).eq("org_id", draft.org_id);
    if (approved.error) back(formData, { error: approved.error.message });
    revalidatePath("/command-centre/inbox");
    back(formData, { notice: plan.message });
  }

  const drafted = outboxRow(plan.reply, String(current.org_id));
  const outbox = await supabase.from("crm_outbox").insert(drafted.row);
  if (outbox.error) back(formData, { error: outbox.error.message });
  const message = await supabase.from("messages").insert({
    org_id: current.org_id,
    conversation_id: plan.reply.message.conversationId,
    direction: plan.reply.message.direction,
    channel: plan.reply.message.channel,
    body: plan.reply.message.body,
    template_id: plan.reply.message.templateId,
    provider_message_id: plan.reply.message.providerMessageId,
    status: plan.reply.message.status,
    wa_category: plan.reply.message.waCategory,
    cost_cents: plan.reply.message.costCents,
    sent_by_user_id: plan.reply.message.sentByUserId,
    outbox_id: plan.reply.message.outboxId,
  });
  if (message.error) {
    await supabase.from("crm_outbox").update({ status: "cancelled", error: message.error.message }).eq("id", plan.reply.outbox.id).eq("org_id", current.org_id);
    const prompt = /use template/i.test(message.error.message) ? "Free-form WhatsApp is outside the 24-hour window. Use an approved template." : message.error.message;
    back(formData, { error: prompt });
  }

  const queued = await supabase.from("ai_drafts").update({
    status: "queued",
    draft_body: body,
    consent_ok: true,
    outbox_id: plan.reply.outbox.id,
    model_meta: {
      ...(draft.model_meta && typeof draft.model_meta === "object" ? draft.model_meta : {}),
      outboxStatus: plan.reply.outbox.status,
      outboxId: plan.reply.outbox.id,
    },
  }).eq("id", draft.id).eq("org_id", draft.org_id);
  if (queued.error) back(formData, { error: queued.error.message });

  await supabase.from("conversations").update({
    last_message_at: new Date().toISOString(),
    status: current.status === "closed" ? "open" : current.status,
  }).eq("id", current.id);

  if (plan.reply.outbox.status !== "blocked_consent") {
    const usage = usageForSend({
      orgId: String(current.org_id),
      channel: plan.reply.outbox.channel,
      purpose: plan.reply.outbox.purpose,
      sourceId: plan.reply.outbox.id,
    });
    await supabase.from("usage_ledger").insert({
      org_id: current.org_id,
      meter: usage.meter,
      quantity: usage.quantity,
      unit_cost_cents: usage.unitCostCents,
      unit_price_cents: usage.unitPriceCents,
      cost_cents: plan.reply.outbox.costCents,
      source_type: "outbox",
      source_id: plan.reply.outbox.id,
      channel_connection_id: current.channel_connection_id,
    });
  }

  revalidatePath("/command-centre/inbox");
  revalidatePath("/command-centre/outbox");
  back(formData, { notice: plan.message });
}

export async function editAiDraft(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    back(formData, { notice: previewNotice() });
  }
  const draftId = text(formData, "draftId");
  const body = text(formData, "draftBody");
  if (!draftId || !body) back(formData, { error: "Write a draft before saving it." });
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect("/login?next=/command-centre/inbox");
  const found = await supabase.from("ai_drafts").select("id, org_id, status").eq("id", draftId).maybeSingle();
  if (!found.data) back(formData, { error: "That draft is not in this workspace." });
  if (found.data.status !== "pending_review" && found.data.status !== "approved") {
    back(formData, { error: "This draft can no longer be edited." });
  }
  const saved = await supabase.from("ai_drafts").update({
    draft_body: body,
    status: "pending_review",
  }).eq("id", draftId).eq("org_id", found.data.org_id);
  if (saved.error) back(formData, { error: saved.error.message });
  revalidatePath("/command-centre/inbox");
  back(formData, { notice: "Draft updated. Nothing was sent." });
}

export async function rejectAiDraft(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    back(formData, { notice: previewNotice() });
  }
  const draftId = text(formData, "draftId");
  if (!draftId) back(formData, { error: "Choose a draft first." });
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect("/login?next=/command-centre/inbox");
  const found = await supabase.from("ai_drafts").select("id, org_id, status").eq("id", draftId).maybeSingle();
  if (!found.data) back(formData, { error: "That draft is not in this workspace." });
  if (found.data.status === "queued" || found.data.status === "sent") {
    back(formData, { error: "This draft is already in the outbox." });
  }
  const saved = await supabase.from("ai_drafts").update({ status: "rejected" }).eq("id", draftId).eq("org_id", found.data.org_id);
  if (saved.error) back(formData, { error: saved.error.message });
  revalidatePath("/command-centre/inbox");
  back(formData, { notice: "Draft rejected. Nothing was sent." });
}

export async function saveAiReplySettings(
  _state: AiReplyActionState,
  formData: FormData,
): Promise<AiReplyActionState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, message: "Connect Supabase before saving Conversation AI settings. Nothing was sent." };
  }
  const slug = text(formData, "org");
  const workspace = await safeResolveWorkspace(slug);
  if (workspace.requiresLogin) {
    redirect(`/login?next=${encodeURIComponent(`/command-centre/ai-replies?org=${slug}`)}`);
  }
  if (workspace.mode !== "member" || !workspace.role) {
    return { ok: false, message: "Sign in as an agency owner or client admin before saving Conversation AI settings." };
  }
  if (slug && workspace.active.slug !== slug) {
    return { ok: false, message: "That workspace is outside your account." };
  }
  if (!canManageAiReplies(workspace.role)) {
    return { ok: false, message: "Only an agency owner or client admin can change Conversation AI." };
  }
  const blocked = await workspaceWriteBlock(workspace.active.id);
  if (blocked) return { ok: false, message: blocked };

  const tone = text(formData, "tone");
  const systemPrompt = text(formData, "systemPrompt");
  if (tone.length > 200) return { ok: false, message: "Keep the tone under 200 characters." };
  if (systemPrompt.length > 4000) return { ok: false, message: "Keep the system prompt under 4000 characters." };
  const max = Number(text(formData, "maxAutoPerHour") || "20");
  if (!Number.isFinite(max) || max < 0 || max > 500) {
    return { ok: false, message: "The hourly draft limit must be between 0 and 500." };
  }
  const mode = text(formData, "mode") === "queue_outbox" ? "queue_outbox" : "draft_only";
  const channels = formData.getAll("channels").map(String).filter((item) => (AI_REPLY_CHANNELS as readonly string[]).includes(item));
  const supabase = await createSupabaseServerClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect(`/login?next=${encodeURIComponent(`/command-centre/ai-replies?org=${workspace.active.slug}`)}`);

  const saved = await supabase.from("ai_reply_settings").upsert({
    org_id: workspace.active.id,
    enabled: formData.get("enabled") === "on",
    mode,
    tone,
    system_prompt: systemPrompt,
    max_auto_per_hour: Math.trunc(max),
    channels,
    require_human_before_send: formData.get("requireHuman") === "on",
  }, { onConflict: "org_id" });
  if (saved.error) {
    const message = missingAiTable(saved.error.message)
      ? "Conversation AI tables are not in this database yet. Apply phase 3a. Nothing was changed."
      : saved.error.message;
    return { ok: false, message };
  }
  revalidatePath("/command-centre/ai-replies");
  revalidatePath("/command-centre/inbox");
  return { ok: true, message: "Conversation AI settings saved. Sending was not changed." };
}

async function loadThreadContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: { orgId: string; conversationId: string; contactId: string | null; channel: string },
) {
  const messages = await supabase
    .from("messages")
    .select("id, direction, body, created_at")
    .eq("conversation_id", input.conversationId)
    .eq("org_id", input.orgId)
    .order("created_at", { ascending: true });
  if (messages.error) return { ok: false as const, message: messages.error.message };
  const rows = messages.data ?? [];
  const inbound = [...rows].reverse().find((row) => row.direction === "in");
  if (!input.contactId) return { ok: false as const, message: "This conversation has no contact to reply to." };
  const contact = await supabase
    .from("crm_contacts")
    .select("id, first_name, last_name, email, phone_e164, whatsapp_e164, lead_id, custom")
    .eq("id", input.contactId)
    .eq("org_id", input.orgId)
    .maybeSingle();
  if (!contact.data) return { ok: false as const, message: "This conversation has no contact to reply to." };
  const address = addressFor(input.channel, contact.data);
  const consents = await supabase
    .from("contact_consents")
    .select("channel, purpose, status, captured_at")
    .eq("contact_id", contact.data.id)
    .order("captured_at", { ascending: false });
  const suppressed = address ? await isSuppressed(supabase, input.orgId, input.channel, address) : false;
  const consent = assessReplyConsent({
    channel: input.channel,
    consents: latestChannelConsents(consents.data ?? []),
    suppressed,
    inboundStop: inbound ? isStopCommand(String(inbound.body || "")) : false,
  });
  return {
    ok: true as const,
    messages: rows.map((row) => ({
      direction: row.direction === "out" ? "out" as const : "in" as const,
      body: String(row.body || ""),
    })),
    hasInbound: Boolean(inbound),
    inboundId: inbound ? String(inbound.id) : null,
    contactId: String(contact.data.id),
    contactName: [contact.data.first_name, contact.data.last_name].filter(Boolean).join(" "),
    leadId: contact.data.lead_id ? String(contact.data.lead_id) : null,
    address,
    suppressed,
    consent,
  };
}

function addressFor(channel: string, contact: { email?: string | null; phone_e164?: string | null; whatsapp_e164?: string | null; custom?: unknown }) {
  if (channel === "email") return String(contact.email || "");
  if (channel === "whatsapp") return String(contact.whatsapp_e164 || contact.phone_e164 || "");
  if (channel === "sms") return String(contact.phone_e164 || "");
  const custom = contact.custom && typeof contact.custom === "object" ? contact.custom as { external_id?: string } : {};
  return String(custom.external_id || "");
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
