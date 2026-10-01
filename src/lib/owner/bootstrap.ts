import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_OWNER_EMAIL } from "@/lib/auth/owners";
import { AGENCY_SLUG } from "@/lib/tenant/types";

export const OWNER_BOOTSTRAP_FLAG = "OWNER_BOOTSTRAP_UI_ENABLED";
export const OWNER_SQL_FILE = "supabase/owner-bootstrap.sql";
export const PHASE5M_MIGRATION = "supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql";
export const SQL_EDITOR_URL = "https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new";
export const AUTH_USERS_URL = "https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/auth/users";

export type OwnerBootstrapMode = "fixture" | "sandbox";
export type OwnerEmailsStatus = "configured" | "missing";
export type AuthAttachStatus = "configured" | "missing" | "fixture";
export type AuthUserRead = "present" | "absent" | "unread";
export type MembershipRead = "agency_owner" | "other" | "none" | "unread";

export type DocumentedOwnerAuth = {
  authUser: AuthUserRead;
  membership: MembershipRead;
};

export type OwnerBootstrapModel = {
  mode: OwnerBootstrapMode;
  write: boolean;
  flag: "set" | "unset";
  ownerEmails: OwnerEmailsStatus;
  authAttach: AuthAttachStatus;
  documentedEmail: typeof DEFAULT_OWNER_EMAIL;
  sqlFile: typeof OWNER_SQL_FILE;
  sqlText: string;
  checksum: string;
  sqlEditorUrl: typeof SQL_EDITOR_URL;
  authUsersUrl: typeof AUTH_USERS_URL;
  lines: string[];
};

export const FIXTURE_OWNER_COPY =
  "Fixture only. This panel writes nothing until OWNER_BOOTSTRAP_UI_ENABLED is the string true and step 34 is applied. It does not create an Auth user and does not run owner-bootstrap.sql.";

export const SECRET_REFUSAL_COPY =
  "Secrets are not stored. Nothing was written. An Auth user was not created. owner-bootstrap.sql was not run.";

export const NOTE_READY_COPY =
  "A sandbox note can be stored. charged stays false. An Auth user is not created. owner-bootstrap.sql is not run.";

const CHECKSUM = /^[a-f0-9]{64}$/;
const SECRET_VALUE = /bearer\s|postgres:\/\/|sbp_|supabase_db_url|cron_secret/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ownerBootstrapMode(env: NodeJS.ProcessEnv = process.env): OwnerBootstrapMode {
  return String(env.OWNER_BOOTSTRAP_UI_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

export function ownerBootstrapDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): OwnerBootstrapMode {
  if (input.tenantMode !== "member") return "fixture";
  return ownerBootstrapMode(input.env);
}

export function ownerEmailsStatus(env: NodeJS.ProcessEnv = process.env): OwnerEmailsStatus {
  return String(env.OWNER_EMAILS ?? "").trim() ? "configured" : "missing";
}

/** Exact match on the documented address only. Other addresses are ignored and not returned. */
export function matchDocumentedOwner(users: Array<{ id?: string | null; email?: string | null }>) {
  const match = users.find((user) => {
    const email = user.email?.trim().toLowerCase() ?? "";
    return email === DEFAULT_OWNER_EMAIL && UUID.test(String(user.id ?? ""));
  });
  if (!match?.id) return { found: false as const, userId: null };
  return { found: true as const, userId: match.id };
}

export function authAttachStatus(input: {
  tenantMode: string;
  authUser: AuthUserRead;
  membership: MembershipRead;
}): AuthAttachStatus {
  if (input.tenantMode !== "member") return "fixture";
  if (input.authUser === "unread") return "fixture";
  if (input.authUser === "present" && input.membership === "unread") return "fixture";
  if (input.authUser === "present" && input.membership === "agency_owner") return "configured";
  return "missing";
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

export function loadOwnerSql(root = process.cwd()) {
  const sqlText = readFileSync(path.join(root, OWNER_SQL_FILE), "utf8");
  const checksum = createHash("sha256").update(sqlText).digest("hex");
  if (!CHECKSUM.test(checksum)) throw new Error("owner-bootstrap.sql checksum must be sha256 hex");
  if (!sqlText.includes(DEFAULT_OWNER_EMAIL)) throw new Error("owner-bootstrap.sql must name the documented owner");
  return { sqlText, checksum };
}

export function planOwnerBootstrapNote(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  secretFieldPresent?: boolean;
}): { mode: OwnerBootstrapMode; write: boolean; message: string } {
  if (input.secretFieldPresent) {
    return { mode: "fixture", write: false, message: SECRET_REFUSAL_COPY };
  }
  const mode = ownerBootstrapDisplayMode(input);
  if (mode !== "sandbox") {
    return { mode: "fixture", write: false, message: FIXTURE_OWNER_COPY };
  }
  return { mode: "sandbox", write: true, message: NOTE_READY_COPY };
}

function attachDetail(status: AuthAttachStatus) {
  if (status === "configured") {
    return `Auth attach is configured. ${DEFAULT_OWNER_EMAIL} exists in Supabase Auth and is agency_owner on ${AGENCY_SLUG}.`;
  }
  if (status === "missing") {
    return `Auth attach is missing. Create ${DEFAULT_OWNER_EMAIL} in Authentication → Users, then paste the SQL. This page does not create that user.`;
  }
  return "Auth attach is fixture. The Auth user was not read on this render. This page does not create an Auth user.";
}

export function buildOwnerBootstrap(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  authUser?: AuthUserRead;
  membership?: MembershipRead;
  root?: string;
}): OwnerBootstrapModel {
  const env = input.env ?? process.env;
  const plan = planOwnerBootstrapNote({ env, tenantMode: input.tenantMode });
  const ownerEmails = ownerEmailsStatus(env);
  const authAttach = authAttachStatus({
    tenantMode: input.tenantMode,
    authUser: input.authUser ?? "unread",
    membership: input.membership ?? "unread",
  });
  const { sqlText, checksum } = loadOwnerSql(input.root);
  const emailsLine = ownerEmails === "configured"
    ? "OWNER_EMAILS is configured. The list is not shown."
    : "OWNER_EMAILS is missing. The server uses the documented default.";
  const flag = ownerBootstrapMode(env) === "sandbox" ? "set" : "unset";
  const lines = [
    `${emailsLine} The documented owner is ${DEFAULT_OWNER_EMAIL}. This page does not invent another address.`,
    attachDetail(authAttach),
    "Steps 20 through 33 are not applied. Step 34 is also unapplied. Step 35 is also unapplied. Do not claim this SQL is already applied.",
    "Open the Supabase SQL editor and paste supabase/owner-bootstrap.sql only after the Auth user exists. This page does not run that file.",
    "sending_enabled stays false. Nothing is sent. Nothing is spent.",
    flag === "set"
      ? "OWNER_BOOTSTRAP_UI_ENABLED is set. A sandbox note can be stored. It does not create an Auth user and does not run the SQL."
      : "OWNER_BOOTSTRAP_UI_ENABLED is unset. Leave it unset until step 34 is applied. This page does not turn it on.",
    "Leave MIGRATION_RUNNER_ENABLED and SETUP_WIZARD_ENABLED unset. This page does not turn them on.",
    plan.message,
  ];
  return {
    mode: plan.mode,
    write: plan.write,
    flag,
    ownerEmails,
    authAttach,
    documentedEmail: DEFAULT_OWNER_EMAIL,
    sqlFile: OWNER_SQL_FILE,
    sqlText,
    checksum,
    sqlEditorUrl: SQL_EDITOR_URL,
    authUsersUrl: AUTH_USERS_URL,
    lines,
  };
}

export function missingOwnerBootstrap(message: string) {
  return /record_owner_bootstrap_note|owner_bootstrap_notes|schema cache|could not find the function/i.test(message);
}

export function noteAccepted(payload: {
  stored?: boolean;
  sandbox?: boolean;
  charged?: boolean;
  status?: string;
  owner_emails?: string;
  auth_attach?: string;
  applied?: boolean;
  created_user?: boolean;
  sending_enabled?: boolean;
  secret?: unknown;
  value?: unknown;
  sql?: unknown;
  email?: unknown;
} | null) {
  if (!payload) return false;
  if (payload.secret != null || payload.value != null || payload.sql != null || payload.email != null) return false;
  if (payload.created_user === true || payload.applied === true || payload.sending_enabled === true) return false;
  if (payload.owner_emails !== "configured" && payload.owner_emails !== "missing") return false;
  if (payload.auth_attach !== "configured" && payload.auth_attach !== "missing" && payload.auth_attach !== "fixture") return false;
  return Boolean(
    payload.stored === true
    && payload.sandbox === true
    && payload.charged === false
    && payload.status === "noted"
    && payload.created_user === false,
  );
}
