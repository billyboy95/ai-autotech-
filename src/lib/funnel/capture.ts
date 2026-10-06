import type { EnvLike } from "@/lib/automation/channels";
import { isSalesFunnelEnabled } from "@/lib/funnel/flag";
import { draftOwnerNotification, planOwnerAlert, type OwnerAlertPlan, type OwnerNotificationDraft } from "@/lib/funnel/notify";
import {
  acceptPolish,
  buildAuditReport,
  reportWithNarrative,
  sourceFacts,
  type AuditReportDraft,
  type AuditSource,
} from "@/lib/funnel/report";

export type PublicCaptureKind = "audit" | "contact" | "booking";

export type PublicCaptureInput = {
  kind: PublicCaptureKind;
  orgId: string | null;
  sourceId: string;
  leadId: string | null;
  name: string;
  company: string;
  phone: string;
  leadEmail: string;
  detail?: string;
  audit?: AuditSource | null;
};

export type CaptureDeps = {
  env: EnvLike;
  insertNotification: (row: OwnerNotificationDraft) => Promise<{ id: string | null }>;
  insertReport: (row: AuditReportDraft & { auditLeadId: string; leadId: string }) => Promise<{ id: string | null }>;
  polish?: (source: string, narrative: string) => Promise<string | null>;
  deliverAlert: (plan: OwnerAlertPlan) => Promise<{ sent: boolean; reason: string }>;
  resultsCallUrl: () => Promise<string>;
};

export type CaptureOutcome = {
  skipped: boolean;
  notificationId: string | null;
  reportId: string | null;
  resultsCallUrl: string | null;
  alertSent: boolean;
  alertReason: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function skipped(reason = "skipped"): CaptureOutcome {
  return {
    skipped: true,
    notificationId: null,
    reportId: null,
    resultsCallUrl: null,
    alertSent: false,
    alertReason: reason,
  };
}

/** TEST name plus an @aiautotech.co.za address stays out of the owner alert, matching the contact route. */
export function shouldNotifyContact(name: string, email: string) {
  return !(/^test\b/i.test(name.trim()) && email.trim().toLowerCase().endsWith("@aiautotech.co.za"));
}

export async function handlePublicCapture(input: PublicCaptureInput, deps: CaptureDeps): Promise<CaptureOutcome> {
  if (!isSalesFunnelEnabled(deps.env)) return skipped("flag_off");
  if (!input.orgId || !UUID.test(input.orgId)) return skipped("no_org");
  if (!input.sourceId.trim()) return skipped("no_source");
  if (input.kind === "contact" && !shouldNotifyContact(input.name, input.leadEmail)) return skipped("test");

  const notification = draftOwnerNotification({
    kind: input.kind,
    name: input.name,
    company: input.company,
    phone: input.phone,
    leadId: input.leadId,
    sourceId: input.sourceId,
    detail: input.detail,
  });
  const stored = await deps.insertNotification(notification);

  let reportId: string | null = null;
  if (input.kind === "audit" && input.audit && UUID.test(input.sourceId)) {
    const draft = buildAuditReport(input.audit);
    const facts = sourceFacts(draft);
    const polished = deps.polish ? acceptPolish(facts, (await deps.polish(facts, draft.narrative)) || "") : null;
    const report = reportWithNarrative(draft, polished);
    const saved = await deps.insertReport({ ...report, auditLeadId: input.sourceId, leadId: input.leadId || "" });
    reportId = saved.id;
  }

  const alert = planOwnerAlert(deps.env, {
    title: notification.title,
    body: notification.body,
    leadEmail: input.leadEmail,
  });
  const delivered = alert.deliver ? await deps.deliverAlert(alert) : { sent: false, reason: alert.reason };
  const resultsCallUrl = input.kind === "audit" ? await deps.resultsCallUrl() : null;

  return {
    skipped: false,
    notificationId: stored.id,
    reportId,
    resultsCallUrl,
    alertSent: delivered.sent,
    alertReason: delivered.reason,
  };
}
