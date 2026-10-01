import { DEFAULT_OWNER_EMAIL } from "@/lib/auth/owners";
import type { AgencyOwnerClaim, PayfastMerchantState } from "@/lib/ops/readiness";
import { AGENCY_SLUG } from "@/lib/tenant/types";

export type SetupWizardMode = "fixture" | "sandbox";

export const SETUP_STEP_KEYS = [
  "sql_steps",
  "owner_attach",
  "cron_secret",
  "channel_email",
  "channel_whatsapp",
  "channel_sms",
  "payfast_billing",
  "feature_flags",
] as const;

export type SetupStepKey = (typeof SETUP_STEP_KEYS)[number];

export const WIZARD_STATUSES = [
  "pending",
  "configured",
  "missing",
  "fixture",
  "noted",
  "leave_unset",
  "connected",
  "not_connected",
] as const;

export type WizardStatus = (typeof WIZARD_STATUSES)[number];

/** Steps 20–31 from supabase/APPLY-ORDER.md. None of these are claimed applied. */
export const PENDING_SQL_STEPS = [
  { step: 20, file: "supabase/migrations/20261026120000_phase4c_aios_pricing.sql", name: "phase4c_aios_pricing" },
  { step: 21, file: "supabase/migrations/20261027120000_phase4d_eastc_education.sql", name: "phase4d_eastc_education" },
  { step: 22, file: "supabase/migrations/20261028120000_phase5a_agent_computers.sql", name: "phase5a_agent_computers" },
  { step: 23, file: "supabase/migrations/20261029120000_phase5b_lead_onboarding.sql", name: "phase5b_lead_onboarding" },
  { step: 24, file: "supabase/migrations/20261030120000_phase5c_connect_import.sql", name: "phase5c_connect_import" },
  { step: 25, file: "supabase/migrations/20261031120000_phase5d_home_chat.sql", name: "phase5d_home_chat" },
  { step: 26, file: "supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql", name: "phase5e_campaign_dry_run" },
  { step: 27, file: "supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql", name: "phase5f_campaign_csv_channels" },
  { step: 28, file: "supabase/migrations/20261103120000_phase5g_social_drafts.sql", name: "phase5g_social_drafts" },
  { step: 29, file: "supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql", name: "phase5h_zentrix_workspace_pack" },
  { step: 30, file: "supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql", name: "phase5i_campaign_seed_ops" },
  { step: 31, file: "supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql", name: "phase5j_pwa_mobile_shell" },
] as const;

/** Phase 5 write flags. This module only reports set or unset. It does not turn them on. */
export const PHASE5_FLAGS = [
  { key: "HOME_CHAT_ENABLED", step: 25, purpose: "Home assistant drafts" },
  { key: "CAMPAIGN_DRY_RUN_ENABLED", step: 26, purpose: "Campaign dry-run reports" },
  { key: "META_CONNECT_STUB_ENABLED", step: 26, purpose: "WhatsApp and Facebook / Instagram stubs" },
  { key: "CAMPAIGN_CSV_IMPORT_ENABLED", step: 27, purpose: "Campaign CSV dry-load" },
  { key: "EMAIL_SMS_CONNECT_STUB_ENABLED", step: 27, purpose: "Email and SMS connect stubs" },
  { key: "SOCIAL_DRAFTS_ENABLED", step: 28, purpose: "Social drafts" },
  { key: "TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED", step: 28, purpose: "TikTok and LinkedIn stubs" },
  { key: "ZENTRIX_WORKSPACE_PACK_ENABLED", step: 29, purpose: "Zentrix workspace pack" },
  { key: "EAST_RAND_CAMPAIGN_SEED_ENABLED", step: 30, purpose: "East Rand sandbox seed" },
  { key: "PWA_INSTALL_SHELL_ENABLED", step: 31, purpose: "PWA install intent" },
  { key: "COMPUTER_PROVIDER_ENABLED", step: 22, purpose: "Agent computer provider" },
  { key: "SETUP_WIZARD_ENABLED", step: 32, purpose: "This setup wizard" },
  { key: "MIGRATION_RUNNER_ENABLED", step: 33, purpose: "Pending SQL migration runner" },
  { key: "OWNER_BOOTSTRAP_UI_ENABLED", step: 34, purpose: "Owner bootstrap attach notes" },
  { key: "OPS_SECRETS_READY_ENABLED", step: 35, purpose: "Ops secrets readiness notes" },
] as const;

export const CHANNEL_LINKS = [
  { key: "gmail", stepKey: "channel_email", label: "Email", href: "/command-centre/connect-accounts/gmail" },
  { key: "whatsapp", stepKey: "channel_whatsapp", label: "WhatsApp (Meta)", href: "/command-centre/connect-accounts/whatsapp" },
  { key: "sms", stepKey: "channel_sms", label: "SMS", href: "/command-centre/connect-accounts/sms" },
] as const;

export type ChannelSnapshot = {
  key: (typeof CHANNEL_LINKS)[number]["key"];
  state: "connect" | "needs_keys" | "connected";
  stubStored: boolean;
  source: "fixture" | "sandbox";
};

export const FIXTURE_WIZARD_COPY =
  "Fixture only. This wizard writes nothing until SETUP_WIZARD_ENABLED is true and step 32 is applied.";

export const SECRET_REFUSAL_COPY = "Secrets are not stored. Nothing was written.";

export const SQL_PASTE_COPY =
  "Re-authenticate the Supabase SQL editor, then paste steps 20 through 31 from supabase/APPLY-ORDER.md in that order. Do not claim this SQL is already applied. This page does not apply the SQL and does not ask for a database URL.";

const SECRET_NAMES = /^(secret|cron_secret|api_key|apikey|token|password|value|merchant_id|payfast_merchant_id|owner_emails|authorization|status)$/i;

export function setupWizardMode(env: NodeJS.ProcessEnv = process.env): SetupWizardMode {
  return String(env.SETUP_WIZARD_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function setupWizardDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): SetupWizardMode {
  if (input.tenantMode !== "member") return "fixture";
  return setupWizardMode(input.env);
}

export function flagPresence(env: NodeJS.ProcessEnv, key: string): "set" | "unset" {
  return String(env[key] ?? "").trim().toLowerCase() === "true" ? "set" : "unset";
}

export function parseStepKey(value: string): SetupStepKey | null {
  const key = value.trim();
  return SETUP_STEP_KEYS.find((item) => item === key) ?? null;
}

export function parseWizardStatus(value: string): WizardStatus | null {
  const status = value.trim();
  return WIZARD_STATUSES.find((item) => item === status) ?? null;
}

export function wizardStatusLabel(status: WizardStatus) {
  if (status === "configured") return "Configured";
  if (status === "missing") return "Missing";
  if (status === "connected") return "Connected";
  if (status === "not_connected") return "Not connected";
  if (status === "leave_unset") return "Leave unset";
  if (status === "fixture") return "Fixture";
  if (status === "noted") return "Noted";
  return "Pending";
}

export function formCarriesSecret(formData: FormData) {
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") return true;
    if (!value.trim()) continue;
    if (SECRET_NAMES.test(key)) return true;
  }
  return false;
}

export function channelsFromConnect(input: {
  preview: boolean;
  cards: Array<{
    key: string;
    state: "connect" | "needs_keys" | "connected";
    metaStub: string[] | null;
    channelStub: string[] | null;
  }>;
}): ChannelSnapshot[] {
  return CHANNEL_LINKS.map((link) => {
    const card = input.cards.find((item) => item.key === link.key);
    const stubStored = link.key === "whatsapp"
      ? Boolean(card?.metaStub?.includes("sandbox_stub"))
      : Boolean(card?.channelStub?.includes("sandbox_stub"));
    return {
      key: link.key,
      state: card?.state ?? "connect",
      stubStored,
      source: input.preview ? "fixture" : "sandbox",
    };
  });
}

export type WizardItem = {
  stepKey: SetupStepKey;
  order: number;
  label: string;
  status: WizardStatus;
  detail: string;
  href?: string;
  hrefLabel?: string;
};

export type SetupFlagRow = {
  key: (typeof PHASE5_FLAGS)[number]["key"];
  step: number;
  purpose: string;
  presence: "set" | "unset";
};

export type SetupWizardModel = {
  mode: SetupWizardMode;
  write: boolean;
  paste: string;
  sqlSteps: Array<(typeof PENDING_SQL_STEPS)[number] & { status: "pending" }>;
  flags: SetupFlagRow[];
  items: WizardItem[];
};

export function buildSetupWizard(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  ownerEmailsSet: boolean;
  ownerClaim: AgencyOwnerClaim;
  cronConfigured: boolean;
  billingSandbox: boolean;
  payfastMerchant: PayfastMerchantState;
  channels: ChannelSnapshot[];
}): SetupWizardModel {
  const env = input.env ?? process.env;
  const mode = setupWizardDisplayMode({ tenantMode: input.tenantMode, env });
  const flags: SetupFlagRow[] = PHASE5_FLAGS.map((flag) => ({
    key: flag.key,
    step: flag.step,
    purpose: flag.purpose,
    presence: flagPresence(env, flag.key),
  }));
  const sqlSteps = PENDING_SQL_STEPS.map((step) => ({ ...step, status: "pending" as const }));
  const items: WizardItem[] = [
    sqlItem(),
    ownerItem(input),
    cronItem(input.cronConfigured),
    ...CHANNEL_LINKS.map((link) => channelItem(link, input.channels.find((row) => row.key === link.key))),
    billingItem(input),
    flagItem(flags),
  ];
  return {
    mode,
    write: mode === "sandbox",
    paste: SQL_PASTE_COPY,
    sqlSteps,
    flags,
    items,
  };
}

function sqlItem(): WizardItem {
  return {
    stepKey: "sql_steps",
    order: 1,
    label: "Supabase SQL steps 20–31",
    status: "pending",
    detail:
      "Steps 20 through 31 are pending. Step 32 is also unapplied. Step 33 is also unapplied. Step 34 is also unapplied. Step 35 is also unapplied. Do not claim this SQL is applied. Paste supabase/APPLY-ORDER.md in order after re-authenticating the Supabase SQL editor. This page does not apply SQL and does not ask for a database URL.",
  };
}

function ownerItem(input: { ownerEmailsSet: boolean; ownerClaim: AgencyOwnerClaim }): WizardItem {
  const presence = input.ownerEmailsSet
    ? "OWNER_EMAILS is configured. The list is not shown."
    : "OWNER_EMAILS is missing. The server uses the documented default.";
  const claim =
    input.ownerClaim === "yes"
      ? `Current user has agency_owner on ${AGENCY_SLUG}.`
      : input.ownerClaim === "no"
        ? `Current user does not have agency_owner on ${AGENCY_SLUG}.`
        : input.ownerClaim === "unknown"
          ? "Agency owner claim could not be read."
          : `Preview. This is not a live agency_owner claim on ${AGENCY_SLUG}.`;
  return {
    stepKey: "owner_attach",
    order: 2,
    label: "Agency owner first login",
    status: input.ownerEmailsSet ? "configured" : "missing",
    href: "/command-centre/owner",
    hrefLabel: "Open owner bootstrap",
    detail: `${presence} The documented default is ${DEFAULT_OWNER_EMAIL}. On first login, that address is attached as agency_owner of ${AGENCY_SLUG} when OWNER_EMAILS is unset or blank and the user has no membership. This page does not invent another address. ${claim}`,
  };
}

function cronItem(configured: boolean): WizardItem {
  return {
    stepKey: "cron_secret",
    order: 3,
    label: "CRON_SECRET",
    status: configured ? "configured" : "missing",
    detail: configured
      ? "CRON_SECRET is configured. The value is not shown. Leave AI_REPLY_CRON_ENABLED unset. This page does not schedule a cron."
      : "CRON_SECRET is missing. The value is not shown. Leave AI_REPLY_CRON_ENABLED unset. This page does not schedule a cron.",
  };
}

function channelItem(
  link: (typeof CHANNEL_LINKS)[number],
  snapshot: ChannelSnapshot | undefined,
): WizardItem {
  const source = snapshot?.source ?? "fixture";
  const connected = source === "sandbox" && snapshot?.state === "connected";
  const where = source === "fixture"
    ? "Fixture. The sandbox tables are not loaded on this render."
    : snapshot?.stubStored
      ? "A sandbox stub row is present. No secret is read."
      : "No sandbox connection row is present. No secret is read.";
  return {
    stepKey: link.stepKey,
    order: link.key === "gmail" ? 4 : link.key === "whatsapp" ? 5 : 6,
    label: link.label,
    status: connected ? "connected" : "not_connected",
    detail: `${link.label} is ${connected ? "connected" : "not connected"}. ${where} Open the connect-accounts stub. Nothing is sent.`,
    href: link.href,
    hrefLabel: connected ? "Connected" : "Not connected",
  };
}

function billingItem(input: { billingSandbox: boolean; payfastMerchant: PayfastMerchantState }): WizardItem {
  const billing = input.billingSandbox ? "configured" : "missing";
  const merchant = input.payfastMerchant === "unset" ? "missing" : "configured";
  const extra = input.payfastMerchant === "refused"
    ? "PayFast merchant id is configured and refused because it is not the sandbox merchant. The id is not shown. No charge is sent from this wizard."
    : input.payfastMerchant === "sandbox"
      ? "PayFast merchant id is configured on the sandbox merchant. The id is not shown. No charge is sent from this wizard."
      : "PayFast merchant id is missing. No charge is sent from this wizard.";
  const ready = input.billingSandbox && input.payfastMerchant === "sandbox";
  return {
    stepKey: "payfast_billing",
    order: 7,
    label: "PayFast / BILLING_SANDBOX",
    status: ready ? "configured" : "missing",
    detail: `BILLING_SANDBOX is ${billing}. PayFast merchant id is ${merchant}. ${extra}`,
  };
}

function flagItem(flags: SetupFlagRow[]): WizardItem {
  const lines = flags
    .map((flag) => `${flag.key} is ${flag.presence}. Leave it unset until step ${flag.step} is applied. This page does not set it.`)
    .join(" ");
  return {
    stepKey: "feature_flags",
    order: 8,
    label: "Phase 5 flags",
    status: "leave_unset",
    detail: `${lines} EAST_RAND_CAMPAIGN_SEED_ENABLED, ZENTRIX_WORKSPACE_PACK_ENABLED, PWA_INSTALL_SHELL_ENABLED, and OPS_SECRETS_READY_ENABLED stay unset. sending_enabled stays false.`,
  };
}

export function planSetupChecklistEvent(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  stepKey: string;
  status: string;
  secretFieldPresent?: boolean;
}): { mode: SetupWizardMode; write: boolean; stepKey: SetupStepKey | null; status: WizardStatus | null; message: string } {
  const mode = setupWizardDisplayMode(input);
  const stepKey = parseStepKey(input.stepKey);
  const status = parseWizardStatus(input.status);
  if (input.secretFieldPresent) {
    return { mode: "fixture", write: false, stepKey, status, message: SECRET_REFUSAL_COPY };
  }
  if (mode !== "sandbox") {
    return { mode: "fixture", write: false, stepKey, status, message: FIXTURE_WIZARD_COPY };
  }
  if (!stepKey || !status) {
    return { mode, write: false, stepKey, status, message: "Choose a checklist step. Nothing was written." };
  }
  return {
    mode,
    write: true,
    stepKey,
    status,
    message: "A sandbox checklist event can be stored. No secret is stored. Nothing is sent.",
  };
}

export function missingSetupWizardMigration(message: string) {
  return /record_setup_checklist_event|setup_checklist_events|schema cache|could not find the function/i.test(message);
}

export function checklistEventAccepted(payload: {
  stored?: boolean;
  sandbox?: boolean;
  charged?: boolean;
  step_key?: string;
  status?: string;
  sending_enabled?: boolean;
  secret?: unknown;
  value?: unknown;
} | null) {
  if (!payload) return false;
  if (payload.secret != null || payload.value != null) return false;
  return Boolean(
    payload.stored === true
    && payload.sandbox === true
    && payload.charged === false
    && payload.sending_enabled !== true
    && parseStepKey(String(payload.step_key ?? ""))
    && parseWizardStatus(String(payload.status ?? "")),
  );
}
