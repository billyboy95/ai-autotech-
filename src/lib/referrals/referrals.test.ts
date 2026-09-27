import assert from "node:assert/strict";
import test from "node:test";
import {
  REFERRAL_COOKIE,
  REFERRAL_MAX_AGE_SECONDS,
  canApproveReward,
  formatZar,
  isSelfReferral,
  readReferralCode,
  referralCodeFromCookieHeader,
  referralLink,
  rewardHoldUntil,
  shareLinks,
  shouldCreateReward,
  tierProgress,
} from "@/lib/referrals/codes";
import { referralQrSvg } from "@/lib/referrals/qr";

test("referral codes are short and the cookie lasts 60 days", () => {
  assert.equal(readReferralCode(" billy-42 "), "BILLY42");
  assert.equal(readReferralCode("ab"), null);
  assert.equal(readReferralCode("this-code-is-way-too-long"), null);
  assert.equal(REFERRAL_MAX_AGE_SECONDS, 60 * 24 * 60 * 60);
  assert.equal(referralCodeFromCookieHeader(`theme=light; ${REFERRAL_COOKIE}=eastc7`), "EASTC7");
  assert.equal(referralLink("EASTC7", "https://aiautotech.co.za"), "https://aiautotech.co.za/audit?ref=EASTC7");
});

test("share links open the visitor's own app", () => {
  const links = shareLinks("https://aiautotech.co.za/audit?ref=EASTC7", "Join me on AI AutoTech");
  assert.match(links.whatsapp, /^https:\/\/wa\.me\/\?text=/);
  assert.match(links.facebook, /^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?u=/);
  assert.match(links.x, /^https:\/\/twitter\.com\/intent\/tweet\?/);
  assert.match(links.linkedin, /^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=/);
  assert.match(links.email, /^mailto:\?subject=/);
  for (const href of Object.values(links)) {
    assert.equal(href.includes("/api/"), false);
  }
});

test("self-referral and unpaid signups do not create a reward", () => {
  assert.equal(isSelfReferral({
    codeUserId: "user-1",
    codeOrgId: "org-1",
    referredUserId: "user-1",
    referredOrgId: "org-2",
    codeOwnerIsMemberOfReferredOrg: false,
  }), true);
  assert.equal(isSelfReferral({
    codeUserId: null,
    codeOrgId: "org-1",
    referredUserId: "user-2",
    referredOrgId: "org-1",
    codeOwnerIsMemberOfReferredOrg: false,
  }), true);
  assert.equal(isSelfReferral({
    codeUserId: "user-1",
    codeOrgId: "org-1",
    referredUserId: "user-2",
    referredOrgId: "org-2",
    codeOwnerIsMemberOfReferredOrg: false,
    actorIsMemberOfCodeOrg: true,
  }), true);
  assert.equal(isSelfReferral({
    codeUserId: "user-1",
    codeOrgId: "org-1",
    referredUserId: "user-2",
    referredOrgId: "org-2",
    codeOwnerIsMemberOfReferredOrg: false,
  }), false);

  assert.equal(shouldCreateReward({
    paymentStatus: "COMPLETE",
    sandbox: true,
    priorCompleteCount: 0,
    hasSignupReferral: true,
    selfReferral: false,
  }), true);
  assert.equal(shouldCreateReward({
    paymentStatus: "COMPLETE",
    sandbox: true,
    priorCompleteCount: 0,
    hasSignupReferral: false,
    selfReferral: false,
  }), false);
  assert.equal(shouldCreateReward({
    paymentStatus: "FAILED",
    sandbox: true,
    priorCompleteCount: 0,
    hasSignupReferral: true,
    selfReferral: false,
  }), false);
  assert.equal(shouldCreateReward({
    paymentStatus: "COMPLETE",
    sandbox: false,
    priorCompleteCount: 0,
    hasSignupReferral: true,
    selfReferral: false,
  }), false);
  assert.equal(shouldCreateReward({
    paymentStatus: "COMPLETE",
    sandbox: true,
    priorCompleteCount: 1,
    hasSignupReferral: true,
    selfReferral: false,
  }), false);
});

test("a reward waits out the hold and shows placeholder rands", () => {
  const paid = new Date("2026-09-01T00:00:00.000Z");
  const hold = rewardHoldUntil(paid, 14);
  assert.equal(hold.toISOString(), "2026-09-15T00:00:00.000Z");
  assert.equal(canApproveReward(new Date("2026-09-14T00:00:00.000Z"), hold, "pending"), false);
  assert.equal(canApproveReward(hold, hold, "pending"), true);
  assert.equal(canApproveReward(hold, hold, "approved"), false);
  assert.equal(formatZar(50000), "R500.00");
  const progress = tierProgress([
    { name: "Starter", paidReferrals: 1, rewardType: "account_credit", amountCents: 50000 },
    { name: "Advocate", paidReferrals: 3, rewardType: "account_credit", amountCents: 75000 },
  ], 1);
  assert.equal(progress.current?.name, "Starter");
  assert.equal(progress.upcoming?.name, "Advocate");
});

test("the referral QR is an SVG of the public link", async () => {
  const svg = await referralQrSvg("https://aiautotech.co.za/audit?ref=EASTC7");
  assert.match(svg, /<svg/);
  assert.equal(svg.includes("<script"), false);
});
