import { affiliateLink, COMMISSION_DISCLAIMER, FIXTURE_NOTICE, ruleLabel } from "@/lib/commissions/calc";
import type { CommissionDesk, CommissionStatement, SalespersonView } from "@/lib/commissions/types";

function people(origin: string): SalespersonView[] {
  return [
    {
      id: "fixture-nomsa",
      name: "Nomsa Dlamini",
      contact: "sample-nomsa@example.com",
      code: "NOMSA30",
      link: affiliateLink("NOMSA30", origin),
      active: true,
      percent: 30,
      basis: "gross_received",
      cadence: "once_off",
      monthLimit: null,
    },
    {
      id: "fixture-pieter",
      name: "Pieter van Wyk",
      contact: "0825550199",
      code: "PIETER",
      link: affiliateLink("PIETER", origin),
      active: true,
      percent: 30,
      basis: "gross_received",
      cadence: "recurring",
      monthLimit: 3,
    },
  ];
}

export function previewCommissionDesk(orgSlug: string, origin = "https://aiautotech.co.za", cookieCode: string | null = null): CommissionDesk {
  const salespeople = people(origin);
  return {
    mode: "fixture",
    preview: true,
    notice: FIXTURE_NOTICE,
    orgSlug,
    canManage: true,
    canAttribute: true,
    writes: false,
    cookieCode,
    salespeople,
    attributions: [
      {
        id: "fixture-attr-workshop",
        salespersonId: "fixture-nomsa",
        salespersonName: "Nomsa Dlamini",
        source: "code",
        leadId: "lead-workshop",
        dealId: null,
        title: "Kempton Park workshop",
      },
      {
        id: "fixture-attr-fleet",
        salespersonId: "fixture-pieter",
        salespersonName: "Pieter van Wyk",
        source: "manual",
        leadId: null,
        dealId: "fixture-deal-fleet",
        title: "Springs fleet",
      },
    ],
    lines: [
      {
        id: "fixture-line-part",
        salespersonId: "fixture-nomsa",
        title: "Kempton Park workshop",
        status: "pending",
        amountCents: 120_000,
        basisCents: 400_000,
        percent: 30,
        paidOn: "2026-09-12",
        method: "eft",
        periodIndex: 1,
      },
      {
        id: "fixture-line-rest",
        salespersonId: "fixture-nomsa",
        title: "Kempton Park workshop",
        status: "approved",
        amountCents: 180_000,
        basisCents: 600_000,
        percent: 30,
        paidOn: "2026-09-20",
        method: "eft",
        periodIndex: 2,
      },
      {
        id: "fixture-line-month1",
        salespersonId: "fixture-pieter",
        title: "Springs fleet",
        status: "paid",
        amountCents: 150_000,
        basisCents: 500_000,
        percent: 30,
        paidOn: "2026-08-03",
        method: "eft",
        periodIndex: 1,
      },
      {
        id: "fixture-line-month2",
        salespersonId: "fixture-pieter",
        title: "Springs fleet",
        status: "pending",
        amountCents: 150_000,
        basisCents: 500_000,
        percent: 30,
        paidOn: "2026-09-03",
        method: "eft",
        periodIndex: 2,
      },
      {
        id: "fixture-line-void",
        salespersonId: "fixture-pieter",
        title: "Springs fleet",
        status: "void",
        amountCents: 60_000,
        basisCents: 200_000,
        percent: 30,
        paidOn: "2026-07-01",
        method: "eft",
        periodIndex: 1,
      },
    ],
    disclaimer: COMMISSION_DISCLAIMER,
  };
}

export function previewCommissionStatement(salespersonId: string, orgSlug: string, origin?: string, cookieCode?: string | null): CommissionStatement {
  const desk = previewCommissionDesk(orgSlug, origin, cookieCode);
  const salesperson = desk.salespeople.find((person) => person.id === salespersonId) ?? null;
  const lines = salesperson ? desk.lines.filter((line) => line.salespersonId === salesperson.id) : [];
  const sum = (status: "pending" | "approved" | "paid" | "void") =>
    lines.filter((line) => line.status === status).reduce((total, line) => total + line.amountCents, 0);
  return {
    ...desk,
    salesperson,
    lines,
    notice: salesperson ? desk.notice : "That sample statement is not on this page. Nothing was saved and no money was sent.",
    audit: salesperson
      ? [
          {
            id: "fixture-audit-1",
            action: "Receipt recorded",
            detail: `${salesperson.name} · sample EFT · ${ruleLabel(salesperson)}`,
            at: "2026-09-12",
          },
          {
            id: "fixture-audit-2",
            action: "Ledger mark",
            detail: "Owner sample marked a row. No money was sent.",
            at: "2026-09-21",
          },
        ]
      : [],
    totals: {
      pendingCents: sum("pending"),
      approvedCents: sum("approved"),
      paidCents: sum("paid"),
      voidCents: sum("void"),
    },
  };
}
