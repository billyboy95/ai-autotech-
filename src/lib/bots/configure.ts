import { botBySlug, templateBySlug, type BotConfig } from "@/lib/bots/catalog";
import { emptyTemplateBook, applyTeamTemplate, type TemplateBook } from "@/lib/bots/templates";
import type { CheckoutResult } from "@/lib/billing/types";
import type { BotBillingLine } from "@/lib/bots/billing";

export type PaidCheckout = {
  sandbox: boolean;
  charged: boolean;
};

function hoursFrom(value: string | undefined) {
  const match = String(value ?? "").match(/(\d{1,2}:\d{2})\s*[-–to]+\s*(\d{1,2}:\d{2})/i);
  if (!match) return { start: "", end: "" };
  return { start: match[1], end: match[2] };
}

function channelFrom(value: string | undefined) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("whatsapp")) return "whatsapp";
  if (text.includes("email")) return "email";
  if (text.includes("instagram") || text.includes("facebook")) return "social";
  return "";
}

export function configWithAnswers(slug: string, base: BotConfig, answers: Record<string, string>): BotConfig {
  const bot = botBySlug(slug);
  const ids = new Set(bot.setupQuestions.map((question) => question.id));
  const hours = hoursFrom(answers.hours);
  const channel = channelFrom(answers.channels);
  const setup: Record<string, string> = {};
  for (const [id, value] of Object.entries(answers)) {
    if (!ids.has(id)) continue;
    const text = value.trim();
    if (text) setup[id] = text.slice(0, 500);
  }
  return {
    ...base,
    tone: ids.has("tone") && setup.tone ? setup.tone : base.tone,
    channel: ids.has("channels") && channel ? channel : base.channel,
    workingHours: {
      ...base.workingHours,
      start: ids.has("hours") && hours.start ? hours.start : base.workingHours.start,
      end: ids.has("hours") && hours.end ? hours.end : base.workingHours.end,
    },
    setup,
  };
}

/**
 * After a sandbox checkout succeeds, configure every agent on the template.
 * A checkout that charged, left the sandbox, or missed an agent configures nothing.
 */
export function configurePaidTeam(input: {
  orgId: string;
  orgName: string;
  templateSlug: string;
  answers: Record<string, string>;
  checkout: PaidCheckout;
  lines: Pick<BotBillingLine, "botSlug">[];
  env?: NodeJS.ProcessEnv;
}): { book: TemplateBook; configured: boolean; reason: string } {
  const empty = emptyTemplateBook([{ orgId: input.orgId }]);
  const template = templateBySlug(input.templateSlug);
  const expected = template.bots.map((bot) => bot.slug);
  const paid = new Set(input.lines.map((line) => line.botSlug));
  const complete = expected.every((slug) => paid.has(slug));
  if (!input.checkout.sandbox || input.checkout.charged || !complete) {
    return {
      book: empty,
      configured: false,
      reason: "Sandbox checkout did not succeed. Nothing was configured and nothing was sent.",
    };
  }
  const applied = applyTeamTemplate(empty, {
    orgId: input.orgId,
    orgName: input.orgName,
    templateSlug: input.templateSlug,
    env: input.env,
  });
  const bots = applied.book.bots.map((bot) => ({
    ...bot,
    config: configWithAnswers(bot.botSlug, bot.config, input.answers),
  }));
  return {
    book: {
      ...applied.book,
      sendingEnabled: false,
      contacts: [],
      messages: [],
      secrets: [],
      bots,
    },
    configured: bots.length === expected.length && expected.every((slug) => bots.some((bot) => bot.botSlug === slug)),
    reason: "The full team is configured. Nothing was sent.",
  };
}

export function checkoutSucceeded(checkout: CheckoutResult, lines: { botSlug: string }[], slugs: string[]) {
  return checkout.sandbox === true && checkout.charged === false && slugs.every((slug) => lines.some((line) => line.botSlug === slug));
}
