import assert from "node:assert/strict";
import test from "node:test";
import { bundleBySlug } from "@/lib/bots/catalog";
import {
  auditToSetup,
  polishRecommendationExplanations,
  recommendTeam,
  type SetupAnswers,
  type TeamRecommendation,
} from "@/lib/bots/recommend";

function priced(recommendation: TeamRecommendation) {
  const amounts = recommendation.agents.map((agent) => agent.monthlyPriceCents);
  const separate = amounts.reduce((sum, amount) => sum + amount, 0);
  const max = amounts.reduce((highest, amount) => Math.max(highest, amount), 0);
  return { separate, max };
}

function assertFullDiscount(recommendation: TeamRecommendation) {
  const { separate, max } = priced(recommendation);
  assert.ok(recommendation.agents.length >= 2);
  assert.equal(recommendation.savingPercent, 20);
  assert.equal(recommendation.separateTotalCents, separate);
  assert.ok(recommendation.monthlyPriceCents > max);
  assert.ok(recommendation.monthlyPriceCents < separate);
  assert.equal(recommendation.monthlyPriceCents, separate - Math.round(separate * 0.2));
  assert.equal(recommendation.monthlyPriceCents, bundleBySlug(recommendation.templateSlug).bundlePriceCents);
  assert.equal(Object.hasOwn(recommendation, "later"), false);
  assert.equal(Object.hasOwn(recommendation, "start"), false);
}

const clinic: SetupAnswers = {
  business: "clinic",
  stage: "running",
  budgetCents: 500_000,
  goals: ["admin"],
  teamSize: "2-5",
  channels: ["whatsapp", "phone"],
};

const youtube: SetupAnswers = {
  business: "faceless youtube channel",
  stage: "idea",
  budgetCents: 500_000,
  goals: ["content"],
  teamSize: "solo",
  channels: ["youtube"],
};

const clothing: SetupAnswers = {
  business: "clothing brand",
  stage: "starting",
  budgetCents: 600_000,
  goals: ["sales", "content"],
  teamSize: "2-5",
  channels: ["instagram"],
};

test("recommendations return the full team, keep the group discount, and do not change between calls", () => {
  const clinicTeam = recommendTeam(clinic);
  const youtubeTeam = recommendTeam(youtube);
  const clothingTeam = recommendTeam(clothing);

  assert.deepEqual(clinicTeam, recommendTeam(clinic));
  assert.deepEqual(youtubeTeam, recommendTeam(youtube));
  assert.deepEqual(clothingTeam, recommendTeam(clothing));

  assert.equal(clinicTeam.templateSlug, "healthcare-clinic");
  assert.deepEqual(clinicTeam.agents.map((agent) => agent.slug), bundleBySlug("healthcare-clinic").botSlugs);
  assert.equal(clinicTeam.agents.some((agent) => agent.slug === "outbound-sales"), false);
  assertFullDiscount(clinicTeam);

  assert.equal(youtubeTeam.templateSlug, "faceless-youtube");
  assert.deepEqual(youtubeTeam.agents.map((agent) => agent.slug), bundleBySlug("faceless-youtube").botSlugs);
  assertFullDiscount(youtubeTeam);

  assert.equal(clothingTeam.templateSlug, "fashion-brand");
  assert.deepEqual(clothingTeam.agents.map((agent) => agent.slug), bundleBySlug("fashion-brand").botSlugs);
  assertFullDiscount(clothingTeam);

  for (const team of [clinicTeam, youtubeTeam, clothingTeam]) {
    assert.equal(team.pricePlaceholder, true);
    assert.equal(team.currency, "ZAR");
    assert.ok(team.agents.length > 3);
  }
});

test("a small budget still returns the full team", () => {
  const tight = recommendTeam({ ...clinic, budgetCents: 50_000 });
  assert.deepEqual(tight.agents.map((agent) => agent.slug), recommendTeam(clinic).agents.map((agent) => agent.slug));
  assert.equal(tight.monthlyPriceCents, recommendTeam(clinic).monthlyPriceCents);
  assert.equal(tight.templateSlug, "healthcare-clinic");
});

test("audit answers use the same full team as the interview", () => {
  const fromAudit = recommendTeam(auditToSetup({
    industry: "Clinic",
    companySize: "4",
    answers: { pain: "patient admin and reminders", channels: ["whatsapp"] },
    recommendedAgents: [{ department: "Reception", agent: "Booking" }],
  }));
  assert.deepEqual(fromAudit.agents.map((agent) => agent.slug), recommendTeam(clinic).agents.map((agent) => agent.slug));
  assert.equal(fromAudit.templateSlug, "healthcare-clinic");
  const mapped = auditToSetup({ industry: "Clinic", answers: { pain: "call jane@example.com", company: "Jane Smith" } });
  assert.equal(mapped.business.includes("@"), false);
  assert.equal(mapped.business.includes("Jane Smith"), false);
  assert.equal(JSON.stringify(recommendTeam(mapped)).includes("jane@"), false);
});

test("polishing explanations leaves the full team and the price unchanged", async () => {
  const team = recommendTeam(youtube);
  const polished = await polishRecommendationExplanations(team, async () => ({
    ok: true,
    text: JSON.stringify(team.agents.map(() => "A shorter explanation. Nothing is sent.")),
  }));
  assert.deepEqual(polished.agents.map((agent) => agent.slug), team.agents.map((agent) => agent.slug));
  assert.equal(polished.monthlyPriceCents, team.monthlyPriceCents);
  assert.equal(polished.savingPercent, team.savingPercent);
  assert.equal(polished.agents[0]?.why, "A shorter explanation. Nothing is sent.");

  const unchanged = await polishRecommendationExplanations(team, async () => ({ ok: false }));
  assert.equal(unchanged.agents[0]?.why, team.agents[0]?.why);
});
