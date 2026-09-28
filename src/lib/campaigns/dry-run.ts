/** Placeholder per-message estimates in ZAR cents. Not a provider quote and not charged. */
export const DRY_RUN_COST_CENTS = {
  whatsapp: 62,
  sms: 35,
  email: 5,
} as const;

export const FIXTURE_CAMPAIGN_NAME = "Sandbox prospect draft";

export type DryRunChannel = "whatsapp" | "email" | "sms";

export type DryRunRecipient = {
  name: string;
  channel: DryRunChannel | "";
  consentBasis: string;
  stopped: boolean;
  suppressed: boolean;
};

export type ConsentBreakdown = {
  consent: number;
  existing_customer: number;
  missing: number;
  opted_out: number;
  stop: number;
};

export type DryRunLine = {
  name: string;
  channel: string;
  outcome: "would_receive" | "blocked";
  reason: "" | "POPIA" | "consent" | "STOP";
};

export type CampaignDryRunReport = {
  campaignName: string;
  source: "fixture" | "sandbox";
  recipientCount: number;
  wouldReceive: number;
  blocked: number;
  breakdown: ConsentBreakdown;
  estimatedCostCents: number;
  charged: false;
  queued: 0;
  sent: 0;
  lines: DryRunLine[];
};

export type CampaignActionPlan = {
  refused: boolean;
  queued: 0;
  sent: 0;
  message: string;
  report: CampaignDryRunReport | null;
};

const EMPTY_BREAKDOWN = (): ConsentBreakdown => ({
  consent: 0,
  existing_customer: 0,
  missing: 0,
  opted_out: 0,
  stop: 0,
});

export function formatDryRunZar(cents: number) {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  return `R ${(safe / 100).toFixed(2)}`;
}

export function isLiveSendIntent(intent: string) {
  const value = intent.trim().toLowerCase().replace(/[_-]+/g, " ");
  return value === "send" || value === "send now" || value === "go live" || value === "golive";
}

function normalizeBasis(value: string) {
  return value.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
}

function validChannel(channel: string): channel is DryRunChannel {
  return channel === "whatsapp" || channel === "email" || channel === "sms";
}

export function fixtureRecipients(): DryRunRecipient[] {
  return [
    { name: "Ayesha Patel", channel: "whatsapp", consentBasis: "consent", stopped: false, suppressed: false },
    { name: "Johan Botha", channel: "email", consentBasis: "existing_customer", stopped: false, suppressed: false },
    { name: "Thabo Ndlovu", channel: "sms", consentBasis: "", stopped: false, suppressed: false },
    { name: "Nomsa Dlamini", channel: "whatsapp", consentBasis: "opted_out", stopped: false, suppressed: false },
    { name: "Pieter Venter", channel: "whatsapp", consentBasis: "consent", stopped: true, suppressed: false },
  ];
}

export function recipientsFromProspects(prospects: Array<{
  name: string;
  phone?: string;
  email?: string;
  consentBasis?: string;
  status?: string;
}>): DryRunRecipient[] {
  return prospects
    .map((prospect) => {
      const name = prospect.name.trim();
      if (!name) return null;
      const channel: DryRunRecipient["channel"] = prospect.phone?.trim()
        ? "whatsapp"
        : prospect.email?.trim()
          ? "email"
          : "";
      return {
        name,
        channel,
        consentBasis: prospect.consentBasis ?? "",
        stopped: prospect.status === "stopped",
        suppressed: false,
      };
    })
    .filter((row): row is DryRunRecipient => row !== null);
}

export function recipientsFromImport(rows: unknown): DryRunRecipient[] {
  if (!Array.isArray(rows)) return [];
  const parsed: DryRunRecipient[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const name = String(record.name ?? "").trim();
    if (!name) continue;
    const phone = String(record.phone ?? "").trim();
    const email = String(record.email ?? "").trim();
    parsed.push({
      name,
      channel: phone ? "whatsapp" : email ? "email" : "",
      consentBasis: String(record.consent_basis ?? ""),
      stopped: String(record.stopped ?? "").toLowerCase() === "true" || String(record.status ?? "").toLowerCase() === "stopped",
      suppressed: String(record.suppressed ?? "").toLowerCase() === "true",
    });
  }
  return parsed;
}

export function dedupeRecipients(rows: DryRunRecipient[]) {
  const seen = new Set<string>();
  const result: DryRunRecipient[] = [];
  for (const row of rows) {
    const key = `${row.name.trim().toLowerCase()}|${row.channel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

export function buildCampaignDryRun(input: {
  campaignName: string;
  source: "fixture" | "sandbox";
  recipients: DryRunRecipient[];
}): CampaignDryRunReport {
  const breakdown = EMPTY_BREAKDOWN();
  const lines: DryRunLine[] = [];
  let estimatedCostCents = 0;
  let wouldReceive = 0;

  for (const recipient of input.recipients) {
    const basis = normalizeBasis(recipient.consentBasis);
    const channel = recipient.channel;
    let bucket: keyof ConsentBreakdown;
    let outcome: DryRunLine["outcome"];
    let reason: DryRunLine["reason"];

    if (recipient.stopped || basis === "stop" || basis === "stopped") {
      bucket = "stop";
      outcome = "blocked";
      reason = "STOP";
    } else if (recipient.suppressed || basis === "opted_out" || basis === "opt_out" || basis === "optout") {
      bucket = "opted_out";
      outcome = "blocked";
      reason = "consent";
    } else if (basis === "consent" || basis === "existing_customer") {
      bucket = basis;
      if (validChannel(channel)) {
        outcome = "would_receive";
        reason = "";
        estimatedCostCents += DRY_RUN_COST_CENTS[channel];
        wouldReceive += 1;
      } else {
        outcome = "blocked";
        reason = "POPIA";
      }
    } else {
      bucket = "missing";
      outcome = "blocked";
      reason = "POPIA";
    }

    breakdown[bucket] += 1;
    lines.push({
      name: recipient.name.trim() || "Contact",
      channel: channel || "none",
      outcome,
      reason,
    });
  }

  return {
    campaignName: input.campaignName.trim() || FIXTURE_CAMPAIGN_NAME,
    source: input.source,
    recipientCount: lines.length,
    wouldReceive,
    blocked: lines.length - wouldReceive,
    breakdown,
    estimatedCostCents,
    charged: false,
    queued: 0,
    sent: 0,
    lines,
  };
}

/**
 * A dry run returns the report. Send now and go live are refused.
 * This never builds an outbox row.
 */
export function planCampaignAction(input: {
  intent: string;
  sendingEnabled: boolean;
  campaignName: string;
  source: "fixture" | "sandbox";
  recipients: DryRunRecipient[];
}): CampaignActionPlan {
  if (isLiveSendIntent(input.intent)) {
    return {
      refused: true,
      queued: 0,
      sent: 0,
      report: null,
      message: input.sendingEnabled
        ? "This dry run does not send. Nothing was queued."
        : "Sending stays off. Send now is refused. Nothing was queued.",
    };
  }

  const report = buildCampaignDryRun({
    campaignName: input.campaignName,
    source: input.source,
    recipients: input.recipients,
  });
  return {
    refused: false,
    queued: 0,
    sent: 0,
    report,
    message: "Dry run only. Nothing was queued.",
  };
}

export function recipientPayload(recipients: DryRunRecipient[]) {
  return recipients.map((recipient) => ({
    name: recipient.name,
    channel: recipient.channel,
    consent_basis: recipient.consentBasis,
    stopped: recipient.stopped,
    suppressed: recipient.suppressed,
  }));
}
