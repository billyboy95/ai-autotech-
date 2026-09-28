import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import {
  EAST_RAND_SANDBOX_CAMPAIGN_NAME,
  EAST_RAND_SANDBOX_LABEL,
  eastRandSeedDisplayMode,
  eastRandSeedMode,
  planEastRandSandboxSeed,
  readEastRandSandboxCsv,
} from "@/lib/campaigns/east-rand-seed";

function digitRuns(text: string) {
  return new Set(
    (text.match(/\d[\d\s/+()-]{6,}\d/g) ?? [])
      .map((item) => item.replace(/\D/g, ""))
      .filter((item) => item.length >= 9),
  );
}

test("East Rand seed stays fixture-only until EAST_RAND_CAMPAIGN_SEED_ENABLED is true", () => {
  assert.equal(eastRandSeedMode({} as NodeJS.ProcessEnv), "fixture");
  assert.equal(eastRandSeedMode({ EAST_RAND_CAMPAIGN_SEED_ENABLED: "" }), "fixture");
  assert.equal(eastRandSeedMode({ EAST_RAND_CAMPAIGN_SEED_ENABLED: "false" }), "fixture");
  assert.equal(eastRandSeedMode({ EAST_RAND_CAMPAIGN_SEED_ENABLED: "true" }), "sandbox");
  assert.equal(eastRandSeedDisplayMode({ tenantMode: "preview", env: { EAST_RAND_CAMPAIGN_SEED_ENABLED: "true" } }), "fixture");
  assert.equal(eastRandSeedDisplayMode({ tenantMode: "member", env: { EAST_RAND_CAMPAIGN_SEED_ENABLED: "true" } }), "sandbox");
});

test("the sandbox fixture is fake, consent-ready, and does not queue", () => {
  const csv = readEastRandSandboxCsv();
  const production = readFileSync(new URL("../../../data/campaigns/ai-autotech-east-rand-prospects.csv", import.meta.url), "utf8");
  const plan = planEastRandSandboxSeed({ intent: "seed", sendingEnabled: false, source: "fixture", csv });
  assert.equal(plan.error, "");
  assert.equal(plan.campaignName, EAST_RAND_SANDBOX_CAMPAIGN_NAME);
  assert.equal(plan.source, "fixture");
  assert.ok(plan.rows.length >= 20 && plan.rows.length <= 24);
  assert.equal(plan.queued, 0);
  assert.equal(plan.sent, 0);
  assert.equal(plan.charged, false);
  assert.ok(plan.skippedMissingConsent >= 1);
  assert.equal(plan.report?.breakdown.stop, 1);
  assert.equal(plan.report?.lines.some((line) => line.reason === "POPIA"), true);
  assert.match(csv.split(/\r?\n/)[0], /consent_basis/);
  assert.equal(plan.rows.every((row) => row.name.startsWith("Sandbox ") && row.email.endsWith("@sandbox.example")), true);
  assert.equal(csv.toLowerCase().includes("kemptonsmile"), false);
  assert.equal(csv.toLowerCase().includes("pravoma"), false);
  const fixturePhones = digitRuns(csv);
  const productionPhones = digitRuns(production);
  for (const phone of fixturePhones) assert.equal(productionPhones.has(phone), false, phone);
  assert.equal(JSON.stringify(plan).includes('"status":"queued"'), false);

  const sendNow = planEastRandSandboxSeed({ intent: "send_now", sendingEnabled: false, source: "fixture", csv });
  assert.equal(sendNow.refused, true);
  assert.equal(sendNow.queued, 0);
  assert.equal(sendNow.sent, 0);
  assert.match(sendNow.message, /refused/);

  const goLive = planEastRandSandboxSeed({ intent: "go_live", sendingEnabled: false, source: "fixture", csv });
  assert.equal(goLive.refused, true);
  assert.equal(goLive.queued, 0);
});

test("East Rand seed copy does not phase the team or turn sending on", () => {
  const files = [
    "src/lib/campaigns/east-rand-seed.ts",
    "src/app/actions/east-rand-seed.ts",
    "src/components/campaigns/east-rand-seed-panel.tsx",
    "src/app/command-centre/campaigns/page.tsx",
    "docs/phase-5i-sandbox-readiness.md",
    "supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql",
    "data/campaigns/east-rand-sandbox.csv",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/ai-autotech-east-rand-prospects\.csv/.test(text), false, file);
    assert.equal(/graph\.facebook|oauth2\.googleapis|api\.whatsapp|api\.resend|clickatell\.com|bulksms\.com/i.test(text), false, file);
  }
  const sql = readFileSync(new URL("../../../supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql", import.meta.url), "utf8");
  assert.match(sql, /save_campaign_csv_import/);
  assert.match(sql, /refuse_campaign_csv_send/);
  assert.match(sql, new RegExp(EAST_RAND_SANDBOX_LABEL));
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.equal(/insert\s+into\s+public\.crm_outbox/i.test(sql), false);
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step29 = order.indexOf("29. `supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql`");
  const step30 = order.indexOf("30. `supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql`");
  assert.ok(step29 >= 0);
  assert.ok(step30 > step29);
});
