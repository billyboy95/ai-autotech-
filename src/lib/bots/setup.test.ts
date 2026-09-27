import assert from "node:assert/strict";
import test from "node:test";
import { BOT_CATALOG, botBySlug, bundleBySlug } from "@/lib/bots/catalog";
import { configurePaidTeam } from "@/lib/bots/configure";
import { parseContactCsv } from "@/lib/bots/contact-csv";
import { openBotCheckout } from "@/lib/bots/billing";
import { accountsForTemplate, agentQuestionSteps } from "@/lib/bots/interview";
import { agentProgressLabel } from "@/lib/bots/setup-questions";

const SANDBOX = {
  BILLING_SANDBOX: "true",
  PAYFAST_MERCHANT_ID: "10000100",
  PAYFAST_MERCHANT_KEY: "sandbox",
};

test("every agent has setup questions and shared questions are asked once", () => {
  for (const bot of BOT_CATALOG) {
    assert.ok(bot.setupQuestions.length > 0, bot.slug);
  }
  const slugs = bundleBySlug("healthcare-clinic").botSlugs;
  const steps = agentQuestionSteps(slugs);
  assert.equal(steps.length, slugs.length);
  const asked = steps.flatMap((step) => step.questions.map((question) => question.id));
  assert.equal(new Set(asked).size, asked.length);
  assert.ok(asked.includes("tone"));
  assert.ok(asked.includes("booking-rules"));
  assert.equal(steps[1]?.questions.some((question) => question.id === "tone"), false);
  const sales = bundleBySlug("real-estate").botSlugs;
  const outbound = sales.indexOf("outbound-sales");
  assert.equal(agentProgressLabel(outbound, sales.length, botBySlug("outbound-sales").name), "Agent 2 of 5: Outbound Sales");
});

test("a paid sandbox checkout configures every agent and an unpaid checkout configures none", () => {
  const slugs = bundleBySlug("healthcare-clinic").botSlugs;
  const opened = openBotCheckout({
    orgId: "org-clinic",
    orgName: "Clinic",
    bundleSlug: "healthcare-clinic",
    intent: "buy",
    env: SANDBOX,
  });
  assert.equal(opened.checkout.sandbox, true);
  assert.equal(opened.checkout.charged, false);
  assert.equal(opened.lines.length, slugs.length);

  const paid = configurePaidTeam({
    orgId: "org-clinic",
    orgName: "Clinic",
    templateSlug: "healthcare-clinic",
    answers: { tone: "Warm", hours: "08:00-17:00", "booking-rules": "Same day only", offers: "Consults" },
    checkout: opened.checkout,
    lines: opened.lines,
    env: SANDBOX,
  });
  assert.equal(paid.configured, true);
  assert.deepEqual(paid.book.bots.map((bot) => bot.botSlug), slugs);
  assert.equal(paid.book.sendingEnabled, false);
  assert.deepEqual(paid.book.secrets, []);
  assert.ok(paid.book.pipelines.length > 0);
  assert.ok(paid.book.workflows.length > 0);
  assert.ok(paid.book.workflows.every((flow) => flow.active === false));
  const receptionist = paid.book.bots.find((bot) => bot.botSlug === "receptionist");
  const documents = paid.book.bots.find((bot) => bot.botSlug === "document-admin");
  assert.equal(receptionist?.config.tone, "Warm");
  assert.equal(receptionist?.config.workingHours.start, "08:00");
  assert.equal(receptionist?.config.setup?.["booking-rules"], "Same day only");
  assert.equal(documents?.config.tone, "Warm");
  assert.equal(documents?.config.setup?.["booking-rules"], undefined);
  assert.equal(documents?.config.setup?.faqs, undefined);

  const unpaid = configurePaidTeam({
    orgId: "org-clinic",
    orgName: "Clinic",
    templateSlug: "healthcare-clinic",
    answers: { tone: "Warm" },
    checkout: { sandbox: true, charged: true },
    lines: opened.lines,
    env: SANDBOX,
  });
  assert.equal(unpaid.configured, false);
  assert.deepEqual(unpaid.book.bots, []);
  assert.equal(unpaid.book.pipelines.length, 0);
});

test("the connect checklist only lists accounts the team uses", () => {
  const clinic = accountsForTemplate("healthcare-clinic").map((account) => account.id);
  assert.deepEqual(clinic, ["email", "whatsapp", "calendar"]);
  const youtube = accountsForTemplate("faceless-youtube").map((account) => account.id);
  assert.ok(youtube.includes("youtube"));
  assert.equal(youtube.includes("tiktok"), false);
  assert.equal(youtube.includes("calendar"), false);
});

test("contact import reuses consent_basis and does not invent a row", () => {
  const parsed = parseContactCsv("name,email,phone,company,consent_basis\nAda Lovelace,ada@example.com,+27110000000,Clinic,consent\n");
  assert.equal(parsed.error, "");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.firstName, "Ada");
  assert.equal(parsed.rows[0]?.lastName, "Lovelace");
  assert.equal(parsed.rows[0]?.consentBasis, "consent");
  const missing = parseContactCsv("name,email\nAda,ada@example.com\n");
  assert.match(missing.error, /consent_basis/);
  assert.deepEqual(missing.rows, []);
});
