import { cookies, headers } from "next/headers";
import { AFFILIATE_COOKIE, readAffiliateCode, ruleLabel } from "@/lib/commissions/calc";
import { commissionsDisplayMode, missingCommissionMigration } from "@/lib/commissions/flag";
import { previewCommissionDesk, previewCommissionStatement } from "@/lib/commissions/preview";
import type {
  AttributionView,
  AuditView,
  CommissionCadence,
  CommissionDesk,
  CommissionStatement,
  LedgerLineView,
  LedgerStatus,
  SalespersonView,
} from "@/lib/commissions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";

async function siteUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") || headerStore.get("host") || "").split(",")[0].trim();
  if (!host) return "https://aiautotech.co.za";
  const forwarded = (headerStore.get("x-forwarded-proto") || "").split(",")[0].trim();
  const proto = forwarded || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function asCadence(value: unknown): CommissionCadence {
  return value === "recurring" ? "recurring" : "once_off";
}

function asStatus(value: unknown): LedgerStatus {
  if (value === "approved" || value === "paid" || value === "void" || value === "pending") return value;
  return "pending";
}

function asMethod(value: unknown): "eft" | "other" {
  return value === "other" ? "other" : "eft";
}

async function cookieCode() {
  const stored = (await cookies()).get(AFFILIATE_COOKIE)?.value;
  return readAffiliateCode(stored);
}

export async function loadCommissionDesk(org?: string | null): Promise<CommissionDesk> {
  const tenant = await safeResolveWorkspace(org);
  const origin = await siteUrl();
  const code = await cookieCode();
  const preview = previewCommissionDesk(tenant.active.slug, origin, code);
  const mode = commissionsDisplayMode({ tenantMode: tenant.mode });
  if (mode !== "sandbox" || tenant.active.id.startsWith("preview-")) return preview;

  const canManage = tenant.role === "agency_owner";
  const canAttribute = isAgencyRole(tenant.role);
  const desk: CommissionDesk = {
    ...preview,
    mode: "sandbox",
    preview: false,
    notice: null,
    canManage,
    canAttribute,
    writes: canAttribute,
    salespeople: [],
    attributions: [],
    lines: [],
  };

  try {
    const supabase = await createSupabaseServerClient();
    const orgId = tenant.active.id;
    const [people, attributions, ledger, receipts] = await Promise.all([
      supabase.from("commission_salespeople").select("id, name, contact, code, active, percent, basis, cadence, month_limit").eq("org_id", orgId).order("name"),
      supabase.from("commission_attributions").select("id, salesperson_id, lead_id, deal_id, source, title").eq("org_id", orgId).order("created_at", { ascending: false }).limit(100),
      supabase.from("commission_ledger").select("id, salesperson_id, receipt_id, title, status, amount_cents, basis_cents, percent, period_index").eq("org_id", orgId).order("created_at", { ascending: false }).limit(200),
      supabase.from("commission_receipts").select("id, paid_on, method").eq("org_id", orgId).limit(200),
    ]);
    const failed = [people.error, attributions.error, ledger.error, receipts.error].find(Boolean);
    if (failed) {
      return {
        ...preview,
        notice: missingCommissionMigration(failed.message)
          ? "Commission tables are not in this database yet. Nothing was saved and no money was sent."
          : failed.message,
      };
    }
    const salespeople: SalespersonView[] = (people.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      contact: String(row.contact || ""),
      code: String(row.code),
      link: `${origin}/audit?aff=${encodeURIComponent(String(row.code))}`,
      active: row.active !== false,
      percent: Number(row.percent) || 0,
      basis: "gross_received",
      cadence: asCadence(row.cadence),
      monthLimit: row.month_limit == null ? null : Number(row.month_limit),
    }));
    const names = new Map(salespeople.map((person) => [person.id, person.name]));
    const paid = new Map((receipts.data ?? []).map((row) => [String(row.id), row]));
    desk.salespeople = salespeople;
    desk.attributions = (attributions.data ?? []).map((row): AttributionView => ({
      id: String(row.id),
      salespersonId: String(row.salesperson_id),
      salespersonName: names.get(String(row.salesperson_id)) || "Salesperson",
      source: row.source === "manual" ? "manual" : "code",
      leadId: row.lead_id ? String(row.lead_id) : null,
      dealId: row.deal_id ? String(row.deal_id) : null,
      title: String(row.title || "Sale"),
    }));
    desk.lines = (ledger.data ?? []).map((row): LedgerLineView => {
      const receipt = paid.get(String(row.receipt_id));
      return {
        id: String(row.id),
        salespersonId: String(row.salesperson_id),
        title: String(row.title || "Sale"),
        status: asStatus(row.status),
        amountCents: Number(row.amount_cents) || 0,
        basisCents: Number(row.basis_cents) || 0,
        percent: Number(row.percent) || 0,
        paidOn: receipt?.paid_on ? String(receipt.paid_on).slice(0, 10) : "",
        method: asMethod(receipt?.method),
        periodIndex: Number(row.period_index) || 1,
      };
    });
    desk.writes = canAttribute;
  } catch (error) {
    desk.notice = error instanceof Error ? error.message : "Commission details could not be loaded.";
    desk.writes = false;
    desk.mode = "fixture";
    desk.preview = true;
  }
  return desk;
}

export async function loadCommissionStatement(salespersonId: string, org?: string | null): Promise<CommissionStatement> {
  const safeId = /^[A-Za-z0-9-]{1,80}$/.test(salespersonId) ? salespersonId : "";
  const tenant = await safeResolveWorkspace(org);
  const origin = await siteUrl();
  const code = await cookieCode();
  const mode = commissionsDisplayMode({ tenantMode: tenant.mode });
  if (mode !== "sandbox" || tenant.active.id.startsWith("preview-")) {
    return previewCommissionStatement(safeId, tenant.active.slug, origin, code);
  }

  const desk = await loadCommissionDesk(org);
  const salesperson = desk.salespeople.find((person) => person.id === safeId) ?? null;
  const lines = salesperson ? desk.lines.filter((line) => line.salespersonId === salesperson.id) : [];
  const sum = (status: LedgerStatus) => lines.filter((line) => line.status === status).reduce((total, line) => total + line.amountCents, 0);
  const statement: CommissionStatement = {
    ...desk,
    salesperson,
    lines,
    notice: salesperson ? desk.notice : "That salesperson is not in this workspace. Nothing was saved and no money was sent.",
    audit: [],
    totals: {
      pendingCents: sum("pending"),
      approvedCents: sum("approved"),
      paidCents: sum("paid"),
      voidCents: sum("void"),
    },
  };
  if (!salesperson || desk.preview || tenant.role !== "agency_owner") return statement;

  try {
    const supabase = await createSupabaseServerClient();
    const audit = await supabase
      .from("commission_audit")
      .select("id, action, detail, created_at, entity_id")
      .eq("org_id", tenant.active.id)
      .order("created_at", { ascending: false })
      .limit(40);
    if (audit.error) return statement;
    const personLines = new Set(lines.map((line) => line.id));
    statement.audit = (audit.data ?? []).flatMap((row): AuditView[] => {
      const detail = row.detail && typeof row.detail === "object" ? row.detail as Record<string, unknown> : {};
      const entity = row.entity_id ? String(row.entity_id) : "";
      const aboutPerson = String(detail.salesperson_id || "") === salesperson.id
        || personLines.has(entity)
        || String(detail.code || "") === salesperson.code
        || entity === salesperson.id;
      if (!aboutPerson) return [];
      return [{
        id: String(row.id),
        action: String(row.action || "change").replaceAll("_", " "),
        detail: auditDetail(detail, salesperson.name),
        at: String(row.created_at || "").slice(0, 10),
      }];
    });
  } catch {
    return statement;
  }
  return statement;
}

function auditDetail(detail: Record<string, unknown>, name: string) {
  const from = detail.from ? String(detail.from) : "";
  const to = detail.to ? String(detail.to) : "";
  if (from && to) return `${name}: ${from} to ${to}. No money was sent.`;
  if (detail.code) return `${name} · ${String(detail.code)} · ${ruleLabel({
    percent: Number(detail.percent) || 0,
    cadence: detail.cadence === "recurring" ? "recurring" : "once_off",
    monthLimit: detail.month_limit == null ? null : Number(detail.month_limit),
  })}`;
  return `${name}. No money was sent.`;
}
