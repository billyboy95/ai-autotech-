export type CommissionMode = "fixture" | "sandbox";

/** Unset, blank, or any value other than true is fixture-only. Writes are refused. */
export function commissionsMode(env: NodeJS.ProcessEnv = process.env): CommissionMode {
  return String(env.COMMISSIONS_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function commissionsDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): CommissionMode {
  if (input.tenantMode !== "member") return "fixture";
  return commissionsMode(input.env);
}

export function missingCommissionMigration(message: string) {
  return /commission_salespeople|commission_ledger|save_commission_salesperson|attribute_commission|record_commission_receipt|schema cache|could not find the function/i.test(message);
}
