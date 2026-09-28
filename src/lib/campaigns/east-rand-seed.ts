import { readFileSync } from "node:fs";
import path from "node:path";
import { csvImportPayload, planCampaignCsvImport, type CsvImportPlan } from "@/lib/campaigns/csv-import";
import type { CampaignDryRunMode } from "@/lib/campaigns/flag";

export const EAST_RAND_SANDBOX_FILE = "data/campaigns/east-rand-sandbox.csv";
export const EAST_RAND_SANDBOX_CAMPAIGN_NAME = "East Rand sandbox (draft)";
export const EAST_RAND_SANDBOX_LABEL = "sandbox";

/** Unset, blank, or any value other than true does not store the seed. */
export function eastRandSeedMode(env: NodeJS.ProcessEnv = process.env): CampaignDryRunMode {
  return String(env.EAST_RAND_CAMPAIGN_SEED_ENABLED ?? "").trim().toLowerCase() === "true" ? "sandbox" : "fixture";
}

/** Preview and logged-out renders stay fixture-only even if the flag is set. */
export function eastRandSeedDisplayMode(input: { tenantMode: string; env?: NodeJS.ProcessEnv }): CampaignDryRunMode {
  if (input.tenantMode !== "member") return "fixture";
  return eastRandSeedMode(input.env);
}

export function missingEastRandSeedMigration(message: string) {
  return /seed_east_rand_sandbox_campaign|refuse_east_rand_seed_send|save_campaign_csv_import|campaign_csv_imports|schema cache|could not find the function/i.test(message);
}

export function readEastRandSandboxCsv() {
  return readFileSync(path.join(process.cwd(), EAST_RAND_SANDBOX_FILE), "utf8");
}

export function planEastRandSandboxSeed(input: {
  intent?: string;
  sendingEnabled: boolean;
  source: CampaignDryRunMode;
  csv?: string;
}): CsvImportPlan {
  return planCampaignCsvImport({
    csv: input.csv ?? readEastRandSandboxCsv(),
    campaignName: EAST_RAND_SANDBOX_CAMPAIGN_NAME,
    intent: input.intent,
    sendingEnabled: input.sendingEnabled,
    source: input.source,
  });
}

export function eastRandSeedPayload(plan: CsvImportPlan) {
  return csvImportPayload(plan.rows);
}
