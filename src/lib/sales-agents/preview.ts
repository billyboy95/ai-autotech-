import { RESULTS_CALL_FALLBACK } from "@/lib/funnel/booking-link";
import { onboardingItems, planAuditFollowUp, planBookingReminders, planDailySummary, type PlannedChecklist, type PlannedDraft, type PlannedNotice } from "@/lib/sales-agents/plan";

export const FIXTURE_COPY =
  "Fixture only. SALES_AGENTS_ENABLED is unset, so these samples are not live leads. Nothing is stored and nothing is sent.";

const SAMPLE_CHANNELS = [
  { channel: "whatsapp" as const, address: "0820000000", status: "opted_in" as const, suppressed: false, basis: "consent" as const, serviceConsent: true },
  { channel: "email" as const, address: "lesego@prospect.example", status: "none" as const, suppressed: false, basis: null, serviceConsent: false },
  { channel: "sms" as const, address: "", status: "none" as const, suppressed: false, basis: null, serviceConsent: false },
];

export function fixtureApprovalQueue(now = new Date("2026-10-06T08:00:00.000Z")) {
  const follow = planAuditFollowUp({
    now,
    sendingEnabled: false,
    senderName: "Billy",
    name: "Lesego Dlamini",
    company: "Ndlovu Dental",
    leadId: "fixture-lead",
    auditLeadId: "fixture-audit",
    reportPath: "/team/preview-audit",
    bookingUrl: RESULTS_CALL_FALLBACK,
    channels: SAMPLE_CHANNELS,
    trigger: "audit_arrived",
  });
  const reminders = planBookingReminders({
    now,
    sendingEnabled: false,
    senderName: "Billy",
    name: "Lesego Dlamini",
    company: "Ndlovu Dental",
    leadId: "fixture-lead",
    appointmentId: "fixture-call",
    startsAt: new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString(),
    channels: SAMPLE_CHANNELS,
    consentAccepted: true,
  });
  const summary = planDailySummary({ now, leadsIn: 1, draftsWaiting: 2, callsBooked: 0, won: 0 });
  const checklist: PlannedChecklist = {
    trigger: "deal_won",
    sourceKey: "fixture-won",
    leadId: "fixture-lead",
    items: onboardingItems(RESULTS_CALL_FALLBACK, null),
  };
  return {
    drafts: [...follow.drafts, ...reminders.drafts.filter((item) => item.step === "reminder_24h" && item.channel === "whatsapp")],
    notices: [summary] as PlannedNotice[],
    checklist,
    summary,
  };
}

export function fixtureDraftId(draft: PlannedDraft, index: number) {
  return `fixture-${index}-${draft.step}-${draft.channel}`;
}
