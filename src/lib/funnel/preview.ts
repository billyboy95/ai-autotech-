import { RESULTS_CALL_FALLBACK } from "@/lib/funnel/booking-link";
import type { OwnerNotificationDraft } from "@/lib/funnel/notify";
import { buildAuditReport, type AuditReportDraft } from "@/lib/funnel/report";

export const FIXTURE_AUDIT_TOKEN = "preview-audit";

export const FIXTURE_COPY =
  "Fixture only. SALES_FUNNEL_ENABLED is unset, so these samples are not live leads. Nothing is stored and nothing is sent.";

const SAMPLE_SOURCE = {
  company: "Ndlovu Dental",
  industry: "clinic",
  website: "https://example.com",
  answers: { response_time: "WhatsApp replies wait until the next morning" },
  score: { readiness: "Early", total: 42 },
  recommendations: [
    {
      agent: "WhatsApp receptionist",
      department: "booking",
      problem: "New enquiries sit unanswered overnight",
      hours: "4 hours a week",
      hoursAssumption: "Based on the hours the practice typed into the audit",
    },
  ],
  recommendedAgents: [{ department: "booking", agent: "WhatsApp receptionist", count: 1 }],
};

export function fixtureAuditReport(): AuditReportDraft {
  return buildAuditReport(SAMPLE_SOURCE);
}

export function fixtureNotifications(): Array<OwnerNotificationDraft & { id: string; createdAt: string; read: boolean }> {
  const audit = {
    id: "fixture-audit",
    kind: "audit" as const,
    title: "New audit from Lesego (sample)",
    body: "Internal alert for the workspace. Nothing is sent to the lead.\nSample only. This is not a live lead.",
    href: "/command-centre/notifications",
    leadId: "",
    dedupeKey: "audit:fixture",
    waLink: "",
    createdAt: "2026-10-06T08:00:00.000Z",
    read: false,
  };
  const contact = {
    id: "fixture-contact",
    kind: "contact" as const,
    title: "New contact from a website form (sample)",
    body: "Internal alert for the workspace. Nothing is sent to the lead.",
    href: "/command-centre/notifications",
    leadId: "",
    dedupeKey: "contact:fixture",
    waLink: "",
    createdAt: "2026-10-06T07:30:00.000Z",
    read: false,
  };
  const booking = {
    id: "fixture-booking",
    kind: "booking" as const,
    title: "New booking (sample)",
    body: "Internal alert for the workspace. Nothing is sent to the lead.",
    href: "/command-centre/notifications",
    leadId: "",
    dedupeKey: "booking:fixture",
    waLink: "",
    createdAt: "2026-10-05T12:00:00.000Z",
    read: true,
  };
  return [audit, contact, booking];
}

export function fixtureResultsCallUrl() {
  return RESULTS_CALL_FALLBACK;
}
