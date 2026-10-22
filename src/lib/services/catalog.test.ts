import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildServiceEnquiry } from "@/lib/services/enquiry";
import { packagePriceLabel, SERVICE_PACKAGES, servicePackage } from "@/lib/services/catalog";

const CONFIRMED = {
  website_starter: 450_000,
  website_business: 895_000,
  website_premium: 1_650_000,
  app_mvp: 3_500_000,
  app_full: 8_500_000,
  marketing_starter: 395_000,
  marketing_growth: 750_000,
  addon_hosting: 15_000,
} as const;

test("the service catalogue uses Billy's confirmed prices and four-line scopes", () => {
  assert.deepEqual(
    SERVICE_PACKAGES.map((item) => item.code),
    Object.keys(CONFIRMED),
  );
  assert.deepEqual(
    SERVICE_PACKAGES.map((item) => item.kind),
    ["website", "website", "website", "app", "app", "marketing", "marketing", "addon"],
  );
  for (const pack of SERVICE_PACKAGES) {
    assert.equal(pack.priceCents, CONFIRMED[pack.code as keyof typeof CONFIRMED]);
    assert.equal(pack.scope.length, 4);
    assert.equal(pack.scope.every((line) => line.trim().length > 0), true);
    assert.equal(/PLACEHOLDER/i.test(`${pack.name} ${pack.summary} ${pack.scope.join(" ")}`), false);
  }
  assert.equal(servicePackage("website_premium")?.priceFrom, true);
  assert.equal(servicePackage("app_mvp")?.priceFrom, true);
  assert.equal(servicePackage("app_mvp")?.supportCents, 75_000);
  assert.equal(servicePackage("app_full")?.supportCents, 150_000);
  assert.equal(servicePackage("website_starter")?.priceFrom, false);
  assert.equal(servicePackage("marketing_starter")?.billing, "month");
  assert.equal(servicePackage("addon_hosting")?.billing, "month");
  assert.match(packagePriceLabel(servicePackage("website_premium")!), /from/);
  assert.match(packagePriceLabel(servicePackage("app_mvp")!), /support/);
  assert.equal(/PLACEHOLDER/.test(packagePriceLabel(servicePackage("website_starter")!)), false);

  const built = buildServiceEnquiry({
    leadId: "lead-1",
    quoteId: "44444444-4444-4444-8444-444444444444",
    acceptToken: "a".repeat(64),
    name: "Aya Naidoo",
    email: "Aya@Example.com",
    phone: "0820000000",
    company: "Naidoo Co",
    message: "Need a site",
    packageCode: "website_premium",
    ord: -1,
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.lead.stage, "New");
  assert.equal(built.lead.email, "aya@example.com");
  assert.equal(built.lead.enrolled, false);
  assert.equal(built.quote.status, "requested");
  assert.equal(built.quote.price_placeholder, false);
  assert.equal(built.quote.amount_cents, 1_650_000);
  assert.match(built.lead.notes, /Price: from/);
  assert.match(built.lead.notes, /Prices exclude VAT/);
  assert.equal(/PLACEHOLDER/.test(built.lead.notes), false);
  assert.equal(buildServiceEnquiry({
    leadId: "lead-1",
    quoteId: "44444444-4444-4444-8444-444444444444",
    acceptToken: "a".repeat(64),
    name: "Aya",
    email: "aya@example.com",
    phone: "",
    company: "",
    message: "",
    packageCode: "nope",
    ord: 0,
  }).ok, false);
});

test("the income migration seeds confirmed service prices and does not turn sending on", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261115120000_income_streams.sql", import.meta.url), "utf8");
  assert.match(sql, /membership upsell/);
  assert.equal(/PLACEHOLDER/.test(sql), false);
  assert.equal(/price_placeholder boolean not null default true/.test(sql), false);
  assert.match(sql, /cardinality\(string_to_array\(scope, E'\\n'\)\) = 4/);
  assert.match(sql, /29900/);
  assert.match(sql, /69900/);
  assert.match(sql, /prices_exclude_vat/);
  assert.match(sql, /Willem@aiautotech.co.za/);
  assert.match(sql, /status = 'draft'/);
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/www\.payfast\.co\.za/i.test(sql), false);
  for (const pack of SERVICE_PACKAGES) {
    assert.match(sql, new RegExp(`'${pack.code}'`));
    assert.match(sql, new RegExp(String(pack.priceCents)));
    if (pack.supportCents) assert.match(sql, new RegExp(String(pack.supportCents)));
  }
});
