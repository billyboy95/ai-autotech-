import { evaluateSend, type ConsentStatus } from "@/lib/compliance/send-gate";
import { firstName, johannesburgDateKey } from "@/lib/automation/ids";
import { RESULTS_CALL_FALLBACK } from "@/lib/funnel/booking-link";
import { LEAD_ONBOARDING_INTRO, recommendFullTeam, type BusinessProfile } from "@/lib/bots/onboarding";

export const RESULT_PLACEHOLDER = "[ADD REAL RESULT]";

export type SalesChannel = "whatsapp" | "email" | "sms";
export type SalesStep = "day0" | "day2" | "day5" | "reminder_24h" | "reminder_1h" | "welcome";
export type StopReason = "" | "booking" | "reply" | "opt_out";

export type ChannelSnapshot = {
  channel: SalesChannel;
  address: string;
  status: ConsentStatus;
  suppressed: boolean;
  basis: "consent" | "existing_customer" | null;
  /** Service opt-in does not unlock marketing follow-ups. */
  serviceConsent: boolean;
};

export type PlannedDraft = {
  dedupeKey: string;
  leadId: string;
  kind: "follow_up" | "reminder" | "welcome";
  step: SalesStep;
  channel: SalesChannel;
  status: "draft" | "skipped";
  skipReason: string;
  subject: string;
  body: string;
  scheduledFor: string;
  toAddress: string;
  purpose: "marketing" | "service";
};

export type PlannedNotice = {
  kind: "audit" | "booking" | "reply" | "approval" | "stalled" | "summary";
  title: string;
  body: string;
  href: string;
  leadId: string;
  dedupeKey: string;
};

export type ChecklistItem = {
  key: "connect_accounts" | "import_contacts" | "apply_template" | "book_kickoff";
  title: string;
  href: string;
  detail: string;
};

export type PlannedChecklist = {
  trigger: "deal_won" | "invoice_paid";
  sourceKey: string;
  leadId: string;
  items: ChecklistItem[];
};

export type SalesSequencePlan = {
  auditLeadId: string;
  leadId: string;
  trigger: "audit_arrived" | "report_approved";
  status: "active" | "stopped";
  stopReason: StopReason;
};

export type SalesPlan = {
  willSend: false;
  sendingEnabled: boolean;
  sequence: SalesSequencePlan | null;
  drafts: PlannedDraft[];
  notices: PlannedNotice[];
  onboarding: PlannedChecklist | null;
  cancelPending: boolean;
};

const CHANNELS: SalesChannel[] = ["whatsapp", "email", "sms"];
const FOLLOW_STEPS: Array<{ step: "day0" | "day2" | "day5"; days: number }> = [
  { step: "day0", days: 0 },
  { step: "day2", days: 2 },
  { step: "day5", days: 5 },
];

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function channelLabel(channel: SalesChannel) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "sms") return "SMS";
  return "email";
}

function emptyPlan(sendingEnabled: boolean): SalesPlan {
  return {
    willSend: false,
    sendingEnabled,
    sequence: null,
    drafts: [],
    notices: [],
    onboarding: null,
    cancelPending: false,
  };
}

function leadHref(leadId: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(leadId)) return "/command-centre/approvals";
  return `/command-centre/leads/${leadId}`;
}

function notice(input: PlannedNotice): PlannedNotice {
  return {
    ...input,
    title: clip(input.title, 160),
    body: clip(input.body, 2000),
    href: input.href.startsWith("/command-centre/") ? input.href : "/command-centre/approvals",
    leadId: clip(input.leadId, 80),
    dedupeKey: clip(input.dedupeKey, 180),
  };
}

function plusDays(now: Date, days: number) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function minusHours(start: Date, hours: number) {
  return new Date(start.getTime() - hours * 60 * 60 * 1000).toISOString();
}

/**
 * Consent and opt-out decide whether a draft is created.
 * sending_enabled is recorded on the plan and does not drop a consented draft.
 * This layer never marks a message sent.
 */
const CHANNELS_SET = new Set<string>(CHANNELS);

export function channelSnapshots(input: {
  phone: string;
  email: string;
  consents: { channel: string; purpose: string; status: string; basis: string; address: string }[];
  suppressions: { channel: string; address: string }[];
  formConsent?: { accepted: boolean; text: string };
}): ChannelSnapshot[] {
  const phone = input.phone.trim();
  const email = input.email.trim();
  const marketingForm = Boolean(input.formConsent?.accepted && /marketing/i.test(input.formConsent.text || ""));
  return CHANNELS.map((channel) => {
    const address = channel === "email" ? email : phone;
    const folded = address.toLowerCase();
    const rows = input.consents.filter((row) => {
      if (!CHANNELS_SET.has(row.channel)) return false;
      if (row.channel !== channel) return false;
      return row.address.trim().toLowerCase() === folded && folded !== "";
    });
    const suppressed = input.suppressions.some((row) => {
      const sameChannel = row.channel === "" || row.channel === channel;
      return sameChannel && row.address.trim().toLowerCase() === folded && folded !== "";
    });
    const optedOut = rows.some((row) => row.status === "opted_out");
    const marketingIn = rows.find((row) => row.purpose === "marketing" && row.status === "opted_in");
    const serviceIn = rows.find((row) => row.purpose === "service" && row.status === "opted_in");
    if (suppressed || optedOut) {
      return { channel, address, status: "opted_out" as const, suppressed: suppressed || optedOut, basis: null, serviceConsent: false };
    }
    if (marketingIn || (marketingForm && address)) {
      return {
        channel,
        address,
        status: "opted_in" as const,
        suppressed: false,
        basis: marketingIn?.basis === "existing_customer" ? "existing_customer" as const : "consent" as const,
        serviceConsent: true,
      };
    }
    if (serviceIn) {
      return { channel, address, status: "none" as const, suppressed: false, basis: null, serviceConsent: true };
    }
    return { channel, address, status: "none" as const, suppressed: false, basis: null, serviceConsent: false };
  });
}

export function gateChannel(input: {
  snapshot: ChannelSnapshot;
  senderName: string;
  body: string;
  purpose: "marketing" | "service";
}): { include: boolean; reason: string; body: string } {
  const label = channelLabel(input.snapshot.channel);
  if (!input.snapshot.address.trim()) {
    return { include: false, reason: `No ${label} address on this lead.`, body: input.body };
  }
  const decision = evaluateSend({
    sendingEnabled: true,
    channel: input.snapshot.channel,
    purpose: input.purpose,
    senderName: input.senderName,
    suppressed: input.snapshot.suppressed,
    consent: input.snapshot.status,
    basis: input.snapshot.basis,
    body: input.body,
  });
  if (!decision.allowed) return { include: false, reason: decision.reason, body: decision.body };
  const consented = input.purpose === "marketing"
    ? input.snapshot.status === "opted_in" || input.snapshot.basis === "existing_customer"
    : input.snapshot.status === "opted_in" || input.snapshot.basis === "existing_customer" || input.snapshot.serviceConsent;
  if (!consented) {
    const reason = input.purpose === "marketing" ? `No marketing consent for ${label}.` : `No consent recorded for ${label}.`;
    return { include: false, reason, body: input.body };
  }
  return { include: true, reason: "", body: decision.body };
}

function draftFor(input: {
  snapshot: ChannelSnapshot;
  senderName: string;
  body: string;
  subject: string;
  purpose: "marketing" | "service";
  kind: PlannedDraft["kind"];
  step: SalesStep;
  leadId: string;
  dedupeKey: string;
  scheduledFor: string;
}): PlannedDraft {
  const gated = gateChannel({
    snapshot: input.snapshot,
    senderName: input.senderName,
    body: input.body,
    purpose: input.purpose,
  });
  return {
    dedupeKey: clip(input.dedupeKey, 180),
    leadId: input.leadId,
    kind: input.kind,
    step: input.step,
    channel: input.snapshot.channel,
    status: gated.include ? "draft" : "skipped",
    skipReason: clip(gated.reason, 300),
    subject: clip(input.subject, 160),
    body: clip(gated.body, 4000),
    scheduledFor: input.scheduledFor,
    toAddress: input.snapshot.address.trim(),
    purpose: input.purpose,
  };
}

function who(name: string, company: string) {
  const person = clip(name, 80) || "New lead";
  const business = clip(company, 80);
  return business ? `${person} (${business})` : person;
}

function approvalNotice(leadId: string, sourceId: string, drafts: PlannedDraft[]): PlannedNotice | null {
  const waiting = drafts.filter((item) => item.status === "draft");
  if (!waiting.length) return null;
  return notice({
    kind: "approval",
    title: `${waiting.length} draft${waiting.length === 1 ? "" : "s"} need approval`,
    body: "Open the approval queue on your phone. Approving queues the outbox. Nothing is sent while sending is off.",
    href: "/command-centre/approvals",
    leadId,
    dedupeKey: `approval:${clip(sourceId, 80)}`,
  });
}

export function followUpCopy(input: {
  step: "day0" | "day2" | "day5";
  name: string;
  company: string;
  reportPath: string;
  bookingUrl: string;
}) {
  const first = firstName(input.name);
  const company = clip(input.company, 80) || "your business";
  const booking = input.bookingUrl.trim() || RESULTS_CALL_FALLBACK;
  const report = input.reportPath.trim();
  if (input.step === "day0") {
    const reportLine = report
      ? `Your report is here: ${report}`
      : "The report link will be added here once the report is approved.";
    return {
      subject: `${company} audit`,
      body: `Hi ${first}, it's Billy from AI AutoTech. Thanks for the audit on ${company}. ${reportLine}\n\nBook the results call: ${booking}\n\n${RESULT_PLACEHOLDER}`,
    };
  }
  if (input.step === "day2") {
    return {
      subject: `Results call for ${company}`,
      body: `Hi ${first}, Billy again from AI AutoTech. The next step for ${company} is the results call. Book a time here: ${booking}\n\n${RESULT_PLACEHOLDER}`,
    };
  }
  return {
    subject: `Last note on the ${company} audit`,
    body: `Hi ${first}, last note from AI AutoTech on ${company}. If you want the results call, book here: ${booking}. If now is the wrong time, reply later and I will leave it.\n\n${RESULT_PLACEHOLDER}`,
  };
}

export function planAuditFollowUp(input: {
  now: Date;
  sendingEnabled: boolean;
  senderName: string;
  name: string;
  company: string;
  leadId: string;
  auditLeadId: string;
  reportPath: string;
  bookingUrl: string;
  channels: ChannelSnapshot[];
  trigger: "audit_arrived" | "report_approved";
  existingKeys?: string[];
  stopReason?: StopReason;
}): SalesPlan {
  const plan = emptyPlan(input.sendingEnabled);
  const stop = input.stopReason || "";
  plan.sequence = {
    auditLeadId: input.auditLeadId,
    leadId: input.leadId,
    trigger: input.trigger,
    status: stop ? "stopped" : "active",
    stopReason: stop,
  };
  if (stop) {
    plan.cancelPending = true;
    plan.notices.push(
      notice({
        kind: stop === "booking" ? "booking" : "reply",
        title: stop === "opt_out" ? `Opt-out from ${who(input.name, input.company)}` : `Follow-up stopped for ${who(input.name, input.company)}`,
        body: `The audit follow-up stopped because of a ${stop === "opt_out" ? "opt-out" : stop}. Pending drafts stay unsent.`,
        href: leadHref(input.leadId),
        leadId: input.leadId,
        dedupeKey: `${stop}:${input.auditLeadId}`,
      }),
    );
    return plan;
  }

  const existing = new Set(input.existingKeys || []);
  const byChannel = new Map(input.channels.map((item) => [item.channel, item]));
  for (const step of FOLLOW_STEPS) {
    const copy = followUpCopy({
      step: step.step,
      name: input.name,
      company: input.company,
      reportPath: input.reportPath,
      bookingUrl: input.bookingUrl,
    });
    for (const channel of CHANNELS) {
      const snapshot = byChannel.get(channel) || {
        channel,
        address: "",
        status: "none" as const,
        suppressed: false,
        basis: null,
        serviceConsent: false,
      };
      const dedupeKey = `follow_up:${input.auditLeadId}:${step.step}:${channel}`;
      const refreshDay0 = input.trigger === "report_approved" && step.step === "day0" && Boolean(input.reportPath.trim());
      if (existing.has(dedupeKey) && !refreshDay0) continue;
      plan.drafts.push(
        draftFor({
          snapshot,
          senderName: input.senderName,
          body: copy.body,
          subject: copy.subject,
          purpose: "marketing",
          kind: "follow_up",
          step: step.step,
          leadId: input.leadId,
          dedupeKey,
          scheduledFor: plusDays(input.now, step.days),
        }),
      );
    }
  }

  if (input.trigger === "audit_arrived") {
    plan.notices.push(
      notice({
        kind: "audit",
        title: `New audit from ${who(input.name, input.company)}`,
        body: "Internal alert. The sales agent drafted a follow-up for approval. Nothing is sent to the lead.",
        href: leadHref(input.leadId),
        leadId: input.leadId,
        dedupeKey: `audit:${input.auditLeadId}`,
      }),
    );
  }
  const batch = approvalNotice(input.leadId, `${input.auditLeadId}:${input.trigger}`, plan.drafts);
  if (batch) plan.notices.push(batch);
  return plan;
}

export function planBookingReminders(input: {
  now: Date;
  sendingEnabled: boolean;
  senderName: string;
  name: string;
  company: string;
  leadId: string;
  appointmentId: string;
  startsAt: string;
  channels: ChannelSnapshot[];
  existingKeys?: string[];
  consentAccepted?: boolean;
}): SalesPlan {
  const plan = emptyPlan(input.sendingEnabled);
  const starts = new Date(input.startsAt);
  if (Number.isNaN(starts.getTime())) return plan;
  const existing = new Set(input.existingKeys || []);
  const byChannel = new Map(input.channels.map((item) => [item.channel, item]));
  const slots: Array<{ step: "reminder_24h" | "reminder_1h"; hours: number; label: string }> = [
    { step: "reminder_24h", hours: 24, label: "in 24 hours" },
    { step: "reminder_1h", hours: 1, label: "in 1 hour" },
  ];
  const first = firstName(input.name);
  const company = clip(input.company, 80);
  const about = company ? ` for ${company}` : "";
  for (const slot of slots) {
    const when = minusHours(starts, slot.hours);
    const passed = new Date(when).getTime() <= input.now.getTime();
    for (const channel of CHANNELS) {
      const base = byChannel.get(channel) || {
        channel,
        address: "",
        status: "none" as const,
        suppressed: false,
        basis: null,
        serviceConsent: false,
      };
      const snapshot: ChannelSnapshot = base.status === "opted_out"
        ? base
        : { ...base, serviceConsent: base.serviceConsent || Boolean(input.consentAccepted) };
      const dedupeKey = `reminder:${input.appointmentId}:${slot.step}:${channel}`;
      if (existing.has(dedupeKey)) continue;
      if (passed) {
        plan.drafts.push({
          dedupeKey,
          leadId: input.leadId,
          kind: "reminder",
          step: slot.step,
          channel,
          status: "skipped",
          skipReason: `The ${slot.hours === 24 ? "24 hour" : "1 hour"} reminder time has passed.`,
          subject: "Results call reminder",
          body: "",
          scheduledFor: when,
          toAddress: snapshot.address.trim(),
          purpose: "service",
        });
        continue;
      }
      plan.drafts.push(
        draftFor({
          snapshot,
          senderName: input.senderName,
          subject: "Results call reminder",
          body: `Hi ${first}, reminder from Billy at AI AutoTech. Your results call${about} is ${slot.label}. Reply if you need to move it.`,
          purpose: "service",
          kind: "reminder",
          step: slot.step,
          leadId: input.leadId,
          dedupeKey,
          scheduledFor: when,
        }),
      );
    }
  }
  plan.notices.push(
    notice({
      kind: "booking",
      title: `Results call booked for ${who(input.name, input.company)}`,
      body: "Reminder drafts are in the approval queue. No confirmation is sent from this step.",
      href: leadHref(input.leadId),
      leadId: input.leadId,
      dedupeKey: `booking:${input.appointmentId}`,
    }),
  );
  const batch = approvalNotice(input.leadId, input.appointmentId, plan.drafts);
  if (batch) plan.notices.push(batch);
  return plan;
}

export function planStop(input: {
  sendingEnabled: boolean;
  name: string;
  company: string;
  leadId: string;
  auditLeadId: string;
  stopReason: Exclude<StopReason, "">;
}): SalesPlan {
  return planAuditFollowUp({
    now: new Date(),
    sendingEnabled: input.sendingEnabled,
    senderName: "Billy",
    name: input.name,
    company: input.company,
    leadId: input.leadId,
    auditLeadId: input.auditLeadId,
    reportPath: "",
    bookingUrl: RESULTS_CALL_FALLBACK,
    channels: [],
    trigger: "audit_arrived",
    stopReason: input.stopReason,
  });
}

function templateDetail(profile: BusinessProfile | null) {
  if (!profile) return "Apply a workspace template from the template library.";
  try {
    const team = recommendFullTeam(profile);
    return `Apply the ${team.templateName} template (${team.templateSlug}). Prices stay placeholders. Nothing is charged.`;
  } catch {
    return "Apply a workspace template from the template library.";
  }
}

export function onboardingItems(bookingUrl: string, profile: BusinessProfile | null): ChecklistItem[] {
  const booking = bookingUrl.trim() || RESULTS_CALL_FALLBACK;
  return [
    {
      key: "connect_accounts",
      title: "Connect accounts",
      href: "/command-centre/connect-accounts",
      detail: "Connect the workspace accounts. No provider call runs from this checklist.",
    },
    {
      key: "import_contacts",
      title: "Import contacts",
      href: "/command-centre/import-contacts",
      detail: "Import contacts into the workspace. Rows stay unsent.",
    },
    {
      key: "apply_template",
      title: "Apply template",
      href: "/command-centre/agents/templates",
      detail: templateDetail(profile),
    },
    {
      key: "book_kickoff",
      title: "Book kickoff",
      href: booking.startsWith("/") ? booking : "/command-centre/calendars",
      detail: `Book the kickoff. Link: ${booking}`,
    },
  ];
}

export function planOnboarding(input: {
  now: Date;
  sendingEnabled: boolean;
  senderName: string;
  name: string;
  company: string;
  leadId: string;
  sourceKey: string;
  trigger: "deal_won" | "invoice_paid";
  bookingUrl: string;
  channels: ChannelSnapshot[];
  profile?: BusinessProfile | null;
  existingKeys?: string[];
}): SalesPlan {
  const plan = emptyPlan(input.sendingEnabled);
  const items = onboardingItems(input.bookingUrl, input.profile || null);
  plan.onboarding = {
    trigger: input.trigger,
    sourceKey: clip(input.sourceKey, 180),
    leadId: input.leadId,
    items,
  };
  const first = firstName(input.name);
  const company = clip(input.company, 80) || "your business";
  const booking = input.bookingUrl.trim() || RESULTS_CALL_FALLBACK;
  const body = `Hi ${first}, it's Billy from AI AutoTech. Welcome. ${company} can start onboarding now.\n\n${LEAD_ONBOARDING_INTRO}\n\nKickoff booking: ${booking}\n\n${RESULT_PLACEHOLDER}`;
  const existing = new Set(input.existingKeys || []);
  const byChannel = new Map(input.channels.map((item) => [item.channel, item]));
  for (const channel of CHANNELS) {
    const dedupeKey = `welcome:${input.sourceKey}:${channel}`;
    if (existing.has(dedupeKey)) continue;
    const snapshot = byChannel.get(channel) || {
      channel,
      address: "",
      status: "none" as const,
      suppressed: false,
      basis: null,
      serviceConsent: false,
    };
    plan.drafts.push(
      draftFor({
        snapshot,
        senderName: input.senderName,
        subject: `Welcome to the ${company} workspace`,
        body,
        purpose: "service",
        kind: "welcome",
        step: "welcome",
        leadId: input.leadId,
        dedupeKey,
        scheduledFor: input.now.toISOString(),
      }),
    );
  }
  const batch = approvalNotice(input.leadId, input.sourceKey, plan.drafts);
  if (batch) plan.notices.push(batch);
  plan.notices.push(
    notice({
      kind: "summary",
      title: input.trigger === "deal_won" ? `Won: ${who(input.name, input.company)}` : `Invoice paid: ${who(input.name, input.company)}`,
      body: "An onboarding checklist is open: connect accounts, import contacts, apply a template, and book the kickoff. Welcome messages are drafts.",
      href: "/command-centre/approvals",
      leadId: input.leadId,
      dedupeKey: `onboarding:${input.sourceKey}`,
    }),
  );
  return plan;
}

export function planStalledLead(input: {
  now: Date;
  name: string;
  company: string;
  leadId: string;
  auditLeadId: string;
  day5DueAt: string;
  stopped: boolean;
}): PlannedNotice | null {
  if (input.stopped) return null;
  const due = new Date(input.day5DueAt);
  if (Number.isNaN(due.getTime()) || due.getTime() > input.now.getTime()) return null;
  return notice({
    kind: "stalled",
    title: `Stalled lead: ${who(input.name, input.company)}`,
    body: "The day 5 follow-up is due and there is no booking, reply, or opt-out. Drafts stay in the approval queue.",
    href: leadHref(input.leadId),
    leadId: input.leadId,
    dedupeKey: `stalled:${input.auditLeadId}:${johannesburgDateKey(input.now)}`,
  });
}

export function planDailySummary(input: {
  now: Date;
  leadsIn: number;
  draftsWaiting: number;
  callsBooked: number;
  won: number;
}): PlannedNotice {
  const day = johannesburgDateKey(input.now);
  const count = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
  return notice({
    kind: "summary",
    title: `Daily summary ${day}`,
    body: `Leads in: ${count(input.leadsIn)}\nDrafts waiting: ${count(input.draftsWaiting)}\nCalls booked: ${count(input.callsBooked)}\nWon: ${count(input.won)}\nNothing in this summary is sent to a lead.`,
    href: "/command-centre/approvals",
    leadId: "",
    dedupeKey: `summary:${day}`,
  });
}

export function decideDraft(input: {
  status: "draft" | "skipped" | "approved" | "rejected";
  skipReason: string;
  body: string;
  action: "approve" | "reject" | "edit";
  nextBody?: string;
  channel: SalesChannel;
  toAddress: string;
  subject: string;
  leadId: string;
  step: SalesStep;
  scheduledFor: string;
  purpose: "marketing" | "service";
}): { status: "draft" | "skipped" | "approved" | "rejected"; body: string; skipReason: string; outbox: null | { status: "queued"; sentAt: null; willSend: false } } {
  if (input.status !== "draft" || input.skipReason.trim()) {
    return { status: input.status, body: input.body, skipReason: input.skipReason, outbox: null };
  }
  if (input.action === "reject") {
    return { status: "rejected", body: input.body, skipReason: "", outbox: null };
  }
  if (input.action === "edit") {
    const body = clip(input.nextBody || input.body, 4000);
    return { status: "draft", body: body || input.body, skipReason: "", outbox: null };
  }
  return {
    status: "approved",
    body: input.body,
    skipReason: "",
    outbox: { status: "queued", sentAt: null, willSend: false },
  };
}
