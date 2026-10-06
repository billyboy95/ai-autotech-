import type { EnvLike } from "@/lib/automation/channels";

export const SALES_AGENTS_FLAG = "SALES_AGENTS_ENABLED";

/** Off unless SALES_AGENTS_ENABLED=true. Unset keeps the approval queue on fixture data and writes nothing. */
export function isSalesAgentsEnabled(env: EnvLike = process.env) {
  return String(env.SALES_AGENTS_ENABLED ?? "").trim().toLowerCase() === "true";
}

/** A logged-out or preview render stays fixture-only even if the flag is set. */
export function salesAgentsDisplayMode(input: { tenantMode: string; env?: EnvLike }): "fixture" | "live" {
  if (input.tenantMode !== "member") return "fixture";
  return isSalesAgentsEnabled(input.env) ? "live" : "fixture";
}
