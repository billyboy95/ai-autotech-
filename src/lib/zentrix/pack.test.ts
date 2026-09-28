import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ZENTRIX_SLUG } from "@/lib/tenant/types";
import {
  ZENTRIX_ORG_ID,
  ZENTRIX_PACK_BUTTON,
  ZENTRIX_PACK_CONFIRM,
  ZENTRIX_STORE_STUBS,
  isZentrixOutboundIntent,
  refuseZentrixOutbound,
  showZentrixPack,
  zentrixPackCatalogue,
  zentrixPackConfirmationOk,
  zentrixPackDisplayMode,
  zentrixPackMode,
} from "@/lib/zentrix/pack";

test("zentrix pack button is agency-only and Zentrix settings only", () => {
  assert.equal(showZentrixPack({ surface: "agency", canManageAgency: true }), true);
  assert.equal(showZentrixPack({ surface: "agency", canManageAgency: false }), false);
  assert.equal(showZentrixPack({ surface: "settings", canManageAgency: true, slug: "zentrix" }), true);
  assert.equal(showZentrixPack({ surface: "settings", canManageAgency: true, slug: "eastc" }), false);
  assert.equal(showZentrixPack({ surface: "settings", canManageAgency: false, slug: "zentrix" }), false);
  assert.equal(ZENTRIX_PACK_BUTTON, "Apply Zentrix pack to Zentrix Online");
});

test("zentrix pack confirmation is an explicit yes", () => {
  assert.equal(zentrixPackConfirmationOk(ZENTRIX_PACK_CONFIRM), true);
  assert.equal(zentrixPackConfirmationOk("no"), false);
  assert.equal(zentrixPackConfirmationOk(null), false);
});

test("zentrix pack stays fixture-only until ZENTRIX_WORKSPACE_PACK_ENABLED is true", () => {
  assert.equal(zentrixPackMode({ ZENTRIX_WORKSPACE_PACK_ENABLED: "" } as NodeJS.ProcessEnv), "fixture");
  assert.equal(zentrixPackMode({ ZENTRIX_WORKSPACE_PACK_ENABLED: "false" } as NodeJS.ProcessEnv), "fixture");
  assert.equal(zentrixPackMode({ ZENTRIX_WORKSPACE_PACK_ENABLED: "true" } as NodeJS.ProcessEnv), "sandbox");
  assert.equal(zentrixPackDisplayMode({ tenantMode: "preview", env: { ZENTRIX_WORKSPACE_PACK_ENABLED: "true" } }), "fixture");
  assert.equal(zentrixPackDisplayMode({ tenantMode: "member", env: { ZENTRIX_WORKSPACE_PACK_ENABLED: "true" } }), "sandbox");
  assert.equal(zentrixPackDisplayMode({ tenantMode: "member", env: { ZENTRIX_WORKSPACE_PACK_ENABLED: "" } }), "fixture");
});

test("zentrix pack catalogue is three sandbox stubs with no secrets", () => {
  const pack = zentrixPackCatalogue();
  assert.equal(pack.orgId, ZENTRIX_ORG_ID);
  assert.equal(pack.slug, ZENTRIX_SLUG);
  assert.equal(pack.storeCount, 3);
  assert.deepEqual(pack.priority, ["pets", "kitchens"]);
  assert.deepEqual(pack.qa, ["auto"]);
  assert.deepEqual(pack.adTargets, ["pets", "kitchens"]);
  assert.equal(pack.sandbox, true);
  assert.equal(pack.charged, false);
  assert.equal(pack.secretStored, false);
  assert.equal(pack.providerKeysPresent, false);
  assert.equal(pack.sendingEnabled, false);
  assert.equal(pack.hasSecrets, false);
  assert.equal(ZENTRIX_STORE_STUBS[0].handle, "w1y2f0-rk");
  assert.equal(ZENTRIX_STORE_STUBS[0].storefrontUrl, "https://w1y2f0-rk.myshopify.com");
  assert.equal(ZENTRIX_STORE_STUBS[0].intendedPublicHost, "pets.zentrixonline.co.za");
  assert.equal(ZENTRIX_STORE_STUBS[1].handle, "desj1r-ic");
  assert.equal(ZENTRIX_STORE_STUBS[1].intendedPublicHost, "kitchens.zentrixonline.co.za");
  assert.equal(ZENTRIX_STORE_STUBS[2].handle, "80ce1e-p8");
  assert.equal(ZENTRIX_STORE_STUBS[2].storefrontUrl, "https://80ce1e-p8.myshopify.com");
  assert.equal(ZENTRIX_STORE_STUBS[2].intendedPublicHost, "");
  assert.equal(ZENTRIX_STORE_STUBS[2].adTarget, false);
});

test("publish, send, go live, and ad spend are refused", () => {
  for (const intent of ["publish", "send", "go_live", "post now", "ad spend", "buy ads"]) {
    assert.equal(isZentrixOutboundIntent(intent), true, intent);
    const refused = refuseZentrixOutbound(intent);
    assert.equal(refused.refused, true);
    assert.equal(refused.queued, 0);
    assert.equal(refused.posted, 0);
    assert.equal(refused.sent, 0);
    assert.equal(refused.charged, false);
    assert.equal(refused.published, false);
    assert.match(refused.message, /Billy must approve sends/);
    assert.match(refused.message, /Nothing was posted/);
  }
  assert.equal(isZentrixOutboundIntent("apply"), false);
});

test("zentrix pack copy does not turn sending on or call Shopify", () => {
  const files = [
    "src/lib/zentrix/pack.ts",
    "src/app/actions/zentrix-pack.ts",
    "src/components/apply-zentrix-pack-form.tsx",
    "docs/zentrix-workspace-pack.md",
    "supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/shpat_|adminAccessToken|client_secret|X-Shopify-Access-Token|admin\/api/i.test(text), false, file);
    assert.equal(/oauth2|pg_cron|cron\.schedule/i.test(text), false, file);
    assert.equal(/\bdelete\s+from\b/i.test(text), false, file);
  }
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step28 = order.indexOf("28. `supabase/migrations/20261103120000_phase5g_social_drafts.sql`");
  const step29 = order.indexOf("29. `supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql`");
  assert.ok(step28 >= 0);
  assert.ok(step29 > step28);
  assert.match(order, /steps 20 through 29/i);
});
