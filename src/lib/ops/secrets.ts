import { PAYFAST_SANDBOX_MERCHANT_ID } from "@/lib/billing/flag";

export const OPS_SECRETS_FLAG = "OPS_SECRETS_READY_ENABLED";
export const PHASE5N_MIGRATION = "supabase/migrations/20261110120000_phase5n_ops_secrets_ready.sql";

/** Names only. This list is not a schedule and it is not registered. */
export const CRON_JOB_NAMES = [
  "automation",
  "workflow-engine",
  "billing-cycle",
  "ai-reply-drafts",
] as const;

export type OpsSecretsMode = "fixture" | "sandbox";
export type Presence = "configured" | "missing" | "fixture";

export type OpsSecretsModel = {
  mode: OpsSecretsMode;
  write: boolean;
  flag: "set" | "unset";
  cron: Presence;
  email: Presence;
  whatsapp: Presence;
  sms: Presence;
  payfast: Presence;
  cronJobs: readonly string[];
  registered: false;
  lines: string[];
};

export const FIXTURE_OPS_COPY =
  "Fixture only. This panel writes nothing until OPS_SECRETS_READY_ENABLED is the string true and step 35 is applied. It does not register a cron and it does not store a secret.";

export const SECRET_REFUSAL_COPY =
  "Secrets are not stored. Nothing was written. A cron was not registered.";

export const NOTE_READY_COPY =
  "A sandbox note can be stored. charged stays false. A cron is not registered. Secret values are not stored.";

const PRESENCE = new Set(["configured", "missing", "fixture"]);
const SECRET_VALUE = /bearer\s|postgres:\/\/|sbp_|re_|sk_|supabase_db_url|cron_secret|api_key|merchant_key|passphrase/i;

export function opsSecretsMode(env: NodeJS.ProcessEnv = process.env): OpsSecretsMode {
  return String(env.OPS_SECRETS_READY_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

export function opsSecretsDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): OpsSecretsMode {
  if (input.tenantMode !== "member") return "fixture";
  return opsSecretsMode(input.env);
}

function filled(env: NodeJS.ProcessEnv, key: string) {
  return String(env[key] ?? "").trim().length > 0;
}

export function cronPresence(env: NodeJS.ProcessEnv = process.env): Exclude<Presence, "fixture"> {
  return filled(env, "CRON_SECRET") ? "configured" : "missing";
}

export function emailProviderPresence(env: NodeJS.ProcessEnv = process.env): Exclude<Presence, "fixture"> {
  if (filled(env, "RESEND_API_KEY") || filled(env, "SMTP_HOST")) return "configured";
  return "missing";
}

export function whatsappMetaPresence(env: NodeJS.ProcessEnv = process.env): Exclude<Presence, "fixture"> {
  const whatsapp = filled(env, "WHATSAPP_TOKEN") && filled(env, "WHATSAPP_PHONE_NUMBER_ID");
  const meta = filled(env, "META_PAGE_ACCESS_TOKEN") && (filled(env, "META_PAGE_ID") || filled(env, "META_IG_USER_ID"));
  return whatsapp || meta ? "configured" : "missing";
}

export function smsProviderPresence(env: NodeJS.ProcessEnv = process.env): Exclude<Presence, "fixture"> {
  const bulksmsToken = filled(env, "BULKSMS_TOKEN_ID") && filled(env, "BULKSMS_TOKEN_SECRET");
  const bulksmsUser = filled(env, "BULKSMS_USERNAME") && filled(env, "BULKSMS_PASSWORD");
  const clickatell = filled(env, "CLICKATELL_API_KEY");
  const twilio = filled(env, "TWILIO_ACCOUNT_SID") && filled(env, "TWILIO_AUTH_TOKEN") && filled(env, "TWILIO_FROM_NUMBER");
  const smsportal = filled(env, "SMSPORTAL_CLIENT_ID") && filled(env, "SMSPORTAL_API_SECRET");
  return bulksmsToken || bulksmsUser || clickatell || twilio || smsportal ? "configured" : "missing";
}

export function payfastSandboxPresence(env: NodeJS.ProcessEnv = process.env): Exclude<Presence, "fixture"> {
  const id = String(env.PAYFAST_MERCHANT_ID ?? "").trim();
  const key = String(env.PAYFAST_MERCHANT_KEY ?? "").trim();
  if (id === PAYFAST_SANDBOX_MERCHANT_ID && key.length > 0) return "configured";
  return "missing";
}

function shown(tenantMode: string, status: Exclude<Presence, "fixture">): Presence {
  return tenantMode === "member" ? status : "fixture";
}

export function formCarriesSecret(formData: FormData) {
  for (const [key, value] of formData.entries()) {
    if (key !== "slug") return true;
    if (typeof value !== "string") return true;
    if (value.length > 80) return true;
    if (value.includes("@")) return true;
    if (SECRET_VALUE.test(value)) return true;
  }
  return false;
}

export function planOpsSecretsNote(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  secretFieldPresent?: boolean;
}): { mode: OpsSecretsMode; write: boolean; message: string } {
  if (input.secretFieldPresent) {
    return { mode: "fixture", write: false, message: SECRET_REFUSAL_COPY };
  }
  const mode = opsSecretsDisplayMode(input);
  if (mode !== "sandbox") {
    return { mode: "fixture", write: false, message: FIXTURE_OPS_COPY };
  }
  return { mode: "sandbox", write: true, message: NOTE_READY_COPY };
}

function presenceLine(label: string, status: Presence) {
  if (status === "configured") return `${label} is configured. The value is not shown.`;
  if (status === "missing") return `${label} is missing. The value is not shown.`;
  return `${label} is fixture. This render did not read the deployment. The value is not shown.`;
}

export function buildOpsSecrets(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
}): OpsSecretsModel {
  const env = input.env ?? process.env;
  const plan = planOpsSecretsNote({ env, tenantMode: input.tenantMode });
  const cron = shown(input.tenantMode, cronPresence(env));
  const email = shown(input.tenantMode, emailProviderPresence(env));
  const whatsapp = shown(input.tenantMode, whatsappMetaPresence(env));
  const sms = shown(input.tenantMode, smsProviderPresence(env));
  const payfast = shown(input.tenantMode, payfastSandboxPresence(env));
  const flag = opsSecretsMode(env) === "sandbox" ? "set" : "unset";
  const lines = [
    presenceLine("CRON_SECRET", cron),
    presenceLine("Email provider", email),
    presenceLine("WhatsApp / Meta", whatsapp),
    presenceLine("SMS provider", sms),
    presenceLine("PayFast sandbox keys", payfast),
    `Cron dry-run names only: ${CRON_JOB_NAMES.join(", ")}. These jobs would be registered once CRON_SECRET exists. This page does not register them.`,
    "Leave AI_REPLY_CRON_ENABLED unset. This page does not schedule a cron.",
    "Steps 20 through 34 are not applied. Step 35 is also unapplied. Do not claim this SQL is already applied.",
    "sending_enabled stays false. Nothing is sent. Nothing is spent.",
    flag === "set"
      ? "OPS_SECRETS_READY_ENABLED is set. A sandbox note can be stored. It stores presence only and does not register a cron."
      : "OPS_SECRETS_READY_ENABLED is unset. Leave it unset until step 35 is applied. This page does not turn it on.",
    "Leave MIGRATION_RUNNER_ENABLED, SETUP_WIZARD_ENABLED, and OWNER_BOOTSTRAP_UI_ENABLED unset. This page does not turn them on.",
    plan.message,
  ];
  return {
    mode: plan.mode,
    write: plan.write,
    flag,
    cron,
    email,
    whatsapp,
    sms,
    payfast,
    cronJobs: CRON_JOB_NAMES,
    registered: false,
    lines,
  };
}

export function missingOpsSecrets(message: string) {
  return /record_ops_secrets_note|ops_secrets_notes|schema cache|could not find the function/i.test(message);
}

export function noteAccepted(payload: {
  stored?: boolean;
  sandbox?: boolean;
  charged?: boolean;
  status?: string;
  cron_presence?: string;
  email_provider?: string;
  whatsapp_meta?: string;
  sms_provider?: string;
  payfast_sandbox?: string;
  cron_jobs?: unknown;
  registered?: boolean;
  scheduled?: boolean;
  applied?: boolean;
  sending_enabled?: boolean;
  secret?: unknown;
  value?: unknown;
  token?: unknown;
  api_key?: unknown;
  merchant_key?: unknown;
} | null) {
  if (!payload) return false;
  if (payload.secret != null || payload.value != null || payload.token != null || payload.api_key != null || payload.merchant_key != null) {
    return false;
  }
  if (payload.registered === true || payload.scheduled === true || payload.applied === true || payload.sending_enabled === true) {
    return false;
  }
  if (!PRESENCE.has(String(payload.cron_presence))) return false;
  if (!PRESENCE.has(String(payload.email_provider))) return false;
  if (!PRESENCE.has(String(payload.whatsapp_meta))) return false;
  if (!PRESENCE.has(String(payload.sms_provider))) return false;
  if (!PRESENCE.has(String(payload.payfast_sandbox))) return false;
  if (!Array.isArray(payload.cron_jobs)) return false;
  if (payload.cron_jobs.join(",") !== CRON_JOB_NAMES.join(",")) return false;
  return Boolean(
    payload.stored === true
    && payload.sandbox === true
    && payload.charged === false
    && payload.status === "noted"
    && payload.registered === false
    && payload.scheduled === false,
  );
}
