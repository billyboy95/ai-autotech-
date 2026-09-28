export type CampaignDryRunMode = "fixture" | "sandbox";

/** Unset, blank, or any value other than true is fixture-only. Reports are not stored. */
export function campaignDryRunMode(env: NodeJS.ProcessEnv = process.env): CampaignDryRunMode {
  return String(env.CAMPAIGN_DRY_RUN_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function campaignDryRunDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): CampaignDryRunMode {
  if (input.tenantMode !== "member") return "fixture";
  return campaignDryRunMode(input.env);
}

export function missingCampaignDryRunMigration(message: string) {
  return /save_campaign_dry_run|refuse_campaign_send|campaign_dry_runs|schema cache|could not find the function/i.test(message);
}
