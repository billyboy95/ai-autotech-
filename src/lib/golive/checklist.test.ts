import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextResponse } from "next/server";
import { decideAccess, requiresSession } from "@/lib/auth/gate";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import {
  DISPLAY_STATUSES,
  FIXTURE_GOLIVE_COPY,
  NOTE_READY_COPY,
  PHASE5O_MIGRATION,
  SECRET_REFUSAL_COPY,
  SNAPSHOT_STATUSES,
  buildGoliveChecklist,
  formCarriesSecret,
  goliveChecklistDisplayMode,
  goliveChecklistMode,
  noteAccepted,
  planGoliveNote,
  toSnapshot,
} from "@/lib/golive/checklist";

const secret = "cron-value-should-not-render";
const resend = "re_should-not-render";
const databaseUrl = "postgres://user:sbp_should-not-render@localhost/db";
const payfastKey = "payfast-key-should-not-render";
const liveMerchant = "20000999";

const validNote = {
  stored: true,
  sandbox: true,
  charged: false,
  status: "noted",
  migrations: "pending",
  setup_wizard: "pending",
  owner_bootstrap: "pending",
  ops_secrets: "fixture",
  education_pack: "pending",
  zentrix_pack: "pending",
  pwa_install: "fixture",
  sending: "blocked",
  applied: false,
  clicked_apply: false,
  registered: false,
  scheduled: false,
  sending_enabled: false,
};

test("an unauthenticated go-live route redirects to login", () => {
  assert.equal(requiresSession("/command-centre/go-live"), true);
  const decision = decideAccess({ pathname: "/command-centre/go-live", search: "", authRequired: true, userId: null });
  assert.deepEqual(decision, { type: "redirect", pathname: "/login", next: "/command-centre/go-live" });
  assert.equal(decideAccess({ pathname: "/command-centre/go-live", authRequired: true, userId: "user-1" }).type, "continue");
  assert.equal(decideAccess({ pathname: "/command-centre/go-live", authRequired: false, userId: null }).type, "continue");
  const response = NextResponse.redirect("http://localhost/login?next=%2Fcommand-centre%2Fgo-live");
  assert.equal(response.status, 307);
  const middleware = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /\/command-centre\/:path\*/);
});

test("GOLIVE_CHECKLIST_ENABLED off refuses the note and preview stays fixture", () => {
  for (const value of [undefined, "", "false", "0", "yes", "TRUEE", " true "]) {
    const env = { GOLIVE_CHECKLIST_ENABLED: value } as NodeJS.ProcessEnv;
    if (value === " true ") {
      assert.equal(goliveChecklistMode(env), "sandbox");
      continue;
    }
    assert.equal(goliveChecklistMode(env), "fixture", String(value));
    const plan = planGoliveNote({ env, tenantMode: "member" });
    assert.equal(plan.write, false);
    assert.equal(plan.mode, "fixture");
    assert.equal(plan.message, FIXTURE_GOLIVE_COPY);
  }
  assert.equal(goliveChecklistDisplayMode({ tenantMode: "preview", env: { GOLIVE_CHECKLIST_ENABLED: "true" } }), "fixture");
  assert.equal(planGoliveNote({
    env: { GOLIVE_CHECKLIST_ENABLED: "true" },
    tenantMode: "preview",
  }).write, false);
  const ready = planGoliveNote({
    env: { GOLIVE_CHECKLIST_ENABLED: "true" },
    tenantMode: "member",
  });
  assert.equal(ready.write, true);
  assert.equal(ready.message, NOTE_READY_COPY);
  assert.equal(planGoliveNote({
    env: { GOLIVE_CHECKLIST_ENABLED: "true" },
    tenantMode: "member",
    secretFieldPresent: true,
  }).message, SECRET_REFUSAL_COPY);
});

test("checklist payloads stay on the status enums and refuse secret-like strings", () => {
  for (const status of DISPLAY_STATUSES) {
    assert.ok(SNAPSHOT_STATUSES.includes(toSnapshot(status)));
  }
  assert.equal(toSnapshot("configured"), "ready");
  assert.equal(toSnapshot("missing"), "pending");
  assert.equal(toSnapshot("blocked"), "blocked");
  assert.equal(noteAccepted(validNote), true);
  assert.equal(noteAccepted({ ...validNote, migrations: "ready", education_pack: "ready", zentrix_pack: "ready", pwa_install: "ready", ops_secrets: "pending" }), true);
  assert.equal(noteAccepted({ ...validNote, migrations: resend }), false);
  assert.equal(noteAccepted({ ...validNote, ops_secrets: "configured" }), false);
  assert.equal(noteAccepted({ ...validNote, sending: "ready" }), false);
  assert.equal(noteAccepted({ ...validNote, sending: "pending" }), false);
  assert.equal(noteAccepted({ ...validNote, applied: true }), false);
  assert.equal(noteAccepted({ ...validNote, clicked_apply: true }), false);
  assert.equal(noteAccepted({ ...validNote, sending_enabled: true }), false);
  assert.equal(noteAccepted({ ...validNote, secret }), false);
  assert.equal(noteAccepted({ ...validNote, api_key: databaseUrl }), false);
  assert.equal(noteAccepted({ ...validNote, token: "sbp_should-not-render" }), false);

  const form = new FormData();
  form.set("migrations", resend);
  assert.equal(formCarriesSecret(form), true);
  const leaked = new FormData();
  leaked.set("slug", databaseUrl);
  assert.equal(formCarriesSecret(leaked), true);
  const bearer = new FormData();
  bearer.set("slug", "bearer secret");
  assert.equal(formCarriesSecret(bearer), true);
  const clean = new FormData();
  clean.set("slug", "ai-autotech");
  assert.equal(formCarriesSecret(clean), false);
});

test("the checklist hides values and keeps sending blocked", () => {
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const steps = [
    "20. `supabase/migrations/20261026120000_phase4c_aios_pricing.sql`",
    "21. `supabase/migrations/20261027120000_phase4d_eastc_education.sql`",
    "22. `supabase/migrations/20261028120000_phase5a_agent_computers.sql`",
    "23. `supabase/migrations/20261029120000_phase5b_lead_onboarding.sql`",
    "24. `supabase/migrations/20261030120000_phase5c_connect_import.sql`",
    "25. `supabase/migrations/20261031120000_phase5d_home_chat.sql`",
    "26. `supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql`",
    "27. `supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql`",
    "28. `supabase/migrations/20261103120000_phase5g_social_drafts.sql`",
    "29. `supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql`",
    "30. `supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql`",
    "31. `supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql`",
    "32. `supabase/migrations/20261107120000_phase5k_setup_wizard.sql`",
    "33. `supabase/migrations/20261108120000_phase5l_migration_runner.sql`",
    "34. `supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql`",
    "35. `supabase/migrations/20261110120000_phase5n_ops_secrets_ready.sql`",
    `36. \`${PHASE5O_MIGRATION}\``,
  ];
  let cursor = -1;
  for (const step of steps) {
    const at = order.indexOf(step);
    assert.ok(at > cursor, step);
    cursor = at;
  }
  assert.match(order, /Step 35 is also unapplied/);
  assert.match(order, /Step 36 is also unapplied/);
  assert.match(order, /GOLIVE_CHECKLIST_ENABLED/);

  const preview = buildGoliveChecklist({
    env: {
      GOLIVE_CHECKLIST_ENABLED: "",
      CRON_SECRET: secret,
      RESEND_API_KEY: resend,
      PAYFAST_MERCHANT_ID: liveMerchant,
      PAYFAST_MERCHANT_KEY: payfastKey,
      SUPABASE_DB_URL: databaseUrl,
      OWNER_EMAILS: "billyfaber06@gmail.com",
      ZENTRIX_WORKSPACE_PACK_ENABLED: "",
      PWA_INSTALL_SHELL_ENABLED: "",
      MIGRATION_RUNNER_ENABLED: "",
      SETUP_WIZARD_ENABLED: "",
      OWNER_BOOTSTRAP_UI_ENABLED: "",
      OPS_SECRETS_READY_ENABLED: "",
      AI_REPLY_CRON_ENABLED: "",
      EAST_RAND_CAMPAIGN_SEED_ENABLED: "",
    } as NodeJS.ProcessEnv,
    tenantMode: "preview",
    workspaceSendingEnabled: false,
    educationApplied: true,
    zentrixApplied: true,
  });
  assert.equal(preview.write, false);
  assert.equal(preview.mode, "fixture");
  assert.equal(preview.flag, "unset");
  assert.equal(preview.sendingOff, true);
  assert.equal(preview.snapshot.sending, "blocked");
  for (const row of preview.rows) {
    if (row.id === "sending") {
      assert.equal(row.status, "blocked");
      continue;
    }
    assert.equal(row.status, "fixture", row.id);
    assert.equal(row.snapshot, "fixture", row.id);
  }
  const previewText = JSON.stringify(preview);
  for (const hidden of [secret, resend, payfastKey, liveMerchant, databaseUrl, "sbp_should-not-render", "billyfaber06@gmail.com"]) {
    assert.equal(previewText.includes(hidden), false, hidden);
  }
  assert.match(previewText, /sending_enabled is OFF/);
  assert.match(previewText, /Blocked for go-live/);
  assert.match(previewText, /Do not click Apply/);
  assert.match(previewText, /ZENTRIX_WORKSPACE_PACK_ENABLED is unset/);
  assert.match(previewText, /PWA_INSTALL_SHELL_ENABLED is unset/);
  assert.match(previewText, /GOLIVE_CHECKLIST_ENABLED is unset/);
  assert.match(previewText, /Step 36 is also unapplied/);
  assert.match(previewText, /The value is not shown/);
  assert.match(previewText, /does not run SQL/);
  assert.equal(previewText.includes("Apply Education pack"), false);
  assert.equal(previewText.includes("Apply Zentrix"), false);

  const ready = buildGoliveChecklist({
    env: {
      GOLIVE_CHECKLIST_ENABLED: "true",
      CRON_SECRET: secret,
      RESEND_API_KEY: resend,
      WHATSAPP_TOKEN: "wa-token-should-not-render",
      WHATSAPP_PHONE_NUMBER_ID: "100",
      BULKSMS_TOKEN_ID: "id",
      BULKSMS_TOKEN_SECRET: "sms-secret-should-not-render",
      PAYFAST_MERCHANT_ID: "10000100",
      PAYFAST_MERCHANT_KEY: payfastKey,
      OWNER_EMAILS: "billyfaber06@gmail.com",
      PWA_INSTALL_SHELL_ENABLED: "true",
      ZENTRIX_WORKSPACE_PACK_ENABLED: "",
    } as NodeJS.ProcessEnv,
    tenantMode: "member",
    workspaceSendingEnabled: false,
    automationSendEnabled: false,
    educationApplied: true,
    zentrixApplied: false,
    verifiedSteps: [],
  });
  assert.equal(ready.write, true);
  assert.equal(ready.mode, "sandbox");
  assert.equal(ready.rows.find((row) => row.id === "migrations")?.status, "pending");
  assert.equal(ready.snapshot.migrations, "pending");
  assert.equal(ready.rows.find((row) => row.id === "ops_secrets")?.status, "configured");
  assert.equal(ready.snapshot.ops_secrets, "ready");
  assert.equal(ready.rows.find((row) => row.id === "education_pack")?.status, "configured");
  assert.equal(ready.snapshot.education_pack, "ready");
  assert.match(ready.rows.find((row) => row.id === "education_pack")?.detail ?? "", /Applied/);
  assert.match(ready.rows.find((row) => row.id === "education_pack")?.detail ?? "", /did not click Apply/);
  assert.equal(ready.rows.find((row) => row.id === "zentrix_pack")?.status, "pending");
  assert.match(ready.rows.find((row) => row.id === "zentrix_pack")?.detail ?? "", /ZENTRIX_WORKSPACE_PACK_ENABLED is unset/);
  assert.equal(ready.rows.find((row) => row.id === "pwa_install")?.status, "configured");
  assert.match(ready.rows.find((row) => row.id === "pwa_install")?.detail ?? "", /Flag status only/);
  assert.equal(ready.rows.find((row) => row.id === "sending")?.status, "blocked");
  assert.equal(ready.sendingOff, true);
  const readyText = JSON.stringify(ready);
  for (const hidden of [secret, resend, payfastKey, "wa-token-should-not-render", "sms-secret-should-not-render", "billyfaber06@gmail.com", "10000100"]) {
    assert.equal(readyText.includes(hidden), false, hidden);
  }

  const applied = buildGoliveChecklist({
    env: { GOLIVE_CHECKLIST_ENABLED: "true" } as NodeJS.ProcessEnv,
    tenantMode: "member",
    verifiedSteps: Array.from({ length: 17 }, (_, index) => 20 + index),
    educationApplied: false,
    zentrixApplied: true,
  });
  assert.equal(applied.rows.find((row) => row.id === "migrations")?.status, "configured");
  assert.equal(applied.snapshot.migrations, "ready");
  assert.match(applied.rows.find((row) => row.id === "migrations")?.detail ?? "", /Applied/);
  assert.match(applied.rows.find((row) => row.id === "migrations")?.detail ?? "", /does not run SQL/);
  assert.equal(applied.rows.find((row) => row.id === "zentrix_pack")?.status, "configured");
  assert.equal(applied.rows.find((row) => row.id === "education_pack")?.status, "pending");
  assert.equal(applied.snapshot.sending, "blocked");
});

test("go-live copy does not send, spend, register crons, apply packs, or turn flags on", () => {
  const files = [
    "src/lib/golive/checklist.ts",
    "src/lib/golive/load.ts",
    "src/app/actions/golive-checklist.ts",
    "src/app/command-centre/go-live/page.tsx",
    "src/components/golive/golive-checklist-panel.tsx",
    "src/components/golive/golive-note-form.tsx",
    "docs/phase-5o-golive-checklist.md",
    "docs/phone-go-live.md",
    "supabase/migrations/20261111120000_phase5o_golive_checklist.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/GOLIVE_CHECKLIST_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/AI_REPLY_CRON_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/MIGRATION_RUNNER_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/SETUP_WIZARD_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/OWNER_BOOTSTRAP_UI_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/OPS_SECRETS_READY_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/ZENTRIX_WORKSPACE_PACK_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/EAST_RAND_CAMPAIGN_SEED_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/PWA_INSTALL_SHELL_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/pg_cron|cron\.schedule/i.test(text), false, file);
    assert.equal(/\bdelete from\b/i.test(text), false, file);
    assert.equal(/apply_education_pack_to_eastc|apply_zentrix_workspace_pack/i.test(text), false, file);
  }
  const panel = readFileSync(new URL("../../components/golive/golive-checklist-panel.tsx", import.meta.url), "utf8");
  assert.equal(/Apply Education|Apply Zentrix/i.test(panel), false);
  const action = readFileSync(new URL("../../app/actions/golive-checklist.ts", import.meta.url), "utf8");
  const guard = action.indexOf("if (!plan.write");
  const rpc = action.indexOf("record_golive_checklist_note");
  const secretGuard = action.indexOf("formCarriesSecret");
  assert.ok(secretGuard >= 0 && secretGuard < rpc);
  assert.ok(guard >= 0 && rpc > guard);
  assert.equal(action.includes("formData.get(\"secret\")"), false);
  assert.equal(action.includes("CRON_SECRET"), false);
  assert.equal(action.includes("p_sending: \"blocked\"") || action.includes("p_sending: model.snapshot.sending"), true);
});
