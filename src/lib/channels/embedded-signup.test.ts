import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PHASED_TEAM_COPY } from "@/lib/bots/onboarding";
import { WhatsAppEmbeddedSignupSlot } from "@/components/connect/whatsapp-embedded-signup-slot";
import {
  EMBEDDED_SIGNUP_BLOCKED,
  EMBEDDED_SIGNUP_HEADING,
  EMBEDDED_SIGNUP_OFFICIAL_ONLY,
  EMBEDDED_SIGNUP_PREVIEW,
  previewEmbeddedSignupClick,
} from "@/lib/channels/embedded-signup";
import { embeddedSignupPanel, publicMetaAppId, whatsappEmbeddedSignupEnabled } from "@/lib/channels/embedded-signup-gate";

const APP_ID = "123456789012345";
const SECRET_LOOKING = "EAAG-should-not-render";

function renderSlot(env: NodeJS.ProcessEnv, surface: "settings" | "whatsapp" = "whatsapp") {
  return renderToStaticMarkup(createElement(WhatsAppEmbeddedSignupSlot, { surface, env }));
}

test("Embedded Signup stays hidden unless the flag is the exact string true", () => {
  for (const value of [undefined, "", "false", "TRUE", "True", " true", "true ", "yes", "1"]) {
    const env = { WHATSAPP_EMBEDDED_SIGNUP_ENABLED: value, NEXT_PUBLIC_META_APP_ID: APP_ID } as NodeJS.ProcessEnv;
    assert.equal(whatsappEmbeddedSignupEnabled(env), false, String(value));
    assert.equal(publicMetaAppId(env), null, String(value));
    assert.deepEqual(embeddedSignupPanel(env), { visible: false });
    assert.equal(renderSlot(env), "");
    assert.equal(renderSlot(env, "settings"), "");
  }
  assert.equal(whatsappEmbeddedSignupEnabled({ WHATSAPP_EMBEDDED_SIGNUP_ENABLED: "true" }), true);
});

test("flag on without a public Meta app id shows the blocked empty state", () => {
  const env = {
    WHATSAPP_EMBEDDED_SIGNUP_ENABLED: "true",
    META_APP_SECRET: SECRET_LOOKING,
    WHATSAPP_TOKEN: SECRET_LOOKING,
    META_APP_ID: "not-an-app-id",
  } as NodeJS.ProcessEnv;
  const panel = embeddedSignupPanel(env);
  assert.equal(panel.visible, true);
  if (!panel.visible) return;
  assert.equal(panel.ready, false);
  assert.equal(panel.blockedMessage, EMBEDDED_SIGNUP_BLOCKED);
  assert.equal(publicMetaAppId(env), null);
  const html = renderSlot(env, "settings");
  assert.match(html, new RegExp(EMBEDDED_SIGNUP_HEADING));
  assert.match(html, /needs Meta Tech Provider \/ Billy keys/);
  assert.match(html, /Official API only/);
  assert.match(html, /WhatsApp Business app stays on the same number/);
  assert.match(html, /Meta Business portfolio/);
  assert.match(html, /Tech Provider/);
  assert.match(html, /Coexistence/);
  assert.match(html, /Webhook later/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Open the WhatsApp connect page/);
  assert.equal(html.includes(SECRET_LOOKING), false);
  assert.equal(html.includes("whatsapp-embedded-signup-scaffold"), false);
  assert.equal(html.includes("graph.facebook"), false);

  const refused = previewEmbeddedSignupClick({ ready: false });
  assert.equal(refused.connected, false);
  assert.equal(refused.sendingEnabled, false);
  assert.equal(refused.oauthStarted, false);
  assert.equal(refused.providerCalls, 0);
  assert.equal(refused.launched, false);
  assert.equal(refused.message, EMBEDDED_SIGNUP_BLOCKED);
});

test("flag on with a public app id renders scaffolding and does not connect or send", () => {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    throw new Error("provider fetch should not run");
  }) as typeof fetch;
  try {
    const env = {
      WHATSAPP_EMBEDDED_SIGNUP_ENABLED: "true",
      META_APP_ID: APP_ID,
      META_APP_SECRET: SECRET_LOOKING,
    } as NodeJS.ProcessEnv;
    assert.equal(publicMetaAppId(env), APP_ID);
    const panel = embeddedSignupPanel(env);
    assert.equal(panel.visible, true);
    if (!panel.visible) return;
    assert.equal(panel.ready, true);
    assert.equal(panel.blockedMessage, null);
    assert.equal(panel.scaffold.launch, false);
    assert.equal(panel.scaffold.setsSendingEnabled, false);
    assert.equal(panel.scaffold.marksConnected, false);
    assert.equal(JSON.stringify(panel).includes(APP_ID), false);
    assert.equal(JSON.stringify(panel).includes(SECRET_LOOKING), false);

    const html = renderSlot(env);
    assert.match(html, /data-testid="whatsapp-embedded-signup"/);
    assert.match(html, new RegExp(EMBEDDED_SIGNUP_OFFICIAL_ONLY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /data-launch="false"/);
    assert.match(html, /whatsapp_business_app_onboarding/);
    assert.match(html, /connect\.facebook\.net/);
    assert.match(html, /"launch":false/);
    assert.doesNotMatch(html, /disabled=""/);
    assert.match(html, new RegExp(EMBEDDED_SIGNUP_PREVIEW.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(html.includes(APP_ID), false);
    assert.equal(html.includes(SECRET_LOOKING), false);
    assert.equal(html.includes("graph.facebook"), false);
    assert.match(html, /The sandbox stub on this page is unchanged/);

    const preview = previewEmbeddedSignupClick({ ready: true });
    assert.equal(preview.connected, false);
    assert.equal(preview.sendingEnabled, false);
    assert.equal(preview.oauthStarted, false);
    assert.equal(preview.providerCalls, 0);
    assert.equal(preview.launched, false);
    assert.equal(preview.message, EMBEDDED_SIGNUP_PREVIEW);
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = original;
  }
});

test("NEXT_PUBLIC_META_APP_ID wins over META_APP_ID and neither is rendered", () => {
  const env = {
    WHATSAPP_EMBEDDED_SIGNUP_ENABLED: "true",
    NEXT_PUBLIC_META_APP_ID: "222222222222222",
    META_APP_ID: APP_ID,
  } as NodeJS.ProcessEnv;
  assert.equal(publicMetaAppId(env), "222222222222222");
  const html = renderSlot(env, "settings");
  assert.equal(html.includes("222222222222222"), false);
  assert.equal(html.includes(APP_ID), false);
  assert.match(html, /A public Meta app id is present/);
});

test("Embedded Signup files do not call a provider or turn sending on", () => {
  const files = [
    "src/lib/channels/embedded-signup.ts",
    "src/lib/channels/embedded-signup-gate.ts",
    "src/components/connect/whatsapp-embedded-signup.tsx",
    "src/components/connect/whatsapp-embedded-signup-slot.tsx",
    "src/app/command-centre/settings/page.tsx",
    "src/app/command-centre/connect-accounts/[account]/page.tsx",
    "docs/phone-whatsapp-embedded-signup.md",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
    assert.equal(/sending_enabled\s*=\s*true/i.test(text), false, file);
    assert.equal(/graph\.facebook|oauth2\.googleapis|api\.whatsapp/i.test(text), false, file);
    assert.equal(/store_channel_secret/.test(text), false, file);
    assert.equal(/from ["']@\/lib\/automation\/send["']/.test(text), false, file);
    assert.equal(/\bfetch\s*\(/.test(text), false, file);
  }

  const client = readFileSync(new URL("../../../src/components/connect/whatsapp-embedded-signup.tsx", import.meta.url), "utf8");
  const shared = readFileSync(new URL("../../../src/lib/channels/embedded-signup.ts", import.meta.url), "utf8");
  assert.equal(client.includes("NEXT_PUBLIC_META_APP_ID"), false);
  assert.equal(client.includes("META_APP_SECRET"), false);
  assert.equal(shared.includes("NEXT_PUBLIC_META_APP_ID"), false);
  assert.equal(shared.includes("process.env"), false);
  const slot = readFileSync(new URL("../../../src/components/connect/whatsapp-embedded-signup-slot.tsx", import.meta.url), "utf8");
  assert.match(slot, /embedded-signup-gate/);
  assert.doesNotMatch(slot, /from ["']@\/lib\/channels\/embedded-signup["']/);
});
