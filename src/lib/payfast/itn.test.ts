import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { payfastParamString, payfastSignature } from "@/lib/billing/signature";
import { onceOffCheckout, subscriptionCheckout } from "@/lib/payfast/checkout";
import { payfastMode, payfastProcessUrl, payfastValidateUrl } from "@/lib/payfast/config";
import { isPayfastSourceIp, signatureMatches, validateIncomeItn } from "@/lib/payfast/itn";
import { receiveIncomeItn } from "@/server/payfast/income-itn";

const PASSPHRASE = "salt";
const ORDER = ["merchant_id", "amount", "item_name"];
const FIELDS = {
  merchant_id: "10000100",
  amount: "100.00",
  item_name: "Website build",
};

test("signature generation matches the PayFast parameter string", () => {
  const query = payfastParamString(FIELDS, ORDER, PASSPHRASE);
  assert.equal(query, "merchant_id=10000100&amount=100.00&item_name=Website+build&passphrase=salt");
  const expected = createHash("md5").update(query).digest("hex");
  assert.equal(expected, "c857e100207a907a44de2b53689af3f4");
  assert.equal(payfastSignature(FIELDS, ORDER, PASSPHRASE), expected);
  assert.equal(payfastSignature({ ...FIELDS, signature: "ignored", empty: "  " }, [...ORDER, "signature", "empty"], PASSPHRASE), expected);
});

test("signature validation accepts the generated signature and rejects a tampered body", () => {
  const signed = { ...FIELDS, signature: payfastSignature(FIELDS, ORDER, PASSPHRASE) };
  assert.equal(signatureMatches(signed, [...ORDER, "signature"], PASSPHRASE), true);
  assert.equal(signatureMatches({ ...signed, amount: "100.01" }, [...ORDER, "signature"], PASSPHRASE), false);
  assert.equal(signatureMatches(signed, [...ORDER, "signature"], "other-salt"), false);
  assert.equal(signatureMatches({ ...signed, signature: "not-a-signature" }, ORDER, PASSPHRASE), false);
});

test("PayFast source IPs use the published ranges and a random address is rejected", () => {
  assert.equal(isPayfastSourceIp("197.97.145.150"), true);
  assert.equal(isPayfastSourceIp("197.97.145.160"), false);
  assert.equal(isPayfastSourceIp("41.74.179.200"), true);
  assert.equal(isPayfastSourceIp("41.74.179.224"), false);
  assert.equal(isPayfastSourceIp("102.216.36.10"), true);
  assert.equal(isPayfastSourceIp("102.216.36.130"), true);
  assert.equal(isPayfastSourceIp("144.126.193.139"), true);
  assert.equal(isPayfastSourceIp("8.8.8.8"), false);
  assert.equal(isPayfastSourceIp(""), false);
});

test("ITN validation checks the signature, the source IP, the amount, and the server confirmation", async () => {
  const posted = {
    merchant_id: "10000100",
    pf_payment_id: "pf-9",
    payment_status: "COMPLETE",
    amount_gross: "299.00",
    custom_str3: "sandbox",
  };
  const order = Object.keys(posted);
  posted.signature = payfastSignature(posted, order, PASSPHRASE);
  const env = { PAYFAST_PASSPHRASE: PASSPHRASE, PAYFAST_MODE: "sandbox" };
  let called = "";
  const ok = await validateIncomeItn({
    fields: posted,
    order: [...order, "signature"],
    sourceIp: "197.97.145.144",
    expectedAmountCents: 29900,
    env,
    fetchImpl: async (url, init) => {
      called = String(url);
      assert.equal(init?.method, "POST");
      assert.equal(String(init?.body).includes("passphrase"), false);
      assert.equal(String(init?.body).includes("signature"), false);
      return new Response("VALID");
    },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.signatureValid, true);
  assert.equal(ok.sourceIpAllowed, true);
  assert.equal(ok.serverConfirmed, true);
  assert.equal(called, payfastValidateUrl("sandbox"));

  const badIp = await validateIncomeItn({
    fields: posted,
    order: [...order, "signature"],
    sourceIp: "8.8.8.8",
    expectedAmountCents: 29900,
    env,
    fetchImpl: async () => {
      throw new Error("should not confirm");
    },
  });
  assert.equal(badIp.ok, false);
  assert.equal(badIp.signatureValid, true);
  assert.equal(badIp.sourceIpAllowed, false);

  const invalid = await validateIncomeItn({
    fields: posted,
    order: [...order, "signature"],
    sourceIp: "144.126.193.139",
    expectedAmountCents: 29900,
    env,
    fetchImpl: async () => new Response("INVALID"),
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.serverConfirmed, false);
});

test("checkout defaults to sandbox, reads keys from the environment, and can open live only when asked", () => {
  assert.equal(payfastMode({}), "sandbox");
  assert.equal(payfastMode({ PAYFAST_MODE: "sandbox" }), "sandbox");
  assert.equal(payfastMode({ PAYFAST_MODE: "LIVE" }), "live");
  assert.equal(payfastProcessUrl("sandbox"), "https://sandbox.payfast.co.za/eng/process");
  assert.equal(payfastProcessUrl("live"), "https://www.payfast.co.za/eng/process");
  assert.equal(payfastValidateUrl("live"), "https://www.payfast.co.za/eng/query/validate");

  const missing = onceOffCheckout({
    env: {},
    paymentId: "svc_1",
    amountCents: 1500000,
    itemName: "Website build",
    itemDescription: "Placeholder",
    firstName: "Aya",
    lastName: "Naidoo",
    email: "aya@example.com",
    customStr1: "11111111-1111-4111-8111-111111111111",
    customStr2: "website_build",
    returnPath: "/quotes/abc",
    cancelPath: "/quotes/abc",
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.actionUrl, null);
  assert.equal(missing.charged, false);

  const sandbox = onceOffCheckout({
    env: {
      PAYFAST_MERCHANT_ID: "10000100",
      PAYFAST_MERCHANT_KEY: "sandbox-key",
      PAYFAST_PASSPHRASE: PASSPHRASE,
      NEXT_PUBLIC_SITE_URL: "https://aiautotech.co.za",
    },
    paymentId: "svc_1",
    amountCents: 1500000,
    itemName: "Website build",
    itemDescription: "Placeholder",
    firstName: "Aya",
    lastName: "",
    email: "aya@example.com",
    customStr1: "11111111-1111-4111-8111-111111111111",
    customStr2: "website_build",
    returnPath: "/quotes/abc",
    cancelPath: "/quotes/abc",
  });
  assert.equal(sandbox.sandbox, true);
  assert.equal(sandbox.actionUrl, "https://sandbox.payfast.co.za/eng/process");
  assert.equal(sandbox.fields?.merchant_key, "sandbox-key");
  assert.equal(sandbox.fields?.custom_str3, "sandbox");
  assert.equal(sandbox.fields?.custom_str4, "income");
  assert.equal(sandbox.fields?.subscription_type, undefined);
  assert.equal(sandbox.charged, false);
  const names = Object.keys(sandbox.fields || []);
  assert.equal(names.at(-1), "signature");
  assert.equal(names[0], "merchant_id");

  const live = subscriptionCheckout({
    env: {
      PAYFAST_MODE: "live",
      PAYFAST_MERCHANT_ID: "from-env",
      PAYFAST_MERCHANT_KEY: "live-key",
      PAYFAST_PASSPHRASE: PASSPHRASE,
    },
    paymentId: "mem_1",
    amountCents: 29900,
    itemName: "AIOS Platform",
    itemDescription: "Monthly",
    firstName: "Aya",
    lastName: "Naidoo",
    email: "aya@example.com",
    customStr1: "22222222-2222-4222-8222-222222222222",
    customStr2: "platform",
    now: new Date("2026-10-22T08:00:00.000Z"),
  });
  assert.equal(live.mode, "live");
  assert.equal(live.sandbox, false);
  assert.equal(live.actionUrl, "https://www.payfast.co.za/eng/process");
  assert.equal(live.fields?.subscription_type, "1");
  assert.equal(live.fields?.frequency, "3");
  assert.equal(live.fields?.cycles, "0");
  assert.equal(live.fields?.recurring_amount, "299.00");
  assert.equal(live.fields?.merchant_id, "from-env");
  assert.equal(live.charged, false);

  const source = readFileSync(new URL("./config.ts", import.meta.url), "utf8");
  assert.equal(source.includes("10000100"), false);
  assert.equal(/merchantKey\s*=\s*["'][^"']+["']/.test(source), false);
  assert.match(source, /PAYFAST_MERCHANT_KEY/);
  assert.match(source, /PAYFAST_PASSPHRASE/);
});

test("the income ITN stores a confirmed sandbox payment and refuses a bad signature", async () => {
  const reference = "33333333-3333-4333-8333-333333333333";
  const fields: Record<string, string> = {
    merchant_id: "10000100",
    m_payment_id: `svc_${reference}`,
    pf_payment_id: "pf-income-1",
    payment_status: "COMPLETE",
    amount_gross: "15000.00",
    custom_str1: reference,
    custom_str2: "website_build",
    custom_str3: "sandbox",
    custom_str4: "income",
  };
  const order = Object.keys(fields);
  fields.signature = payfastSignature(fields, order, "");
  const body = new URLSearchParams(fields).toString();
  let applied = false;
  const saved = await receiveIncomeItn(body, new Headers({ "x-real-ip": "102.216.36.1" }), { PAYFAST_MODE: "sandbox", PAYFAST_PASSPHRASE: "" }, {
    loadExpected: async () => ({ kind: "service", amountCents: 1_500_000 }),
    apply: async () => {
      applied = true;
      return { configured: true, error: null, data: { sent: false, drafted: true } };
    },
    fetchImpl: async () => new Response("VALID"),
  });
  assert.equal(saved.status, 200);
  assert.equal(applied, true);
  assert.equal((saved.body as { charged?: boolean }).charged, false);

  fields.amount_gross = "1.00";
  fields.signature = payfastSignature(fields, order, "");
  const rejected = await receiveIncomeItn(new URLSearchParams(fields).toString(), new Headers({ "x-real-ip": "102.216.36.1" }), { PAYFAST_PASSPHRASE: "" }, {
    loadExpected: async () => ({ kind: "service", amountCents: 1_500_000 }),
    apply: async () => {
      throw new Error("should not record");
    },
    fetchImpl: async () => new Response("VALID"),
  });
  assert.equal(rejected.status, 400);
});
