/** Outreach funnel maths for the 2-call close. Pure functions, no I/O. */

export const OUTREACH_STAGES = [
  "not_contacted",
  "sent",
  "replied",
  "booked_call1",
  "showed",
  "call2",
  "closed",
] as const;

export type OutreachStage = (typeof OUTREACH_STAGES)[number] | "lost";

export const ALL_OUTREACH_STAGES: readonly OutreachStage[] = [...OUTREACH_STAGES, "lost"];

export const STAGE_LABELS: Record<OutreachStage, string> = {
  not_contacted: "Not contacted",
  sent: "Sent",
  replied: "Replied",
  booked_call1: "Booked call 1",
  showed: "Showed (call 1)",
  call2: "Call 2",
  closed: "Closed",
  lost: "Lost",
};

export type OutreachProspect = {
  id: string;
  business: string;
  fspNumber: string;
  area: string;
  website: string;
  email: string;
  phone: string;
  contactName: string;
  sourceUrl: string;
  hook: string;
  priority: string;
  channel: string;
  stage: OutreachStage;
  doNotContact: boolean;
  dncReason: string;
  sentAt: string | null;
  repliedAt: string | null;
  bookedCall1At: string | null;
  showedAt: string | null;
  call2At: string | null;
  closedAt: string | null;
  lostAt: string | null;
  stageChangedAt: string | null;
  notes: string;
};

export function isOutreachStage(value: string): value is OutreachStage {
  return (ALL_OUTREACH_STAGES as readonly string[]).includes(value);
}

const STAMP: Record<Exclude<OutreachStage, "not_contacted" | "lost">, keyof OutreachProspect> = {
  sent: "sentAt",
  replied: "repliedAt",
  booked_call1: "bookedCall1At",
  showed: "showedAt",
  call2: "call2At",
  closed: "closedAt",
};

/** Index of the furthest funnel step a prospect reached (lost prospects keep the steps they passed). */
export function furthestStep(p: OutreachProspect): number {
  let best = p.stage === "lost" ? 0 : OUTREACH_STAGES.indexOf(p.stage as (typeof OUTREACH_STAGES)[number]);
  OUTREACH_STAGES.forEach((stage, index) => {
    if (stage === "not_contacted") return;
    if (p[STAMP[stage]]) best = Math.max(best, index);
  });
  return Math.max(best, 0);
}

export type FunnelStep = {
  stage: (typeof OUTREACH_STAGES)[number];
  label: string;
  /** Prospects that reached this step or further. */
  reached: number;
  /** Prospects currently sitting at this step. */
  current: number;
  /** Conversion from the previous step, 0-100, or null when the previous step is empty. */
  fromPrevious: number | null;
  /** Conversion from "sent", 0-100, or null before anything was sent. */
  fromSent: number | null;
};

export type FunnelSummary = {
  total: number;
  doNotContact: number;
  lost: number;
  steps: FunnelStep[];
  /** Calls needed per close at the current rates (sent per closed), or null. */
  sentPerClose: number | null;
};

function pct(part: number, whole: number) {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function summariseFunnel(prospects: OutreachProspect[]): FunnelSummary {
  const reached = OUTREACH_STAGES.map(() => 0);
  const current = OUTREACH_STAGES.map(() => 0);
  let lost = 0;
  for (const p of prospects) {
    const far = furthestStep(p);
    for (let i = 0; i <= far; i += 1) reached[i] += 1;
    if (p.stage === "lost") lost += 1;
    else current[OUTREACH_STAGES.indexOf(p.stage)] += 1;
  }
  const sentIndex = OUTREACH_STAGES.indexOf("sent");
  const steps = OUTREACH_STAGES.map((stage, i) => ({
    stage,
    label: STAGE_LABELS[stage],
    reached: reached[i],
    current: current[i],
    fromPrevious: i === 0 ? null : pct(reached[i], reached[i - 1]),
    fromSent: i <= sentIndex ? null : pct(reached[i], reached[sentIndex]),
  }));
  const closed = reached[OUTREACH_STAGES.indexOf("closed")];
  return {
    total: prospects.length,
    doNotContact: prospects.filter((p) => p.doNotContact).length,
    lost,
    steps,
    sentPerClose: closed > 0 ? Math.round((reached[sentIndex] / closed) * 10) / 10 : null,
  };
}

/** A do-not-contact prospect may never be (re)sent. Later stages are allowed (they replied to us). */
export function canMoveTo(p: Pick<OutreachProspect, "doNotContact" | "stage">, next: OutreachStage) {
  if (!isOutreachStage(next)) return false;
  if (p.doNotContact && next === "sent" && p.stage === "not_contacted") return false;
  return true;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const when = (v: unknown) => (v ? str(v) : null);

export function prospectFromRow(row: Row): OutreachProspect {
  const stage = str(row.stage);
  return {
    id: str(row.id),
    business: str(row.business),
    fspNumber: str(row.fsp_number),
    area: str(row.area),
    website: str(row.website),
    email: str(row.email),
    phone: str(row.phone),
    contactName: str(row.contact_name),
    sourceUrl: str(row.source_url),
    hook: str(row.hook),
    priority: str(row.priority) || "B",
    channel: str(row.channel) || "email",
    stage: isOutreachStage(stage) ? stage : "not_contacted",
    doNotContact: row.do_not_contact === true,
    dncReason: str(row.dnc_reason),
    sentAt: when(row.sent_at),
    repliedAt: when(row.replied_at),
    bookedCall1At: when(row.booked_call1_at),
    showedAt: when(row.showed_at),
    call2At: when(row.call2_at),
    closedAt: when(row.closed_at),
    lostAt: when(row.lost_at),
    stageChangedAt: when(row.stage_changed_at),
    notes: str(row.notes),
  };
}
