import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const MIGRATION_RUNNER_FLAG = "MIGRATION_RUNNER_ENABLED";
export const STEP_FROM = 20;
export const STEP_TO = 33;
export const PHASE5L_MIGRATION = "supabase/migrations/20261108120000_phase5l_migration_runner.sql";

export type MigrationRunnerMode = "fixture" | "sandbox";
export type MigrationStepStatus = "pending" | "applied";
export type Presence = "configured" | "missing";
export type FlagPresence = "set" | "unset";

export type CatalogStep = {
  step: number;
  file: string;
  name: string;
};

export type MigrationStepView = CatalogStep & {
  checksum: string;
  status: MigrationStepStatus;
};

export type MigrationRunnerModel = {
  mode: MigrationRunnerMode;
  source: MigrationRunnerMode;
  write: boolean;
  dbUrl: Presence;
  flag: FlagPresence;
  lines: string[];
  steps: MigrationStepView[];
};

export const FIXTURE_RUNNER_COPY =
  "Fixture only. This runner writes nothing until MIGRATION_RUNNER_ENABLED is the string true, step 33 is applied, and SUPABASE_DB_URL is configured. SQL is not applied.";

export const CONNECTION_REQUIRED_COPY =
  "SUPABASE_DB_URL is missing. Nothing was written. SQL was not applied.";

export const SECRET_REFUSAL_COPY =
  "Secrets are not stored. Nothing was written. SQL was not applied.";

export const DRY_RUN_READY_COPY =
  "A sandbox dry-run can be stored. charged stays false. SQL is not applied. Status stays pending until verified.";

const APPLY_ORDER_LINE = /^(\d+)\. `(supabase\/migrations\/[^`]+\.sql)`$/gm;
const FILENAME = /^supabase\/migrations\/[0-9]{14}_[a-z0-9_]+\.sql$/;
const CHECKSUM = /^[a-f0-9]{64}$/;
const SECRET_VALUE = /bearer\s|postgres:\/\/|sbp_|supabase_db_url|cron_secret/i;

export function migrationRunnerMode(env: NodeJS.ProcessEnv = process.env): MigrationRunnerMode {
  return String(env.MIGRATION_RUNNER_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

export function migrationRunnerDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): MigrationRunnerMode {
  if (input.tenantMode !== "member") return "fixture";
  return migrationRunnerMode(input.env);
}

/** Presence only. The value is never returned. */
export function dbUrlPresence(env: NodeJS.ProcessEnv = process.env): Presence {
  return String(env.SUPABASE_DB_URL ?? "").trim() ? "configured" : "missing";
}

export function flagPresence(env: NodeJS.ProcessEnv = process.env): FlagPresence {
  return migrationRunnerMode(env) === "sandbox" ? "set" : "unset";
}

export function migrationStatusLabel(status: MigrationStepStatus) {
  return status === "applied" ? "Applied" : "Pending";
}

export function migrationName(file: string) {
  const base = file.split("/").pop() ?? file;
  return base.replace(/^\d+_/, "").replace(/\.sql$/, "");
}

export function parseApplyOrder(markdown: string): CatalogStep[] {
  const steps: CatalogStep[] = [];
  for (const match of markdown.matchAll(APPLY_ORDER_LINE)) {
    const step = Number(match[1]);
    if (step < STEP_FROM || step > STEP_TO) continue;
    const file = match[2];
    if (!FILENAME.test(file)) continue;
    steps.push({ step, file, name: migrationName(file) });
  }
  return steps;
}

export function loadMigrationCatalog(root = process.cwd()): Array<CatalogStep & { checksum: string }> {
  const order = readFileSync(path.join(root, "supabase/APPLY-ORDER.md"), "utf8");
  const parsed = parseApplyOrder(order);
  if (parsed.length !== STEP_TO - STEP_FROM + 1) {
    throw new Error("APPLY-ORDER steps 20 through 33 are incomplete");
  }
  for (let index = 0; index < parsed.length; index += 1) {
    const step = parsed[index];
    if (step.step !== STEP_FROM + index) {
      throw new Error("APPLY-ORDER steps 20 through 33 must stay in order");
    }
  }
  if (parsed[parsed.length - 1]?.file !== PHASE5L_MIGRATION) {
    throw new Error("step 33 must be the phase 5l migration runner");
  }
  return parsed.map((step) => {
    const checksum = createHash("sha256").update(readFileSync(path.join(root, step.file))).digest("hex");
    if (!CHECKSUM.test(checksum)) throw new Error("checksum must be sha256 hex");
    return { ...step, checksum };
  });
}

/**
 * Production steps 20–33 are not applied.
 * The page passes this empty list so the panel stays pending until a later verification exists.
 */
export function verifiedMigrationSteps(): number[] {
  return [];
}

export function annotateMigrationSteps(
  steps: Array<CatalogStep & { checksum: string }>,
  input: { source: MigrationRunnerMode; verifiedSteps?: number[] },
): MigrationStepView[] {
  const verified = new Set(input.source === "sandbox" ? input.verifiedSteps ?? [] : []);
  return steps.map((step) => ({
    ...step,
    status: verified.has(step.step) ? "applied" : "pending",
  }));
}

export function formCarriesSecret(formData: FormData) {
  for (const [key, value] of formData.entries()) {
    if (key !== "slug") return true;
    if (typeof value !== "string") return true;
    if (value.length > 80) return true;
    if (SECRET_VALUE.test(value)) return true;
  }
  return false;
}

export function planMigrationDryRun(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  secretFieldPresent?: boolean;
}): { mode: MigrationRunnerMode; write: boolean; message: string } {
  if (input.secretFieldPresent) {
    return { mode: "fixture", write: false, message: SECRET_REFUSAL_COPY };
  }
  const mode = migrationRunnerDisplayMode(input);
  if (mode !== "sandbox") {
    return { mode: "fixture", write: false, message: FIXTURE_RUNNER_COPY };
  }
  if (dbUrlPresence(input.env) !== "configured") {
    return { mode: "sandbox", write: false, message: CONNECTION_REQUIRED_COPY };
  }
  return { mode: "sandbox", write: true, message: DRY_RUN_READY_COPY };
}

export function buildMigrationRunner(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  steps: Array<CatalogStep & { checksum: string }>;
  verifiedSteps?: number[];
}): MigrationRunnerModel {
  const env = input.env ?? process.env;
  const dbUrl = dbUrlPresence(env);
  const flag = flagPresence(env);
  const source: MigrationRunnerMode = input.tenantMode === "member" && dbUrl === "configured" ? "sandbox" : "fixture";
  const plan = planMigrationDryRun({ env, tenantMode: input.tenantMode });
  const steps = annotateMigrationSteps(input.steps, {
    source,
    verifiedSteps: input.verifiedSteps,
  });
  const lines = [
    "Steps 20 through 33 are pending until verified. Do not claim applied. SQL is not applied. Step 34 is also unapplied and is not part of this dry-run.",
    "sending_enabled stays false. Nothing is sent. Nothing is spent.",
    dbUrl === "configured"
      ? "SUPABASE_DB_URL is configured. The value is not shown."
      : "SUPABASE_DB_URL is missing. The value is not shown.",
    flag === "set"
      ? "MIGRATION_RUNNER_ENABLED is set. SQL is not applied. Status stays pending until verified."
      : "MIGRATION_RUNNER_ENABLED is unset. Leave it unset until step 33 is applied. This page does not turn it on.",
    source === "fixture"
      ? "Fixture. Every step is pending."
      : "Checklist source is the workspace session. Every unverified step stays pending.",
    plan.message,
  ];
  return {
    mode: plan.mode,
    source,
    write: plan.write,
    dbUrl,
    flag,
    lines,
    steps,
  };
}

export function buildPageMigrationRunner(input: {
  env?: NodeJS.ProcessEnv;
  tenantMode: string;
  root?: string;
}): MigrationRunnerModel {
  return buildMigrationRunner({
    env: input.env,
    tenantMode: input.tenantMode,
    steps: loadMigrationCatalog(input.root),
    verifiedSteps: verifiedMigrationSteps(),
  });
}

export function missingMigrationRunner(message: string) {
  return /record_migration_dry_run|migration_runner_events|schema cache|could not find the function/i.test(message);
}

export function dryRunAccepted(payload: {
  stored?: boolean;
  sandbox?: boolean;
  charged?: boolean;
  status?: string;
  count?: number;
  applied?: boolean;
  sending_enabled?: boolean;
  secret?: unknown;
  value?: unknown;
  sql?: unknown;
} | null) {
  if (!payload) return false;
  if (payload.secret != null || payload.value != null || payload.sql != null) return false;
  if (payload.applied === true) return false;
  return Boolean(
    payload.stored === true
    && payload.sandbox === true
    && payload.charged === false
    && payload.status === "pending"
    && payload.count === STEP_TO - STEP_FROM + 1
    && payload.sending_enabled !== true,
  );
}
