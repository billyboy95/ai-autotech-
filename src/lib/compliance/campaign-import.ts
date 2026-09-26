import { importProspectCsv, parseProspectCsv } from "@/lib/automation/campaigns";
import { ensureMarketingFooter } from "@/lib/automation/compliance";
import { newId } from "@/lib/automation/ids";
import { stopAddress } from "@/lib/compliance/stop";
import type { AutomationState, Channel, OutboxMessage, Prospect } from "@/lib/automation/types";

export type ConsentBasis = "consent" | "existing_customer" | "";

const CONSENT_REQUEST =
  "Hi {{firstName}}, it's {{owner}}. May we contact you about services for {{business}}? Reply YES to opt in, or STOP to opt out.";

export function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function consentBasisColumn(csv: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return false;
  const header = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  return header.includes("consent_basis") || header.includes("consent basis");
}

export function rowConsentBasis(csv: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const header = splitCsvLine(lines[0] || "").map((cell) => cell.trim().toLowerCase());
  const index = header.findIndex((cell) => cell === "consent_basis" || cell === "consent basis");
  const nameIndex = header.findIndex((cell) => cell === "name");
  return lines.slice(1).flatMap((line) => {
    const cells = splitCsvLine(line);
    if (nameIndex >= 0 && !(cells[nameIndex] || "").trim()) return [];
    const raw = (cells[index] || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (raw === "consent" || raw === "opted_in" || raw === "yes") return ["consent" as const];
    if (raw === "existing_customer" || raw === "existing" || raw === "customer") return ["existing_customer" as const];
    return ["" as const];
  });
}

function addressFor(prospect: Prospect, channel: Channel) {
  return stopAddress(channel === "email" ? "email" : "sms", channel === "email" ? prospect.email : prospect.phone);
}

export function consentRequestAlreadyQueued(state: AutomationState, address: string) {
  if (!address) return false;
  return state.outbox.some((message) => {
    if (message.templateKey !== "consent_request" || message.status === "cancelled") return false;
    return stopAddress(message.channel === "email" ? "email" : "sms", message.toAddress) === address;
  }) || state.prospects.some((prospect) => {
    if (!prospect.consentRequested) return false;
    return addressFor(prospect, prospect.email ? "email" : "sms") === address || addressFor(prospect, "sms") === address;
  });
}

/**
 * CSV import for campaigns. consent_basis is required.
 * A row without consent gets at most one consent-request (POPIA s69(2)).
 * A second request to the same address is blocked.
 */
export function importConsentCampaign(
  state: AutomationState,
  csv: string,
  now: Date,
  campaignId = "",
): { state: AutomationState; error: string; count: number; blocked: number; requested: number } {
  if (!consentBasisColumn(csv)) {
    return { state, error: "CSV is missing: consent_basis.", count: 0, blocked: 0, requested: 0 };
  }
  const bases = rowConsentBasis(csv);
  const imported = importProspectCsv(state, csv, now, campaignId, { consentBasis: bases });
  if (imported.error) return { state, error: imported.error, count: 0, blocked: 0, requested: 0 };

  const created = imported.state.prospects.filter((prospect) => !state.prospects.some((prev) => prev.id === prospect.id));
  let next = imported.state;
  let blocked = Math.max(0, bases.filter((basis) => basis === "").length - created.filter((prospect) => !prospect.consentBasis).length);
  let requested = 0;

  for (const prospect of created) {
    if (prospect.consentBasis === "consent" || prospect.consentBasis === "existing_customer") continue;
    const channel: Channel = prospect.phone ? "whatsapp" : "email";
    const address = addressFor(prospect, channel);
    if (consentRequestAlreadyQueued(state, address) || consentRequestAlreadyQueued(next, address)) {
      blocked += 1;
      next = patchProspect(next, prospect.id, { consentRequested: true, status: "not_contacted" });
      continue;
    }
    next = queueConsentRequest(next, prospect, channel, now);
    requested += 1;
  }

  return { state: next, error: "", count: created.length, blocked, requested };
}

function patchProspect(state: AutomationState, id: string, patch: Partial<Prospect>): AutomationState {
  return {
    ...state,
    prospects: state.prospects.map((prospect) => (prospect.id === id ? { ...prospect, ...patch } : prospect)),
  };
}

function queueConsentRequest(state: AutomationState, prospect: Prospect, channel: Channel, now: Date): AutomationState {
  const address = channel === "email" ? prospect.email : prospect.phone;
  const owner = state.settings.defaultOwner || "AI AutoTech";
  const firstName = prospect.name.trim().split(/\s+/)[0] || "there";
  const rendered = CONSENT_REQUEST.replaceAll("{{firstName}}", firstName)
    .replaceAll("{{owner}}", owner)
    .replaceAll("{{business}}", prospect.business || prospect.name || "your business");
  const body = ensureMarketingFooter(rendered, owner);
  const message: OutboxMessage = {
    id: newId("msg"),
    leadId: "",
    prospectId: prospect.id,
    templateKey: "consent_request",
    channel,
    toAddress: address,
    subject: channel === "email" ? `May ${owner} contact you?` : "",
    body,
    category: "marketing",
    purpose: "consent_request",
    status: "queued",
    scheduledFor: now.toISOString(),
    sentAt: null,
    provider: "outbox",
    providerId: "",
    error: "",
    costUsd: null,
    costZar: null,
    costCategory: "",
    waLink: "",
    createdAt: now.toISOString(),
  };
  return {
    ...patchProspect(state, prospect.id, { consentRequested: true, consentBasis: "", marketingConsent: false }),
    outbox: [...state.outbox, message],
  };
}

export function describeConsentBlock() {
  return "POPIA s69(2): a second consent request to this contact is blocked.";
}

export { parseProspectCsv };
