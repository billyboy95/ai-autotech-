import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TEAM_TEMPLATES, bundleBySlug } from "@/lib/bots/catalog";
import { agentQuestionSteps } from "@/lib/bots/interview";
import { onboardingBotConfigs } from "@/lib/bots/onboarding-config";
import {
  LEAD_ONBOARDING_INTRO,
  ONBOARDING_NICHES,
  PHASED_TEAM_COPY,
  SANDBOX_TEAM_MAX,
  parseAgentAnswers,
  parseBusinessProfile,
  profileToSetup,
  quoteForTeam,
  recommendFullTeam,
} from "@/lib/bots/onboarding";
import { recommendTeam } from "@/lib/bots/recommend";
import { PLATFORM_FEE_CENTS, teamDiscountPercent } from "@/lib/pricing/price-sheet";

const clinic = {
  niche: "clinic",
  goals: ["leads" as const],
  channels: ["whatsapp" as const],
  hours: "09:00-16:00",
  tools: "Google Calendar",
};

test("every niche chip recommends that industry template in full", () => {
  for (const niche of ONBOARDING_NICHES) {
    const team = recommendFullTeam({ ...clinic, niche: niche.business });
    assert.equal(team.templateSlug, niche.templateSlug);
    assert.deepEqual(team.agents.map((agent) => agent.slug), bundleBySlug(niche.templateSlug).botSlugs);
    assert.ok(team.agents.length >= 5, niche.templateSlug);
    assert.ok(team.agents.length <= SANDBOX_TEAM_MAX, niche.templateSlug);
    assert.equal(team.savingPercent, teamDiscountPercent(team.agents.length));
    assert.equal(team.platformFeeCents, PLATFORM_FEE_CENTS);
    assert.equal(team.monthlyPriceCents, team.platformFeeCents + team.agentTotalCents);
    assert.equal(team.pricePlaceholder, true);
    assert.equal(Object.hasOwn(team, "later"), false);
    const quote = quoteForTeam(team);
    assert.equal(quote.pricesExcludeVat, true);
    assert.equal(quote.charged, false);
    assert.equal(quote.sandbox, true);
    assert.equal(quote.currency, "ZAR");
  }
});

test("a tiny budget still returns the full clinic team and every agent is visited", () => {
  const team = recommendFullTeam(clinic);
  const tiny = recommendTeam({ ...profileToSetup(clinic), budgetCents: 100 });
  assert.deepEqual(tiny.agents.map((agent) => agent.slug), team.agents.map((agent) => agent.slug));
  const steps = agentQuestionSteps(team.agents.map((agent) => agent.slug));
  assert.equal(steps.length, team.agents.length);
  const asked = steps.flatMap((step) => step.questions.map((question) => question.id));
  assert.ok(asked.includes("knowledge-pack"));
  assert.ok(asked.includes("calendar"));
  assert.ok(asked.includes("whatsapp-number"));
  assert.ok(asked.includes("faqs"));
  assert.equal(new Set(asked).size, asked.length);
});

test("industry templates fit the existing sandbox team call", () => {
  const industry = TEAM_TEMPLATES.filter((template) => template.industry);
  assert.ok(industry.length >= 12);
  for (const template of industry) {
    assert.deepEqual(template.bots.map((bot) => bot.slug), bundleBySlug(template.slug).botSlugs);
    assert.ok(template.bots.length <= SANDBOX_TEAM_MAX, template.slug);
  }
});

test("answers land on the agents that ask them and stay sandbox", () => {
  const team = recommendFullTeam(clinic);
  const configs = onboardingBotConfigs(team.templateSlug, {
    hours: "09:00-16:00",
    tone: "Warm",
    "whatsapp-number": "+27110000000",
    faqs: "Parking",
    calendar: "Front desk",
  }, clinic);
  assert.deepEqual(configs.map((bot) => bot.slug), team.agents.map((agent) => agent.slug));
  const receptionist = configs.find((bot) => bot.slug === "receptionist");
  const documents = configs.find((bot) => bot.slug === "document-admin");
  assert.equal(receptionist?.config.workingHours.start, "09:00");
  assert.equal(receptionist?.config.workingHours.end, "16:00");
  assert.equal(receptionist?.config.setup?.["whatsapp-number"], "+27110000000");
  assert.equal(receptionist?.config.setup?.calendar, "Front desk");
  assert.equal(receptionist?.config.onboarding.charged, false);
  assert.equal(receptionist?.config.onboarding.sandbox, true);
  assert.equal(receptionist?.config.onboarding.pricePlaceholder, true);
  assert.equal(documents?.config.setup?.faqs, "Parking");
  assert.equal(documents?.config.setup?.["whatsapp-number"], undefined);
});

test("profile parsing keeps catalogue values and drops a blank niche", () => {
  assert.equal(parseBusinessProfile({ niche: "  clinic  ", goals: ["leads", "nope"], channels: ["whatsapp"], hours: "08:00-17:00", tools: "Shopify" })?.niche, "clinic");
  assert.equal(parseBusinessProfile({ niche: "", goals: ["leads"], channels: ["whatsapp"] }), null);
  assert.equal(parseBusinessProfile({ niche: "clinic", goals: [], channels: ["whatsapp"] }), null);
  assert.deepEqual(parseAgentAnswers({ tone: " Warm ", "bad key": "no", "whatsapp-number": "  " }), { tone: "Warm" });
});

test("onboarding copy does not tell anyone to phase the team", () => {
  assert.equal(PHASED_TEAM_COPY.test(LEAD_ONBOARDING_INTRO), false);
  assert.match(LEAD_ONBOARDING_INTRO, /full team/);
  assert.match(LEAD_ONBOARDING_INTRO, /excluding VAT/);
  assert.match(LEAD_ONBOARDING_INTRO, /Start this team/);
  const files = [
    "src/components/bots/lead-onboarding.tsx",
    "src/lib/bots/onboarding.ts",
    "src/app/command-centre/lead-agent/page.tsx",
    "src/app/actions/onboarding.ts",
    "src/lib/bots/onboarding-config.ts",
    "docs/lead-onboarding.md",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
    assert.equal(PHASED_TEAM_COPY.test(text), false, file);
  }
});
