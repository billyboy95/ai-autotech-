import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ReplyProvider } from "@/lib/ai-reply/provider";
import { applyConfirmedActions, proposeAssistantActions, proposalsFromText } from "@/lib/bots/assistant";
import { addSandboxBotLines, openBotCheckout } from "@/lib/bots/billing";
import { AGENT_DEPARTMENTS, BOT_CATALOG, BOT_BUNDLES, EDUCATION_ADMISSIONS_PIPELINE, TEAM_TEMPLATES, bundleBySlug } from "@/lib/bots/catalog";
import { EDUCATION_PAYLOAD } from "@/lib/snapshots/catalog";
import { isBotAssistantEnabled } from "@/lib/bots/flag";
import { allocateBundlePrice, assertBundleDiscount, bundleSaving } from "@/lib/bots/pricing";
import { PLATFORM_FEE_CENTS, teamDiscountPercent } from "@/lib/pricing/price-sheet";
import { runBot } from "@/lib/bots/runtime";
import { applyTeamTemplate, emptyTemplateBook } from "@/lib/bots/templates";

const sandboxEnv = {
  BILLING_SANDBOX: "true",
  PAYFAST_MERCHANT_ID: "10000100",
  PAYFAST_MERCHANT_KEY: "sandbox-key",
  PAYFAST_PASSPHRASE: "",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
} as NodeJS.ProcessEnv;

test("catalogue prices are placeholders and every bundle is a real group discount", () => {
  assert.equal(BOT_CATALOG.every((bot) => bot.pricePlaceholder && bot.currency === "ZAR"), true);
  for (const bundle of BOT_BUNDLES) {
    const saving = assertBundleDiscount(bundle);
    const percent = teamDiscountPercent(bundle.botSlugs.length);
    assert.equal(saving.savingPercent, percent);
    assert.equal(bundle.pricePlaceholder, true);
    assert.ok(saving.bundlePriceCents > saving.maxBotCents);
    if (percent === 0) assert.equal(saving.bundlePriceCents, saving.separateTotalCents);
    else assert.ok(saving.bundlePriceCents < saving.separateTotalCents);
    const shares = allocateBundlePrice(
      bundle.botSlugs.map((slug) => BOT_CATALOG.find((bot) => bot.slug === slug)!),
      saving.bundlePriceCents,
    );
    assert.equal(shares.reduce((sum, line) => sum + line.amountCents, 0), saving.bundlePriceCents);
  }
  const inbound = BOT_CATALOG.find((bot) => bot.slug === "inbound-lead");
  assert.equal(inbound?.tier, "included");
  assert.equal(inbound?.monthlyPriceCents, 0);
  assert.equal(BOT_CATALOG.find((bot) => bot.slug === "outbound-sales")?.tier, "pro");
  assert.equal(BOT_CATALOG.find((bot) => bot.slug === "onboarding")?.tier, "starter");
  assert.equal(BOT_CATALOG.find((bot) => bot.slug === "ads")?.tier, "pro");
  assert.equal(BOT_CATALOG.find((bot) => bot.slug === "social-posting")?.tier, "starter");
  const sales = bundleBySlug("sales-team");
  assert.equal(sales.discountPercent, 10);
  assert.equal(bundleBySlug("marketing-team").discountPercent, 0);
  assert.equal(bundleBySlug("full-business").discountPercent, 15);
  assert.ok(BOT_CATALOG.length >= 40);
  assert.equal(new Set(BOT_CATALOG.map((bot) => bot.slug)).size, BOT_CATALOG.length);
  for (const department of AGENT_DEPARTMENTS) {
    assert.ok(BOT_CATALOG.some((bot) => bot.department === department), department);
  }
  assert.throws(() => assertBundleDiscount({ ...sales, bundlePriceCents: bundleSaving(sales).separateTotalCents }));
  assert.throws(() => assertBundleDiscount({ ...sales, bundlePriceCents: bundleSaving(sales).maxBotCents }));
  const education = EDUCATION_PAYLOAD.pipelines[0];
  assert.deepEqual(
    EDUCATION_ADMISSIONS_PIPELINE.stages.map((stage) => stage.assetKey),
    education.stages.map((stage) => stage.asset_key),
  );
  assert.ok(TEAM_TEMPLATES.length >= 17);
  assert.ok(TEAM_TEMPLATES.some((template) => template.slug === "healthcare-clinic"));
  assert.ok(TEAM_TEMPLATES.some((template) => template.industry === "education"));
});

test("sandbox checkout never charges and does not add a second subscription", () => {
  const trial = openBotCheckout({
    orgId: "org-1",
    orgName: "EASTC",
    bundleSlug: "sales-team",
    intent: "trial",
    env: sandboxEnv,
  });
  assert.equal(trial.checkout.sandbox, true);
  assert.equal(trial.checkout.charged, false);
  assert.equal(trial.checkout.mode, "form");
  assert.match(trial.checkout.actionUrl || "", /sandbox\.payfast\.co\.za/);
  const ledger = addSandboxBotLines({ subscriptions: [{ orgId: "org-1" }], lines: [] }, trial.lines);
  assert.equal(ledger.subscriptions.length, 1);
  assert.equal(ledger.lines.length, 3);
  assert.equal(ledger.lines.every((line) => line.sandbox && line.charged === false), true);
  assert.equal(ledger.lines.reduce((sum, line) => sum + line.amountCents, 0), bundleBySlug("sales-team").bundlePriceCents);
  assert.equal(trial.checkout.fields?.amount, ((bundleBySlug("sales-team").bundlePriceCents + PLATFORM_FEE_CENTS) / 100).toFixed(2));

  const again = addSandboxBotLines(ledger, trial.lines);
  assert.equal(again.lines.length, 3);

  const closed = openBotCheckout({
    orgId: "org-1",
    orgName: "EASTC",
    botSlug: "ads",
    intent: "buy",
    env: { BILLING_SANDBOX: "false" },
  });
  assert.equal(closed.lines.length, 0);
  assert.equal(closed.checkout.charged, false);
  assert.equal(closed.checkout.sandbox, true);

  const live = openBotCheckout({
    orgId: "org-1",
    orgName: "EASTC",
    botSlug: "ads",
    intent: "buy",
    env: { ...sandboxEnv, PAYFAST_MERCHANT_ID: "20000100" },
  });
  assert.equal(live.lines.length, 0);
  assert.equal(live.checkout.charged, false);
  assert.match(live.checkout.message, /10000100/);
});

test("team templates apply once and do not duplicate or send", () => {
  const env = sandboxEnv;
  const first = applyTeamTemplate(emptyTemplateBook([{ orgId: "org-1" }]), {
    orgId: "org-1",
    orgName: "EASTC",
    templateSlug: "sales-team",
    env,
  });
  assert.equal(first.createdStages, 6);
  assert.equal(first.book.sendingEnabled, false);
  assert.equal(first.book.contacts.length, 0);
  assert.equal(first.book.messages.length, 0);
  assert.equal(first.book.secrets.length, 0);
  assert.equal(first.book.workflows.every((flow) => flow.active === false), true);
  assert.equal(first.book.ledger.subscriptions.length, 1);
  const second = applyTeamTemplate(first.book, {
    orgId: "org-1",
    orgName: "EASTC",
    templateSlug: "sales-team",
    env,
  });
  assert.equal(second.createdStages, 0);
  assert.equal(second.book.pipelines[0].stages.length, 6);
  assert.equal(second.book.workflows.length, 2);
  assert.equal(second.book.bots.length, 3);
  assert.equal(second.book.ledger.lines.length, 3);

  const full = applyTeamTemplate(second.book, {
    orgId: "org-1",
    orgName: "EASTC",
    templateSlug: "full-business",
    env,
  });
  assert.equal(full.book.pipelines.length, 2);
  assert.equal(full.book.bots.length, 5);
  assert.equal(full.book.sendingEnabled, false);
  const clinic = applyTeamTemplate(full.book, {
    orgId: "org-1",
    orgName: "EASTC",
    templateSlug: "healthcare-clinic",
    env,
  });
  assert.equal(clinic.book.sendingEnabled, false);
  assert.equal(clinic.book.contacts.length, 0);
  const clinicAgain = applyTeamTemplate(clinic.book, {
    orgId: "org-1",
    orgName: "EASTC",
    templateSlug: "healthcare-clinic",
    env,
  });
  assert.equal(clinicAgain.createdStages, 0);
});

test("bot runs stay drafts or tasks", () => {
  const base = {
    sendingEnabled: false,
    suppressed: false,
    stopped: false,
    consents: [{ channel: "whatsapp", status: "opted_in" }, { channel: "email", status: "opted_in" }],
    leadName: "Lerato",
  };
  const inbound = runBot({ ...base, slug: "inbound-lead" });
  assert.equal(inbound.status, "drafted");
  assert.ok(inbound.artifacts.some((item) => item.kind === "task"));
  assert.ok(inbound.artifacts.some((item) => item.kind === "draft"));
  assert.equal(inbound.artifacts.some((item) => item.outboxStatus === "draft" && item.status !== "draft"), false);

  const skipped = runBot({ ...base, slug: "outbound-sales", consents: [], suppressed: true });
  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.artifacts.length, 0);

  const outbound = runBot({ ...base, slug: "outbound-sales", sendingEnabled: true });
  assert.equal(outbound.output.outboxStatus, "draft");
  assert.equal(outbound.artifacts.every((item) => !item.outboxStatus || item.outboxStatus === "draft"), true);
  assert.equal(JSON.stringify(outbound).includes('"queued"'), false);
  assert.equal(JSON.stringify(outbound).includes('"sent"'), false);

  const onboarding = runBot({ ...base, slug: "onboarding" });
  assert.match(onboarding.output.draftBody || "", /\/book\//);
  assert.ok(onboarding.artifacts.some((item) => item.kind === "task"));

  for (const slug of ["ads", "social-posting"] as const) {
    const run = runBot({ ...base, slug });
    assert.equal(run.artifacts.every((item) => item.kind === "draft" && !item.outboxStatus), true);
    assert.match(run.summary, /draft/i);
  }
});

test("the assistant stays off without the flag and key, and confirm does not send", async () => {
  assert.equal(isBotAssistantEnabled({}), false);
  assert.equal(isBotAssistantEnabled({ BOT_ASSISTANT_ENABLED: "true" }), false);
  assert.equal(isBotAssistantEnabled({ BOT_ASSISTANT_ENABLED: "true", AI_REPLY_API_KEY: "test-key" }), true);

  const off = await proposeAssistantActions({ request: "send the lead a message", env: {} });
  assert.equal(off.enabled, false);
  assert.equal(off.proposals.length, 0);

  const provider: ReplyProvider = {
    model: "test",
    configured: () => true,
    async complete() {
      return {
        ok: true,
        model: "test",
        text: JSON.stringify({
          actions: [
            { kind: "create_task", label: "Call Lerato", detail: "Today" },
            { kind: "send_message", label: "Send now", detail: "no" },
            { kind: "draft_message", label: "Draft a follow-up", detail: "Hello, this is a draft." },
            { kind: "activate_bot", label: "Activate Inbound Lead", detail: "inbound-lead" },
          ],
        }),
      };
    },
  };
  const plan = await proposeAssistantActions({
    request: "help with this lead",
    env: { BOT_ASSISTANT_ENABLED: "true", AI_REPLY_API_KEY: "test-key" },
    provider,
  });
  assert.equal(plan.proposals.some((item) => item.kind === "create_task"), true);
  assert.equal(plan.proposals.some((item) => (item.kind as string) === "send_message"), false);
  const book = applyConfirmedActions(
    { sendingEnabled: false, tasks: [], drafts: [], stageMoves: [], activeBots: [] },
    plan.proposals,
    plan.proposals.map((item) => item.id),
  );
  assert.equal(book.sendingEnabled, false);
  assert.equal(book.tasks.length, 1);
  assert.equal(book.drafts.length, 1);
  assert.equal(book.drafts[0].status, "draft");
  assert.deepEqual(book.activeBots, ["inbound-lead"]);
  assert.equal(proposalsFromText('{"actions":[{"kind":"send","label":"Send"}]}').length, 0);
});

test("phase 4c pricing migration is additive and keeps sending off", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261026120000_phase4c_aios_pricing.sql", import.meta.url), "utf8");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/\bdrop table\b/i.test(sql), false);
  assert.match(sql, /agent_starter/);
  assert.match(sql, /agent_always_on/);
  assert.match(sql, /'included'/);
  assert.match(sql, /markup_multiplier = 1\.5/);
  assert.match(sql, /setup_quick_start/);
  assert.match(sql, /250000/);
  assert.match(sql, /499900/);
  assert.match(sql, /price_placeholder/);
});

test("phase 4a migration does not send, delete, or charge", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261024120000_phase4a_bots.sql", import.meta.url), "utf8");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/\bdrop table\b/i.test(sql), false);
  assert.match(sql, /to be confirmed by Billy/);
  assert.match(sql, /price_placeholder/);
  assert.match(sql, /check \(sandbox\)/);
  assert.match(sql, /check \(charged = false\)/);
  assert.match(sql, /'draft'/);
  assert.match(sql, /healthcare-clinic/);
  assert.match(sql, /faceless-youtube/);
  assert.match(sql, /scriptwriter/);
  assert.match(sql, /start_recommended_sandbox_team/);
  assert.match(sql, /share_token/);
  assert.match(sql, /stage:admissions:enquiry/);
  assert.match(sql, /department/);
  for (const slug of ["inbound-lead", "outbound-sales", "onboarding", "ads", "social-posting", "sales-team", "marketing-team", "full-business", "admin-team", "education-school"]) {
    assert.match(sql, new RegExp(slug));
  }
});
