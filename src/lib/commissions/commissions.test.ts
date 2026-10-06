import assert from "node:assert/strict";
import test from "node:test";
import {
  AFFILIATE_COOKIE,
  affiliateCodeFromCookieHeader,
  affiliateLink,
  canSetLedgerStatus,
  commissionCents,
  DEFAULT_COMMISSION_PERCENT,
  FIXTURE_WRITE_MESSAGE,
  formatCommissionZar,
  readAffiliateCode,
  receiptBooksCommission,
  ruleLabel,
  randsToCents,
} from "@/lib/commissions/calc";
import { commissionsDisplayMode, commissionsMode } from "@/lib/commissions/flag";
import { previewCommissionDesk, previewCommissionStatement } from "@/lib/commissions/preview";

test("commissions stay fixture-only until COMMISSIONS_ENABLED is true", () => {
  assert.equal(commissionsMode({} as NodeJS.ProcessEnv), "fixture");
  assert.equal(commissionsMode({ COMMISSIONS_ENABLED: "" }), "fixture");
  assert.equal(commissionsMode({ COMMISSIONS_ENABLED: "false" }), "fixture");
  assert.equal(commissionsMode({ COMMISSIONS_ENABLED: "true" }), "sandbox");
  assert.equal(commissionsDisplayMode({ tenantMode: "preview", env: { COMMISSIONS_ENABLED: "true" } }), "fixture");
  assert.equal(commissionsDisplayMode({ tenantMode: "member", env: { COMMISSIONS_ENABLED: "true" } }), "sandbox");
  assert.equal(commissionsDisplayMode({ tenantMode: "member", env: {} }), "fixture");
  assert.match(FIXTURE_WRITE_MESSAGE, /Nothing was saved/);
  assert.match(FIXTURE_WRITE_MESSAGE, /no money was sent/i);
});

test("a salesperson code is short and the link carries aff", () => {
  assert.equal(readAffiliateCode(" nomsa-30 "), "NOMSA30");
  assert.equal(readAffiliateCode("ab"), null);
  assert.equal(readAffiliateCode("this-code-is-way-too-long"), null);
  assert.equal(affiliateCodeFromCookieHeader(`theme=light; ${AFFILIATE_COOKIE}=pieter`), "PIETER");
  assert.equal(affiliateLink("NOMSA30", "https://aiautotech.co.za"), "https://aiautotech.co.za/audit?aff=NOMSA30");
});

test("partial EFT commission is the percent of the amount received", () => {
  const quoted = 1_000_000;
  const first = 400_000;
  const second = 600_000;
  assert.equal(DEFAULT_COMMISSION_PERCENT, 30);
  assert.equal(commissionCents(first, 30), 120_000);
  assert.equal(commissionCents(quoted, 30), 300_000);
  assert.equal(commissionCents(first, 30) + commissionCents(second, 30), commissionCents(quoted, 30));
  assert.equal(commissionCents(0, 30), 0);
  assert.equal(commissionCents(first, 101), 0);
  assert.equal(randsToCents("4,000.00"), 400_000);
  assert.equal(formatCommissionZar(120_000), "R1,200.00");
});

test("a line is booked only after the deal is won and the payment is paid", () => {
  const base = {
    dealWon: true,
    paymentPaid: true,
    amountReceivedCents: 400_000,
    cadence: "once_off" as const,
    bookedCount: 0,
    monthLimit: null,
  };
  assert.equal(receiptBooksCommission({ ...base, dealWon: false }).reason, "deal_not_won");
  assert.equal(receiptBooksCommission({ ...base, paymentPaid: false }).reason, "payment_not_paid");
  assert.equal(receiptBooksCommission({ ...base, amountReceivedCents: 0 }).reason, "no_amount");
  assert.equal(receiptBooksCommission({ ...base, bookedCount: 4 }).book, true);
  assert.equal(receiptBooksCommission({ ...base, cadence: "recurring", bookedCount: 3, monthLimit: 3 }).reason, "month_limit");
  assert.equal(receiptBooksCommission({ ...base, cadence: "recurring", bookedCount: 2, monthLimit: 3 }).book, true);
  assert.equal(receiptBooksCommission({ ...base, cadence: "recurring", bookedCount: 5, monthLimit: null }).book, true);
});

test("ledger marks move pending to approved to paid, and void keeps a status", () => {
  assert.equal(canSetLedgerStatus("pending", "approved"), true);
  assert.equal(canSetLedgerStatus("pending", "paid"), false);
  assert.equal(canSetLedgerStatus("approved", "paid"), true);
  assert.equal(canSetLedgerStatus("paid", "void"), true);
  assert.equal(canSetLedgerStatus("void", "paid"), false);
  assert.equal(canSetLedgerStatus("paid", "approved"), false);
});

test("the sample statement shows part payments and does not move money", () => {
  const desk = previewCommissionDesk("ai-autotech");
  assert.equal(desk.mode, "fixture");
  assert.equal(desk.writes, false);
  assert.equal(desk.salespeople[0]?.percent, 30);
  assert.equal(desk.salespeople[0]?.basis, "gross_received");
  const statement = previewCommissionStatement("fixture-nomsa", "ai-autotech");
  assert.equal(statement.salesperson?.name, "Nomsa Dlamini");
  assert.equal(statement.totals.pendingCents, 120_000);
  assert.equal(statement.totals.approvedCents, 180_000);
  assert.equal(statement.lines.every((line) => line.method === "eft"), true);
  assert.match(ruleLabel(statement.salesperson!), /Once-off/);
  assert.match(ruleLabel(desk.salespeople[1]!), /up to 3 recorded months/);
  assert.match(statement.disclaimer, /not a tax invoice/i);
  assert.match(statement.disclaimer, /does not send money/i);
  const body = JSON.stringify(statement);
  assert.equal(body.includes("payfast"), false);
  assert.equal(body.includes("www.payfast.co.za"), false);
  assert.equal(previewCommissionStatement("missing", "ai-autotech").salesperson, null);
});
