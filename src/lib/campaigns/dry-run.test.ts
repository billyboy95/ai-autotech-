import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCampaignDryRun,
  fixtureRecipients,
  formatDryRunZar,
  isLiveSendIntent,
  planCampaignAction,
  recipientsFromImport,
} from "@/lib/campaigns/dry-run";
import { campaignDryRunDisplayMode, campaignDryRunMode } from "@/lib/campaigns/flag";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";

test("campaign dry run stays fixture-only until CAMPAIGN_DRY_RUN_ENABLED is true", () => {
  assert.equal(campaignDryRunMode({} as NodeJS.ProcessEnv), "fixture");
  assert.equal(campaignDryRunMode({ CAMPAIGN_DRY_RUN_ENABLED: "" }), "fixture");
  assert.equal(campaignDryRunMode({ CAMPAIGN_DRY_RUN_ENABLED: "false" }), "fixture");
  assert.equal(campaignDryRunMode({ CAMPAIGN_DRY_RUN_ENABLED: "true" }), "sandbox");
  assert.equal(campaignDryRunDisplayMode({ tenantMode: "preview", env: { CAMPAIGN_DRY_RUN_ENABLED: "true" } }), "fixture");
  assert.equal(campaignDryRunDisplayMode({ tenantMode: "member", env: { CAMPAIGN_DRY_RUN_ENABLED: "true" } }), "sandbox");
  assert.equal(campaignDryRunDisplayMode({ tenantMode: "member", env: {} }), "fixture");
});

test("dry run counts consent, blocks POPIA consent and STOP, and does not queue", () => {
  const report = buildCampaignDryRun({
    campaignName: "Sandbox prospect draft",
    source: "fixture",
    recipients: fixtureRecipients(),
  });
  assert.equal(report.recipientCount, 5);
  assert.equal(report.wouldReceive, 2);
  assert.equal(report.blocked, 3);
  assert.deepEqual(report.breakdown, {
    consent: 1,
    existing_customer: 1,
    missing: 1,
    opted_out: 1,
    stop: 1,
  });
  assert.equal(report.estimatedCostCents, 67);
  assert.equal(formatDryRunZar(report.estimatedCostCents), "R 0.67");
  assert.equal(report.charged, false);
  assert.equal(report.queued, 0);
  assert.equal(report.sent, 0);
  assert.equal(report.lines.find((line) => line.name === "Ayesha Patel")?.outcome, "would_receive");
  assert.equal(report.lines.find((line) => line.name === "Thabo Ndlovu")?.reason, "POPIA");
  assert.equal(report.lines.find((line) => line.name === "Nomsa Dlamini")?.reason, "consent");
  assert.equal(report.lines.find((line) => line.name === "Pieter Venter")?.reason, "STOP");
  assert.equal(JSON.stringify(report).includes('"status":"queued"'), false);
  assert.equal(JSON.stringify(report).includes('"status":"sent"'), false);

  const suppressed = buildCampaignDryRun({
    campaignName: "Sandbox",
    source: "sandbox",
    recipients: [{ name: "Ada", channel: "sms", consentBasis: "consent", stopped: false, suppressed: true }],
  });
  assert.equal(suppressed.lines[0]?.reason, "consent");
  assert.equal(suppressed.estimatedCostCents, 0);
  assert.equal(suppressed.queued, 0);
});

test("send now and go live are refused while sending is off", () => {
  assert.equal(isLiveSendIntent("send_now"), true);
  assert.equal(isLiveSendIntent("go_live"), true);
  assert.equal(isLiveSendIntent("dry_run"), false);

  const send = planCampaignAction({
    intent: "send_now",
    sendingEnabled: false,
    campaignName: "Sandbox prospect draft",
    source: "fixture",
    recipients: fixtureRecipients(),
  });
  assert.equal(send.refused, true);
  assert.equal(send.queued, 0);
  assert.equal(send.sent, 0);
  assert.equal(send.report, null);
  assert.match(send.message, /Sending stays off/);
  assert.match(send.message, /refused/);
  assert.match(send.message, /Nothing was queued/);

  const live = planCampaignAction({
    intent: "go live",
    sendingEnabled: false,
    campaignName: "Sandbox prospect draft",
    source: "fixture",
    recipients: fixtureRecipients(),
  });
  assert.equal(live.refused, true);
  assert.equal(live.queued, 0);

  const stillOff = planCampaignAction({
    intent: "send_now",
    sendingEnabled: true,
    campaignName: "Sandbox prospect draft",
    source: "fixture",
    recipients: fixtureRecipients(),
  });
  assert.equal(stillOff.refused, true);
  assert.equal(stillOff.queued, 0);
  assert.match(stillOff.message, /does not send/);

  const dry = planCampaignAction({
    intent: "dry_run",
    sendingEnabled: false,
    campaignName: "Sandbox prospect draft",
    source: "fixture",
    recipients: fixtureRecipients(),
  });
  assert.equal(dry.refused, false);
  assert.equal(dry.queued, 0);
  assert.equal(dry.report?.wouldReceive, 2);
});

test("imported sandbox rows keep consent_basis and do not carry a send flag", () => {
  const rows = recipientsFromImport([
    { name: "Ada Lovelace", phone: "0825550101", email: "ada@example.com", consent_basis: "consent" },
    { name: "No Phone", email: "ada@example.com", consent_basis: "existing_customer" },
  ]);
  assert.equal(rows[0]?.channel, "whatsapp");
  assert.equal(rows[1]?.channel, "email");
  assert.equal(rows[0]?.consentBasis, "consent");
  assert.equal(JSON.stringify(rows).includes('"send"'), false);
});

test("campaign dry-run copy does not phase the team or turn sending on", () => {
  const files = [
    "src/lib/campaigns/flag.ts",
    "src/lib/campaigns/dry-run.ts",
    "src/lib/campaigns/load.ts",
    "src/app/actions/campaign-dry-run.ts",
    "src/components/campaigns/dry-run-panel.tsx",
    "src/app/command-centre/campaigns/page.tsx",
    "docs/campaign-dry-run.md",
    "supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|oauth2\.googleapis|api\.whatsapp/i.test(text), false, file);
  }
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step25 = order.indexOf("25. `supabase/migrations/20261031120000_phase5d_home_chat.sql`");
  const step26 = order.indexOf("26. `supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql`");
  assert.ok(step25 >= 0);
  assert.ok(step26 > step25);
});
