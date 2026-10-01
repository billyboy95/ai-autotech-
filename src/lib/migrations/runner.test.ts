import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextResponse } from "next/server";
import { decideAccess, requiresSession } from "@/lib/auth/gate";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import {
  CONNECTION_REQUIRED_COPY,
  DRY_RUN_READY_COPY,
  FIXTURE_RUNNER_COPY,
  PHASE5L_MIGRATION,
  SECRET_REFUSAL_COPY,
  STEP_FROM,
  STEP_TO,
  annotateMigrationSteps,
  buildPageMigrationRunner,
  dryRunAccepted,
  formCarriesSecret,
  loadMigrationCatalog,
  migrationRunnerDisplayMode,
  migrationRunnerMode,
  parseApplyOrder,
  planMigrationDryRun,
  verifiedMigrationSteps,
} from "@/lib/migrations/runner";

const secret = "cron-value-should-not-render";
const databaseUrl = "postgres://user:sbp_should-not-render@localhost/db";

test("an unauthenticated migrations route redirects to login", () => {
  assert.equal(requiresSession("/command-centre/migrations"), true);
  const decision = decideAccess({ pathname: "/command-centre/migrations", search: "", authRequired: true, userId: null });
  assert.deepEqual(decision, { type: "redirect", pathname: "/login", next: "/command-centre/migrations" });
  assert.equal(decideAccess({ pathname: "/command-centre/migrations", authRequired: true, userId: "user-1" }).type, "continue");
  assert.equal(decideAccess({ pathname: "/command-centre/migrations", authRequired: false, userId: null }).type, "continue");
  const response = NextResponse.redirect("http://localhost/login?next=%2Fcommand-centre%2Fmigrations");
  assert.equal(response.status, 307);
  const middleware = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /\/command-centre\/:path\*/);
});

test("MIGRATION_RUNNER_ENABLED off refuses the dry-run", () => {
  for (const value of [undefined, "", "false", "0", "yes", "TRUEE", " true "]) {
    const env = { MIGRATION_RUNNER_ENABLED: value, SUPABASE_DB_URL: databaseUrl } as NodeJS.ProcessEnv;
    if (value === " true ") {
      assert.equal(migrationRunnerMode(env), "sandbox");
      continue;
    }
    assert.equal(migrationRunnerMode(env), "fixture", String(value));
    const plan = planMigrationDryRun({ env, tenantMode: "member" });
    assert.equal(plan.write, false);
    assert.equal(plan.mode, "fixture");
    assert.equal(plan.message, FIXTURE_RUNNER_COPY);
  }
  assert.equal(migrationRunnerDisplayMode({ tenantMode: "preview", env: { MIGRATION_RUNNER_ENABLED: "true", SUPABASE_DB_URL: databaseUrl } }), "fixture");
  assert.equal(planMigrationDryRun({
    env: { MIGRATION_RUNNER_ENABLED: "true", SUPABASE_DB_URL: databaseUrl },
    tenantMode: "preview",
  }).write, false);
  assert.equal(planMigrationDryRun({
    env: { MIGRATION_RUNNER_ENABLED: "true" },
    tenantMode: "member",
  }).write, false);
  assert.equal(planMigrationDryRun({
    env: { MIGRATION_RUNNER_ENABLED: "true", SUPABASE_DB_URL: "  " },
    tenantMode: "member",
  }).message, CONNECTION_REQUIRED_COPY);
  const ready = planMigrationDryRun({
    env: { MIGRATION_RUNNER_ENABLED: "true", SUPABASE_DB_URL: databaseUrl },
    tenantMode: "member",
  });
  assert.equal(ready.write, true);
  assert.equal(ready.message, DRY_RUN_READY_COPY);
  assert.equal(planMigrationDryRun({
    env: { MIGRATION_RUNNER_ENABLED: "true", SUPABASE_DB_URL: databaseUrl },
    tenantMode: "member",
    secretFieldPresent: true,
  }).message, SECRET_REFUSAL_COPY);
});

test("the catalog lists steps 20 through 33 as pending and hides secrets", () => {
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const parsed = parseApplyOrder(order);
  assert.equal(parsed.length, 14);
  assert.equal(parsed[0]?.step, STEP_FROM);
  assert.equal(parsed[13]?.step, STEP_TO);
  assert.equal(parsed[13]?.file, PHASE5L_MIGRATION);
  const step32 = order.indexOf("32. `supabase/migrations/20261107120000_phase5k_setup_wizard.sql`");
  const step33 = order.indexOf(`33. \`${PHASE5L_MIGRATION}\``);
  assert.ok(step33 > step32);

  const catalog = loadMigrationCatalog();
  assert.equal(verifiedMigrationSteps().length, 0);
  const model = buildPageMigrationRunner({
    env: {
      MIGRATION_RUNNER_ENABLED: "",
      SUPABASE_DB_URL: databaseUrl,
      CRON_SECRET: secret,
      SETUP_WIZARD_ENABLED: "",
    } as NodeJS.ProcessEnv,
    tenantMode: "preview",
  });
  assert.equal(model.write, false);
  assert.equal(model.mode, "fixture");
  assert.equal(model.source, "fixture");
  assert.equal(model.dbUrl, "configured");
  assert.equal(model.flag, "unset");
  assert.equal(model.steps.length, catalog.length);
  assert.equal(model.steps.every((step) => step.status === "pending"), true);
  const text = JSON.stringify(model);
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes(databaseUrl), false);
  assert.equal(text.includes("sbp_should-not-render"), false);
  assert.match(text, /Do not claim applied/);
  assert.match(text, /SQL is not applied/);
  assert.match(text, /MIGRATION_RUNNER_ENABLED is unset/);
  assert.match(text, /The value is not shown/);
  assert.match(text, /phase5l_migration_runner/);
  assert.match(text, /phase4c_aios_pricing/);
  for (const step of model.steps) {
    const hashed = createHash("sha256").update(readFileSync(new URL(`../../../${step.file}`, import.meta.url))).digest("hex");
    assert.equal(step.checksum, hashed);
    assert.equal(step.status, "pending");
  }

  const verified = annotateMigrationSteps(catalog, { source: "sandbox", verifiedSteps: [33] });
  assert.equal(verified.find((step) => step.step === 33)?.status, "applied");
  assert.equal(verified.filter((step) => step.step < 33).every((step) => step.status === "pending"), true);
  const fixture = annotateMigrationSteps(catalog, { source: "fixture", verifiedSteps: [20, 32, 33] });
  assert.equal(fixture.every((step) => step.status === "pending"), true);

  const connected = buildPageMigrationRunner({
    env: { MIGRATION_RUNNER_ENABLED: "true", SUPABASE_DB_URL: databaseUrl } as NodeJS.ProcessEnv,
    tenantMode: "member",
  });
  assert.equal(connected.write, true);
  assert.equal(connected.steps.every((step) => step.status === "pending"), true);
  assert.equal(JSON.stringify(connected).includes(databaseUrl), false);

  const form = new FormData();
  form.set("checksum", "a".repeat(64));
  assert.equal(formCarriesSecret(form), true);
  const leaked = new FormData();
  leaked.set("slug", databaseUrl);
  assert.equal(formCarriesSecret(leaked), true);
  const clean = new FormData();
  clean.set("slug", "ai-autotech");
  assert.equal(formCarriesSecret(clean), false);
  assert.equal(dryRunAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "pending",
    count: 14,
    applied: false,
    sending_enabled: false,
  }), true);
  assert.equal(dryRunAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "pending",
    count: 14,
    applied: true,
    sending_enabled: false,
  }), false);
  assert.equal(dryRunAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "applied",
    count: 14,
    applied: false,
    sending_enabled: false,
  }), false);
});

test("migration runner copy does not send, spend, or turn flags on", () => {
  const files = [
    "src/lib/migrations/runner.ts",
    "src/app/actions/migration-runner.ts",
    "src/app/command-centre/migrations/page.tsx",
    "src/components/migrations/pending-sql-panel.tsx",
    "src/components/migrations/dry-run-form.tsx",
    "docs/phase-5l-migration-runner.md",
    "supabase/migrations/20261108120000_phase5l_migration_runner.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/MIGRATION_RUNNER_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/SETUP_WIZARD_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/pg_cron|cron\.schedule/i.test(text), false, file);
    assert.equal(/\bdelete from\b/i.test(text), false, file);
    assert.equal(/pg_read_file|dblink|execute\s+format/i.test(text), false, file);
  }
  const sql = readFileSync(new URL("../../../supabase/migrations/20261108120000_phase5l_migration_runner.sql", import.meta.url), "utf8");
  for (const step of loadMigrationCatalog()) {
    assert.equal(sql.includes(step.file), true, step.file);
  }
  const action = readFileSync(new URL("../../app/actions/migration-runner.ts", import.meta.url), "utf8");
  const guard = action.indexOf("if (!plan.write");
  const rpc = action.indexOf("record_migration_dry_run");
  const secretGuard = action.indexOf("formCarriesSecret");
  assert.ok(secretGuard >= 0 && secretGuard < rpc);
  assert.ok(guard >= 0 && rpc > guard);
  assert.equal(action.includes("formData.get(\"checksum\")"), false);
  assert.equal(action.includes("formData.get(\"sql\")"), false);
});
