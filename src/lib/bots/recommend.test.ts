import assert from "node:assert/strict";
import test from "node:test";
import { botBySlug } from "@/lib/bots/catalog";
import {
  auditToSetup,
  polishRecommendationExplanations,
  recommendTeam,
  type SetupAnswers,
  type TeamRecommendation,
} from "@/lib/bots/recommend";

function priced(recommendation: TeamRecommendation) {
  const amounts = recommendation.start.map((agent) => agent.monthlyPriceCents);
  const separate = amounts.reduce((sum, amount) => sum + amount, 0);
  const max = amounts.reduce((highest, amount) => Math.max(highest, amount), 0);
  return { separate, max };
}

function assertBudgetAndDiscount(recommendation: TeamRecommendation, budgetCents: number) {
  assert.ok(recommendation.monthlyPriceCents <= budgetCents);
  if (recommendation.start.length >= 2) {
    const { separate, max } = priced(recommendation);
    assert.equal(recommendation.savingPercent, 20);
    assert.equal(recommendation.separateTotalCents, separate);
    assert.ok(recommendation.monthlyPriceCents > max);
    assert.ok(recommendation.monthlyPriceCents < separate);
    assert.equal(recommendation.monthlyPriceCents, separate - Math.round(separate * 0.2));
  }
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

test("recommendations stay inside the budget, keep the group discount, and do not change between calls", () => {
  const clinicTeam = recommendTeam(clinic);
  const youtubeTeam = recommendTeam(youtube);
  const clothingTeam = recommendTeam(clothing);

  assert.deepEqual(clinicTeam, recommendTeam(clinic));
  assert.deepEqual(youtubeTeam, recommendTeam(youtube));
  assert.deepEqual(clothingTeam, recommendTeam(clothing));

  assert.equal(clinicTeam.templateSlug, "healthcare-clinic");
  assert.deepEqual(clinicTeam.start.map((agent) => agent.slug), ["receptionist", "reminder-drafts", "document-admin"]);
  assert.equal(clinicTeam.start.some((agent) => agent.slug === "outbound-sales"), false);
  assert.equal(clinicTeam.monthlyPriceCents, 304_000);
  assertBudgetAndDiscount(clinicTeam, clinic.budgetCents);

  assert.equal(youtubeTeam.templateSlug, "faceless-youtube");
  assert.deepEqual(youtubeTeam.start.map((agent) => agent.slug), ["scriptwriter", "video-editor-brief", "thumbnail-brief"]);
  assert.equal(youtubeTeam.monthlyPriceCents, 328_000);
  assertBudgetAndDiscount(youtubeTeam, youtube.budgetCents);

  assert.equal(clothingTeam.templateSlug, "fashion-brand");
  assert.deepEqual(clothingTeam.start.map((agent) => agent.slug), ["brand-voice", "inbound-lead", "campaign-planner"]);
  assert.equal(clothingTeam.monthlyPriceCents, 368_000);
  assertBudgetAndDiscount(clothingTeam, clothing.budgetCents);

  for (const team of [clinicTeam, youtubeTeam, clothingTeam]) {
    assert.equal(team.pricePlaceholder, true);
    assert.equal(team.currency, "ZAR");
    assert.ok(team.later.length >= 2);
    assert.equal(team.start.length, 3);
  }
});

test("a tight clinic budget drops agents until the discounted price fits", () => {
  const tight = recommendTeam({ ...clinic, budgetCents: 150_000 });
  assert.deepEqual(tight.start.map((agent) => agent.slug), ["receptionist"]);
  assert.equal(tight.monthlyPriceCents, botBySlug("receptionist").monthlyPriceCents);
  assert.ok(tight.monthlyPriceCents <= 150_000);
  assert.equal(tight.savingPercent, 0);

  const empty = recommendTeam({ ...clinic, budgetCents: 50_000 });
  assert.deepEqual(empty.start, []);
  assert.equal(empty.monthlyPriceCents, 0);
  assert.equal(empty.templateSlug, "healthcare-clinic");
});

test("audit answers use the same recommendation as the interview", () => {
  const fromAudit = recommendTeam(auditToSetup({
    industry: "Clinic",
    companySize: "4",
    answers: { pain: "patient admin and reminders", channels: ["whatsapp"] },
    recommendedAgents: [{ department: "Reception", agent: "Booking" }],
  }));
  assert.deepEqual(fromAudit.start.map((agent) => agent.slug), recommendTeam(clinic).start.map((agent) => agent.slug));
  assert.equal(fromAudit.templateSlug, "healthcare-clinic");
  const mapped = auditToSetup({ industry: "Clinic", answers: { pain: "call jane@example.com", company: "Jane Smith" } });
  assert.equal(mapped.business.includes("@"), false);
  assert.equal(mapped.business.includes("Jane Smith"), false);
  assert.equal(JSON.stringify(recommendTeam(mapped)).includes("jane@"), false);
});

test("polishing explanations leaves the team and the price unchanged", async () => {
  const team = recommendTeam(youtube);
  const polished = await polishRecommendationExplanations(team, async () => ({
    ok: true,
    text: JSON.stringify([...team.start, ...team.later].map(() => "A shorter explanation. Nothing is sent.")),
  }));
  assert.deepEqual(polished.start.map((agent) => agent.slug), team.start.map((agent) => agent.slug));
  assert.deepEqual(polished.later.map((agent) => agent.slug), team.later.map((agent) => agent.slug));
  assert.equal(polished.monthlyPriceCents, team.monthlyPriceCents);
  assert.equal(polished.savingPercent, team.savingPercent);
  assert.equal(polished.start[0]?.why, "A shorter explanation. Nothing is sent.");

  const unchanged = await polishRecommendationExplanations(team, async () => ({ ok: false }));
  assert.equal(unchanged.start[0]?.why, team.start[0]?.why);
});
