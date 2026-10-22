import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildServiceEnquiry } from "@/lib/services/enquiry";
import { PRICE_PLACEHOLDER_LABEL, SERVICE_PACKAGES, servicePackage } from "@/lib/services/catalog";

test("the service catalogue is website, app, and marketing packages with placeholder prices", () => {
  assert.deepEqual(SERVICE_PACKAGES.map((item) => item.kind), ["website_build", "app_build", "marketing", "marketing"]);
  assert.equal(SERVICE_PACKAGES.every((item) => item.priceCents > 0), true);
  assert.match(PRICE_PLACEHOLDER_LABEL, /PLACEHOLDER/);
  assert.match(PRICE_PLACEHOLDER_LABEL, /Billy/);
  const built = buildServiceEnquiry({
    leadId: "lead-1",
    quoteId: "44444444-4444-4444-8444-444444444444",
    acceptToken: "a".repeat(64),
    name: "Aya Naidoo",
    email: "Aya@Example.com",
    phone: "0820000000",
    company: "Naidoo Co",
    message: "Need a site",
    packageCode: "website_build",
    ord: -1,
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.lead.stage, "New");
  assert.equal(built.lead.email, "aya@example.com");
  assert.equal(built.lead.enrolled, false);
  assert.equal(built.quote.status, "requested");
  assert.equal(built.quote.price_placeholder, true);
  assert.equal(built.quote.amount_cents, servicePackage("website_build")?.priceCents);
  assert.match(built.lead.notes, /PLACEHOLDER/);
  assert.equal(buildServiceEnquiry({ ...{
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
  } }).ok, false);
});

test("the income migration keeps placeholder service prices and does not turn sending on", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261115120000_income_streams.sql", import.meta.url), "utf8");
  assert.match(sql, /membership upsell/);
  assert.match(sql, /price_placeholder boolean not null default true check \(price_placeholder\)/);
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
  }
});
