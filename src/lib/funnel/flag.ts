import type { EnvLike } from "@/lib/automation/channels";

export const SALES_FUNNEL_FLAG = "SALES_FUNNEL_ENABLED";

/** Off unless SALES_FUNNEL_ENABLED=true. Capture still stores the lead. */
export function isSalesFunnelEnabled(env: EnvLike = process.env) {
  return String(env.SALES_FUNNEL_ENABLED ?? "").trim().toLowerCase() === "true";
}

/** Preview and a logged-out render stay fixture-only even if the flag is set. */
export function salesFunnelDisplayMode(input: { tenantMode: string; env?: EnvLike }): "fixture" | "live" {
  if (input.tenantMode !== "member") return "fixture";
  return isSalesFunnelEnabled(input.env) ? "live" : "fixture";
}
