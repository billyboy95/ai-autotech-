import { johannesburgDateKey } from "@/lib/automation/ids";
import { HOT_SCORE } from "@/lib/automation/score";
import { PIPELINE_STAGES, type AutomationState, type LeadRecord, type PipelineStage } from "@/lib/automation/types";

export type StageCount = { stage: PipelineStage; count: number; valueZar: number };

export type StuckLead = {
  id: string;
  name: string;
  company: string;
  stage: PipelineStage;
  reason: string;
};

export type DailyReport = {
  generatedAt: string;
  timezone: "Africa/Johannesburg";
  date: string;
  newToday: number;
  hotLeads: Array<{ id: string; name: string; company: string; score: number; stage: PipelineStage; ownerName: string }>;
  perStage: StageCount[];
  conversion: {
    contacted: number;
    booked: number;
    won: number;
  };
  pipelineValueZar: number;
  wonValueZar: number;
  stuck: StuckLead[];
  outboxQueued: number;
  outboxApproved: number;
  socialQueued: number;
  attribution: Array<{ source: string; campaign: string; leads: number }>;
  sendingEnabled: boolean;
};

const CONTACTED: PipelineStage[] = [
  "Contacted",
  "Audit booked",
  "Audit done",
  "Proposal sent",
  "Won",
  "Onboarding/Handover",
];
const BOOKED: PipelineStage[] = ["Audit booked", "Audit done", "Proposal sent", "Won", "Onboarding/Handover"];
const WON: PipelineStage[] = ["Won", "Onboarding/Handover"];

export function buildReport(state: AutomationState, now: Date, sendingEnabled = false): DailyReport {
  const date = johannesburgDateKey(now);
  const total = state.leads.length;
  const rate = (stages: PipelineStage[]) =>
    total === 0 ? 0 : Math.round((state.leads.filter((lead) => stages.includes(lead.stage)).length / total) * 1000) / 10;

  const perStage = PIPELINE_STAGES.map((stage) => {
    const rows = state.leads.filter((lead) => lead.stage === stage);
    return {
      stage,
      count: rows.length,
      valueZar: rows.reduce((sum, lead) => sum + (lead.valueZar || 0), 0),
    };
  });

  return {
    generatedAt: now.toISOString(),
    timezone: "Africa/Johannesburg",
    date,
    newToday: state.leads.filter((lead) => johannesburgDateKey(new Date(lead.createdAt)) === date).length,
    hotLeads: state.leads
      .filter((lead) => lead.score >= HOT_SCORE && lead.stage !== "Lost")
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((lead) => ({
        id: lead.id,
        name: lead.name,
        company: lead.company,
        score: lead.score,
        stage: lead.stage,
        ownerName: lead.ownerName,
      })),
    perStage,
    conversion: {
      contacted: rate(CONTACTED),
      booked: rate(BOOKED),
      won: rate(WON),
    },
    pipelineValueZar: state.leads
      .filter((lead) => lead.stage !== "Lost")
      .reduce((sum, lead) => sum + (lead.valueZar || 0), 0),
    wonValueZar: state.leads
      .filter((lead) => WON.includes(lead.stage))
      .reduce((sum, lead) => sum + (lead.valueZar || 0), 0),
    stuck: stuckLeads(state, now),
    outboxQueued:
      state.outbox.filter((message) => message.status === "queued").length +
      (state.socialPosts || []).filter((post) => post.status === "queued").length,
    outboxApproved:
      state.outbox.filter((message) => message.status === "approved").length +
      (state.socialPosts || []).filter((post) => post.status === "approved").length,
    socialQueued: (state.socialPosts || []).filter((post) => post.status === "queued").length,
    attribution: attributionRows(state),
    sendingEnabled,
  };
}

function attributionRows(state: AutomationState) {
  const counts = new Map<string, { source: string; campaign: string; leads: number }>();
  for (const lead of state.leads) {
    const source = lead.utmSource || lead.source || "unknown";
    const campaign = lead.campaign || "(none)";
    const key = `${source}::${campaign}`;
    const row = counts.get(key) || { source, campaign, leads: 0 };
    row.leads += 1;
    counts.set(key, row);
  }
  return [...counts.values()].sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source));
}

function stuckLeads(state: AutomationState, now: Date): StuckLead[] {
  const stuckDays = state.settings.stuckAfterDays || 3;
  const stuckMs = stuckDays * 24 * 60 * 60 * 1000;
  const followupMs = (state.settings.proposalFollowupDays || 3) * 24 * 60 * 60 * 1000;
  const rows: StuckLead[] = [];

  for (const lead of state.leads) {
    const reason = stuckReason(lead, now, stuckMs, followupMs);
    if (!reason) continue;
    rows.push({ id: lead.id, name: lead.name, company: lead.company, stage: lead.stage, reason });
  }

  return rows.slice(0, 12);
}

function stuckReason(lead: LeadRecord, now: Date, stuckMs: number, followupMs: number) {
  if (lead.stage === "Lost" || lead.stage === "Onboarding/Handover") return "";
  if (lead.stage === "Audit booked" && lead.bookedAt && new Date(lead.bookedAt).getTime() < now.getTime()) {
    return "Audit time has passed and the stage is still Audit booked.";
  }
  if (lead.stage === "Proposal sent" && lead.proposalSentAt && now.getTime() - new Date(lead.proposalSentAt).getTime() >= followupMs) {
    return "Proposal is old enough for a follow-up.";
  }
  if (lead.stage === "Won") return "";
  const changed = new Date(lead.stageChangedAt || lead.createdAt).getTime();
  if (now.getTime() - changed >= stuckMs) {
    return `No stage change for ${Math.round((now.getTime() - changed) / 864e5)} days.`;
  }
  return "";
}

export function summaryLines(report: DailyReport) {
  return [
    `Daily summary for ${report.date} (Africa/Johannesburg).`,
    `${report.newToday} new lead${report.newToday === 1 ? "" : "s"} today.`,
    `Pipeline value ${report.pipelineValueZar} ZAR. Won value ${report.wonValueZar} ZAR.`,
    `Conversion: ${report.conversion.contacted}% contacted, ${report.conversion.booked}% booked, ${report.conversion.won}% won.`,
    `${report.stuck.length} stuck or overdue. ${report.outboxQueued} messages and posts waiting in the outbox.`,
    ...(report.attribution.length
      ? [`Attribution: ${report.attribution.map((row) => `${row.source} / ${row.campaign}: ${row.leads}`).join("; ")}.`]
      : []),
    report.sendingEnabled
      ? "Automatic sending is ON."
      : "Automatic sending is OFF. Messages stay in the outbox.",
  ];
}
