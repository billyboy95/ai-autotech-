#!/usr/bin/env node
/**
 * Dry-run or apply APPLY-ORDER steps 20–36.
 *
 *   node scripts/apply-pending-migrations.mjs
 *   node scripts/apply-pending-migrations.mjs --apply --project-ref <ref>
 *
 * --apply requires SUPABASE_ACCESS_TOKEN to start with sbp_.
 * The token is never printed. sending_enabled is not changed.
 * Crons are not scheduled. Apply Education and the Zentrix pack are not called.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STEP_FROM = 20;
export const STEP_TO = 36;

const APPLY_ORDER_LINE = /^(\d+)\. `(supabase\/migrations\/[^`]+\.sql)`$/gm;
const FILENAME = /^supabase\/migrations\/[0-9]{14}_[a-z0-9_]+\.sql$/;
const PROJECT_REF = /^[a-z]{20}$/;
const TOKEN_PREFIX = "sbp_";
const MIN_TOKEN_LENGTH = 20;
const QUERY_TIMEOUT_MS = 180_000;

/** Hard-coded order. APPLY-ORDER.md must match this list before any SQL is sent. */
export const EXPECTED_FILES = [
  [20, "supabase/migrations/20261026120000_phase4c_aios_pricing.sql"],
  [21, "supabase/migrations/20261027120000_phase4d_eastc_education.sql"],
  [22, "supabase/migrations/20261028120000_phase5a_agent_computers.sql"],
  [23, "supabase/migrations/20261029120000_phase5b_lead_onboarding.sql"],
  [24, "supabase/migrations/20261030120000_phase5c_connect_import.sql"],
  [25, "supabase/migrations/20261031120000_phase5d_home_chat.sql"],
  [26, "supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql"],
  [27, "supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql"],
  [28, "supabase/migrations/20261103120000_phase5g_social_drafts.sql"],
  [29, "supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql"],
  [30, "supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql"],
  [31, "supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql"],
  [32, "supabase/migrations/20261107120000_phase5k_setup_wizard.sql"],
  [33, "supabase/migrations/20261108120000_phase5l_migration_runner.sql"],
  [34, "supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql"],
  [35, "supabase/migrations/20261110120000_phase5n_ops_secrets_ready.sql"],
  [36, "supabase/migrations/20261111120000_phase5o_golive_checklist.sql"],
];

const HELP = [
  "Apply pending Supabase migrations, steps 20–36.",
  "",
  "  node scripts/apply-pending-migrations.mjs",
  "  node scripts/apply-pending-migrations.mjs --apply --project-ref <ref>",
  "",
  "Default is a dry-run: list the files and send no SQL.",
  " --apply          run each file, in order, and stop on the first failure",
  " --project-ref    project ref (or SUPABASE_PROJECT_REF / SUPABASE_PROJECT_ID)",
  " --from <step>    resume at a step from 20 through 36",
  " --via api|cli|auto",
  "                  api (default) posts to the Management API",
  "                  cli runs `supabase db query` when that command is on PATH",
  "                  auto uses the CLI when `supabase db query` exists, otherwise the API",
  "",
  "SUPABASE_ACCESS_TOKEN must start with sbp_ before --apply.",
  "A missing token still dry-runs. Any other value is refused.",
  "The token is never printed.",
  "sending_enabled stays false. Crons are not scheduled.",
  "Apply Education and the Zentrix pack are not called.",
];

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

export function migrationName(file) {
  const base = file.split("/").pop() ?? file;
  return base.replace(/^\d+_/, "").replace(/\.sql$/, "");
}

export function parsePendingSteps(markdown) {
  const byStep = new Map();
  for (const match of String(markdown).matchAll(APPLY_ORDER_LINE)) {
    const step = Number(match[1]);
    if (step < STEP_FROM || step > STEP_TO) continue;
    const file = match[2];
    if (!FILENAME.test(file)) continue;
    if (!byStep.has(step)) byStep.set(step, file);
  }
  const steps = [];
  for (let step = STEP_FROM; step <= STEP_TO; step += 1) {
    const file = byStep.get(step);
    if (!file) throw new Error(`APPLY-ORDER is missing step ${step}`);
    steps.push({ step, file, name: migrationName(file) });
  }
  return steps;
}

export function loadPendingSteps(root) {
  const markdown = readFileSync(path.join(root, "supabase/APPLY-ORDER.md"), "utf8");
  const parsed = parsePendingSteps(markdown);
  if (parsed.length !== EXPECTED_FILES.length) {
    throw new Error("APPLY-ORDER steps 20 through 36 are incomplete");
  }
  for (let index = 0; index < EXPECTED_FILES.length; index += 1) {
    const [step, file] = EXPECTED_FILES[index];
    const found = parsed[index];
    if (found.step !== step || found.file !== file) {
      throw new Error(`APPLY-ORDER step ${step} does not match ${file}`);
    }
    if (!existsSync(path.join(root, file))) {
      throw new Error(`Missing migration file ${file}`);
    }
  }
  return parsed;
}

/**
 * missing: unset or blank.
 * prefix: set, but not an sbp_ token.
 * ok: starts with sbp_ and is long enough to be a real token.
 * The token value is returned only for the request header. Callers must not print it.
 */
export function tokenStatus(raw) {
  const token = String(raw ?? "").trim();
  if (!token) return { ok: false, reason: "missing" };
  if (!token.startsWith(TOKEN_PREFIX) || token.length < MIN_TOKEN_LENGTH) {
    return { ok: false, reason: "prefix" };
  }
  return { ok: true, reason: "ok", token };
}

export function redactSecrets(text, token) {
  let out = String(text ?? "");
  if (token) out = out.split(token).join("[redacted]");
  out = out.replace(/sbp_[A-Za-z0-9][A-Za-z0-9._~+/-]*/g, "[redacted]");
  out = out.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  return out;
}

export function projectRefFromSupabaseUrl(url) {
  const match = String(url ?? "").trim().match(/^https:\/\/([a-z]{20})\.supabase\.co\/?$/);
  return match ? match[1] : "";
}

export function resolveProjectRef({ flag, env }) {
  const fromFlag = String(flag ?? "").trim();
  if (fromFlag) return fromFlag;
  const fromEnv = String(env.SUPABASE_PROJECT_REF ?? "").trim();
  if (fromEnv) return fromEnv;
  const fromId = String(env.SUPABASE_PROJECT_ID ?? "").trim();
  if (fromId) return fromId;
  return projectRefFromSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL);
}

export function parseArgs(argv) {
  const args = { apply: false, projectRef: "", from: STEP_FROM, via: "api", help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    const inline = splitInline(arg);
    if (inline) {
      assignArg(args, inline.name, inline.value);
      continue;
    }
    if (arg === "--project-ref" || arg === "--from" || arg === "--via") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      assignArg(args, arg.slice(2), value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument ${arg}`);
  }
  return args;
}

function splitInline(arg) {
  const match = /^(--project-ref|--from|--via)=(.*)$/.exec(arg);
  if (!match) return null;
  return { name: match[1].slice(2), value: match[2] };
}

function assignArg(args, name, value) {
  if (name === "project-ref") {
    args.projectRef = value.trim();
    return;
  }
  if (name === "from") {
    if (!/^\d+$/.test(value)) throw new Error("--from must be a step number");
    args.from = Number(value);
    return;
  }
  if (name === "via") {
    args.via = value.trim();
    return;
  }
  throw new Error(`Unknown argument --${name}`);
}

export function cliQueryAvailable(spawnImpl = spawnSync) {
  try {
    const result = spawnImpl("supabase", ["db", "query", "--help"], {
      encoding: "utf8",
      timeout: 8000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return result?.status === 0;
  } catch {
    return false;
  }
}

export function resolveTransport({ via = "api", spawnImpl }) {
  if (via !== "api" && via !== "cli" && via !== "auto") {
    throw new Error(`Unknown --via ${via}. Use api, cli, or auto.`);
  }
  if (via === "api") return { kind: "api", label: "Management API" };
  const available = cliQueryAvailable(spawnImpl);
  if (via === "cli" && !available) {
    throw new Error("supabase db query is not available. Re-run with --via api. Nothing was applied.");
  }
  if (via === "auto" && !available) return { kind: "api", label: "Management API" };
  return { kind: "cli", label: "supabase CLI" };
}

export async function applyViaApi({ sql, projectRef, token, fetchImpl }) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: sql, read_only: false }),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(redactSecrets(`Management API request failed: ${error.message}`, token));
  }
  const body = typeof response.text === "function" ? await response.text() : "";
  if (response.status < 200 || response.status >= 300) {
    throw new Error(redactSecrets(`Management API ${response.status}: ${String(body).slice(0, 500)}`, token));
  }
}

export function applyViaCli({ step, projectRef, token, root, spawnImpl, env }) {
  const result = spawnImpl(
    "supabase",
    [
      "db", "query",
      "--linked",
      "--project-ref", projectRef,
      "--file", path.join(root, step.file),
      "--output", "json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: QUERY_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...env,
        SUPABASE_ACCESS_TOKEN: token,
        SUPABASE_PROJECT_ID: projectRef,
      },
    },
  );
  if (result?.error) {
    throw new Error(redactSecrets(`supabase CLI failed to start: ${result.error.message}`, token));
  }
  if (!result || result.status !== 0) {
    const detail = `${result?.stderr || ""} ${result?.stdout || ""}`.trim();
    throw new Error(redactSecrets(`supabase db query exited ${result?.status}: ${detail}`.slice(0, 800), token));
  }
}

function printPlan(stdout, steps) {
  const first = steps[0]?.step ?? STEP_FROM;
  const last = steps[steps.length - 1]?.step ?? STEP_TO;
  stdout(`Steps ${first}–${last} (${steps.length} files) from supabase/APPLY-ORDER.md:`);
  for (const step of steps) stdout(`  ${step.step}  ${step.file}`);
}

export async function run(options = {}) {
  const argv = options.argv ?? [];
  const env = options.env ?? {};
  const root = options.root ?? repoRoot;
  const stdout = options.stdout ?? ((line) => console.log(line));
  const stderr = options.stderr ?? ((line) => console.error(line));
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const spawnImpl = options.spawnImpl ?? spawnSync;
  const tokenRaw = env.SUPABASE_ACCESS_TOKEN;

  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    stderr(redactSecrets(error.message, tokenRaw));
    return 1;
  }
  if (args.help) {
    for (const line of HELP) stdout(line);
    return 0;
  }

  let steps;
  try {
    steps = loadPendingSteps(root);
  } catch (error) {
    stderr(`Fail. ${error.message}`);
    return 1;
  }
  if (!Number.isInteger(args.from) || args.from < STEP_FROM || args.from > STEP_TO) {
    stderr(`Fail. --from must be a step from ${STEP_FROM} to ${STEP_TO}. Nothing was applied.`);
    return 1;
  }
  const selected = steps.filter((step) => step.step >= args.from);
  const tokenState = tokenStatus(tokenRaw);
  const projectRef = resolveProjectRef({ flag: args.projectRef, env });

  if (tokenState.reason === "prefix") {
    stderr("Fail. Need SUPABASE_ACCESS_TOKEN starting with sbp_. The current value is not an sbp_ token. Nothing was applied.");
    printPlan(stdout, selected);
    return 1;
  }

  if (!args.apply) {
    stdout("Dry-run. No SQL was sent.");
    printPlan(stdout, selected);
    if (!tokenState.ok) {
      stdout("Need SUPABASE_ACCESS_TOKEN starting with sbp_ before --apply.");
    } else {
      stdout("Token accepted (sbp_ prefix). The value is not shown.");
    }
    stdout(projectRef
      ? `Project ref: ${redactSecrets(projectRef, tokenState.token)}`
      : "Project ref: missing. Set SUPABASE_PROJECT_REF or --project-ref before --apply.");
    stdout("sending_enabled stays false. This script does not schedule crons and does not call Apply Education or the Zentrix pack.");
    return 0;
  }

  if (!tokenState.ok) {
    stderr("Fail. Need SUPABASE_ACCESS_TOKEN starting with sbp_ before --apply. Nothing was applied.");
    return 1;
  }
  if (!PROJECT_REF.test(projectRef)) {
    stderr("Fail. Need a project ref (SUPABASE_PROJECT_REF or --project-ref). Nothing was applied.");
    return 1;
  }

  let transport;
  try {
    transport = resolveTransport({ via: args.via, spawnImpl });
  } catch (error) {
    stderr(redactSecrets(error.message, tokenState.token));
    return 1;
  }

  stdout(`Apply. Transport: ${transport.label}. Project ref: ${redactSecrets(projectRef, tokenState.token)}.`);
  if (args.from > STEP_FROM) {
    stdout(`Starting at step ${args.from}. Earlier steps in ${STEP_FROM}–${STEP_TO} are skipped.`);
  }

  for (const step of selected) {
    const sql = readFileSync(path.join(root, step.file), "utf8");
    if (!sql.trim()) {
      stderr(`Fail step ${step.step} ${step.name}`);
      stderr("Migration file is empty. Stopped. Later steps were not applied.");
      return 1;
    }
    stdout(`Applying step ${step.step} ${step.file}`);
    try {
      if (transport.kind === "cli") {
        applyViaCli({ step, projectRef, token: tokenState.token, root, spawnImpl, env });
      } else {
        await applyViaApi({ sql, projectRef, token: tokenState.token, fetchImpl });
      }
      stdout(`Success step ${step.step} ${step.name}`);
    } catch (error) {
      stderr(`Fail step ${step.step} ${step.name}`);
      stderr(redactSecrets(error.message, tokenState.token));
      stderr("Stopped. Later steps were not applied.");
      return 1;
    }
  }

  const appliedFrom = selected[0]?.step ?? args.from;
  const appliedTo = selected[selected.length - 1]?.step ?? STEP_TO;
  stdout(`Success. Steps ${appliedFrom}–${appliedTo} applied.`);
  stdout("sending_enabled was not changed by this script. Crons were not scheduled. Apply Education and the Zentrix pack were not called.");
  stdout("Next: NOTIFY pgrst, 'reload schema'; — see docs/GO-LIVE-RUNBOOK.md.");
  return 0;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  run({ argv: process.argv.slice(2), env: process.env, root: repoRoot }).then(
    (code) => process.exit(code),
    (error) => {
      console.error(redactSecrets(error?.message || "Failed.", process.env.SUPABASE_ACCESS_TOKEN));
      process.exit(1);
    },
  );
}
