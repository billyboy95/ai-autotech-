"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashSecret } from "@/lib/channels/webhook";
import { newId } from "@/lib/automation/ids";
import { usageForSend } from "@/lib/compliance/usage";

export type ChannelActionState = { ok: boolean; message: string };

const initialProviders = ["resend", "smtp", "meta_cloud", "smsportal", "bulksms", "clickatell", "meta"] as const;

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function saveChannelConnection(_state: ChannelActionState, formData: FormData): Promise<ChannelActionState> {
  const slug = text(formData, "slug");
  const channel = text(formData, "channel");
  const provider = text(formData, "provider");
  const identifier = text(formData, "identifier");
  const displayName = text(formData, "displayName");
  if (!slug || !channel || !provider || !identifier) {
    return { ok: false, message: "Channel, provider, and identifier are required." };
  }
  if (!initialProviders.includes(provider as (typeof initialProviders)[number])) {
    return { ok: false, message: "That provider is not supported." };
  }

  const supabase = await createSupabaseServerClient();
  const org = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (org.error || !org.data) return { ok: false, message: org.error?.message || "Workspace not found." };

  const publicConfig = {
    fromName: text(formData, "fromName"),
    host: text(formData, "host"),
    port: text(formData, "port"),
    graphVersion: text(formData, "graphVersion") || "v21.0",
  };
  const existing = await supabase
    .from("channel_connections")
    .select("id")
    .eq("org_id", org.data.id)
    .eq("channel", channel)
    .eq("provider", provider)
    .eq("identifier", identifier)
    .maybeSingle();
  if (existing.error) return { ok: false, message: existing.error.message };

  const row = {
    org_id: org.data.id,
    channel,
    provider,
    identifier,
    display_name: displayName || identifier,
    status: "pending",
    public_config: publicConfig,
    updated_at: new Date().toISOString(),
  };
  const saved = existing.data
    ? await supabase.from("channel_connections").update(row).eq("id", existing.data.id).select("id").single()
    : await supabase.from("channel_connections").insert(row).select("id").single();
  if (saved.error || !saved.data) return { ok: false, message: saved.error?.message || "Could not save the connection." };

  const secret = secretPayload(formData);
  const hasSecret = Object.values(secret).some((value) => value);
  if (hasSecret) {
    const stored = await supabase.rpc("store_channel_secret", {
      p_connection_id: saved.data.id,
      p_secret: JSON.stringify(secret),
    });
    if (stored.error) return { ok: false, message: stored.error.message };
    const webhookSecret = secret.webhookSecret || secret.appSecret || "";
    await supabase
      .from("channel_connections")
      .update({
        status: "connected",
        webhook_secret_hash: webhookSecret ? hashSecret(webhookSecret) : "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", saved.data.id);
  }

  revalidatePath(`/agency/${slug}/settings`);
  return { ok: true, message: hasSecret ? "Connection saved. The secret is in the vault, not in the form." : "Connection saved. Add a secret before it can send." };
}

export async function queueChannelTest(_state: ChannelActionState, formData: FormData): Promise<ChannelActionState> {
  const slug = text(formData, "slug");
  const connectionId = text(formData, "connectionId");
  const to = text(formData, "to");
  if (!connectionId || !to) return { ok: false, message: "Choose a connection and a test address." };

  const supabase = await createSupabaseServerClient();
  const org = await supabase.from("organizations").select("id, sending_enabled, sender_name, name").eq("slug", slug).maybeSingle();
  if (org.error || !org.data) return { ok: false, message: org.error?.message || "Workspace not found." };
  const connection = await supabase
    .from("channel_connections")
    .select("id, channel, provider, identifier")
    .eq("id", connectionId)
    .eq("org_id", org.data.id)
    .maybeSingle();
  if (connection.error || !connection.data) return { ok: false, message: "That connection is not on this workspace." };

  const sender = org.data.sender_name || org.data.name || "This workspace";
  const id = newId("msg");
  const usage = usageForSend({
    orgId: org.data.id,
    channel: connection.data.channel,
    purpose: "service",
    sourceId: id,
  });
  const body = `${sender}: channel test for ${connection.data.provider}. This is a dry run and was not sent.`;
  let inserted = await supabase.from("crm_outbox").insert({
    id,
    org_id: org.data.id,
    lead_id: null,
    template_key: "channel_test",
    channel: connection.data.channel,
    to_address: to,
    subject: "Channel test",
    body,
    status: "held",
    purpose: "service",
    provider: "dry_run",
    error: "Dry run. Sending stays off until an agency owner enables it. Nothing was delivered.",
    channel_connection_id: connection.data.id,
    cost_cents: usage.costCents,
    message_category: "service",
  });
  if (inserted.error && /check constraint|purpose|cost_cents|channel_connection/i.test(inserted.error.message)) {
    inserted = await supabase.from("crm_outbox").insert({
      id,
      org_id: org.data.id,
      lead_id: null,
      template_key: "channel_test",
      channel: connection.data.channel === "email" ? "email" : "whatsapp",
      to_address: to,
      subject: "Channel test",
      body,
      status: "queued",
      provider: "dry_run",
      error: "Dry run. Nothing was delivered.",
    });
  }
  if (inserted.error) return { ok: false, message: inserted.error.message };

  await supabase.from("usage_ledger").insert({
    org_id: org.data.id,
    meter: usage.meter,
    quantity: usage.quantity,
    unit_cost_cents: usage.unitCostCents,
    unit_price_cents: usage.unitPriceCents,
    cost_cents: usage.costCents,
    source_type: "outbox",
    source_id: id,
    channel_connection_id: connection.data.id,
  });

  revalidatePath("/command-centre/outbox");
  return {
    ok: true,
    message: org.data.sending_enabled
      ? "Test queued as a dry run. This button does not call the provider."
      : `Held dry run. Cost recorded at ${usage.costCents} cents. Nothing was sent.`,
  };
}

function secretPayload(formData: FormData) {
  return {
    token: text(formData, "token"),
    apiKey: text(formData, "apiKey"),
    apiSecret: text(formData, "apiSecret"),
    clientId: text(formData, "clientId"),
    webhookSecret: text(formData, "webhookSecret"),
    verifyToken: text(formData, "verifyToken"),
    appSecret: text(formData, "appSecret"),
    password: text(formData, "password"),
    user: text(formData, "smtpUser"),
    host: text(formData, "host"),
    port: text(formData, "port"),
    from: text(formData, "fromAddress"),
  };
}
