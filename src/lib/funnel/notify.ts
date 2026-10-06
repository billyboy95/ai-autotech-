import type { EnvLike } from "@/lib/automation/channels";
import { buildWaLink } from "@/lib/automation/channels";
import { firstName } from "@/lib/automation/ids";
import { ownerEmailList } from "@/lib/auth/owners";

export const OWNER_ALERT_PROVIDER_ENV = "OWNER_ALERT_EMAIL_PROVIDER";

export type NotificationKind = "audit" | "contact" | "booking" | "workflow";

export type OwnerNotificationDraft = {
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  leadId: string;
  dedupeKey: string;
  waLink: string;
};

export type OwnerAlertPlan =
  | { deliver: false; reason: "provider_unset" | "no_owner"; to: string[] }
  | { deliver: true; reason: "ready"; provider: "resend" | "smtp"; to: string[]; subject: string; text: string };

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function leadHref(leadId: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(leadId)) return "/command-centre/notifications";
  return `/command-centre/leads/${leadId}`;
}

export function notificationDedupeKey(kind: NotificationKind, sourceId: string, extra = "") {
  const source = clip(sourceId, 80).replace(/\s+/g, "-");
  const tail = extra ? `:${clip(extra, 40)}` : "";
  return `${kind}:${source}${tail}`.slice(0, 180);
}

export function draftOwnerNotification(input: {
  kind: NotificationKind;
  name: string;
  company: string;
  phone: string;
  leadId: string | null;
  sourceId: string;
  detail?: string;
  at?: string;
}): OwnerNotificationDraft {
  const name = clip(input.name, 80) || "New lead";
  const company = clip(input.company, 80);
  const who = company ? `${name} (${company})` : name;
  const leadId = input.leadId?.trim() || "";
  const href = leadHref(leadId);
  const wa = input.phone
    ? buildWaLink(input.phone, `Hi ${firstName(name)}, it's Billy from AI AutoTech. I saw your ${input.kind} in the CRM.`)
    : "";
  const titles: Record<NotificationKind, string> = {
    audit: `New audit from ${who}`,
    contact: `New contact from ${who}`,
    booking: `New booking from ${who}`,
    workflow: clip(input.detail || "Workflow note", 120),
  };
  const lines = [
    titles[input.kind],
    "Internal alert for the workspace. Nothing is sent to the lead.",
    wa ? `WhatsApp (you tap, nothing is sent): ${wa}` : "",
    input.detail && input.kind !== "workflow" ? clip(input.detail, 240) : "",
  ].filter(Boolean);
  const extra = input.kind === "workflow" ? `${input.at || ""}:${input.detail || ""}` : "";
  return {
    kind: input.kind,
    title: clip(titles[input.kind], 160),
    body: clip(lines.join("\n"), 2000),
    href,
    leadId,
    dedupeKey: notificationDedupeKey(input.kind, input.sourceId, extra),
    waLink: wa,
  };
}

function providerReady(env: EnvLike, provider: string) {
  if (provider === "resend") return Boolean(String(env.RESEND_API_KEY ?? "").trim());
  if (provider === "smtp") return Boolean(String(env.SMTP_HOST ?? "").trim());
  return false;
}

/** Internal mail to OWNER_EMAILS only. Unset provider is a no-op. The lead address is never a recipient. */
export function planOwnerAlert(
  env: EnvLike,
  input: { title: string; body: string; leadEmail?: string },
): OwnerAlertPlan {
  const provider = String(env[OWNER_ALERT_PROVIDER_ENV] ?? "").trim().toLowerCase();
  const lead = String(input.leadEmail ?? "").trim().toLowerCase();
  if (provider !== "resend" && provider !== "smtp") return { deliver: false, reason: "provider_unset", to: [] };
  if (!providerReady(env, provider)) return { deliver: false, reason: "provider_unset", to: [] };
  const to = ownerEmailList(env.OWNER_EMAILS).filter((email) => email !== lead);
  if (!to.length) return { deliver: false, reason: "no_owner", to: [] };
  return {
    deliver: true,
    reason: "ready",
    provider,
    to,
    subject: clip(input.title, 140),
    text: clip(`${input.body}\n\nThis alert is internal. It was not sent to the lead.`, 4000),
  };
}

export type WorkflowNote = { subjectId: string; text: string; at: string };

export function draftsFromNotifyMemory(notes: WorkflowNote[], orgIgnored = "") {
  void orgIgnored;
  return notes.map((note) =>
    draftOwnerNotification({
      kind: "workflow",
      name: "Workflow",
      company: "",
      phone: "",
      leadId: note.subjectId,
      sourceId: note.subjectId || "workflow",
      detail: note.text,
      at: note.at,
    }),
  );
}
