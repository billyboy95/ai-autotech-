import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextResponse } from "next/server";
import { decideAccess, requiresSession } from "@/lib/auth/gate";
import { DEFAULT_OWNER_EMAIL } from "@/lib/auth/owners";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import {
  AUTH_USERS_URL,
  FIXTURE_OWNER_COPY,
  NOTE_READY_COPY,
  OWNER_SQL_FILE,
  PHASE5M_MIGRATION,
  SECRET_REFUSAL_COPY,
  SQL_EDITOR_URL,
  authAttachStatus,
  buildOwnerBootstrap,
  formCarriesSecret,
  loadOwnerSql,
  matchDocumentedOwner,
  noteAccepted,
  ownerBootstrapDisplayMode,
  ownerBootstrapMode,
  ownerEmailsStatus,
  planOwnerBootstrapNote,
} from "@/lib/owner/bootstrap";
import { STEP_TO, loadMigrationCatalog } from "@/lib/migrations/runner";

const secret = "cron-value-should-not-render";
const otherEmail = "someone-else@example.com";
const databaseUrl = "postgres://user:sbp_should-not-render@localhost/db";

test("an unauthenticated owner route redirects to login", () => {
  assert.equal(requiresSession("/command-centre/owner"), true);
  const decision = decideAccess({ pathname: "/command-centre/owner", search: "", authRequired: true, userId: null });
  assert.deepEqual(decision, { type: "redirect", pathname: "/login", next: "/command-centre/owner" });
  assert.equal(decideAccess({ pathname: "/command-centre/owner", authRequired: true, userId: "user-1" }).type, "continue");
  assert.equal(decideAccess({ pathname: "/command-centre/owner", authRequired: false, userId: null }).type, "continue");
  const response = NextResponse.redirect("http://localhost/login?next=%2Fcommand-centre%2Fowner");
  assert.equal(response.status, 307);
  const middleware = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /\/command-centre\/:path\*/);
});

test("OWNER_BOOTSTRAP_UI_ENABLED off refuses the note", () => {
  for (const value of [undefined, "", "false", "0", "yes", "TRUEE", " true "]) {
    const env = { OWNER_BOOTSTRAP_UI_ENABLED: value } as NodeJS.ProcessEnv;
    if (value === " true ") {
      assert.equal(ownerBootstrapMode(env), "sandbox");
      continue;
    }
    assert.equal(ownerBootstrapMode(env), "fixture", String(value));
    const plan = planOwnerBootstrapNote({ env, tenantMode: "member" });
    assert.equal(plan.write, false);
    assert.equal(plan.mode, "fixture");
    assert.equal(plan.message, FIXTURE_OWNER_COPY);
  }
  assert.equal(ownerBootstrapDisplayMode({ tenantMode: "preview", env: { OWNER_BOOTSTRAP_UI_ENABLED: "true" } }), "fixture");
  assert.equal(planOwnerBootstrapNote({
    env: { OWNER_BOOTSTRAP_UI_ENABLED: "true" },
    tenantMode: "preview",
  }).write, false);
  const ready = planOwnerBootstrapNote({
    env: { OWNER_BOOTSTRAP_UI_ENABLED: "true" },
    tenantMode: "member",
  });
  assert.equal(ready.write, true);
  assert.equal(ready.message, NOTE_READY_COPY);
  assert.equal(planOwnerBootstrapNote({
    env: { OWNER_BOOTSTRAP_UI_ENABLED: "true" },
    tenantMode: "member",
    secretFieldPresent: true,
  }).message, SECRET_REFUSAL_COPY);
});

test("attach status is configured, missing, or fixture and hides other emails", () => {
  assert.equal(ownerEmailsStatus({} as NodeJS.ProcessEnv), "missing");
  assert.equal(ownerEmailsStatus({ OWNER_EMAILS: "  " }), "missing");
  assert.equal(ownerEmailsStatus({ OWNER_EMAILS: DEFAULT_OWNER_EMAIL }), "configured");
  assert.equal(ownerEmailsStatus({ OWNER_EMAILS: otherEmail }), "configured");
  assert.equal(authAttachStatus({ tenantMode: "preview", authUser: "present", membership: "agency_owner" }), "fixture");
  assert.equal(authAttachStatus({ tenantMode: "member", authUser: "unread", membership: "unread" }), "fixture");
  assert.equal(authAttachStatus({ tenantMode: "member", authUser: "present", membership: "unread" }), "fixture");
  assert.equal(authAttachStatus({ tenantMode: "member", authUser: "absent", membership: "none" }), "missing");
  assert.equal(authAttachStatus({ tenantMode: "member", authUser: "present", membership: "none" }), "missing");
  assert.equal(authAttachStatus({ tenantMode: "member", authUser: "present", membership: "other" }), "missing");
  assert.equal(authAttachStatus({ tenantMode: "member", authUser: "present", membership: "agency_owner" }), "configured");

  const matched = matchDocumentedOwner([
    { id: "22222222-2222-4222-8222-222222222222", email: otherEmail },
    { id: "11111111-1111-4111-8111-111111111111", email: ` ${DEFAULT_OWNER_EMAIL.toUpperCase()} ` },
  ]);
  assert.equal(matched.found, true);
  assert.equal(matched.userId, "11111111-1111-4111-8111-111111111111");
  assert.equal(JSON.stringify(matched).includes(otherEmail), false);
  assert.equal(matchDocumentedOwner([{ id: "not-a-uuid", email: DEFAULT_OWNER_EMAIL }]).found, false);
  assert.equal(matchDocumentedOwner([{ id: "11111111-1111-4111-8111-111111111111", email: otherEmail }]).found, false);
});

test("the panel names the documented owner, shows the SQL, and does not claim steps applied", () => {
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step33 = order.indexOf("33. `supabase/migrations/20261108120000_phase5l_migration_runner.sql`");
  const step34 = order.indexOf(`34. \`${PHASE5M_MIGRATION}\``);
  assert.ok(step34 > step33);
  assert.match(order, /Step 34 is also unapplied/);
  assert.match(order, /OWNER_BOOTSTRAP_UI_ENABLED/);
  const catalog = loadMigrationCatalog();
  assert.equal(catalog.length, 14);
  assert.equal(catalog[catalog.length - 1]?.step, STEP_TO);
  assert.equal(catalog.some((step) => step.file === PHASE5M_MIGRATION), false);

  const file = readFileSync(new URL(`../../../${OWNER_SQL_FILE}`, import.meta.url), "utf8");
  const loaded = loadOwnerSql();
  assert.equal(loaded.sqlText, file);
  assert.equal(loaded.checksum, createHash("sha256").update(file).digest("hex"));
  assert.match(file, new RegExp(DEFAULT_OWNER_EMAIL.replace(/\./g, "\\.")));
  assert.equal(file.includes(otherEmail), false);

  const model = buildOwnerBootstrap({
    env: {
      OWNER_BOOTSTRAP_UI_ENABLED: "",
      OWNER_EMAILS: otherEmail,
      MIGRATION_RUNNER_ENABLED: "",
      SETUP_WIZARD_ENABLED: "",
      CRON_SECRET: secret,
      SUPABASE_DB_URL: databaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: secret,
    } as NodeJS.ProcessEnv,
    tenantMode: "preview",
    authUser: "unread",
    membership: "unread",
  });
  assert.equal(model.write, false);
  assert.equal(model.mode, "fixture");
  assert.equal(model.flag, "unset");
  assert.equal(model.ownerEmails, "configured");
  assert.equal(model.authAttach, "fixture");
  assert.equal(model.documentedEmail, "billyfaber06@gmail.com");
  assert.equal(model.sqlEditorUrl, SQL_EDITOR_URL);
  assert.equal(model.authUsersUrl, AUTH_USERS_URL);
  const text = JSON.stringify(model);
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes(databaseUrl), false);
  assert.equal(text.includes(otherEmail), false);
  assert.equal(text.includes("sbp_should-not-render"), false);
  assert.match(text, /billyfaber06@gmail.com/);
  assert.match(text, /OWNER_EMAILS is configured/);
  assert.match(text, /The list is not shown/);
  assert.match(text, /Auth attach is fixture/);
  assert.match(text, /Steps 20 through 33 are not applied/);
  assert.match(text, /Step 34 is also unapplied/);
  assert.match(text, /Do not claim this SQL is already applied/);
  assert.match(text, /does not create an Auth user/);
  assert.match(text, /does not run owner-bootstrap.sql/);
  assert.match(text, /OWNER_BOOTSTRAP_UI_ENABLED is unset/);
  assert.match(text, /MIGRATION_RUNNER_ENABLED/);
  assert.match(text, /SETUP_WIZARD_ENABLED/);
  assert.match(text, /on conflict/);

  const attached = buildOwnerBootstrap({
    env: { OWNER_BOOTSTRAP_UI_ENABLED: "true", OWNER_EMAILS: "" } as NodeJS.ProcessEnv,
    tenantMode: "member",
    authUser: "present",
    membership: "agency_owner",
  });
  assert.equal(attached.write, true);
  assert.equal(attached.ownerEmails, "missing");
  assert.equal(attached.authAttach, "configured");
  assert.match(attached.lines.join(" "), /Auth attach is configured/);
  assert.equal(JSON.stringify(attached).includes(otherEmail), false);

  const form = new FormData();
  form.set("email", otherEmail);
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
    owner_emails: "configured",
    auth_attach: "fixture",
    applied: false,
    created_user: false,
    sending_enabled: false,
  }), true);
  assert.equal(noteAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "noted",
    owner_emails: "configured",
    auth_attach: "fixture",
    created_user: true,
    sending_enabled: false,
  }), false);
  assert.equal(noteAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "noted",
    owner_emails: otherEmail,
    auth_attach: "fixture",
    created_user: false,
    sending_enabled: false,
  }), false);
  assert.equal(noteAccepted({
    stored: true,
    sandbox: true,
    charged: false,
    status: "noted",
    owner_emails: "missing",
    auth_attach: "missing",
    created_user: false,
    sending_enabled: true,
  }), false);
});

test("owner bootstrap copy does not send, spend, create users, or turn flags on", () => {
  const files = [
    "src/lib/owner/bootstrap.ts",
    "src/lib/owner/auth-lookup.ts",
    "src/app/actions/owner-bootstrap.ts",
    "src/app/command-centre/owner/page.tsx",
    "src/components/owner/owner-bootstrap-panel.tsx",
    "src/components/owner/owner-note-form.tsx",
    "docs/phase-5m-owner-bootstrap.md",
    "supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/OWNER_BOOTSTRAP_UI_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/MIGRATION_RUNNER_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/SETUP_WIZARD_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/createUser|inviteUserByEmail|auth\.admin\.createUser/i.test(text), false, file);
    assert.equal(/pg_cron|cron\.schedule/i.test(text), false, file);
    assert.equal(/\bdelete from\b/i.test(text), false, file);
    assert.equal(/insert into auth\.users/i.test(text), false, file);
    assert.equal(/insert into public\.memberships/i.test(text), false, file);
  }
  const action = readFileSync(new URL("../../app/actions/owner-bootstrap.ts", import.meta.url), "utf8");
  const guard = action.indexOf("if (!plan.write");
  const rpc = action.indexOf("record_owner_bootstrap_note");
  const secretGuard = action.indexOf("formCarriesSecret");
  assert.ok(secretGuard >= 0 && secretGuard < rpc);
  assert.ok(guard >= 0 && rpc > guard);
  assert.equal(action.includes("formData.get(\"checksum\")"), false);
  assert.equal(action.includes("formData.get(\"sql\")"), false);
  assert.equal(action.includes("formData.get(\"email\")"), false);
});
