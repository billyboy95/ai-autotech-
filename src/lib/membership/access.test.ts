import assert from "node:assert/strict";
import test from "node:test";
import { isPublicPath } from "@/lib/auth/gate";
import { isMarketingPath } from "@/lib/brand/host";
import { clientPlatformDecision, membershipGrantsPlatform } from "@/lib/membership/access";
import { MEMBERSHIP_PRICES_EXCLUDE_VAT, MEMBERSHIP_TIERS } from "@/lib/membership/tiers";

test("membership prices match the live site and exclude VAT", () => {
  assert.equal(MEMBERSHIP_PRICES_EXCLUDE_VAT, true);
  assert.equal(MEMBERSHIP_TIERS[0]?.code, "platform");
  assert.equal(MEMBERSHIP_TIERS[0]?.priceCents, 29_900);
  assert.equal(MEMBERSHIP_TIERS.find((tier) => tier.code === "agent_starter")?.priceCents, 69_900);
  assert.equal(MEMBERSHIP_TIERS.every((tier) => tier.priceCents >= 29_900), true);
});

test("only an active membership grants platform access, and a lapse blocks a client", () => {
  assert.equal(membershipGrantsPlatform("active"), true);
  assert.equal(membershipGrantsPlatform("pending"), false);
  assert.equal(membershipGrantsPlatform("past_due"), false);
  assert.equal(membershipGrantsPlatform("suspended"), false);
  assert.equal(membershipGrantsPlatform("cancelled"), false);
  assert.equal(membershipGrantsPlatform(null), false);

  assert.equal(clientPlatformDecision({ role: "agency_owner", status: "past_due" }).allowed, true);
  assert.equal(clientPlatformDecision({ role: "client_admin", status: null }).allowed, true);
  assert.equal(clientPlatformDecision({ role: "client_admin", status: "pending" }).allowed, true);
  assert.equal(clientPlatformDecision({ role: "client_user", status: "active" }).allowed, true);
  assert.equal(clientPlatformDecision({ role: "client_user", status: "past_due" }).allowed, false);
  assert.equal(clientPlatformDecision({ role: "client_admin", status: "cancelled" }).allowed, false);
  assert.equal(clientPlatformDecision({ role: "client_admin", status: "suspended" }).gated, true);
});

test("membership and quote pages are public", () => {
  assert.equal(isPublicPath("/membership"), true);
  assert.equal(isPublicPath("/quotes/abc"), true);
  assert.equal(isMarketingPath("/membership"), true);
});
