export const LEDGER_STATUSES = ["pending", "approved", "paid", "void"] as const;
export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

export const COMMISSION_CADENCES = ["once_off", "recurring"] as const;
export type CommissionCadence = (typeof COMMISSION_CADENCES)[number];

export type SalespersonView = {
  id: string;
  name: string;
  contact: string;
  code: string;
  link: string;
  active: boolean;
  percent: number;
  basis: "gross_received";
  cadence: CommissionCadence;
  monthLimit: number | null;
};

export type AttributionView = {
  id: string;
  salespersonId: string;
  salespersonName: string;
  source: "code" | "manual";
  leadId: string | null;
  dealId: string | null;
  title: string;
};

export type LedgerLineView = {
  id: string;
  salespersonId: string;
  title: string;
  status: LedgerStatus;
  amountCents: number;
  basisCents: number;
  percent: number;
  paidOn: string;
  method: "eft" | "other";
  periodIndex: number;
};

export type AuditView = {
  id: string;
  action: string;
  detail: string;
  at: string;
};

export type CommissionDesk = {
  mode: "fixture" | "sandbox";
  preview: boolean;
  notice: string | null;
  orgSlug: string;
  canManage: boolean;
  canAttribute: boolean;
  writes: boolean;
  cookieCode: string | null;
  salespeople: SalespersonView[];
  attributions: AttributionView[];
  lines: LedgerLineView[];
  disclaimer: string;
};

export type CommissionStatement = CommissionDesk & {
  salesperson: SalespersonView | null;
  audit: AuditView[];
  totals: { pendingCents: number; approvedCents: number; paidCents: number; voidCents: number };
};
