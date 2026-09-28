import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import { metaConnectDisplayMode, metaConnectMode, metaStubBadges, refuseMetaTestSend } from "@/lib/connect/meta-stub";

test("Meta connect stub stays fixture-only until META_CONNECT_STUB_ENABLED is true", () => {
  assert.equal(metaConnectMode({} as NodeJS.ProcessEnv), "fixture");
  assert.equal(metaConnectMode({ META_CONNECT_STUB_ENABLED: "" }), "fixture");
  assert.equal(metaConnectMode({ META_CONNECT_STUB_ENABLED: "false" }), "fixture");
  assert.equal(metaConnectMode({ META_CONNECT_STUB_ENABLED: "true" }), "sandbox");
  assert.equal(metaConnectDisplayMode({ tenantMode: "preview", env: { META_CONNECT_STUB_ENABLED: "true" } }), "fixture");
  assert.equal(metaConnectDisplayMode({ tenantMode: "member", env: { META_CONNECT_STUB_ENABLED: "true" } }), "sandbox");
});

test("WhatsApp and Facebook stubs use the three status badges and refuse a test send", () => {
  assert.deepEqual(metaStubBadges({ stubStored: false, providerKeysPresent: false }), ["not_connected"]);
  assert.deepEqual(metaStubBadges({ stubStored: true, providerKeysPresent: false }), ["sandbox_stub", "needs_provider_keys"]);
  assert.deepEqual(metaStubBadges({ stubStored: true, providerKeysPresent: true }), ["sandbox_stub"]);

  const refused = refuseMetaTestSend({ providerKeysPresent: false });
  assert.equal(refused.refused, true);
  assert.equal(refused.queued, 0);
  assert.equal(refused.sent, 0);
  assert.match(refused.message, /Provider keys are missing/);
  assert.match(refused.message, /dry run only/);
  assert.match(refused.message, /Nothing was queued/);

  const stillRefused = refuseMetaTestSend({ providerKeysPresent: true });
  assert.equal(stillRefused.refused, true);
  assert.equal(stillRefused.queued, 0);
  assert.match(stillRefused.message, /does not call Meta/);
});

test("Meta stub copy does not phase the team or turn sending on", () => {
  const files = [
    "src/lib/connect/meta-stub.ts",
    "src/lib/connect/load.ts",
    "src/app/actions/meta-stub.ts",
    "src/components/connect/account-cards.tsx",
    "src/components/connect/meta-stub-form.tsx",
    "src/app/command-centre/connect-accounts/page.tsx",
    "src/app/command-centre/connect-accounts/[account]/page.tsx",
    "docs/connect-import.md",
    "docs/campaign-dry-run.md",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|oauth2\.googleapis|api\.whatsapp/i.test(text), false, file);
    assert.equal(/store_channel_secret/.test(text), false, file);
  }
});
