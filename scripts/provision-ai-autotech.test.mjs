import assert from "node:assert/strict";
import test from "node:test";
import {
  CONFIRM_VALUE,
  PRODUCTION_CONFIRM_VALUE,
  PRODUCTION_PROJECT_REF,
  PROVISION_SQL,
  decideProvision,
  postProvisionSql,
  runProvision,
} from "./provision-ai-autotech.mjs";

const REF = "abcdefghijklmnopqrst";

test("the provision script dry-runs and does not send SQL", async () => {
  let called = false;
  const result = await runProvision([], {}, async () => {
    called = true;
    return { status: 500, text: async () => "" };
  });
  assert.equal(result.action, "dry-run");
  assert.equal(result.sent, false);
  assert.equal(called, false);
  assert.equal(result.profile.businessName, "AI AutoTech");
  assert.equal(result.profile.website, "https://aiautotech.co.za");
  assert.equal(result.profile.bookingUrl, "https://aiautotech.co.za/book");
  assert.equal(result.profile.senderAddress, "Willem@aiautotech.co.za");
  assert.match(PROVISION_SQL, /sending_enabled = false/);
  assert.equal(/sending_enabled\s*=\s*true/i.test(PROVISION_SQL), false);
});

test("apply is refused without the confirm string, and production needs its own confirm", async () => {
  const token = "sbp_exampletokenvalue";
  const missing = decideProvision(["--apply", "--project-ref", REF], { SUPABASE_ACCESS_TOKEN: token });
  assert.equal(missing.action, "refuse");
  assert.equal(missing.reason, "confirm");

  const sandbox = decideProvision(["--apply", "--project-ref", REF], {
    SUPABASE_ACCESS_TOKEN: token,
    AI_AUTOTECH_PROVISION_CONFIRM: CONFIRM_VALUE,
  });
  assert.equal(sandbox.action, "apply");
  assert.equal(sandbox.production, false);

  const production = decideProvision(["--apply", "--project-ref", PRODUCTION_PROJECT_REF], {
    SUPABASE_ACCESS_TOKEN: token,
    AI_AUTOTECH_PROVISION_CONFIRM: CONFIRM_VALUE,
  });
  assert.equal(production.action, "refuse");
  assert.equal(production.reason, "production_confirm");

  const allowed = decideProvision(["--apply", "--project-ref", PRODUCTION_PROJECT_REF], {
    SUPABASE_ACCESS_TOKEN: token,
    AI_AUTOTECH_PROVISION_CONFIRM: PRODUCTION_CONFIRM_VALUE,
  });
  assert.equal(allowed.action, "apply");
  assert.equal(allowed.production, true);

  const ci = decideProvision(["--apply", "--project-ref", REF], {
    CI: "true",
    SUPABASE_ACCESS_TOKEN: token,
    AI_AUTOTECH_PROVISION_CONFIRM: CONFIRM_VALUE,
  });
  assert.equal(ci.action, "refuse");
  assert.equal(ci.reason, "ci");
});

test("apply posts the provision SQL once and does not print the token", async () => {
  const token = "sbp_exampletokenvalue";
  const calls = [];
  const result = await runProvision(
    ["--apply", "--project-ref", REF],
    { SUPABASE_ACCESS_TOKEN: token, AI_AUTOTECH_PROVISION_CONFIRM: CONFIRM_VALUE },
    async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body), authorization: init.headers.Authorization });
      return { status: 201, text: async () => "[]" };
    },
  );
  assert.equal(result.sent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.supabase.com/v1/projects/${REF}/database/query`);
  assert.equal(calls[0].body.read_only, false);
  assert.match(calls[0].body.query, /duplicate_workspace/);
  assert.match(calls[0].body.query, /Willem@aiautotech.co.za/);
  assert.equal(calls[0].body.query.includes(token), false);

  await assert.rejects(
    postProvisionSql({
      sql: "select 1",
      projectRef: REF,
      token,
      fetchImpl: async () => ({ status: 400, text: async () => "no" }),
    }),
    /Management API 400/,
  );
});
