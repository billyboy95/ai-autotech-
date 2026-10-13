import { ensureMarketingFooter } from "@/lib/automation/compliance";

/** Outbox template for the broker free-audit opener. Flush ignores this status. */
export const OPENER_TEMPLATE_KEY = "broker_free_audit_opener";

/**
 * Non-delivering outbox status.
 * flushOutbox delivers only `queued` and `approved`.
 * `approved` is delivered when AUTOMATION_SEND_ENABLED=true, so it is not used here.
 * `draft` is already in the outbox check and is left as draft by the loader.
 */
export const OPENER_OUTBOX_STATUS = "draft" as const;

export const OPENER_NOTE = "Opener draft saved. Not sent.";

const ADVICE = /i recommend|you should buy|this policy|premium|cover you need|guaranteed cover/i;

export type OpenerSkipReason = "dnc" | "no-email" | "stage" | "duplicate";
export type OpenerBlockReason = "suppressed" | "opted_out";

export type OpenerPlan =
  | { action: "skip"; reason: OpenerSkipReason }
  | { action: "block"; reason: OpenerBlockReason; status: "blocked_consent" }
  | {
      action: "draft";
      status: typeof OPENER_OUTBOX_STATUS;
      purpose: "marketing" | "consent_request";
      subject: string;
      body: string;
      consentOnFile: boolean;
    };

function firstName(contactName: string) {
  const cleaned = contactName.trim().replace(/\s+/g, " ");
  const first = cleaned.split(" ")[0] || "";
  return first.slice(0, 80) || "there";
}

function cleanHook(hook: string) {
  return hook.trim().replace(/\s+/g, " ").slice(0, 200);
}

/** FSCA-safe free-audit invite. It does not recommend a policy, a product, or cover. */
export function renderBrokerOpener(input: { contactName: string; business: string; hook: string }) {
  const name = firstName(input.contactName);
  const business = input.business.trim().slice(0, 200) || "your brokerage";
  const hook = cleanHook(input.hook);
  const hookLine = hook ? ` A line from your own site: ${hook}` : "";
  const body = [
    `Hi ${name},`,
    "",
    `Billy at AI AutoTech. I am writing to ${business}.${hookLine}`,
    "",
    "This is not insurance advice. I am not recommending a policy, a product, or cover.",
    "",
    `If it is useful, I can give ${business} a free 20-minute look at how new enquiries get a reply. Reply YES and I will send times. Reply STOP and I will not write again.`,
    "",
    "Billy",
    "AI AutoTech Pty Ltd",
  ].join("\n");
  return {
    subject: `Free reply audit for ${business} — not insurance advice`,
    body: ensureMarketingFooter(body, "Billy"),
  };
}

export function openerGivesAdvice(text: string) {
  return ADVICE.test(text);
}

/**
 * POPIA gate for a draft only. Sending switches are not a reason to refuse the draft.
 * Do-not-contact, suppression, and marketing opt-out write nothing.
 * A missing opt-in still drafts, as a consent request, and stays status draft.
 */
export function planOpener(input: {
  stage: string;
  doNotContact: boolean;
  email: string;
  contactName: string;
  business: string;
  hook: string;
  suppressed: boolean;
  optedOut: boolean;
  marketingOptIn: boolean;
  existingCustomer: boolean;
  duplicate: boolean;
}): OpenerPlan {
  if (input.doNotContact) return { action: "skip", reason: "dnc" };
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { action: "skip", reason: "no-email" };
  if (input.stage !== "not_contacted" && input.stage !== "outreach_queued") return { action: "skip", reason: "stage" };
  if (input.duplicate) return { action: "skip", reason: "duplicate" };
  if (input.suppressed) return { action: "block", reason: "suppressed", status: "blocked_consent" };
  if (input.optedOut) return { action: "block", reason: "opted_out", status: "blocked_consent" };
  const rendered = renderBrokerOpener(input);
  const consentOnFile = input.marketingOptIn || input.existingCustomer;
  return {
    action: "draft",
    status: OPENER_OUTBOX_STATUS,
    purpose: consentOnFile ? "marketing" : "consent_request",
    subject: rendered.subject,
    body: rendered.body,
    consentOnFile,
  };
}

/** Queued marketing rows are the ones a later send switch can flush. Drafts are not. */
export function isStaleQueuedMarketing(row: { status: string; purpose?: string; category?: string }) {
  if (row.status !== "queued") return false;
  const purpose = String(row.purpose || "").trim().toLowerCase();
  const category = String(row.category || "").trim().toLowerCase();
  return purpose === "marketing" || category === "marketing";
}
