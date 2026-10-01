import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextResponse } from "next/server";
import { decideAccess, requiresSession } from "@/lib/auth/gate";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import { DEFAULT_OWNER_EMAIL } from "@/lib/auth/owners";
import {
  FIXTURE_WIZARD_COPY,
  PENDING_SQL_STEPS,
  PHASE5_FLAGS,
  SQL_PASTE_COPY,
  buildSetupWizard,
  channelsFromConnect,
  checklistEventAccepted,
  formCarriesSecret,
  planSetupChecklistEvent,
  setupWizardDisplayMode,
  setupWizardMode,
} from "@/lib/setup/wizard";

const secret = "cron-value-should-not-render";
const merchant = "20000999";
const otherEmail = "someone-else@example.com";

test("an unauthenticated setup route redirects to login", () => {
  assert.equal(requiresSession("/command-centre/setup"), true);
  const decision = decideAccess({ pathname: "/command-centre/setup", search: "", authRequired: true, userId: null });
  assert.deepEqual(decision, { type: "redirect", pathname: "/login", next: "/command-centre/setup" });
  assert.equal(decideAccess({ pathname: "/command-centre/setup", authRequired: true, userId: "user-1" }).type, "continue");
  assert.equal(decideAccess({ pathname: "/command-centre/setup", authRequired: false, userId: null }).type, "continue");
  const response = NextResponse.redirect("http://localhost/login?next=%2Fcommand-centre%2Fsetup");
  assert.equal(response.status, 307);
  const middleware = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /\/command-centre\/:path\*/);
  assert.match(middleware, /NextResponse\.redirect\(url\)/);
});

test("SETUP_WIZARD_ENABLED off is fixture only and write is false", () => {
  for (const value of [undefined, "", "false", "0", "yes", "TRUEE"]) {
    const env = { SETUP_WIZARD_ENABLED: value } as NodeJS.ProcessEnv;
    assert.equal(setupWizardMode(env), "fixture", String(value));
    const plan = planSetupChecklistEvent({ env, tenantMode: "member", stepKey: "cron_secret", status: "missing" });
    assert.equal(plan.write, false);
    assert.equal(plan.mode, "fixture");
    assert.equal(plan.message, FIXTURE_WIZARD_COPY);
  }
  assert.equal(setupWizardMode({ SETUP_WIZARD_ENABLED: " true " }), "sandbox");
  assert.equal(setupWizardDisplayMode({ tenantMode: "preview", env: { SETUP_WIZARD_ENABLED: "true" } }), "fixture");
  assert.equal(planSetupChecklistEvent({
    env: { SETUP_WIZARD_ENABLED: "true" },
    tenantMode: "preview",
    stepKey: "sql_steps",
    status: "pending",
  }).write, false);
  const ready = planSetupChecklistEvent({
    env: { SETUP_WIZARD_ENABLED: "true" },
    tenantMode: "member",
    stepKey: "cron_secret",
    status: "configured",
  });
  assert.equal(ready.write, true);
  assert.equal(ready.stepKey, "cron_secret");
  assert.equal(ready.status, "configured");
  assert.equal(planSetupChecklistEvent({
    env: { SETUP_WIZARD_ENABLED: "true" },
    tenantMode: "member",
    stepKey: "cron_secret",
    status: secret,
    secretFieldPresent: true,
  }).write, false);
  assert.equal(checklistEventAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    step_key: "cron_secret",
    status: "missing",
    sending_enabled: false,
  }), true);
  assert.equal(checklistEventAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    step_key: "cron_secret",
    status: "missing",
    sending_enabled: true,
  }), false);
  assert.equal(checklistEventAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    step_key: "cron_secret",
    status: "missing",
    sending_enabled: false,
    secret,
  }), false);
});

test("the wizard lists pending SQL, the owner default, and does not print secrets", () => {
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  for (const step of PENDING_SQL_STEPS) {
    assert.match(order, new RegExp(`${step.step}\\. \`supabase/migrations/${step.file.split("/").pop()}\``));
  }
  assert.match(order, /Step 32 is also unapplied/);
  assert.match(SQL_PASTE_COPY, /steps 20 through 31/);
  assert.match(SQL_PASTE_COPY, /APPLY-ORDER\.md/);
  assert.match(SQL_PASTE_COPY, /Do not claim this SQL is already applied/);
  assert.match(SQL_PASTE_COPY, /does not ask for a database URL/);

  const env = {
    CRON_SECRET: secret,
    PAYFAST_MERCHANT_ID: merchant,
    OWNER_EMAILS: otherEmail,
    HOME_CHAT_ENABLED: secret,
    EAST_RAND_CAMPAIGN_SEED_ENABLED: "",
    ZENTRIX_WORKSPACE_PACK_ENABLED: "",
    PWA_INSTALL_SHELL_ENABLED: "",
    SETUP_WIZARD_ENABLED: "",
  } as NodeJS.ProcessEnv;
  const model = buildSetupWizard({
    env,
    tenantMode: "preview",
    ownerEmailsSet: true,
    ownerClaim: "preview",
    cronConfigured: true,
    billingSandbox: false,
    payfastMerchant: "refused",
    channels: channelsFromConnect({ preview: true, cards: [] }),
  });
  assert.equal(model.write, false);
  assert.equal(model.mode, "fixture");
  const text = JSON.stringify(model);
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes(merchant), false);
  assert.equal(text.includes(otherEmail), false);
  assert.match(text, new RegExp(DEFAULT_OWNER_EMAIL.replace(".", "\\.")));
  assert.equal(DEFAULT_OWNER_EMAIL, "billyfaber06@gmail.com");
  assert.match(text, /OWNER_EMAILS is configured/);
  assert.match(text, /The list is not shown/);
  assert.match(text, /CRON_SECRET is configured/);
  assert.match(text, /The value is not shown/);
  assert.match(text, /BILLING_SANDBOX is missing/);
  assert.match(text, /The id is not shown/);
  assert.match(text, /phase4c_aios_pricing/);
  assert.match(text, /phase5j_pwa_mobile_shell/);
  assert.match(text, /Do not claim this SQL is applied/);
  assert.match(text, /not connected/);
  assert.match(text, /EAST_RAND_CAMPAIGN_SEED_ENABLED is unset/);
  assert.match(text, /ZENTRIX_WORKSPACE_PACK_ENABLED is unset/);
  assert.match(text, /PWA_INSTALL_SHELL_ENABLED is unset/);
  assert.equal(model.items.find((item) => item.stepKey === "cron_secret")?.status, "configured");
  assert.equal(model.items.find((item) => item.stepKey === "channel_whatsapp")?.href, "/command-centre/connect-accounts/whatsapp");
  assert.equal(model.items.find((item) => item.stepKey === "channel_email")?.status, "not_connected");
  assert.equal(model.sqlSteps.every((step) => step.status === "pending"), true);
  for (const flag of PHASE5_FLAGS) {
    assert.equal(model.flags.find((row) => row.key === flag.key)?.presence, "unset");
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("step_key", "cron_secret");
  assert.equal(formCarriesSecret(form), true);
  const clean = new FormData();
  clean.set("step_key", "sql_steps");
  clean.set("slug", "ai-autotech");
  assert.equal(formCarriesSecret(clean), false);
});

test("a sandbox channel row can show connected without a secret", () => {
  const channels = channelsFromConnect({
    preview: false,
    cards: [
      { key: "gmail", state: "connected", metaStub: null, channelStub: ["sandbox_stub"] },
      { key: "whatsapp", state: "needs_keys", metaStub: ["sandbox_stub", "needs_provider_keys"], channelStub: null },
      { key: "sms", state: "connect", metaStub: null, channelStub: null },
    ],
  });
  const model = buildSetupWizard({
    env: { SETUP_WIZARD_ENABLED: "true" },
    tenantMode: "member",
    ownerEmailsSet: false,
    ownerClaim: "yes",
    cronConfigured: false,
    billingSandbox: true,
    payfastMerchant: "sandbox",
    channels,
  });
  assert.equal(model.write, true);
  assert.equal(model.items.find((item) => item.stepKey === "channel_email")?.status, "connected");
  assert.equal(model.items.find((item) => item.stepKey === "channel_whatsapp")?.status, "not_connected");
  assert.match(model.items.find((item) => item.stepKey === "channel_whatsapp")?.detail ?? "", /sandbox stub row is present/i);
  assert.equal(model.items.find((item) => item.stepKey === "channel_sms")?.status, "not_connected");
  assert.equal(model.items.find((item) => item.stepKey === "cron_secret")?.status, "missing");
  assert.equal(model.items.find((item) => item.stepKey === "payfast_billing")?.status, "configured");
  assert.match(model.items.find((item) => item.stepKey === "owner_attach")?.detail ?? "", /billyfaber06@gmail.com/);
  assert.equal((model.items.find((item) => item.stepKey === "owner_attach")?.detail ?? "").includes(otherEmail), false);
});

test("setup wizard copy does not send, spend, or turn flags on", () => {
  const files = [
    "src/lib/setup/wizard.ts",
    "src/app/actions/setup-wizard.ts",
    "src/app/command-centre/setup/page.tsx",
    "src/components/setup/go-live-wizard.tsx",
    "src/components/setup/checklist-form.tsx",
    "docs/phase-5k-setup-wizard.md",
    "supabase/migrations/20261107120000_phase5k_setup_wizard.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/AI_REPLY_CRON_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/EAST_RAND_CAMPAIGN_SEED_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/ZENTRIX_WORKSPACE_PACK_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/PWA_INSTALL_SHELL_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/pg_cron|cron\.schedule/i.test(text), false, file);
    assert.equal(/\bdelete from\b/i.test(text), false, file);
  }
  const action = readFileSync(new URL("../../app/actions/setup-wizard.ts", import.meta.url), "utf8");
  const guard = action.indexOf("if (!plan.write");
  const rpc = action.indexOf("record_setup_checklist_event");
  const secretGuard = action.indexOf("formCarriesSecret");
  assert.ok(secretGuard >= 0 && secretGuard < rpc);
  assert.ok(guard >= 0 && rpc > guard);
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step31 = order.indexOf("31. `supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql`");
  const step32 = order.indexOf("32. `supabase/migrations/20261107120000_phase5k_setup_wizard.sql`");
  assert.ok(step31 >= 0);
  assert.ok(step32 > step31);
});
