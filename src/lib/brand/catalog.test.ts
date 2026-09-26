import assert from "node:assert/strict";
import test from "node:test";
import { AGENCY_WHATSAPP_E164, JOB_KINDS, OFFER_PACKAGES } from "./catalog";
import { packagePricingMessage, packageWhatsAppHref } from "./whatsapp";

test("deal types are the sourced services and packages, and older job labels still fit", () => {
  assert.equal(JOB_KINDS.includes("Professional Websites"), true);
  assert.equal(JOB_KINDS.includes("Funnel + Lead Generation System"), true);
  assert.equal(JOB_KINDS.includes("Website"), true);
  assert.equal(OFFER_PACKAGES.filter((item) => item.asksForPricing).length, 3);
});

test("package WhatsApp links use the sourced number and do not invent a price", () => {
  const href = packageWhatsAppHref("Starter Online Presence");
  assert.match(href, new RegExp(`wa.me/${AGENCY_WHATSAPP_E164}`));
  assert.match(decodeURIComponent(href), /share more details and pricing/);
  assert.equal(packagePricingMessage("Business Website System").includes("R"), false);
  assert.equal(packageWhatsAppHref("AI AutoTech Scale Upgrade"), `https://wa.me/${AGENCY_WHATSAPP_E164}`);
});
