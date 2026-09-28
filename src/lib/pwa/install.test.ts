import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextResponse } from "next/server";
import { decideAccess, requiresSession } from "@/lib/auth/gate";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import {
  FIXTURE_INSTALL_COPY,
  INSTALL_PLATFORMS,
  STORE_LISTING_COPY,
  installEventAccepted,
  planInstallIntent,
  pwaInstallDisplayMode,
  pwaInstallMode,
} from "@/lib/pwa/install";
import { PWA_APP_NAME, PWA_START_URL, PWA_THEME_COLOR, aiosWebManifest } from "@/lib/pwa/manifest";

test("the web manifest names AIOS and does not point at a store", () => {
  const manifest = aiosWebManifest();
  assert.equal(manifest.name, PWA_APP_NAME);
  assert.equal(manifest.short_name, "AIOS");
  assert.equal(manifest.start_url, PWA_START_URL);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, PWA_THEME_COLOR);
  assert.equal(manifest.prefer_related_applications, false);
  assert.equal(manifest.related_applications, undefined);
  assert.match(manifest.description ?? "", /No store listing is live/);
  const icons = manifest.icons ?? [];
  assert.ok(icons.some((icon) => icon.src === "/icons/aios-192.png" && icon.sizes === "192x192"));
  assert.ok(icons.some((icon) => icon.src === "/icons/aios-512.png" && icon.sizes === "512x512"));
  assert.ok(icons.some((icon) => icon.purpose === "maskable"));
  for (const file of ["public/icons/aios-192.png", "public/icons/aios-512.png", "public/icons/aios-maskable-512.png", "public/icons/apple-touch-icon.png", "public/icons/aios.svg"]) {
    const bytes = readFileSync(new URL(`../../../${file}`, import.meta.url));
    if (file.endsWith(".png")) {
      assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", file);
      assert.ok(bytes.readUInt32BE(16) >= 180, file);
      assert.ok(bytes.readUInt32BE(20) >= 180, file);
    } else {
      assert.match(bytes.toString("utf8"), /#0B1F3A/);
    }
  }
  const route = readFileSync(new URL("../../app/manifest.ts", import.meta.url), "utf8");
  assert.match(route, /aiosWebManifest/);
  const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /themeColor/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /mobile-web-app-capable/);
  assert.match(layout, /apple-mobile-web-app-capable/);
});

test("an unauthenticated install route redirects to login", () => {
  assert.equal(requiresSession("/command-centre/install"), true);
  const decision = decideAccess({ pathname: "/command-centre/install", search: "", authRequired: true, userId: null });
  assert.deepEqual(decision, { type: "redirect", pathname: "/login", next: "/command-centre/install" });
  assert.equal(decideAccess({ pathname: "/command-centre/install", authRequired: true, userId: "user-1" }).type, "continue");
  assert.equal(decideAccess({ pathname: "/command-centre/install", authRequired: false, userId: null }).type, "continue");
  const response = NextResponse.redirect("http://localhost/login?next=%2Fcommand-centre%2Finstall");
  assert.equal(response.status, 307);
  const middleware = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /\/command-centre\/:path\*/);
  assert.match(middleware, /NextResponse\.redirect\(url\)/);
});

test("PWA_INSTALL_SHELL_ENABLED off is fixture only and writes nothing", () => {
  for (const value of [undefined, "", "false", "0", "yes", "TRUEE"]) {
    const env = { PWA_INSTALL_SHELL_ENABLED: value } as NodeJS.ProcessEnv;
    assert.equal(pwaInstallMode(env), "fixture", String(value));
    const plan = planInstallIntent({ env, tenantMode: "member", platform: "ios" });
    assert.equal(plan.write, false);
    assert.equal(plan.mode, "fixture");
    assert.equal(plan.message, FIXTURE_INSTALL_COPY);
  }
  assert.equal(pwaInstallMode({ PWA_INSTALL_SHELL_ENABLED: " true " }), "sandbox");
  assert.equal(pwaInstallDisplayMode({ tenantMode: "preview", env: { PWA_INSTALL_SHELL_ENABLED: "true" } }), "fixture");
  assert.equal(planInstallIntent({ env: { PWA_INSTALL_SHELL_ENABLED: "true" }, tenantMode: "preview", platform: "android" }).write, false);
  const ready = planInstallIntent({ env: { PWA_INSTALL_SHELL_ENABLED: "true" }, tenantMode: "member", platform: "windows" });
  assert.equal(ready.write, true);
  assert.equal(ready.platform, "windows");
  assert.equal(planInstallIntent({ env: { PWA_INSTALL_SHELL_ENABLED: "true" }, tenantMode: "member", platform: "play" }).write, false);
  assert.equal(installEventAccepted({ stored: true, sandbox: true, charged: false, intent: "install_intent", surface: "browser", sending_enabled: false }), true);
  assert.equal(installEventAccepted({ stored: true, sandbox: true, charged: false, intent: "install_intent", surface: "browser", sending_enabled: true }), false);
});

test("install copy names the browser steps and does not spend or send", () => {
  const files = [
    "src/lib/pwa/install.ts",
    "src/lib/pwa/manifest.ts",
    "src/app/actions/pwa-install.ts",
    "src/app/command-centre/install/page.tsx",
    "src/components/pwa/install-card.tsx",
    "src/components/pwa/install-form.tsx",
    "docs/phase-5j-pwa-mobile-shell.md",
    "mobile/README.md",
    "mobile/capacitor.config.json",
    "mobile/pwabuilder.json",
    "supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/AI_REPLY_CRON_ENABLED\s*=\s*['"]?true/i.test(text), false, file);
    assert.equal(/play\.google|itunes\.apple|apps\.microsoft|analytics\.google|graph\.facebook/i.test(text), false, file);
    assert.equal(/\bdelete from\b/i.test(text), false, file);
  }
  const page = readFileSync(new URL("../../app/command-centre/install/page.tsx", import.meta.url), "utf8");
  assert.match(page, /FIXTURE_INSTALL_COPY/);
  assert.match(page, /STORE_LISTING_COPY/);
  assert.match(page, /INSTALL_PLATFORMS/);
  assert.match(STORE_LISTING_COPY, /No store listing is live/);
  assert.match(INSTALL_PLATFORMS.map((platform) => `${platform.label} ${platform.steps}`).join("\n"), /iOS Safari/);
  assert.match(INSTALL_PLATFORMS[0].steps, /Add to Home Screen/);
  assert.match(INSTALL_PLATFORMS[1].label, /Android Chrome/);
  assert.match(INSTALL_PLATFORMS[1].steps, /Add to Home screen/);
  assert.match(INSTALL_PLATFORMS[2].label, /Windows/);
  assert.match(INSTALL_PLATFORMS[2].steps, /PWA/);
  const action = readFileSync(new URL("../../app/actions/pwa-install.ts", import.meta.url), "utf8");
  const guard = action.indexOf("if (!plan.write");
  const rpc = action.indexOf("record_install_intent");
  assert.ok(guard >= 0 && rpc > guard);
  const shell = JSON.parse(readFileSync(new URL("../../../mobile/pwabuilder.json", import.meta.url), "utf8")) as {
    name: string;
    startUrl: string;
    packageId: string;
    stores: { googlePlay: string };
  };
  assert.equal(shell.name, PWA_APP_NAME);
  assert.equal(shell.startUrl, PWA_START_URL);
  assert.equal(shell.packageId, "za.co.aiautotech.aios");
  assert.equal(shell.stores.googlePlay, "not-submitted");
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const step30 = order.indexOf("30. `supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql`");
  const step31 = order.indexOf("31. `supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql`");
  assert.ok(step30 >= 0);
  assert.ok(step31 > step30);
  assert.match(order, /Steps 20 through 29 are still unapplied/);
  assert.match(order, /Step 30 is also unapplied/);
  assert.match(order, /Step 31 is also unapplied/);
});
