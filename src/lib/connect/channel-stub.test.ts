import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import {
  channelConnectDisplayMode,
  channelConnectMode,
  channelStubBadges,
  channelStubExplanation,
  refuseChannelTestSend,
} from "@/lib/connect/channel-stub";

test("email and SMS connect stubs stay fixture-only until EMAIL_SMS_CONNECT_STUB_ENABLED is true", () => {
  assert.equal(channelConnectMode({} as NodeJS.ProcessEnv), "fixture");
  assert.equal(channelConnectMode({ EMAIL_SMS_CONNECT_STUB_ENABLED: "" }), "fixture");
  assert.equal(channelConnectMode({ EMAIL_SMS_CONNECT_STUB_ENABLED: "false" }), "fixture");
  assert.equal(channelConnectMode({ EMAIL_SMS_CONNECT_STUB_ENABLED: "true" }), "sandbox");
  assert.equal(channelConnectDisplayMode({ tenantMode: "preview", env: { EMAIL_SMS_CONNECT_STUB_ENABLED: "true" } }), "fixture");
  assert.equal(channelConnectDisplayMode({ tenantMode: "member", env: { EMAIL_SMS_CONNECT_STUB_ENABLED: "true" } }), "sandbox");
});

test("email and SMS stubs use the three status badges and refuse a test send", () => {
  assert.deepEqual(channelStubBadges({ stubStored: false, providerKeysPresent: false }), ["not_connected"]);
  assert.deepEqual(channelStubBadges({ stubStored: true, providerKeysPresent: false }), ["sandbox_stub", "needs_provider_keys"]);
  assert.deepEqual(channelStubBadges({ stubStored: true, providerKeysPresent: true }), ["sandbox_stub"]);

  assert.match(channelStubExplanation("gmail"), /Resend or SMTP/);
  assert.match(channelStubExplanation("gmail"), /No OAuth/);
  assert.match(channelStubExplanation("sms"), /SMSPortal/);
  assert.match(channelStubExplanation("sms"), /BulkSMS/);
  assert.match(channelStubExplanation("sms"), /Clickatell/);
  assert.match(channelStubExplanation("sms"), /placeholders/);

  const refused = refuseChannelTestSend({ providerKeysPresent: false });
  assert.equal(refused.refused, true);
  assert.equal(refused.queued, 0);
  assert.equal(refused.sent, 0);
  assert.match(refused.message, /Provider keys are missing/);
  assert.match(refused.message, /dry run only/);
  assert.match(refused.message, /Nothing was queued/);

  const stillRefused = refuseChannelTestSend({ providerKeysPresent: true });
  assert.equal(stillRefused.refused, true);
  assert.equal(stillRefused.queued, 0);
  assert.match(stillRefused.message, /does not call the provider/);
});

test("email and SMS stub copy does not phase the team or turn sending on", () => {
  const files = [
    "src/lib/connect/channel-stub.ts",
    "src/lib/connect/load.ts",
    "src/app/actions/channel-stub.ts",
    "src/components/connect/account-cards.tsx",
    "src/components/connect/channel-stub-form.tsx",
    "src/app/command-centre/connect-accounts/page.tsx",
    "src/app/command-centre/connect-accounts/[account]/page.tsx",
    "docs/connect-import.md",
    "docs/campaign-csv-import.md",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|oauth2\.googleapis|api\.whatsapp|api\.resend|clickatell\.com|bulksms\.com/i.test(text), false, file);
    assert.equal(/store_channel_secret/.test(text), false, file);
  }
});
