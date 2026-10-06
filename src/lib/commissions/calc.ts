import type { CommissionCadence, LedgerStatus, SalespersonView } from "@/lib/commissions/types";

export const AFFILIATE_COOKIE = "aat_aff";
export const AFFILIATE_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;
export const DEFAULT_COMMISSION_PERCENT = 30;

export const COMMISSION_DISCLAIMER =
  "These rows are a workspace record of amounts staff entered. They are not a tax invoice, a payslip, or tax or legal advice. Marking a row paid does not send money.";

export const FIXTURE_NOTICE =
  "COMMISSIONS_ENABLED is unset. These are sample rows so you can read a statement on a phone. Nothing is saved and no money is sent.";

export const FIXTURE_WRITE_MESSAGE =
  "COMMISSIONS_ENABLED is unset. Sample rows stay on this page. Nothing was saved and no money was sent.";

const CODE_RE = /^[A-Z0-9]{4,12}$/;

const NEXT_STATUS: Record<LedgerStatus, LedgerStatus[]> = {
  pending: ["approved", "void"],
  approved: ["paid", "void"],
  paid: ["void"],
  void: [],
};

export function readAffiliateCode(value: string | null | undefined) {
  if (!value) return null;
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!CODE_RE.test(code)) return null;
  return code;
}

export function affiliateCodeFromCookieHeader(header: string | null) {
  if (!header) return null;
  const part = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${AFFILIATE_COOKIE}=`));
  if (!part) return null;
  return readAffiliateCode(decodeURIComponent(part.slice(AFFILIATE_COOKIE.length + 1)));
}

export function affiliateLink(code: string, origin = "") {
  const path = `/audit?aff=${encodeURIComponent(code)}`;
  return origin ? `${origin.replace(/\/$/, "")}${path}` : path;
}

/** Percent of the gross amount received. The quoted deal total is not the base. */
export function commissionCents(amountReceivedCents: number, percent: number) {
  if (!Number.isFinite(amountReceivedCents) || amountReceivedCents <= 0) return 0;
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return 0;
  return Math.round((amountReceivedCents * percent) / 100);
}

export function receiptBooksCommission(input: {
  dealWon: boolean;
  paymentPaid: boolean;
  amountReceivedCents: number;
  cadence: CommissionCadence;
  bookedCount: number;
  monthLimit: number | null;
}) {
  if (!input.dealWon) return { book: false, reason: "deal_not_won" as const };
  if (!input.paymentPaid) return { book: false, reason: "payment_not_paid" as const };
  if (!(input.amountReceivedCents > 0)) return { book: false, reason: "no_amount" as const };
  if (input.cadence === "recurring" && input.monthLimit != null && input.bookedCount >= input.monthLimit) {
    return { book: false, reason: "month_limit" as const };
  }
  return { book: true, reason: "booked" as const };
}

export function canSetLedgerStatus(from: LedgerStatus, to: LedgerStatus) {
  return NEXT_STATUS[from].includes(to);
}

export function formatCommissionZar(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const rands = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const part = String(abs % 100).padStart(2, "0");
  return `${sign}R${rands}.${part}`;
}

export function ruleLabel(person: Pick<SalespersonView, "percent" | "cadence" | "monthLimit">) {
  const base = `${person.percent}% of the gross amount received`;
  if (person.cadence === "recurring") {
    return person.monthLimit
      ? `${base}. Recurring, up to ${person.monthLimit} recorded months.`
      : `${base}. Recurring, with no month limit set.`;
  }
  return `${base}. Once-off: each part payment on this sale is included.`;
}

export function randsToCents(value: string) {
  const amount = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}
