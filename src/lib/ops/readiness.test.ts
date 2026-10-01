import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import { buildOpsReadiness, cronSecretPresent, payfastMerchantState } from "@/lib/ops/readiness";

const secret = "cron-value-should-not-render";
const merchant = "20000999";

test("ops readiness stays read-only and does not print secrets", () => {
  const checks = buildOpsReadiness({
    claim: "preview",
    ownerEmailsSet: true,
    cronSecretPresent: false,
    workspaceSendingEnabled: false,
    automationSendEnabled: false,
    billingSandbox: false,
    payfastMerchant: "refused",
    zentrixPackEnabled: false,
    pwaInstallEnabled: false,
  });
  const text = checks.map((check) => `${check.label} ${check.detail} ${check.hrefLabel ?? ""}`).join("\n");
  assert.match(text, /Steps 20 through 29 are still unapplied/);
  assert.match(text, /Step 30 is also unapplied/);
  assert.match(text, /Step 31 is also unapplied/);
  assert.match(text, /Do not claim this SQL is applied/);
  assert.match(text, /not a live agency_owner claim on ai-autotech/);
  assert.match(text, /OWNER_EMAILS is set on the server/);
  assert.match(text, /The list is not shown/);
  assert.match(text, /CRON_SECRET is missing/);
  assert.match(text, /Needs Billy/);
  assert.match(text, /Meta, SMS, and email/);
  assert.match(text, /sending_enabled stays false/);
  assert.match(text, /BILLING_SANDBOX stays a sandbox switch/);
  assert.match(text, /The id is not shown/);
  assert.match(text, /Apply Education pack to EASTC/);
  assert.match(text, /ZENTRIX_WORKSPACE_PACK_ENABLED/);
  assert.match(text, /Optional\. Not a go-live blocker/);
  assert.match(text, /No store listing is live/);
  assert.match(text, /PWA_INSTALL_SHELL_ENABLED is unset/);
  assert.match(text, /writes nothing/);
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes(merchant), false);
  assert.equal(text.includes("@"), false);
  assert.equal(checks.find((check) => check.id === "education-pack")?.href, "/agency#education-pack");
  assert.equal(checks.find((check) => check.id === "zentrix-pack")?.href, "/agency#zentrix-pack");
  assert.equal(checks.find((check) => check.id === "channel-keys")?.status, "needs_billy");
  assert.equal(checks.find((check) => check.id === "sending")?.status, "ok");
  assert.equal(checks.find((check) => check.id === "pwa-install")?.status, "optional");
  assert.equal(checks.find((check) => check.id === "pwa-install")?.href, "/command-centre/install");
  assert.equal(checks.find((check) => check.id === "setup-wizard")?.href, "/command-centre/setup");
  assert.equal(checks.find((check) => check.id === "setup-wizard")?.hrefLabel, "Open setup wizard");
  assert.match(text, /Step 32 is also unapplied/);
  assert.match(text, /Step 33 is also unapplied/);
  assert.match(text, /Step 34 is also unapplied/);
  assert.match(text, /MIGRATION_RUNNER_ENABLED stays unset/);
  assert.match(text, /OWNER_BOOTSTRAP_UI_ENABLED stays unset/);
  assert.match(text, /Step 35 is also unapplied/);
  assert.match(text, /OPS_SECRETS_READY_ENABLED stays unset/);
  assert.equal(checks.find((check) => check.id === "ops-secrets")?.href, "/command-centre/ops-secrets");
  assert.equal(checks.find((check) => check.id === "ops-secrets")?.hrefLabel, "Open ops secrets");
  assert.match(text, /does not create an Auth user/);
  assert.equal(checks.find((check) => check.id === "owner-bootstrap")?.href, "/command-centre/owner");
  assert.equal(checks.find((check) => check.id === "owner-bootstrap")?.hrefLabel, "Open owner bootstrap");
  assert.match(text, /does not apply SQL/);
  assert.equal(checks.find((check) => check.id === "migrations")?.href, "/command-centre/migrations");
  assert.equal(checks.find((check) => check.id === "migrations")?.hrefLabel, "Open migration runner");
  assert.match(text, /SETUP_WIZARD_ENABLED stays unset/);
});

test("a live agency owner claim and a present cron secret stay boolean", () => {
  assert.equal(cronSecretPresent({} as NodeJS.ProcessEnv), false);
  assert.equal(cronSecretPresent({ CRON_SECRET: "  " }), false);
  assert.equal(cronSecretPresent({ CRON_SECRET: secret }), true);
  assert.equal(payfastMerchantState({} as NodeJS.ProcessEnv), "unset");
  assert.equal(payfastMerchantState({ PAYFAST_MERCHANT_ID: "10000100" }), "sandbox");
  assert.equal(payfastMerchantState({ PAYFAST_MERCHANT_ID: merchant }), "refused");

  const checks = buildOpsReadiness({
    claim: "yes",
    ownerEmailsSet: false,
    cronSecretPresent: true,
    workspaceSendingEnabled: false,
    automationSendEnabled: false,
    billingSandbox: true,
    payfastMerchant: "sandbox",
    zentrixPackEnabled: false,
    pwaInstallEnabled: true,
  });
  const text = checks.map((check) => check.detail).join("\n");
  assert.match(text, /Current user has agency_owner on ai-autotech/);
  assert.match(text, /CRON_SECRET is present/);
  assert.match(text, /BILLING_SANDBOX is true/);
  assert.match(text, /PWA_INSTALL_SHELL_ENABLED is the string true/);
  assert.equal(checks.find((check) => check.id === "pwa-install")?.status, "optional");
  assert.equal(text.includes(secret), false);
  assert.equal(checks.find((check) => check.id === "sending")?.status, "ok");

  const blocked = buildOpsReadiness({
    claim: "no",
    ownerEmailsSet: false,
    cronSecretPresent: false,
    workspaceSendingEnabled: true,
    automationSendEnabled: false,
    billingSandbox: false,
    payfastMerchant: "unset",
    zentrixPackEnabled: true,
    pwaInstallEnabled: false,
  });
  assert.equal(blocked.find((check) => check.id === "agency-owner")?.status, "blocked");
  assert.equal(blocked.find((check) => check.id === "sending")?.status, "blocked");
  assert.match(blocked.find((check) => check.id === "sending")?.detail ?? "", /must stay false/);
  assert.match(blocked.find((check) => check.id === "zentrix-pack")?.detail ?? "", /string true/);
});

test("ops readiness copy does not turn sending on", () => {
  const files = [
    "src/lib/ops/readiness.ts",
    "src/components/ops/readiness-panel.tsx",
    "src/components/agency-view.tsx",
    "src/app/agency/page.tsx",
    "src/app/command-centre/page.tsx",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/vercel\.com\/api|api\.vercel\.com/i.test(text), false, file);
  }
});
