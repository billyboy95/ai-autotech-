import { readFileSync } from "node:fs";
import path from "node:path";
import { splitCsvLine } from "@/lib/compliance/campaign-import";
import { newId, toWaDigits } from "@/lib/automation/ids";
import { AGENCY_SLUG } from "@/lib/tenant/types";
import type { AutomationState, Campaign, Prospect } from "@/lib/automation/types";

export const DRAFT_CAMPAIGN_NAME = "East Rand prospects (draft)";
export const DRAFT_PROSPECTS_FILE = "data/campaigns/ai-autotech-east-rand-prospects.csv";

export function assertDraftOrg(slug: string) {
  if (slug !== AGENCY_SLUG) {
    throw new Error("This draft list loads into the AI AutoTech workspace only.");
  }
}

export function readBundledProspectsCsv() {
  return readFileSync(path.join(process.cwd(), DRAFT_PROSPECTS_FILE), "utf8");
}

export function firstPhone(value: string) {
  const raw = value.split("/")[0] || "";
  const digits = toWaDigits(raw);
  return digits ? `+${digits}` : "";
}

/**
 * Held draft for AI AutoTech. Prospects stay "not contacted".
 * No outbox rows are created and nothing is sent.
 */
export function loadDraftProspectCampaign(
  state: AutomationState,
  csv: string,
  now: Date,
): { state: AutomationState; error: string; count: number } {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { state, error: "The prospect CSV is empty.", count: 0 };
  const header = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const index = (...names: string[]) => header.findIndex((cell) => names.includes(cell));
  const columns = {
    name: index("name"),
    niche: index("niche", "industry"),
    area: index("area"),
    website: index("website", "url"),
    phone: index("public_phone", "phone"),
    email: index("public_email", "email"),
    opening: index("personalised_opening_line", "opening line", "opening_line", "opening"),
    source: index("source_url", "source"),
    status: index("status"),
  };
  if (columns.name < 0 || columns.opening < 0) {
    return { state, error: "CSV is missing: name, personalised_opening_line.", count: 0 };
  }

  const existing = state.campaigns.find((campaign) => campaign.name === DRAFT_CAMPAIGN_NAME && campaign.status === "draft");
  const campaign: Campaign = existing ?? {
    id: newId("cmp"),
    name: DRAFT_CAMPAIGN_NAME,
    status: "draft",
    steps: [],
    createdAt: now.toISOString(),
  };
  const known = new Set(
    state.prospects
      .filter((prospect) => prospect.campaignId === campaign.id)
      .map((prospect) => `${prospect.email}|${prospect.business}`.toLowerCase()),
  );

  const created: Prospect[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const business = (cells[columns.name] || "").trim();
    if (!business) continue;
    const email = (cells[columns.email] || "").trim().toLowerCase();
    const key = `${email}|${business.toLowerCase()}`;
    if (known.has(key)) continue;
    known.add(key);
    const statusCell = (cells[columns.status] || "not contacted").trim().toLowerCase();
    created.push({
      id: newId("prs"),
      campaignId: campaign.id,
      name: business,
      business,
      niche: (cells[columns.niche] || "").trim(),
      website: (cells[columns.website] || "").trim(),
      phone: firstPhone(cells[columns.phone] || ""),
      email,
      openingLine: (cells[columns.opening] || "").trim(),
      marketingConsent: false,
      consentBasis: "",
      consentRequested: false,
      area: (cells[columns.area] || "").trim(),
      sourceUrl: (cells[columns.source] || "").trim(),
      outreachStatus: statusCell || "not contacted",
      status: "not_contacted",
      stepIndex: 0,
      leadId: null,
      touches: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  }

  if (!created.length) return { state, error: "", count: 0 };
  return {
    state: {
      ...state,
      campaigns: existing ? state.campaigns : [campaign, ...state.campaigns],
      prospects: [...created, ...state.prospects],
    },
    error: "",
    count: created.length,
  };
}
