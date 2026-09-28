import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import {
  FIXTURE_CAMPAIGN_CSV,
  blockedReasonCount,
  planCampaignCsvImport,
} from "@/lib/campaigns/csv-import";
import { campaignCsvImportDisplayMode, campaignCsvImportMode } from "@/lib/campaigns/flag";

const box = [
  "name,business,niche,website,phone,email,opening line,consent_basis",
  "Amina,Amina Co,clinic,https://amina.example,0820000002,amina@example.co.za,Hello,existing_customer",
  "Chris,Chris Co,clinic,https://chris.example,0820000003,chris@example.co.za,Hello,yes",
  "Blank,Blank Co,clinic,https://blank.example,0820000004,blank@example.co.za,Hello,",
].join("\n");

test("campaign CSV import stays fixture-only until CAMPAIGN_CSV_IMPORT_ENABLED is true", () => {
  assert.equal(campaignCsvImportMode({} as NodeJS.ProcessEnv), "fixture");
  assert.equal(campaignCsvImportMode({ CAMPAIGN_CSV_IMPORT_ENABLED: "" }), "fixture");
  assert.equal(campaignCsvImportMode({ CAMPAIGN_CSV_IMPORT_ENABLED: "false" }), "fixture");
  assert.equal(campaignCsvImportMode({ CAMPAIGN_CSV_IMPORT_ENABLED: "true" }), "sandbox");
  assert.equal(campaignCsvImportDisplayMode({ tenantMode: "preview", env: { CAMPAIGN_CSV_IMPORT_ENABLED: "true" } }), "fixture");
  assert.equal(campaignCsvImportDisplayMode({ tenantMode: "member", env: { CAMPAIGN_CSV_IMPORT_ENABLED: "true" } }), "sandbox");
});

test("fixture CSV dry-load counts imported and skipped and blocks POPIA and STOP", () => {
  const plan = planCampaignCsvImport({
    csv: FIXTURE_CAMPAIGN_CSV,
    intent: "dry_load",
    sendingEnabled: false,
    source: "fixture",
  });
  assert.equal(plan.error, "");
  assert.equal(plan.refused, false);
  assert.equal(plan.imported, 4);
  assert.equal(plan.skippedMissingConsent, 1);
  assert.equal(plan.queued, 0);
  assert.equal(plan.sent, 0);
  assert.equal(plan.charged, false);
  assert.equal(plan.report?.wouldReceive, 2);
  assert.equal(plan.report?.blocked, 3);
  assert.equal(plan.report?.breakdown.missing, 1);
  assert.equal(plan.report?.breakdown.stop, 1);
  assert.equal(plan.report?.breakdown.opted_out, 1);
  assert.equal(plan.report?.estimatedCostCents, 67);
  assert.equal(blockedReasonCount(plan.report!, "POPIA"), 1);
  assert.equal(blockedReasonCount(plan.report!, "STOP"), 1);
  assert.equal(plan.report?.lines.find((line) => line.name === "Thabo Ndlovu")?.reason, "POPIA");
  assert.equal(plan.report?.lines.find((line) => line.name === "Pieter Venter")?.reason, "STOP");
  assert.equal(plan.report?.lines.find((line) => line.name === "Nomsa Dlamini")?.reason, "consent");
  assert.equal(plan.report?.lines.find((line) => line.name === "Johan Botha")?.channel, "email");
  assert.equal(plan.rows.find((row) => row.name === "Thabo Ndlovu")?.imported, false);
  assert.equal(plan.rows.find((row) => row.name === "Pieter Venter")?.imported, true);
  assert.equal(JSON.stringify(plan).includes('"status":"queued"'), false);
  assert.equal(JSON.stringify(plan).includes('"status":"sent"'), false);
});

test("box CSV requires consent_basis and maps phase 2b aliases without queueing", () => {
  const plan = planCampaignCsvImport({
    csv: box,
    campaignName: "Sandbox prospect draft",
    intent: "dry_load",
    sendingEnabled: false,
    source: "sandbox",
  });
  assert.equal(plan.error, "");
  assert.equal(plan.imported, 2);
  assert.equal(plan.skippedMissingConsent, 1);
  assert.equal(plan.queued, 0);
  assert.equal(plan.rows.find((row) => row.name === "Chris")?.consentBasis, "consent");
  assert.equal(plan.rows.find((row) => row.name === "Amina")?.consentBasis, "existing_customer");
  assert.equal(plan.rows.some((row) => "send" in row), false);

  const missing = planCampaignCsvImport({
    csv: "name,business,niche,website,phone,email,opening line\nA,B,C,https://a.example,1,a@example.com,Hi\n",
    sendingEnabled: false,
    source: "fixture",
  });
  assert.match(missing.error, /consent_basis/);
  assert.equal(missing.imported, 0);
  assert.equal(missing.queued, 0);
});

test("a send column and send now are refused and nothing is queued", () => {
  const flagged = [
    "name,business,niche,website,phone,email,opening line,consent_basis,send",
    "Ada,Ada Co,clinic,https://ada.example,0820000001,ada@example.co.za,Hello,consent,true",
  ].join("\n");
  const refused = planCampaignCsvImport({
    csv: flagged,
    intent: "dry_load",
    sendingEnabled: false,
    source: "fixture",
  });
  assert.equal(refused.refused, true);
  assert.equal(refused.imported, 0);
  assert.equal(refused.queued, 0);
  assert.match(refused.message, /Nothing was queued/);

  const sendNow = planCampaignCsvImport({
    csv: FIXTURE_CAMPAIGN_CSV,
    intent: "send_now",
    sendingEnabled: false,
    source: "fixture",
  });
  assert.equal(sendNow.refused, true);
  assert.equal(sendNow.queued, 0);
  assert.equal(sendNow.sent, 0);
  assert.equal(sendNow.report, null);
  assert.match(sendNow.message, /Sending stays off/);
  assert.match(sendNow.message, /refused/);

  const goLive = planCampaignCsvImport({
    csv: FIXTURE_CAMPAIGN_CSV,
    intent: "go live",
    sendingEnabled: false,
    source: "fixture",
  });
  assert.equal(goLive.refused, true);
  assert.equal(goLive.queued, 0);

  const stillOff = planCampaignCsvImport({
    csv: FIXTURE_CAMPAIGN_CSV,
    intent: "send_now",
    sendingEnabled: true,
    source: "fixture",
  });
  assert.equal(stillOff.refused, true);
  assert.equal(stillOff.queued, 0);
  assert.match(stillOff.message, /does not send/);
});

test("campaign CSV copy does not phase the team or turn sending on", () => {
  const files = [
    "src/lib/campaigns/csv-import.ts",
    "src/lib/campaigns/flag.ts",
    "src/app/actions/campaign-csv-import.ts",
    "src/components/campaigns/csv-import-panel.tsx",
    "src/app/command-centre/campaigns/page.tsx",
    "docs/campaign-csv-import.md",
    "supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|oauth2\.googleapis|api\.whatsapp|api\.resend|clickatell\.com|bulksms\.com/i.test(text), false, file);
  }
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step26 = order.indexOf("26. `supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql`");
  const step27 = order.indexOf("27. `supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql`");
  assert.ok(step26 >= 0);
  assert.ok(step27 > step26);
});
