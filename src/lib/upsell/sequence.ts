import { isSendEnabled, type EnvLike } from "@/lib/automation/channels";
import { BUSINESS_EMAIL } from "@/lib/brand/contact";
import { MEMBERSHIP_UPSELL_STAGE } from "@/lib/upsell/stage";

export const UPSELL_STEPS = [
  { step: "day0", days: 0 },
  { step: "day2", days: 2 },
  { step: "day5", days: 5 },
] as const;

export type UpsellStep = (typeof UPSELL_STEPS)[number]["step"];

export type UpsellDraft = {
  step: UpsellStep;
  channel: "email" | "whatsapp";
  status: "draft";
  subject: string;
  body: string;
  dedupeKey: string;
  scheduledFor: string;
};

export type UpsellPlan = {
  stage: typeof MEMBERSHIP_UPSELL_STAGE;
  willSend: false;
  sent: false;
  queued: false;
  drafts: UpsellDraft[];
};

function plusDays(now: Date, days: number) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function bodyFor(step: UpsellStep, firstName: string, packageName: string, site: string) {
  const who = firstName.trim() || "there";
  const pack = packageName.trim() || "project";
  const price = "The platform is R299 per month. Agents start from R699 per month. Prices exclude VAT.";
  const link = `${site.replace(/\/$/, "")}/membership`;
  if (step === "day0") {
    return `Hi ${who}, it's AI AutoTech.\n\nYour ${pack} payment is in. The next step we recommend is AIOS membership.\n\n${price}\n\nMembership: ${link}\n\nQuestions: ${BUSINESS_EMAIL}\n\nThis note is a draft. It has not been sent.`;
  }
  if (step === "day2") {
    return `Hi ${who}, a short note on AIOS membership after the ${pack}.\n\n${price}\n\n${link}\n\n${BUSINESS_EMAIL}\n\nThis note is a draft. It has not been sent.`;
  }
  return `Hi ${who}, this is the last draft in the membership sequence for the ${pack}.\n\n${price}\n\n${link}\n\n${BUSINESS_EMAIL}\n\nThis note is a draft. It has not been sent.`;
}

/** Drafts only. willSend stays false. Nothing in this plan is queued or sent. */
export function planMembershipUpsell(input: {
  now: Date;
  quoteId: string;
  firstName: string;
  packageName: string;
  email: string;
  phone: string;
  site?: string;
}): UpsellPlan {
  const site = input.site || "https://aiautotech.co.za";
  const drafts: UpsellDraft[] = [];
  for (const item of UPSELL_STEPS) {
    const body = bodyFor(item.step, input.firstName, input.packageName, site);
    const subject = item.step === "day0" ? "AIOS membership after your project" : "AIOS membership";
    if (input.email.trim()) {
      drafts.push({
        step: item.step,
        channel: "email",
        status: "draft",
        subject,
        body,
        dedupeKey: `upsell:${input.quoteId}:${item.step}:email`,
        scheduledFor: plusDays(input.now, item.days),
      });
    }
    if (input.phone.trim()) {
      drafts.push({
        step: item.step,
        channel: "whatsapp",
        status: "draft",
        subject: "",
        body,
        dedupeKey: `upsell:${input.quoteId}:${item.step}:whatsapp`,
        scheduledFor: plusDays(input.now, item.days),
      });
    }
  }
  return {
    stage: MEMBERSHIP_UPSELL_STAGE,
    willSend: false,
    sent: false,
    queued: false,
    drafts,
  };
}

/**
 * Both gates have to be on before any later sender may run.
 * This feature still does not send. Drafts stay drafts.
 */
export function upsellSendDecision(input: { sendingEnabled: boolean; env?: EnvLike }) {
  const automationOn = isSendEnabled(input.env);
  if (!input.sendingEnabled) {
    return { sent: false as const, queued: false as const, drafted: true as const, reason: "sending_enabled is off." };
  }
  if (!automationOn) {
    return { sent: false as const, queued: false as const, drafted: true as const, reason: "AUTOMATION_SEND_ENABLED is off." };
  }
  return {
    sent: false as const,
    queued: false as const,
    drafted: true as const,
    reason: "Both send gates are on. The membership upsell sequence stays a draft and is not sent.",
  };
}
