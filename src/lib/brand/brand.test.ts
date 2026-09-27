import assert from "node:assert/strict";
import test from "node:test";
import { brandedEmailFrom, brandedSubject } from "@/lib/brand/email-from";
import { brandHostFrom, brandRedirectPath, isMarketingPath, stubPath } from "@/lib/brand/host";
import { loginCopy, mentionsPlatform, presentBrand } from "@/lib/brand/present";
import { previewWorkspaces } from "@/lib/tenant/blueprints";

test("platform hosts do not steal a branded cookie, and marketing paths leave the client domain", () => {
  assert.equal(isMarketingPath("/"), true);
  assert.equal(brandRedirectPath("/"), "/login");
  assert.equal(brandRedirectPath("/agency/eastc/settings"), "/command-centre");
  assert.equal(brandRedirectPath("/command-centre"), null);
  assert.equal(brandHostFrom({ host: "crm.eastc.test" }), "crm.eastc.test");
  assert.equal(brandHostFrom({ forwardedHost: "aiautotech.co.za", cookie: "crm.eastc.test" }), "crm.eastc.test");
  assert.deepEqual(stubPath("/d/crm.zentrix.test/command-centre"), { host: "crm.zentrix.test", pathname: "/command-centre" });
  assert.equal(stubPath("/login"), null);
});

test("agency branding can still show the platform name", () => {
  const [agency] = previewWorkspaces();
  const brand = presentBrand(agency);
  assert.equal(brand.showPlatformName, true);
  assert.equal(loginCopy(null).showPlatform, true);
  assert.equal(mentionsPlatform(loginCopy(brand).body), true);
  assert.match(brandedEmailFrom({ address: "billy@aiautotech.co.za" }), /AI AutoTech/);
  assert.equal(brandedSubject({ showPlatformName: false, senderName: "EASTC" }), "EASTC");
});
