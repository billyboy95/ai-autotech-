import { isSendEnabled } from "@/lib/automation/channels";
import { verifiedMigrationSteps } from "@/lib/migrations/runner";
import { ownerEmailsStatus } from "@/lib/owner/bootstrap";
import {
  cronPresence,
  emailProviderPresence,
  payfastSandboxPresence,
  smsProviderPresence,
  whatsappMetaPresence,
  type Presence,
} from "@/lib/ops/secrets";
import { pwaInstallMode } from "@/lib/pwa/install";

export const GOLIVE_FLAG = "GOLIVE_CHECKLIST_ENABLED";
export const PHASE5O_MIGRATION = "supabase/migrations/20261111120000_phase5o_golive_checklist.sql";
export const MIGRATION_STEP_FROM = 20;
export const MIGRATION_STEP_TO = 36;

export const DISPLAY_STATUSES = ["configured", "missing", "pending", "fixture", "blocked"] as const;
export const SNAPSHOT_STATUSES = ["pending", "ready", "blocked", "fixture"] as const;

export type GoliveMode = "fixture" | "sandbox";
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];
export type SnapshotStatus = (typeof SNAPSHOT_STATUSES)[number];

export type ChecklistRowId =
  | "migrations"
  | "setup_wizard"
  | "owner_bootstrap"
  | "ops_secrets"
  | "education_pack"
  | "zentrix_pack"
  | "pwa_install"
  | "sending";

export type OpsPart = {
  id: "cron" | "email" | "whatsapp" | "sms" | "payfast";
  label: string;
  status: DisplayStatus;
};

export type ChecklistRow = {
  id: ChecklistRowId;
  label: string;
  status: DisplayStatus;
  snapshot: SnapshotStatus;
  detail: string;
  href?: string;
  hrefLabel?: string;
  parts?: OpsPart[];
};

export type GoliveSnapshot = {
  migrations: SnapshotStatus;
  setup_wizard: SnapshotStatus;
  owner_bootstrap: SnapshotStatus;
  ops_secrets: SnapshotStatus;
  education_pack: SnapshotStatus;
  zentrix_pack: SnapshotStatus;
  pwa_install: SnapshotStatus;
  sending: "blocked";
};

export type GoliveChecklistModel = {
  mode: GoliveMode;
  write: boolean;
  flag: "set" | "unset";
  sendingOff: boolean;
  rows: ChecklistRow[];
  snapshot: GoliveSnapshot;
  lines: string[];
};

export const FIXTURE_GOLIVE_COPY =
  "Fixture only. This page writes nothing until GOLIVE_CHECKLIST_ENABLED is the string true and step 36 is applied. It does not run SQL, click Apply, register a cron, or turn sending on.";

export const SECRET_REFUSAL_COPY =
  "Secrets are not stored. Nothing was written. SQL was not applied. A pack was not applied.";

export const NOTE_READY_COPY =
  "A sandbox note can be stored. charged stays false. The note stores pending, ready, blocked, or fixture only. SQL is not applied. A pack is not applied. sending_enabled stays false.";

const SNAPSHOT = new Set<string>(SNAPSHOT_STATUSES);
const SECRET_VALUE = /bearer\s|postgres:\/\/|sbp_|re_|sk_|supabase_db_url|cron_secret|api_key|merchant_key|passphrase/i;

const LEAVE_UNSET = [
  "MIGRATION_RUNNER_ENABLED",
  "SETUP_WIZARD_ENABLED",
  "OWNER_BOOTSTRAP_UI_ENABLED",
  "OPS_SECRETS_READY_ENABLED",
  "HOME_CHAT_ENABLED",
  "CAMPAIGN_DRY_RUN_ENABLED",
  "META_CONNECT_STUB_ENABLED",
  "CAMPAIGN_CSV_IMPORT_ENABLED",
  "EMAIL_SMS_CONNECT_STUB_ENABLED",
  "SOCIAL_DRAFTS_ENABLED",
  "TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED",
  "ZENTRIX_WORKSPACE_PACK_ENABLED",
  "EAST_RAND_CAMPAIGN_SEED_ENABLED",
  "PWA_INSTALL_SHELL_ENABLED",
  "AI_REPLY_CRON_ENABLED",
] as const;

export function goliveChecklistMode(env: NodeJS.ProcessEnv = process.env): GoliveMode {
  return String(env.GOLIVE_CHECKLIST_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

export function goliveChecklistDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): GoliveMode {
  if (input.tenantMode !== "member") return "fixture";
  return goliveChecklistMode(input.env);
}

export function toSnapshot(status: DisplayStatus): SnapshotStatus {
  if (status === "configured") return "ready";
  if (status === "blocked") return "blocked";
  if (status === "fixture") return "fixture";
  return "pending";
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

export function planGoliveNote(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  secretFieldPresent?: boolean;
}): { mode: GoliveMode; write: boolean; message: string } {
  if (input.secretFieldPresent) {
    return { mode: "fixture", write: false, message: SECRET_REFUSAL_COPY };
  }
  const mode = goliveChecklistDisplayMode(input);
  if (mode !== "sandbox") {
    return { mode: "fixture", write: false, message: FIXTURE_GOLIVE_COPY };
  }
  return { mode: "sandbox", write: true, message: NOTE_READY_COPY };
}

function flagOn(env: NodeJS.ProcessEnv, key: string) {
  return String(env[key] ?? "").trim().toLowerCase() === "true";
}

function flagLine(env: NodeJS.ProcessEnv, key: string) {
  return flagOn(env, key)
    ? `${key} is the string true. This page does not change it.`
    : `${key} is unset. This page does not turn it on.`;
}

function migrationsStatus(tenantMode: string, verifiedSteps: number[]): DisplayStatus {
  if (tenantMode !== "member") return "fixture";
  const verified = new Set(verifiedSteps);
  for (let step = MIGRATION_STEP_FROM; step <= MIGRATION_STEP_TO; step += 1) {
    if (!verified.has(step)) return "pending";
  }
  return "configured";
}

function ownerStatus(tenantMode: string, env: NodeJS.ProcessEnv): DisplayStatus {
  if (tenantMode !== "member") return "fixture";
  return ownerEmailsStatus(env) === "configured" ? "pending" : "missing";
}

function presenceStatus(tenantMode: string, status: Exclude<Presence, "fixture">): DisplayStatus {
  return tenantMode === "member" ? status : "fixture";
}

function rollupOps(parts: OpsPart[]): DisplayStatus {
  if (parts.every((part) => part.status === "fixture")) return "fixture";
  if (parts.every((part) => part.status === "configured")) return "configured";
  if (parts.some((part) => part.status === "missing")) return "missing";
  return "pending";
}

function packStatus(tenantMode: string, applied: boolean): DisplayStatus {
  if (tenantMode !== "member") return "fixture";
  return applied ? "configured" : "pending";
}

function pwaStatus(tenantMode: string, env: NodeJS.ProcessEnv): DisplayStatus {
  if (tenantMode !== "member") return "fixture";
  return pwaInstallMode(env) === "sandbox" ? "configured" : "pending";
}

export function buildGoliveChecklist(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  workspaceSendingEnabled?: boolean;
  automationSendEnabled?: boolean;
  educationApplied?: boolean;
  zentrixApplied?: boolean;
  verifiedSteps?: number[];
}): GoliveChecklistModel {
  const env = input.env ?? process.env;
  const plan = planGoliveNote({ env, tenantMode: input.tenantMode });
  const verified = input.verifiedSteps ?? verifiedMigrationSteps();
  const migrations = migrationsStatus(input.tenantMode, verified);
  const setup = input.tenantMode === "member" ? "pending" : "fixture";
  const owner = ownerStatus(input.tenantMode, env);
  const opsParts: OpsPart[] = [
    { id: "cron", label: "CRON_SECRET", status: presenceStatus(input.tenantMode, cronPresence(env)) },
    { id: "email", label: "Email", status: presenceStatus(input.tenantMode, emailProviderPresence(env)) },
    { id: "whatsapp", label: "WhatsApp / Meta", status: presenceStatus(input.tenantMode, whatsappMetaPresence(env)) },
    { id: "sms", label: "SMS", status: presenceStatus(input.tenantMode, smsProviderPresence(env)) },
    { id: "payfast", label: "PayFast sandbox", status: presenceStatus(input.tenantMode, payfastSandboxPresence(env)) },
  ];
  const ops = rollupOps(opsParts);
  const education = packStatus(input.tenantMode, input.educationApplied === true);
  const zentrix = packStatus(input.tenantMode, input.zentrixApplied === true);
  const pwa = pwaStatus(input.tenantMode, env);
  const sendingOff = input.workspaceSendingEnabled !== true && (input.automationSendEnabled ?? isSendEnabled(env)) !== true;
  const flag = goliveChecklistMode(env) === "sandbox" ? "set" : "unset";

  const rows: ChecklistRow[] = [
    {
      id: "migrations",
      label: "SQL migrations",
      status: migrations,
      snapshot: toSnapshot(migrations),
      href: "/command-centre/migrations",
      hrefLabel: "Open migration runner",
      detail: migrations === "configured"
        ? "Applied. Steps 20 through 36 are verified. This page does not run SQL."
        : migrations === "fixture"
          ? "Fixture. Steps 20 through 35 are not applied. Step 36 is also unapplied. Do not claim this SQL is already applied. This page does not run SQL."
          : "Pending. Steps 20 through 35 are not applied. Step 36 is also unapplied. Do not claim this SQL is already applied. This page does not run SQL.",
    },
    {
      id: "setup_wizard",
      label: "Setup wizard",
      status: setup,
      snapshot: toSnapshot(setup),
      href: "/command-centre/setup",
      hrefLabel: "Open setup wizard",
      detail: setup === "fixture"
        ? "Fixture. SETUP_WIZARD_ENABLED stays unset. This page does not turn it on."
        : `${flagLine(env, "SETUP_WIZARD_ENABLED")} The wizard is pending. This page does not write a wizard event.`,
    },
    {
      id: "owner_bootstrap",
      label: "Owner bootstrap",
      status: owner,
      snapshot: toSnapshot(owner),
      href: "/command-centre/owner",
      hrefLabel: "Open owner bootstrap",
      detail: owner === "fixture"
        ? "Fixture. OWNER_BOOTSTRAP_UI_ENABLED stays unset. The address list is not shown. This page does not create an Auth user and does not run owner-bootstrap.sql."
        : owner === "missing"
          ? "OWNER_EMAILS is missing. The list is not shown. OWNER_BOOTSTRAP_UI_ENABLED stays unset. This page does not create an Auth user and does not run owner-bootstrap.sql."
          : "Pending. OWNER_EMAILS is configured. The list is not shown. Auth attach is not confirmed here. OWNER_BOOTSTRAP_UI_ENABLED stays unset. This page does not create an Auth user and does not run owner-bootstrap.sql.",
    },
    {
      id: "ops_secrets",
      label: "Ops secrets",
      status: ops,
      snapshot: toSnapshot(ops),
      href: "/command-centre/ops-secrets",
      hrefLabel: "Open ops secrets",
      parts: opsParts,
      detail: "CRON_SECRET, email, WhatsApp / Meta, SMS, and PayFast sandbox are presence only. The value is not shown. OPS_SECRETS_READY_ENABLED stays unset. This page does not register a cron.",
    },
    {
      id: "education_pack",
      label: "Education pack (EASTC)",
      status: education,
      snapshot: toSnapshot(education),
      href: "/agency#education-pack",
      hrefLabel: "View Education pack",
      detail: education === "configured"
        ? "Applied. This checklist did not click Apply."
        : education === "fixture"
          ? "Fixture. Pending until the Education pack is applied to EASTC. Do not click Apply from this checklist."
          : "Pending. The Education pack is not applied to EASTC. Do not click Apply from this checklist.",
    },
    {
      id: "zentrix_pack",
      label: "Zentrix pack",
      status: zentrix,
      snapshot: toSnapshot(zentrix),
      href: "/agency#zentrix-pack",
      hrefLabel: "View Zentrix pack",
      detail: zentrix === "configured"
        ? `Applied. ${flagLine(env, "ZENTRIX_WORKSPACE_PACK_ENABLED")} This checklist did not click Apply.`
        : zentrix === "fixture"
          ? "Fixture. Pending until the Zentrix pack is applied. Leave ZENTRIX_WORKSPACE_PACK_ENABLED unset. Do not click Apply from this checklist."
          : `Pending. The Zentrix pack is not applied. ${flagLine(env, "ZENTRIX_WORKSPACE_PACK_ENABLED")} Do not click Apply from this checklist.`,
    },
    {
      id: "pwa_install",
      label: "PWA install shell",
      status: pwa,
      snapshot: toSnapshot(pwa),
      href: "/command-centre/install",
      hrefLabel: "Open install shell",
      detail: pwa === "fixture"
        ? "Fixture. Flag status only. PWA_INSTALL_SHELL_ENABLED is unset. Optional. Not a go-live blocker. This page does not write an install intent."
        : `Flag status only. ${flagLine(env, "PWA_INSTALL_SHELL_ENABLED")} Optional. Not a go-live blocker. This page does not write an install intent.`,
    },
    {
      id: "sending",
      label: "sending_enabled",
      status: "blocked",
      snapshot: "blocked",
      detail: sendingOff
        ? "sending_enabled is OFF. Blocked for go-live until Billy explicitly enables it later. This page does not turn it on."
        : "sending_enabled is on. Blocked for go-live. This page does not change it and does not send.",
    },
  ];

  const snapshot: GoliveSnapshot = {
    migrations: toSnapshot(migrations),
    setup_wizard: toSnapshot(setup),
    owner_bootstrap: toSnapshot(owner),
    ops_secrets: toSnapshot(ops),
    education_pack: toSnapshot(education),
    zentrix_pack: toSnapshot(zentrix),
    pwa_install: toSnapshot(pwa),
    sending: "blocked",
  };

  const lines = [
    ...rows.map((row) => `${row.label}: ${row.status}. ${row.detail}`),
    ...opsParts.map((part) => `${part.label} is ${part.status}. The value is not shown.`),
    ...LEAVE_UNSET.map((key) => flagLine(env, key)),
    flag === "set"
      ? "GOLIVE_CHECKLIST_ENABLED is the string true. A sandbox note can be stored. It stores pending, ready, blocked, or fixture only."
      : "GOLIVE_CHECKLIST_ENABLED is unset. Leave it unset until step 36 is applied. This page does not turn it on.",
    migrations === "configured"
      ? "SQL migrations are applied. This page does not run SQL."
      : "Steps 20 through 35 are not applied. Step 36 is also unapplied. Do not claim this SQL is already applied.",
    plan.message,
  ];

  return {
    mode: plan.mode,
    write: plan.write,
    flag,
    sendingOff,
    rows,
    snapshot,
    lines,
  };
}

export function missingGoliveChecklist(message: string) {
  return /record_golive_checklist_note|golive_checklist_notes|schema cache|could not find the function/i.test(message);
}

export function noteAccepted(payload: {
  stored?: boolean;
  sandbox?: boolean;
  charged?: boolean;
  status?: string;
  migrations?: string;
  setup_wizard?: string;
  owner_bootstrap?: string;
  ops_secrets?: string;
  education_pack?: string;
  zentrix_pack?: string;
  pwa_install?: string;
  sending?: string;
  applied?: boolean;
  clicked_apply?: boolean;
  registered?: boolean;
  scheduled?: boolean;
  sending_enabled?: boolean;
  secret?: unknown;
  value?: unknown;
  token?: unknown;
  api_key?: unknown;
} | null) {
  if (!payload) return false;
  if (SECRET_VALUE.test(JSON.stringify(payload))) return false;
  if (payload.secret != null || payload.value != null || payload.token != null || payload.api_key != null) return false;
  if (payload.registered === true || payload.scheduled === true || payload.applied === true || payload.sending_enabled === true || payload.clicked_apply === true) {
    return false;
  }
  if (payload.sending !== "blocked") return false;
  for (const key of ["migrations", "setup_wizard", "owner_bootstrap", "ops_secrets", "education_pack", "zentrix_pack", "pwa_install"] as const) {
    if (!SNAPSHOT.has(String(payload[key]))) return false;
  }
  return Boolean(
    payload.stored === true
    && payload.sandbox === true
    && payload.charged === false
    && payload.status === "noted"
    && payload.applied === false
    && payload.clicked_apply === false
    && payload.registered === false
    && payload.scheduled === false
    && payload.sending_enabled === false,
  );
}
