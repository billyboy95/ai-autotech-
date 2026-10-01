import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextResponse } from "next/server";
import { decideAccess, requiresSession } from "@/lib/auth/gate";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import { STEP_TO, loadMigrationCatalog } from "@/lib/migrations/runner";
import {
  CRON_JOB_NAMES,
  FIXTURE_OPS_COPY,
  NOTE_READY_COPY,
  PHASE5N_MIGRATION,
  SECRET_REFUSAL_COPY,
  buildOpsSecrets,
  cronPresence,
  emailProviderPresence,
  formCarriesSecret,
  noteAccepted,
  opsSecretsDisplayMode,
  opsSecretsMode,
  payfastSandboxPresence,
  planOpsSecretsNote,
  smsProviderPresence,
  whatsappMetaPresence,
} from "@/lib/ops/secrets";

const secret = "cron-value-should-not-render";
const resend = "re_should-not-render";
const smtpPass = "smtp-pass-should-not-render";
const waToken = "wa-token-should-not-render";
const metaToken = "meta-token-should-not-render";
const smsSecret = "sms-secret-should-not-render";
const payfastKey = "payfast-key-should-not-render";
const liveMerchant = "20000999";
const databaseUrl = "postgres://user:sbp_should-not-render@localhost/db";

test("an unauthenticated ops secrets route redirects to login", () => {
  assert.equal(requiresSession("/command-centre/ops-secrets"), true);
  const decision = decideAccess({ pathname: "/command-centre/ops-secrets", search: "", authRequired: true, userId: null });
  assert.deepEqual(decision, { type: "redirect", pathname: "/login", next: "/command-centre/ops-secrets" });
  assert.equal(decideAccess({ pathname: "/command-centre/ops-secrets", authRequired: true, userId: "user-1" }).type, "continue");
  assert.equal(decideAccess({ pathname: "/command-centre/ops-secrets", authRequired: false, userId: null }).type, "continue");
  const response = NextResponse.redirect("http://localhost/login?next=%2Fcommand-centre%2Fops-secrets");
  assert.equal(response.status, 307);
  const middleware = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /\/command-centre\/:path\*/);
});

test("OPS_SECRETS_READY_ENABLED off refuses the note", () => {
  for (const value of [undefined, "", "false", "0", "yes", "TRUEE", " true "]) {
    const env = { OPS_SECRETS_READY_ENABLED: value } as NodeJS.ProcessEnv;
    if (value === " true ") {
      assert.equal(opsSecretsMode(env), "sandbox");
      continue;
    }
    assert.equal(opsSecretsMode(env), "fixture", String(value));
    const plan = planOpsSecretsNote({ env, tenantMode: "member" });
    assert.equal(plan.write, false);
    assert.equal(plan.mode, "fixture");
    assert.equal(plan.message, FIXTURE_OPS_COPY);
  }
  assert.equal(opsSecretsDisplayMode({ tenantMode: "preview", env: { OPS_SECRETS_READY_ENABLED: "true" } }), "fixture");
  assert.equal(planOpsSecretsNote({
    env: { OPS_SECRETS_READY_ENABLED: "true" },
    tenantMode: "preview",
  }).write, false);
  const ready = planOpsSecretsNote({
    env: { OPS_SECRETS_READY_ENABLED: "true" },
    tenantMode: "member",
  });
  assert.equal(ready.write, true);
  assert.equal(ready.message, NOTE_READY_COPY);
  assert.equal(planOpsSecretsNote({
    env: { OPS_SECRETS_READY_ENABLED: "true" },
    tenantMode: "member",
    secretFieldPresent: true,
  }).message, SECRET_REFUSAL_COPY);
});

test("presence is configured, missing, or fixture and never returns a value", () => {
  assert.equal(cronPresence({} as NodeJS.ProcessEnv), "missing");
  assert.equal(cronPresence({ CRON_SECRET: "  " }), "missing");
  assert.equal(cronPresence({ CRON_SECRET: secret }), "configured");
  assert.equal(emailProviderPresence({} as NodeJS.ProcessEnv), "missing");
  assert.equal(emailProviderPresence({ SMTP_PORT: "587" }), "missing");
  assert.equal(emailProviderPresence({ RESEND_API_KEY: resend }), "configured");
  assert.equal(emailProviderPresence({ SMTP_HOST: "smtp.example" }), "configured");
  assert.equal(whatsappMetaPresence({ WHATSAPP_TOKEN: waToken }), "missing");
  assert.equal(whatsappMetaPresence({ WHATSAPP_TOKEN: waToken, WHATSAPP_PHONE_NUMBER_ID: "100" }), "configured");
  assert.equal(whatsappMetaPresence({ META_PAGE_ACCESS_TOKEN: metaToken, META_PAGE_ID: "1" }), "configured");
  assert.equal(whatsappMetaPresence({ META_PAGE_ACCESS_TOKEN: metaToken }), "missing");
  assert.equal(smsProviderPresence({ BULKSMS_TOKEN_ID: "id" }), "missing");
  assert.equal(smsProviderPresence({ BULKSMS_TOKEN_ID: "id", BULKSMS_TOKEN_SECRET: smsSecret }), "configured");
  assert.equal(smsProviderPresence({ CLICKATELL_API_KEY: "click" }), "configured");
  assert.equal(smsProviderPresence({ SMSPORTAL_CLIENT_ID: "client", SMSPORTAL_API_SECRET: smsSecret }), "configured");
  assert.equal(smsProviderPresence({
    TWILIO_ACCOUNT_SID: "AC",
    TWILIO_AUTH_TOKEN: smsSecret,
    TWILIO_FROM_NUMBER: "+27000000000",
  }), "configured");
  assert.equal(payfastSandboxPresence({} as NodeJS.ProcessEnv), "missing");
  assert.equal(payfastSandboxPresence({ PAYFAST_MERCHANT_ID: "10000100" }), "missing");
  assert.equal(payfastSandboxPresence({ PAYFAST_MERCHANT_ID: "10000100", PAYFAST_MERCHANT_KEY: payfastKey }), "configured");
  assert.equal(payfastSandboxPresence({ PAYFAST_MERCHANT_ID: liveMerchant, PAYFAST_MERCHANT_KEY: payfastKey }), "missing");
});

test("the panel hides secret values and lists cron names without registering them", () => {
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step34 = order.indexOf("34. `supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql`");
  const step35 = order.indexOf(`35. \`${PHASE5N_MIGRATION}\``);
  assert.ok(step35 > step34);
  assert.match(order, /Step 34 is also unapplied/);
  assert.match(order, /Step 35 is also unapplied/);
  assert.match(order, /OPS_SECRETS_READY_ENABLED/);
  const catalog = loadMigrationCatalog();
  assert.equal(catalog.length, 14);
  assert.equal(catalog[catalog.length - 1]?.step, STEP_TO);
  assert.equal(catalog.some((step) => step.file === PHASE5N_MIGRATION), false);

  const preview = buildOpsSecrets({
    env: {
      OPS_SECRETS_READY_ENABLED: "",
      CRON_SECRET: secret,
      RESEND_API_KEY: resend,
      SMTP_PASS: smtpPass,
      WHATSAPP_TOKEN: waToken,
      WHATSAPP_PHONE_NUMBER_ID: "100",
      META_PAGE_ACCESS_TOKEN: metaToken,
      BULKSMS_TOKEN_SECRET: smsSecret,
      PAYFAST_MERCHANT_ID: liveMerchant,
      PAYFAST_MERCHANT_KEY: payfastKey,
      SUPABASE_DB_URL: databaseUrl,
      MIGRATION_RUNNER_ENABLED: "",
      SETUP_WIZARD_ENABLED: "",
      OWNER_BOOTSTRAP_UI_ENABLED: "",
      AI_REPLY_CRON_ENABLED: "",
    } as NodeJS.ProcessEnv,
    tenantMode: "preview",
  });
  assert.equal(preview.write, false);
  assert.equal(preview.mode, "fixture");
  assert.equal(preview.flag, "unset");
  assert.equal(preview.registered, false);
  assert.equal(preview.cron, "fixture");
  assert.equal(preview.email, "fixture");
  assert.equal(preview.whatsapp, "fixture");
  assert.equal(preview.sms, "fixture");
  assert.equal(preview.payfast, "fixture");
  assert.deepEqual(preview.cronJobs, [...CRON_JOB_NAMES]);
  const previewText = JSON.stringify(preview);
  for (const hidden of [secret, resend, smtpPass, waToken, metaToken, smsSecret, payfastKey, liveMerchant, databaseUrl, "sbp_should-not-render"]) {
    assert.equal(previewText.includes(hidden), false, hidden);
  }
  assert.match(previewText, /CRON_SECRET is fixture/);
  assert.match(previewText, /The value is not shown/);
  assert.match(previewText, /would be registered once CRON_SECRET exists/);
  assert.match(previewText, /does not register them/);
  assert.match(previewText, /Steps 20 through 34 are not applied/);
  assert.match(previewText, /Step 35 is also unapplied/);
  assert.match(previewText, /OPS_SECRETS_READY_ENABLED is unset/);
  assert.match(previewText, /AI_REPLY_CRON_ENABLED/);
  assert.match(previewText, /sending_enabled stays false/);

  const ready = buildOpsSecrets({
    env: {
      OPS_SECRETS_READY_ENABLED: "true",
      CRON_SECRET: secret,
      RESEND_API_KEY: resend,
      WHATSAPP_TOKEN: waToken,
      WHATSAPP_PHONE_NUMBER_ID: "100",
      BULKSMS_TOKEN_ID: "id",
      BULKSMS_TOKEN_SECRET: smsSecret,
      PAYFAST_MERCHANT_ID: "10000100",
      PAYFAST_MERCHANT_KEY: payfastKey,
    } as NodeJS.ProcessEnv,
    tenantMode: "member",
  });
  assert.equal(ready.write, true);
  assert.equal(ready.mode, "sandbox");
  assert.equal(ready.cron, "configured");
  assert.equal(ready.email, "configured");
  assert.equal(ready.whatsapp, "configured");
  assert.equal(ready.sms, "configured");
  assert.equal(ready.payfast, "configured");
  assert.equal(ready.registered, false);
  const readyText = JSON.stringify(ready);
  for (const hidden of [secret, resend, waToken, smsSecret, payfastKey]) {
    assert.equal(readyText.includes(hidden), false, hidden);
  }
  assert.match(readyText, /CRON_SECRET is configured/);
  assert.match(readyText, /PayFast sandbox keys is configured/);

  const live = buildOpsSecrets({
    env: {
      OPS_SECRETS_READY_ENABLED: "true",
      PAYFAST_MERCHANT_ID: liveMerchant,
      PAYFAST_MERCHANT_KEY: payfastKey,
    } as NodeJS.ProcessEnv,
    tenantMode: "member",
  });
  assert.equal(live.payfast, "missing");
  assert.equal(live.cron, "missing");
  assert.equal(JSON.stringify(live).includes(liveMerchant), false);
  assert.equal(JSON.stringify(live).includes(payfastKey), false);

  const form = new FormData();
  form.set("cron_secret", secret);
  assert.equal(formCarriesSecret(form), true);
  const leaked = new FormData();
  leaked.set("slug", databaseUrl);
  assert.equal(formCarriesSecret(leaked), true);
  const clean = new FormData();
  clean.set("slug", "ai-autotech");
  assert.equal(formCarriesSecret(clean), false);

  assert.equal(noteAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "noted",
    cron_presence: "configured",
    email_provider: "missing",
    whatsapp_meta: "fixture",
    sms_provider: "missing",
    payfast_sandbox: "missing",
    cron_jobs: [...CRON_JOB_NAMES],
    registered: false,
    scheduled: false,
    applied: false,
    sending_enabled: false,
  }), true);
  assert.equal(noteAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "noted",
    cron_presence: secret,
    email_provider: "missing",
    whatsapp_meta: "fixture",
    sms_provider: "missing",
    payfast_sandbox: "missing",
    cron_jobs: [...CRON_JOB_NAMES],
    registered: false,
    scheduled: false,
    sending_enabled: false,
  }), false);
  assert.equal(noteAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "noted",
    cron_presence: "configured",
    email_provider: "missing",
    whatsapp_meta: "fixture",
    sms_provider: "missing",
    payfast_sandbox: "missing",
    cron_jobs: [...CRON_JOB_NAMES, secret],
    registered: false,
    scheduled: false,
    sending_enabled: false,
  }), false);
  assert.equal(noteAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "noted",
    cron_presence: "configured",
    email_provider: "missing",
    whatsapp_meta: "fixture",
    sms_provider: "missing",
    payfast_sandbox: "missing",
    cron_jobs: [...CRON_JOB_NAMES],
    registered: true,
    scheduled: false,
    sending_enabled: false,
  }), false);
  assert.equal(noteAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "noted",
    cron_presence: "missing",
    email_provider: "missing",
    whatsapp_meta: "missing",
    sms_provider: "missing",
    payfast_sandbox: "missing",
    cron_jobs: [...CRON_JOB_NAMES],
    registered: false,
    scheduled: false,
    sending_enabled: true,
    secret,
  }), false);
});

test("ops secrets copy does not send, spend, register crons, or turn flags on", () => {
  const files = [
    "src/lib/ops/secrets.ts",
    "src/app/actions/ops-secrets.ts",
    "src/app/command-centre/ops-secrets/page.tsx",
    "src/components/ops/ops-secrets-panel.tsx",
    "src/components/ops/ops-secrets-note-form.tsx",
    "docs/phase-5n-ops-secrets.md",
    "supabase/migrations/20261110120000_phase5n_ops_secrets_ready.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/OPS_SECRETS_READY_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/AI_REPLY_CRON_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/MIGRATION_RUNNER_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/SETUP_WIZARD_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/OWNER_BOOTSTRAP_UI_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/pg_cron|cron\.schedule/i.test(text), false, file);
    assert.equal(/\bdelete from\b/i.test(text), false, file);
    assert.equal(/process\.env\[/i.test(text) && file.endsWith(".tsx"), false, file);
  }
  const action = readFileSync(new URL("../../app/actions/ops-secrets.ts", import.meta.url), "utf8");
  const guard = action.indexOf("if (!plan.write");
  const rpc = action.indexOf("record_ops_secrets_note");
  const secretGuard = action.indexOf("formCarriesSecret");
  assert.ok(secretGuard >= 0 && secretGuard < rpc);
  assert.ok(guard >= 0 && rpc > guard);
  assert.equal(action.includes("formData.get(\"cron\")"), false);
  assert.equal(action.includes("formData.get(\"secret\")"), false);
  assert.equal(action.includes("CRON_SECRET"), false);
});
