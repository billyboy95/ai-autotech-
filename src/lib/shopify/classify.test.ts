import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { classifyShopifyEvent } from "./classify";
import { shopifyAdminReady, verifyShopifyHmac } from "./hmac";
import { zentrixStores } from "./catalog";

test("Zentrix has one store record for each niche", () => {
  const stores = zentrixStores();
  assert.equal(stores.length, 10);
  assert.deepEqual(
    stores.map((store) => store.niche),
    ["Pets", "Auto", "Kitchens", "Camping", "Holidays", "Home", "Beauty", "Baby", "Fitness", "Tools"],
  );
  assert.equal(stores[0].publicDomain, "pets.zentrixonline.co.za");
  assert.equal(stores[0].myshopifyDomain, "zentrix-pets.myshopify.com");
  assert.equal(stores.every((store) => store.planStatus === "not_connected"), true);
});

test("paid orders become customers and a second paid order is a repeat", () => {
  const first = classifyShopifyEvent("orders/paid", { id: 10, email: "a@shop.test", total_price: "199.50", currency: "ZAR", financial_status: "paid" }, 0);
  assert.equal(first?.stage, "Customer");
  assert.equal(first?.countsAsRevenue, true);
  assert.equal(first?.totalCents, 19950);
  const second = classifyShopifyEvent("orders/create", { id: 11, email: "a@shop.test", total_price: "50", financial_status: "paid" }, 1);
  assert.equal(second?.stage, "Repeat customer");
  assert.equal(second?.dealStatus, "won");
});

test("an open checkout is an abandoned cart and is not revenue", () => {
  const cart = classifyShopifyEvent("checkouts/update", { id: "tok", email: "a@shop.test", total_price: "80.00", completed_at: null }, 0);
  assert.equal(cart?.stage, "Cart abandoned");
  assert.equal(cart?.countsAsRevenue, false);
  assert.equal(cart?.abandoned, true);
  assert.equal(classifyShopifyEvent("checkouts/update", { id: "tok", completed_at: "2026-01-01T00:00:00Z" }, 0), null);
});

test("a new customer is a subscriber", () => {
  const person = classifyShopifyEvent("customers/create", { id: 5, email: "new@shop.test" }, 0);
  assert.equal(person?.kind, "customer");
  assert.equal(person?.stage, "Subscriber");
  assert.equal(person?.countsAsRevenue, false);
});

test("webhook HMAC is checked locally and Shopify is not called without a token", () => {
  const secret = "shpss_test";
  const raw = JSON.stringify({ id: 1 });
  const hmac = createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  assert.equal(verifyShopifyHmac(raw, hmac, secret), true);
  assert.equal(verifyShopifyHmac(raw, hmac, ""), false);
  assert.equal(verifyShopifyHmac(raw, "nope", secret), false);
  assert.equal(shopifyAdminReady(""), false);
  assert.equal(shopifyAdminReady("shpat_example"), true);
});
