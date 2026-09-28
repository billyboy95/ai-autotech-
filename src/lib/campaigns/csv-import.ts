import { splitCsvLine } from "@/lib/compliance/campaign-import";
import {
  buildCampaignDryRun,
  FIXTURE_CAMPAIGN_NAME,
  isLiveSendIntent,
  type CampaignDryRunReport,
  type DryRunChannel,
  type DryRunRecipient,
} from "@/lib/campaigns/dry-run";

export const FIXTURE_CAMPAIGN_CSV = [
  "name,business,niche,website,phone,email,opening line,consent_basis,stopped",
  "Ayesha Patel,Example Co,clinic,https://example.co.za,0825550101,ayesha@example.co.za,Hello,consent,false",
  "Johan Botha,Botha Co,workshop,https://botha.example,,johan@example.co.za,Hello,existing_customer,false",
  "Thabo Ndlovu,Ndlovu Dental,dental,https://ndlovu.example,0825550102,thabo@example.co.za,Hello,,false",
  "Nomsa Dlamini,Dlamini Co,salon,https://dlamini.example,0825550103,nomsa@example.co.za,Hello,opted_out,false",
  "Pieter Venter,Venter Co,trades,https://venter.example,0825550104,pieter@example.co.za,Hello,consent,true",
].join("\n");

export type CsvImportRow = {
  name: string;
  business: string;
  niche: string;
  website: string;
  phone: string;
  email: string;
  openingLine: string;
  consentBasis: string;
  channel: DryRunChannel | "";
  stopped: boolean;
  suppressed: boolean;
  imported: boolean;
};

export type CsvImportPlan = {
  error: string;
  campaignName: string;
  source: "fixture" | "sandbox";
  imported: number;
  skippedMissingConsent: number;
  queued: 0;
  sent: 0;
  charged: false;
  report: CampaignDryRunReport | null;
  rows: CsvImportRow[];
  refused: boolean;
  message: string;
};

const BOX_COLUMNS: Record<string, string[]> = {
  name: ["name"],
  business: ["business", "company"],
  niche: ["niche", "industry"],
  website: ["website", "url"],
  phone: ["phone", "mobile"],
  email: ["email"],
  opening: ["opening line", "opening_line", "opening"],
};

function normalizeBasis(value: string) {
  const raw = value.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (raw === "opted_in" || raw === "yes") return "consent";
  if (raw === "existing" || raw === "customer") return "existing_customer";
  return raw;
}

function truthy(value: string) {
  const raw = value.trim().toLowerCase();
  return raw === "true" || raw === "t" || raw === "1" || raw === "yes";
}

function validChannel(channel: string): channel is DryRunChannel {
  return channel === "whatsapp" || channel === "email" || channel === "sms";
}

function cell(cells: string[], index: number) {
  if (index < 0) return "";
  return (cells[index] || "").trim();
}

/** A row is skipped for missing consent only when phase 5e would bucket it as missing. */
export function missingConsent(recipient: Pick<DryRunRecipient, "consentBasis" | "stopped" | "suppressed">) {
  const basis = normalizeBasis(recipient.consentBasis);
  if (recipient.stopped || basis === "stop" || basis === "stopped") return false;
  if (recipient.suppressed || basis === "opted_out" || basis === "opt_out" || basis === "optout") return false;
  if (basis === "consent" || basis === "existing_customer") return false;
  return true;
}

function emptyPlan(input: {
  campaignName: string;
  source: "fixture" | "sandbox";
  error: string;
  refused?: boolean;
  message?: string;
}): CsvImportPlan {
  return {
    error: input.error,
    campaignName: input.campaignName,
    source: input.source,
    imported: 0,
    skippedMissingConsent: 0,
    queued: 0,
    sent: 0,
    charged: false,
    report: null,
    rows: [],
    refused: input.refused ?? false,
    message: input.message ?? input.error,
  };
}

/**
 * Dry-load a box-format campaign CSV.
 * consent_basis is required. Missing consent is skipped and is not queued.
 * The preview uses the phase 5e POPIA / consent / STOP rules.
 */
export function planCampaignCsvImport(input: {
  csv: string;
  campaignName?: string;
  intent?: string;
  sendingEnabled: boolean;
  source: "fixture" | "sandbox";
}): CsvImportPlan {
  const campaignName = (input.campaignName ?? "").trim() || FIXTURE_CAMPAIGN_NAME;
  if (isLiveSendIntent(input.intent ?? "")) {
    return emptyPlan({
      campaignName,
      source: input.source,
      error: "",
      refused: true,
      message: input.sendingEnabled
        ? "This dry-load does not send. Nothing was queued."
        : "Sending stays off. Send now is refused. Nothing was queued.",
    });
  }

  const lines = input.csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) {
    return emptyPlan({ campaignName, source: input.source, error: "The CSV is empty." });
  }

  const header = splitCsvLine(lines[0]).map((item) => item.trim().toLowerCase());
  const consentIndex = header.findIndex((item) => item === "consent_basis" || item === "consent basis");
  if (consentIndex < 0) {
    return emptyPlan({ campaignName, source: input.source, error: "CSV is missing: consent_basis." });
  }

  const indexes = Object.fromEntries(
    Object.entries(BOX_COLUMNS).map(([key, names]) => [key, header.findIndex((item) => names.includes(item))]),
  ) as Record<keyof typeof BOX_COLUMNS, number>;
  const missing = Object.entries(indexes).filter(([, index]) => index < 0).map(([key]) => (key === "opening" ? "opening line" : key));
  if (missing.length) {
    return emptyPlan({ campaignName, source: input.source, error: `CSV is missing: ${missing.join(", ")}.` });
  }

  if (lines.length - 1 > 200) {
    return emptyPlan({
      campaignName,
      source: input.source,
      error: "Import up to 200 prospects at a time. Nothing was stored and nothing was queued.",
    });
  }

  const stoppedIndex = header.findIndex((item) => item === "stopped");
  const suppressedIndex = header.findIndex((item) => item === "suppressed");
  const statusIndex = header.findIndex((item) => item === "status");
  const channelIndex = header.findIndex((item) => item === "channel");
  const sendIndex = header.findIndex((item) => item === "send");

  const rows: CsvImportRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    if (sendIndex >= 0 && truthy(cell(cells, sendIndex))) {
      return emptyPlan({
        campaignName,
        source: input.source,
        error: "Dry-load only. Nothing was queued.",
        refused: true,
      });
    }
    const status = cell(cells, statusIndex).toLowerCase();
    if (status === "queued" || status === "approved" || status === "sent") {
      return emptyPlan({
        campaignName,
        source: input.source,
        error: "Dry-load only. Nothing was queued.",
        refused: true,
      });
    }

    const name = cell(cells, indexes.name);
    if (!name) continue;
    const phone = cell(cells, indexes.phone);
    const email = cell(cells, indexes.email).toLowerCase();
    const explicit = cell(cells, channelIndex).toLowerCase();
    const channel: CsvImportRow["channel"] = validChannel(explicit) ? explicit : phone ? "whatsapp" : email ? "email" : "";
    const consentBasis = normalizeBasis(cell(cells, consentIndex));
    const stopped = truthy(cell(cells, stoppedIndex)) || status === "stopped" || consentBasis === "stop" || consentBasis === "stopped";
    const suppressed = truthy(cell(cells, suppressedIndex));
    const recipient = { consentBasis, stopped, suppressed };
    rows.push({
      name,
      business: cell(cells, indexes.business),
      niche: cell(cells, indexes.niche),
      website: cell(cells, indexes.website),
      phone,
      email,
      openingLine: cell(cells, indexes.opening),
      consentBasis,
      channel,
      stopped,
      suppressed,
      imported: !missingConsent(recipient),
    });
  }

  if (!rows.length) {
    return emptyPlan({ campaignName, source: input.source, error: "The CSV has headers but no prospect rows." });
  }

  const report = buildCampaignDryRun({
    campaignName,
    source: input.source,
    recipients: rows.map((row) => ({
      name: row.name,
      channel: row.channel,
      consentBasis: row.consentBasis,
      stopped: row.stopped,
      suppressed: row.suppressed,
    })),
  });
  const imported = rows.filter((row) => row.imported).length;
  const skippedMissingConsent = rows.length - imported;
  return {
    error: "",
    campaignName,
    source: input.source,
    imported,
    skippedMissingConsent,
    queued: 0,
    sent: 0,
    charged: false,
    report,
    rows,
    refused: false,
    message: "Dry-load only. Nothing was queued.",
  };
}

export function csvImportPayload(rows: CsvImportRow[]) {
  return rows.map((row) => ({
    name: row.name,
    business: row.business,
    niche: row.niche,
    website: row.website,
    phone: row.phone,
    email: row.email,
    opening_line: row.openingLine,
    consent_basis: row.consentBasis,
    channel: row.channel,
    stopped: row.stopped,
    suppressed: row.suppressed,
  }));
}

export function blockedReasonCount(report: CampaignDryRunReport, reason: "POPIA" | "consent" | "STOP") {
  return report.lines.filter((line) => line.reason === reason).length;
}

export const EMPTY_CSV_IMPORT_ACTION = {
  id: "",
  stored: false,
  error: "",
  campaignName: "",
  source: "fixture" as const,
  imported: 0,
  skippedMissingConsent: 0,
  queued: 0 as const,
  sent: 0 as const,
  charged: false as const,
  report: null as CampaignDryRunReport | null,
  refused: false,
  message: "",
};
