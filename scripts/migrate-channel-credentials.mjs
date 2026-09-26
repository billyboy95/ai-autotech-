/**
 * Copies AI AutoTech provider env vars into channel_connections + Vault.
 * Run locally when the keys exist in the environment. Nothing in this file is a secret.
 *
 *   node scripts/migrate-channel-credentials.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and the phase 2b migration.
 * Leaves organizations.sending_enabled false. Prints identifiers only.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function present(name) {
  return Boolean(String(process.env[name] || "").trim());
}

const plans = [];
if (present("WHATSAPP_TOKEN") && present("WHATSAPP_PHONE_NUMBER_ID")) {
  plans.push({
    channel: "whatsapp",
    provider: "meta_cloud",
    identifier: process.env.WHATSAPP_PHONE_NUMBER_ID.trim(),
    displayName: "AI AutoTech WhatsApp",
    secret: {
      token: process.env.WHATSAPP_TOKEN.trim(),
      webhookSecret: process.env.WHATSAPP_APP_SECRET || "",
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    },
  });
}
if (present("SMSPORTAL_CLIENT_ID") && present("SMSPORTAL_API_SECRET")) {
  plans.push({
    channel: "sms",
    provider: "smsportal",
    identifier: (process.env.SMSPORTAL_SENDER_ID || "AIAuto").trim(),
    displayName: "AI AutoTech SMSPortal",
    secret: {
      clientId: process.env.SMSPORTAL_CLIENT_ID.trim(),
      apiSecret: process.env.SMSPORTAL_API_SECRET.trim(),
      webhookSecret: process.env.SMSPORTAL_WEBHOOK_SECRET || "",
    },
  });
}
if (present("BULKSMS_TOKEN_ID") && present("BULKSMS_TOKEN_SECRET")) {
  plans.push({
    channel: "sms",
    provider: "bulksms",
    identifier: (process.env.BULKSMS_SENDER_ID || "AIAuto").trim(),
    displayName: "AI AutoTech BulkSMS",
    secret: { clientId: process.env.BULKSMS_TOKEN_ID.trim(), apiSecret: process.env.BULKSMS_TOKEN_SECRET.trim() },
  });
}
if (present("CLICKATELL_API_KEY")) {
  plans.push({
    channel: "sms",
    provider: "clickatell",
    identifier: (process.env.CLICKATELL_FROM || "AIAuto").trim(),
    displayName: "AI AutoTech Clickatell",
    secret: { apiKey: process.env.CLICKATELL_API_KEY.trim() },
  });
}
if (present("RESEND_API_KEY")) {
  plans.push({
    channel: "email",
    provider: "resend",
    identifier: (process.env.RESEND_FROM || "billy@aiautotech.co.za").trim(),
    displayName: "AI AutoTech Resend",
    secret: { apiKey: process.env.RESEND_API_KEY.trim(), from: process.env.RESEND_FROM || "" },
  });
}
if (present("SMTP_HOST") && present("SMTP_FROM")) {
  plans.push({
    channel: "email",
    provider: "smtp",
    identifier: process.env.SMTP_FROM.trim(),
    displayName: "AI AutoTech SMTP",
    secret: {
      host: process.env.SMTP_HOST.trim(),
      port: process.env.SMTP_PORT || "587",
      user: process.env.SMTP_USER || "",
      password: process.env.SMTP_PASS || "",
      from: process.env.SMTP_FROM.trim(),
    },
  });
}
if (present("META_PAGE_ID") && present("META_PAGE_ACCESS_TOKEN")) {
  plans.push({
    channel: "facebook",
    provider: "meta",
    identifier: process.env.META_PAGE_ID.trim(),
    displayName: "AI AutoTech Facebook",
    secret: { token: process.env.META_PAGE_ACCESS_TOKEN.trim(), appSecret: process.env.META_APP_SECRET || "" },
  });
}
if (present("META_IG_USER_ID") && present("META_PAGE_ACCESS_TOKEN")) {
  plans.push({
    channel: "instagram",
    provider: "meta",
    identifier: process.env.META_IG_USER_ID.trim(),
    displayName: "AI AutoTech Instagram",
    secret: { token: process.env.META_PAGE_ACCESS_TOKEN.trim(), appSecret: process.env.META_APP_SECRET || "" },
  });
}

if (!url || !key) {
  console.log("Skipped. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to migrate credentials. No secrets were printed.");
  process.exit(0);
}
if (!plans.length) {
  console.log("Skipped. No provider env vars are set. Sending stays off.");
  process.exit(0);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const org = await supabase.from("organizations").select("id, sending_enabled").eq("slug", "ai-autotech").maybeSingle();
if (org.error || !org.data) {
  console.error(org.error?.message || "AI AutoTech organisation was not found. Apply the phase 2a migration first.");
  process.exit(1);
}

for (const plan of plans) {
  const existing = await supabase
    .from("channel_connections")
    .select("id")
    .eq("org_id", org.data.id)
    .eq("channel", plan.channel)
    .eq("provider", plan.provider)
    .eq("identifier", plan.identifier)
    .maybeSingle();
  if (existing.error) {
    console.error(existing.error.message);
    process.exit(1);
  }
  const saved = existing.data
    ? await supabase.from("channel_connections").update({ display_name: plan.displayName, status: "connected", updated_at: new Date().toISOString() }).eq("id", existing.data.id).select("id").single()
    : await supabase
        .from("channel_connections")
        .insert({
          org_id: org.data.id,
          channel: plan.channel,
          provider: plan.provider,
          identifier: plan.identifier,
          display_name: plan.displayName,
          status: "connected",
        })
        .select("id")
        .single();
  if (saved.error || !saved.data) {
    console.error(saved.error?.message || "Could not save a connection.");
    process.exit(1);
  }
  const stored = await supabase.rpc("store_channel_secret", {
    p_connection_id: saved.data.id,
    p_secret: JSON.stringify(plan.secret),
  });
  if (stored.error) {
    console.error(stored.error.message);
    process.exit(1);
  }
  console.log(`Saved ${plan.channel}/${plan.provider} identifier ${plan.identifier}`);
}

console.log(`Done. sending_enabled is ${org.data.sending_enabled ? "on" : "off"}. This script did not change it and did not send anything.`);
