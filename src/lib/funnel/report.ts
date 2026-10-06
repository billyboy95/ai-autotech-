export type ReportSection = {
  id: "gaps" | "team" | "impact";
  heading: string;
  body: string;
};

export type AuditRecommendation = {
  agent?: string;
  department?: string;
  priority?: number;
  problem?: string;
  solution?: string;
  how?: string;
  benefit?: string;
  hours?: string;
  hoursAssumption?: string;
  revenue?: string;
};

export type AuditAgent = {
  department?: string;
  agent?: string;
  count?: number;
};

export type AuditSource = {
  company: string;
  industry: string;
  website: string;
  answers: Record<string, unknown>;
  score: Record<string, unknown>;
  recommendations: AuditRecommendation[];
  recommendedAgents: AuditAgent[];
};

export type AuditReportDraft = {
  title: string;
  narrative: string;
  sections: ReportSection[];
  polished: boolean;
};

const GAP_KEY = /gap|problem|pain|struggle|miss|slow|manual|response|unanswered|follow/i;
const EMPTY_GAPS = "The audit did not list a specific gap. This draft does not invent one.";
const EMPTY_TEAM = "This audit did not name an AIOS agent. This draft does not pick one.";
const EMPTY_IMPACT = "No hour or revenue figure was submitted with this audit. This report does not estimate one.";

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "";
  if (Array.isArray(value)) return value.map((item) => textOf(item)).filter(Boolean).join(", ");
  return "";
}

function labelKey(key: string) {
  return key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function scoreLines(score: Record<string, unknown>) {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(score || {})) {
    const text = textOf(value);
    if (!text || text.length > 80) continue;
    lines.push(`${labelKey(key)}: ${text}`);
    if (lines.length >= 6) break;
  }
  return lines;
}

function gapLines(source: AuditSource) {
  const lines: string[] = [];
  for (const item of source.recommendations) {
    const problem = clip(textOf(item.problem), 400);
    if (!problem) continue;
    const agent = clip(textOf(item.agent), 80);
    lines.push(agent ? `${agent}: ${problem}` : problem);
    if (lines.length >= 8) return lines;
  }
  for (const [key, value] of Object.entries(source.answers || {})) {
    if (!GAP_KEY.test(key)) continue;
    const text = clip(textOf(value), 400);
    if (!text) continue;
    lines.push(`From the answer to ${labelKey(key)}: ${text}`);
    if (lines.length >= 8) break;
  }
  return lines;
}

function teamLines(source: AuditSource) {
  const lines: string[] = [];
  for (const agent of source.recommendedAgents) {
    const name = clip(textOf(agent.agent), 80);
    if (!name) continue;
    const department = clip(textOf(agent.department), 60);
    const count = Number.isFinite(agent.count) ? Math.min(10, Math.max(1, Math.trunc(Number(agent.count)))) : 1;
    lines.push(department ? `${count} × ${name} (${department})` : `${count} × ${name}`);
  }
  if (lines.length) return lines;
  const seen = new Set<string>();
  for (const item of source.recommendations) {
    const name = clip(textOf(item.agent), 80);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name);
    const department = clip(textOf(item.department), 60);
    lines.push(department ? `${name} (${department})` : name);
  }
  return lines;
}

function impactLines(source: AuditSource) {
  const lines: string[] = [];
  for (const item of source.recommendations) {
    const hours = clip(textOf(item.hours), 200);
    const revenue = clip(textOf(item.revenue), 200);
    const assumption = clip(textOf(item.hoursAssumption), 400);
    if (!hours && !revenue) continue;
    const agent = clip(textOf(item.agent), 80);
    const parts = [hours, revenue].filter(Boolean).join(". ");
    const lead = agent ? `${agent}: ${parts}` : parts;
    lines.push(assumption ? `${lead}. Stated assumption: ${assumption}` : lead);
  }
  return lines;
}

export function sourceFacts(draft: Pick<AuditReportDraft, "narrative" | "sections">) {
  return [draft.narrative, ...draft.sections.map((section) => `${section.heading}\n${section.body}`)].join("\n");
}

/** Draft from the prospect's own answers and score. Hours and revenue are copied, not estimated. */
export function buildAuditReport(source: AuditSource): AuditReportDraft {
  const company = clip(source.company, 120);
  const industry = clip(source.industry, 80);
  const website = clip(source.website, 200);
  const scores = scoreLines(source.score);
  const gaps = gapLines(source);
  const team = teamLines(source);
  const impact = impactLines(source);

  const sections: ReportSection[] = [
    { id: "gaps", heading: "Gaps", body: gaps.length ? gaps.map((line) => `• ${line}`).join("\n") : EMPTY_GAPS },
    { id: "team", heading: "Recommended AIOS agent team", body: team.length ? team.map((line) => `• ${line}`).join("\n") : EMPTY_TEAM },
    {
      id: "impact",
      heading: "Estimated impact",
      body: impact.length
        ? `Figures below are copied from the audit answers.\n${impact.map((line) => `• ${line}`).join("\n")}`
        : EMPTY_IMPACT,
    },
  ];

  const title = company ? `Audit report for ${company}` : "Audit report";
  const who = [company || "This business", industry ? `in ${industry}` : "", website ? `(${website})` : ""]
    .filter(Boolean)
    .join(" ");
  const scoreSentence = scores.length ? `Submitted score: ${scores.join("; ")}.` : "No readiness score was submitted.";
  const narrative = [
    `${who} completed the free audit. This draft uses only those answers.`,
    scoreSentence,
    gaps.length ? `${gaps.length} gap${gaps.length === 1 ? "" : "s"} are listed from the answers.` : EMPTY_GAPS,
    team.length ? `Recommended team: ${team.join("; ")}.` : EMPTY_TEAM,
    impact.length ? "Impact figures are copied from the audit. None were calculated here." : EMPTY_IMPACT,
    "A person on the workspace reviews this draft before it can show on the prospect team page. It is not sent.",
  ].join(" ");

  return { title: clip(title, 160), narrative: clip(narrative, 4000), sections, polished: false };
}

const NUMBER = /\d[\d.,]*/g;

export function numbersIn(text: string) {
  return new Set(text.match(NUMBER) ?? []);
}

/** Keep a rewrite only when it adds no number, percent, or email address. */
export function acceptPolish(source: string, candidate: string) {
  const next = candidate.replace(/\s+/g, " ").trim();
  if (!next || next.length > 4000) return null;
  if (next.includes("@") || next.includes("%")) {
    if (!source.includes("@") && next.includes("@")) return null;
    if (!source.includes("%") && next.includes("%")) return null;
  }
  const known = numbersIn(source);
  for (const value of numbersIn(next)) {
    if (!known.has(value)) return null;
  }
  return next;
}

export function reportWithNarrative(draft: AuditReportDraft, narrative: string | null): AuditReportDraft {
  if (!narrative) return draft;
  return { ...draft, narrative, polished: true };
}
