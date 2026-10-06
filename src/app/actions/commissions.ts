"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { AFFILIATE_COOKIE, FIXTURE_WRITE_MESSAGE, randsToCents, readAffiliateCode } from "@/lib/commissions/calc";
import { commissionsDisplayMode } from "@/lib/commissions/flag";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";

export type CommissionActionState = {
  ok: boolean;
  message: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function refresh() {
  revalidatePath("/command-centre/commissions");
}

async function gate(formData: FormData, kind: "manage" | "attribute") {
  const slug = String(formData.get("org") ?? "");
  const tenant = await safeResolveWorkspace(slug);
  if (commissionsDisplayMode({ tenantMode: tenant.mode }) !== "sandbox" || tenant.active.id.startsWith("preview-")) {
    return { tenant, error: { ok: false, message: FIXTURE_WRITE_MESSAGE } as CommissionActionState };
  }
  const allowed = kind === "manage" ? tenant.role === "agency_owner" : isAgencyRole(tenant.role);
  if (!allowed) {
    const message = kind === "manage"
      ? "The workspace owner updates salespeople and payout marks. Nothing was saved and no money was sent."
      : "Workspace staff attribute a sale and record the amount received. Nothing was saved and no money was sent.";
    return { tenant, error: { ok: false, message } as CommissionActionState };
  }
  return { tenant, error: null };
}

export async function saveSalesperson(
  _state: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const { tenant, error } = await gate(formData, "manage");
  if (error) return error;
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const code = readAffiliateCode(String(formData.get("code") ?? ""));
  if (!code) return { ok: false, message: "Use a code of 4 to 12 letters or digits. Nothing was saved." };
  const percent = Number(formData.get("percent") ?? 30);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return { ok: false, message: "Percent must be from 0 to 100. Nothing was saved." };
  }
  const cadence = String(formData.get("cadence") ?? "once_off") === "recurring" ? "recurring" : "once_off";
  const limitRaw = String(formData.get("monthLimit") ?? "").trim();
  const monthLimit = cadence === "recurring" && limitRaw ? Number(limitRaw) : null;
  if (monthLimit != null && (!Number.isInteger(monthLimit) || monthLimit < 1 || monthLimit > 36)) {
    return { ok: false, message: "Month limit is 1 to 36, or leave it empty. Nothing was saved." };
  }
  const existing = String(formData.get("salespersonId") ?? "").trim();
  const salespersonId = existing ? existing : null;
  if (salespersonId && !UUID.test(salespersonId)) return { ok: false, message: "Choose a salesperson. Nothing was saved." };

  const supabase = await createSupabaseServerClient();
  const { data, error: rpcError } = await supabase.rpc("save_commission_salesperson", {
    p_org: tenant.active.id,
    p_salesperson: salespersonId,
    p_name: name,
    p_contact: contact,
    p_code: code,
    p_active: String(formData.get("active") ?? "yes") !== "no",
    p_percent: percent,
    p_cadence: cadence,
    p_month_limit: monthLimit,
  });
  if (rpcError) return { ok: false, message: rpcError.message };
  const row = data as { ok?: boolean; message?: string; charged?: boolean; money_moved?: boolean } | null;
  if (row?.charged || row?.money_moved) return { ok: false, message: "This ledger does not move money." };
  if (!row?.ok) return { ok: false, message: row?.message || "Nothing was saved and no money was sent." };
  refresh();
  return { ok: true, message: row.message || "Salesperson saved. No money was sent." };
}

export async function attributeByCode(
  _state: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const { tenant, error } = await gate(formData, "attribute");
  if (error) return error;
  const posted = readAffiliateCode(String(formData.get("code") ?? ""));
  const stored = readAffiliateCode((await cookies()).get(AFFILIATE_COOKIE)?.value);
  const code = posted || stored;
  const leadId = String(formData.get("leadId") ?? "").trim();
  if (!code) return { ok: false, message: "Add the salesperson code from the link. Nothing was saved." };
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(leadId)) return { ok: false, message: "Add the lead id. Nothing was saved." };
  const dealRaw = String(formData.get("dealId") ?? "").trim();
  if (dealRaw && !UUID.test(dealRaw)) return { ok: false, message: "That deal id is not valid. Nothing was saved." };

  const supabase = await createSupabaseServerClient();
  const { data, error: rpcError } = await supabase.rpc("attribute_commission", {
    p_org: tenant.active.id,
    p_source: "code",
    p_code: code,
    p_salesperson: null,
    p_lead_id: leadId,
    p_deal_id: dealRaw || null,
  });
  if (rpcError) return { ok: false, message: rpcError.message };
  const row = data as { ok?: boolean; message?: string; charged?: boolean; money_moved?: boolean } | null;
  if (row?.charged || row?.money_moved) return { ok: false, message: "This ledger does not move money." };
  if (!row?.ok) return { ok: false, message: row?.message || "Nothing was saved and no money was sent." };
  refresh();
  return { ok: true, message: row.message || "Attribution saved. No money was sent." };
}

export async function attributeManual(
  _state: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const { tenant, error } = await gate(formData, "attribute");
  if (error) return error;
  const salespersonId = String(formData.get("salespersonId") ?? "").trim();
  const dealId = String(formData.get("dealId") ?? "").trim();
  if (!UUID.test(salespersonId) || !UUID.test(dealId)) {
    return { ok: false, message: "Choose a salesperson and a deal. Nothing was saved." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error: rpcError } = await supabase.rpc("attribute_commission", {
    p_org: tenant.active.id,
    p_source: "manual",
    p_code: null,
    p_salesperson: salespersonId,
    p_lead_id: null,
    p_deal_id: dealId,
  });
  if (rpcError) return { ok: false, message: rpcError.message };
  const row = data as { ok?: boolean; message?: string; charged?: boolean; money_moved?: boolean } | null;
  if (row?.charged || row?.money_moved) return { ok: false, message: "This ledger does not move money." };
  if (!row?.ok) return { ok: false, message: row?.message || "Nothing was saved and no money was sent." };
  refresh();
  return { ok: true, message: row.message || "Attribution saved. No money was sent." };
}

export async function recordReceipt(
  _state: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const { tenant, error } = await gate(formData, "attribute");
  if (error) return error;
  const attributionId = String(formData.get("attributionId") ?? "").trim();
  const amount = randsToCents(String(formData.get("amount") ?? ""));
  const paidOn = String(formData.get("paidOn") ?? "").trim();
  const method = String(formData.get("method") ?? "eft") === "other" ? "other" : "eft";
  if (!UUID.test(attributionId)) return { ok: false, message: "Choose the attributed sale. Nothing was saved." };
  if (amount == null) return { ok: false, message: "Enter the amount received. Nothing was saved." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { ok: false, message: "Enter the date the amount was received. Nothing was saved." };

  const supabase = await createSupabaseServerClient();
  const { data, error: rpcError } = await supabase.rpc("record_commission_receipt", {
    p_org: tenant.active.id,
    p_attribution: attributionId,
    p_amount_cents: amount,
    p_paid_on: paidOn,
    p_method: method,
  });
  if (rpcError) return { ok: false, message: rpcError.message };
  const row = data as { ok?: boolean; message?: string; charged?: boolean; money_moved?: boolean } | null;
  if (row?.charged || row?.money_moved) return { ok: false, message: "This ledger does not move money." };
  if (!row?.ok) return { ok: false, message: row?.message || "Nothing was saved and no money was sent." };
  refresh();
  return { ok: true, message: row.message || "Payment recorded. No money was sent." };
}

export async function setLedgerStatus(
  _state: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const { error } = await gate(formData, "manage");
  if (error) return error;
  const ledgerId = String(formData.get("ledgerId") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  if (!UUID.test(ledgerId)) return { ok: false, message: "Choose a ledger row. No money was sent." };
  if (status !== "approved" && status !== "paid" && status !== "void") {
    return { ok: false, message: "Choose approved, paid, or void. No money was sent." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error: rpcError } = await supabase.rpc("set_commission_ledger_status", {
    p_ledger: ledgerId,
    p_status: status,
  });
  if (rpcError) return { ok: false, message: rpcError.message };
  const row = data as { ok?: boolean; message?: string; charged?: boolean; money_moved?: boolean } | null;
  if (row?.charged || row?.money_moved) return { ok: false, message: "This ledger does not move money." };
  if (!row?.ok) return { ok: false, message: row?.message || "Nothing was changed and no money was sent." };
  refresh();
  return { ok: true, message: row.message || "Ledger updated. No money was sent." };
}
