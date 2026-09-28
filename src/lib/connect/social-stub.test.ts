import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import {
  refuseSocialConnectSend,
  socialConnectDisplayMode,
  socialConnectMode,
  socialStubBadges,
  socialStubExplanation,
} from "@/lib/connect/social-stub";

test("TikTok and LinkedIn stubs stay fixture-only until TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED is true", () => {
  assert.equal(socialConnectMode({} as NodeJS.ProcessEnv), "fixture");
  assert.equal(socialConnectMode({ TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED: "" }), "fixture");
  assert.equal(socialConnectMode({ TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED: "false" }), "fixture");
  assert.equal(socialConnectMode({ TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED: "true" }), "sandbox");
  assert.equal(socialConnectDisplayMode({ tenantMode: "preview", env: { TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED: "true" } }), "fixture");
  assert.equal(socialConnectDisplayMode({ tenantMode: "member", env: { TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED: "true" } }), "sandbox");
});

test("TikTok and LinkedIn stubs use the three status badges and refuse send, test, and publish", () => {
  assert.deepEqual(socialStubBadges({ stubStored: false, providerKeysPresent: false }), ["not_connected"]);
  assert.deepEqual(socialStubBadges({ stubStored: true, providerKeysPresent: false }), ["sandbox_stub", "needs_provider_keys"]);
  assert.deepEqual(socialStubBadges({ stubStored: true, providerKeysPresent: true }), ["sandbox_stub"]);

  assert.match(socialStubExplanation("tiktok"), /Billy must add TikTok keys later/);
  assert.match(socialStubExplanation("tiktok"), /No OAuth/);
  assert.match(socialStubExplanation("tiktok"), /no ad is bought/);
  assert.match(socialStubExplanation("linkedin"), /Billy must add LinkedIn keys later/);
  assert.match(socialStubExplanation("linkedin"), /No OAuth/);

  for (const intent of ["send_test", "publish", "send"]) {
    const refused = refuseSocialConnectSend({ providerKeysPresent: false, intent });
    assert.equal(refused.refused, true);
    assert.equal(refused.queued, 0);
    assert.equal(refused.posted, 0);
    assert.match(refused.message, /Provider keys are missing/);
    assert.match(refused.message, /refused/);
    assert.match(refused.message, /Nothing was posted/);
  }

  const stillRefused = refuseSocialConnectSend({ providerKeysPresent: true, intent: "publish" });
  assert.equal(stillRefused.refused, true);
  assert.equal(stillRefused.queued, 0);
  assert.match(stillRefused.message, /does not call the provider/);
});

test("TikTok and LinkedIn stub copy does not phase the team or store a secret", () => {
  const files = [
    "src/lib/connect/social-stub.ts",
    "src/lib/connect/load.ts",
    "src/app/actions/social-stub.ts",
    "src/components/connect/social-stub-form.tsx",
    "src/components/connect/account-cards.tsx",
    "src/app/command-centre/connect-accounts/[account]/page.tsx",
    "docs/social-drafts.md",
    "docs/connect-import.md",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|api\.linkedin|tiktok\.com|oauth2\.googleapis|store_channel_secret/i.test(text), false, file);
  }
});
