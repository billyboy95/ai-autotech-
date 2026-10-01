import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

test("inbox, conversation AI, calendars, reviews, referrals, and public pages respond", { timeout: 180_000 }, async () => {
  const port = 4187;
  const root = new URL("../../..", import.meta.url).pathname;
  const nextBin = new URL("../../../node_modules/next/dist/bin/next", import.meta.url).pathname;
  const child = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    detached: true,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      VERCEL_ENV: "",
      AI_REPLY_CRON_ENABLED: "",
      AI_REPLY_API_KEY: "",
      CAMPAIGN_DRY_RUN_ENABLED: "",
      META_CONNECT_STUB_ENABLED: "",
      CAMPAIGN_CSV_IMPORT_ENABLED: "",
      EMAIL_SMS_CONNECT_STUB_ENABLED: "",
      SOCIAL_DRAFTS_ENABLED: "",
      TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED: "",
      ZENTRIX_WORKSPACE_PACK_ENABLED: "",
      EAST_RAND_CAMPAIGN_SEED_ENABLED: "",
      PWA_INSTALL_SHELL_ENABLED: "",
      SETUP_WIZARD_ENABLED: "",
      MIGRATION_RUNNER_ENABLED: "",
      OWNER_BOOTSTRAP_UI_ENABLED: "",
      OPS_SECRETS_READY_ENABLED: "",
      RESEND_API_KEY: "",
      SMTP_HOST: "",
      SMTP_PASS: "",
      WHATSAPP_TOKEN: "",
      WHATSAPP_PHONE_NUMBER_ID: "",
      META_PAGE_ACCESS_TOKEN: "",
      META_PAGE_ID: "",
      BULKSMS_TOKEN_ID: "",
      BULKSMS_TOKEN_SECRET: "",
      CLICKATELL_API_KEY: "",
      TWILIO_AUTH_TOKEN: "",
      SMSPORTAL_API_SECRET: "",
      PAYFAST_MERCHANT_KEY: "",
      PAYFAST_PASSPHRASE: "",
      SUPABASE_DB_URL: "",
      AUTOMATION_SEND_ENABLED: "",
      BILLING_SANDBOX: "",
      CRON_SECRET: "",
      PAYFAST_MERCHANT_ID: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });

  const stop = () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  };

  try {
    const deadline = Date.now() + 150_000;
    let inbox = null;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/command-centre/inbox`, { redirect: "manual" });
        if (response.status === 200) {
          inbox = response;
          break;
        }
      } catch {
        // The dev server is still booting.
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(inbox, output.slice(-2000));
    const inboxHtml = await inbox.text();
    assert.match(inboxHtml, /Inbox/);
    assert.match(inboxHtml, /Draft with AI/);

    const settings = await fetch(`http://127.0.0.1:${port}/command-centre/ai-replies`, { redirect: "manual" });
    assert.equal(settings.status, 200);
    const settingsHtml = await settings.text();
    assert.match(settingsHtml, /Conversation AI/);
    assert.match(settingsHtml, /AI_REPLY_API_KEY/);
    assert.match(settingsHtml, /Off until an agency owner or client admin enables it/);

    const calendars = await fetch(`http://127.0.0.1:${port}/command-centre/calendars`, { redirect: "manual" });
    assert.equal(calendars.status, 200);
    const calendarsHtml = await calendars.text();
    assert.match(calendarsHtml, /Calendars/);
    assert.match(calendarsHtml, /appointment\.booked/);

    const bots = await fetch(`http://127.0.0.1:${port}/command-centre/bots`, { redirect: "manual" });
    assert.equal(bots.status, 200);
    const botsHtml = await bots.text();
    assert.match(botsHtml, /Agent store/);
    assert.match(botsHtml, /Placeholder price/);
    assert.match(botsHtml, /Save 10% vs buying separately/);
    assert.match(botsHtml, /Save 15% vs buying separately/);
    assert.match(botsHtml, /\/command-centre\/lead-agent/);
    assert.match(botsHtml, /Build the full team/);
    assert.doesNotMatch(botsHtml, /start with (these )?(3|three)/i);
    assert.doesNotMatch(botsHtml, /Save 0%/);

    const bot = await fetch(`http://127.0.0.1:${port}/command-centre/bots/inbound-lead`, { redirect: "manual" });
    assert.equal(bot.status, 200);
    const botHtml = await bot.text();
    assert.match(botHtml, /Inbound Lead/);
    assert.match(botHtml, /Activity/);
    assert.match(botHtml, /Reports to/);
    assert.match(botHtml, /View computer/);

    const computer = await fetch(`http://127.0.0.1:${port}/command-centre/bots/inbound-lead/computer`, { redirect: "manual" });
    assert.equal(computer.status, 200);
    const computerHtml = await computer.text();
    assert.match(computerHtml, /View only/);
    assert.match(computerHtml, /sandbox/i);
    assert.match(computerHtml, /until Billy enables a provider/);
    assert.match(computerHtml, /Add a fixture minute/);

    const computerView = await fetch(`http://127.0.0.1:${port}/command-centre/bots/inbound-lead/computer/view?viewOnly=1&provider=fixture`, { redirect: "manual" });
    assert.equal(computerView.status, 200);
    const computerViewHtml = await computerView.text();
    assert.match(computerViewHtml, /Sandbox computer/);
    assert.match(computerViewHtml, /View only/);

    const templates = await fetch(`http://127.0.0.1:${port}/command-centre/agents/templates`, { redirect: "manual" });
    assert.equal(templates.status, 200);
    const templatesHtml = await templates.text();
    assert.match(templatesHtml, /Templates/);
    assert.match(templatesHtml, /Healthcare/);

    const team = await fetch(`http://127.0.0.1:${port}/command-centre/team`, { redirect: "manual" });
    assert.equal(team.status, 200);
    const teamHtml = await team.text();
    assert.match(teamHtml, /Team/);
    assert.match(teamHtml, /reports to/);

    const setup = await fetch(`http://127.0.0.1:${port}/command-centre/setup`, { redirect: "manual" });
    assert.equal(setup.status, 200);
    const setupHtml = await setup.text();
    assert.match(setupHtml, /Lead Agent/);
    assert.match(setupHtml, /Clinic/);
    assert.match(setupHtml, /Setup \/ go-live wizard/);
    assert.match(setupHtml, /billyfaber06@gmail.com/);
    assert.match(setupHtml, /phase4c_aios_pricing/);
    assert.match(setupHtml, /phase5j_pwa_mobile_shell/);
    assert.match(setupHtml, /Do not claim applied/);
    assert.match(setupHtml, /CRON_SECRET/);
    assert.match(setupHtml, /Missing/);
    assert.match(setupHtml, /APPLY-ORDER\.md/);
    assert.match(setupHtml, /SETUP_WIZARD_ENABLED/);
    assert.match(setupHtml, /write: false/);
    assert.match(setupHtml, /data-write="false"/);
    assert.match(setupHtml, /\/command-centre\/connect-accounts\/whatsapp/);
    assert.match(setupHtml, /Not connected/);
    assert.match(setupHtml, /BILLING_SANDBOX/);
    assert.match(setupHtml, /EAST_RAND_CAMPAIGN_SEED_ENABLED/);
    assert.match(setupHtml, /ZENTRIX_WORKSPACE_PACK_ENABLED/);
    assert.match(setupHtml, /PWA_INSTALL_SHELL_ENABLED/);
    assert.match(setupHtml, /writes nothing/);
    assert.match(setupHtml, /MIGRATION_RUNNER_ENABLED/);
    assert.match(setupHtml, /Step 33 is also unapplied/);
    assert.match(setupHtml, /Step 34 is also unapplied/);
    assert.match(setupHtml, /Step 35 is also unapplied/);
    assert.match(setupHtml, /OWNER_BOOTSTRAP_UI_ENABLED/);
    assert.match(setupHtml, /OPS_SECRETS_READY_ENABLED/);
    assert.match(setupHtml, /Open ops secrets/);
    assert.match(setupHtml, /data-cron="fixture"/);
    assert.match(setupHtml, /data-registered="false"/);
    assert.match(setupHtml, /workflow-engine/);
    assert.match(setupHtml, /Owner bootstrap/);
    assert.match(setupHtml, /Auth attach is fixture/);
    assert.match(setupHtml, /Open SQL editor/);
    assert.match(setupHtml, /does not create an Auth user/);
    assert.match(setupHtml, /data-auth-attach="fixture"/);
    assert.match(setupHtml, /data-owner-emails="(configured|missing)"/);

    const migrations = await fetch(`http://127.0.0.1:${port}/command-centre/migrations`, { redirect: "manual" });
    assert.equal(migrations.status, 200);
    const migrationsHtml = await migrations.text();
    assert.match(migrationsHtml, /Migration runner/);
    assert.match(migrationsHtml, /phase4c_aios_pricing/);
    assert.match(migrationsHtml, /phase5l_migration_runner/);
    assert.match(migrationsHtml, /MIGRATION_RUNNER_ENABLED is unset/);
    assert.match(migrationsHtml, /SUPABASE_DB_URL is missing/);
    assert.match(migrationsHtml, /SQL is not applied/);
    assert.match(migrationsHtml, /write: false/);
    assert.match(migrationsHtml, /data-write="false"/);
    assert.match(migrationsHtml, /data-status="pending"/);
    assert.equal(migrationsHtml.includes('data-status="applied"'), false);
    assert.equal(migrationsHtml.includes("sbp_"), false);

    const owner = await fetch(`http://127.0.0.1:${port}/command-centre/owner`, { redirect: "manual" });
    assert.equal(owner.status, 200);
    const ownerHtml = await owner.text();
    assert.match(ownerHtml, /Owner bootstrap/);
    assert.match(ownerHtml, /billyfaber06@gmail.com/);
    assert.match(ownerHtml, /Auth attach is fixture/);
    assert.match(ownerHtml, /OWNER_BOOTSTRAP_UI_ENABLED is unset/);
    assert.match(ownerHtml, /Open SQL editor/);
    assert.match(ownerHtml, /Steps 20 through 33 are not applied/);
    assert.match(ownerHtml, /Step 34 is also unapplied/);
    assert.match(ownerHtml, /Step 35 is also unapplied/);
    assert.match(ownerHtml, /write: false/);
    assert.match(ownerHtml, /data-write="false"/);
    assert.match(ownerHtml, /data-auth-attach="fixture"/);
    assert.match(ownerHtml, /on conflict/);
    assert.equal(ownerHtml.includes("sbp_"), false);

    const opsSecrets = await fetch(`http://127.0.0.1:${port}/command-centre/ops-secrets`, { redirect: "manual" });
    assert.equal(opsSecrets.status, 200);
    const opsHtml = await opsSecrets.text();
    assert.match(opsHtml, /Ops secrets/);
    assert.match(opsHtml, /CRON_SECRET is fixture/);
    assert.match(opsHtml, /Email provider is fixture/);
    assert.match(opsHtml, /WhatsApp \/ Meta is fixture/);
    assert.match(opsHtml, /SMS provider is fixture/);
    assert.match(opsHtml, /PayFast sandbox keys is fixture/);
    assert.match(opsHtml, /The value is not shown/);
    assert.match(opsHtml, /OPS_SECRETS_READY_ENABLED is unset/);
    assert.match(opsHtml, /workflow-engine/);
    assert.match(opsHtml, /billing-cycle/);
    assert.match(opsHtml, /ai-reply-drafts/);
    assert.match(opsHtml, /would be registered once CRON_SECRET exists/);
    assert.match(opsHtml, /does not register them/);
    assert.match(opsHtml, /Step 35 is also unapplied/);
    assert.match(opsHtml, /write: false/);
    assert.match(opsHtml, /data-write="false"/);
    assert.match(opsHtml, /data-cron="fixture"/);
    assert.match(opsHtml, /data-registered="false"/);
    assert.equal(opsHtml.includes("sbp_"), false);
    assert.equal(opsHtml.includes("re_"), false);

    const leadAgent = await fetch(`http://127.0.0.1:${port}/command-centre/lead-agent`, { redirect: "manual" });
    assert.equal(leadAgent.status, 200);
    const leadHtml = await leadAgent.text();
    assert.match(leadHtml, /Lead Agent/);
    assert.match(leadHtml, /What is the niche/);
    assert.match(leadHtml, /full team/i);
    assert.match(leadHtml, /Start this team/);
    assert.match(leadHtml, /excluding VAT/);
    assert.match(leadHtml, /sandbox/i);
    assert.doesNotMatch(leadHtml, /start with (these )?(3|three)/i);
    assert.doesNotMatch(leadHtml, /Connect your accounts/);
    assert.doesNotMatch(leadHtml, /Import your contacts/);

    const home = await fetch(`http://127.0.0.1:${port}/command-centre`, { redirect: "manual" });
    assert.equal(home.status, 200);
    const homeHtml = await home.text();
    assert.match(homeHtml, /Assistant/);
    assert.match(homeHtml, /Fixture only/);
    assert.match(homeHtml, /What do you want to do\?/);
    assert.match(homeHtml, /Nothing is sent/);
    assert.match(homeHtml, /Ask the assistant/);
    assert.match(homeHtml, /Ops readiness/);
    assert.match(homeHtml, /Steps 20 through 29/);
    assert.match(homeHtml, /sending_enabled stays false/);
    assert.match(homeHtml, /CRON_SECRET/);
    assert.match(homeHtml, /Needs Billy/);
    assert.match(homeHtml, /BILLING_SANDBOX/);
    assert.match(homeHtml, /ZENTRIX_WORKSPACE_PACK_ENABLED/);
    assert.match(homeHtml, /Step 30 is also unapplied/);
    assert.match(homeHtml, /Step 31 is also unapplied/);
    assert.match(homeHtml, /Step 32 is also unapplied/);
    assert.match(homeHtml, /Step 33 is also unapplied/);
    assert.match(homeHtml, /Step 34 is also unapplied/);
    assert.match(homeHtml, /Step 35 is also unapplied/);
    assert.match(homeHtml, /Open owner bootstrap/);
    assert.match(homeHtml, /Open ops secrets/);
    assert.match(homeHtml, /\/command-centre\/ops-secrets/);
    assert.match(homeHtml, /Open setup wizard/);
    assert.match(homeHtml, /Migration runner/);
    assert.match(homeHtml, /phase5l_migration_runner/);
    assert.match(homeHtml, /MIGRATION_RUNNER_ENABLED is unset/);
    assert.match(homeHtml, /SUPABASE_DB_URL is missing/);
    assert.match(homeHtml, /SQL is not applied/);
    assert.match(homeHtml, /data-write="false"/);
    assert.match(homeHtml, /data-status="pending"/);
    assert.equal(homeHtml.includes('data-status="applied"'), false);
    assert.match(homeHtml, /\/command-centre\/setup/);
    assert.match(homeHtml, /PWA install/);
    assert.match(homeHtml, /Optional/);
    assert.match(homeHtml, /Not a go-live blocker/);
    assert.doesNotMatch(homeHtml, /start with (these )?(3|three)/i);

    const assistant = await fetch(`http://127.0.0.1:${port}/command-centre/assistant`, { redirect: "manual" });
    assert.equal(assistant.status, 200);
    const assistantHtml = await assistant.text();
    assert.match(assistantHtml, /Assistant/);
    assert.match(assistantHtml, /Fixture only/);
    assert.match(assistantHtml, /Open the pipeline/);
    assert.match(assistantHtml, /Nothing is sent/);
    assert.doesNotMatch(assistantHtml, /start with (these )?(3|three)/i);

    const campaigns = await fetch(`http://127.0.0.1:${port}/command-centre/campaigns`, { redirect: "manual" });
    assert.equal(campaigns.status, 200);
    const campaignsHtml = await campaigns.text();
    assert.match(campaignsHtml, /Campaign dry run/);
    assert.match(campaignsHtml, /consent_basis/);
    assert.match(campaignsHtml, /Not charged/);
    assert.match(campaignsHtml, /Sending stays off/);
    assert.match(campaignsHtml, /Dry run/);
    assert.match(campaignsHtml, /Send now/);
    assert.match(campaignsHtml, /would receive/);
    assert.match(campaignsHtml, /POPIA/);
    assert.match(campaignsHtml, /STOP/);
    assert.match(campaignsHtml, /Outbox queued: 0/);
    assert.match(campaignsHtml, /Sandbox CSV import/);
    assert.match(campaignsHtml, /Imported/);
    assert.match(campaignsHtml, /missing consent/);
    assert.match(campaignsHtml, /CAMPAIGN_CSV_IMPORT_ENABLED/);
    assert.match(campaignsHtml, /Dry-load CSV/);
    assert.match(campaignsHtml, /East Rand sandbox seed/);
    assert.match(campaignsHtml, /EAST_RAND_CAMPAIGN_SEED_ENABLED/);
    assert.match(campaignsHtml, /Load sandbox seed/);
    assert.match(campaignsHtml, /Go live/);
    assert.match(campaignsHtml, /POPIA blocked/);
    assert.match(campaignsHtml, /STOP blocked/);
    assert.doesNotMatch(campaignsHtml, /start with (these )?(3|three)/i);

    const connectAccounts = await fetch(`http://127.0.0.1:${port}/command-centre/connect-accounts`, { redirect: "manual" });
    assert.equal(connectAccounts.status, 200);
    const connectHtml = await connectAccounts.text();
    assert.match(connectHtml, /Connect accounts/);
    assert.match(connectHtml, /Email \/ Gmail/);
    assert.match(connectHtml, /WhatsApp \(Meta Cloud\)/);
    assert.match(connectHtml, /Needs keys/);
    assert.match(connectHtml, /Connected/);
    assert.match(connectHtml, /Not connected/);
    assert.match(connectHtml, /Sandbox stub/);
    assert.match(connectHtml, /Needs provider keys/);
    assert.match(connectHtml, /Nothing is sent/);
    assert.match(connectHtml, /Resend or SMTP/);
    assert.match(connectHtml, /SMSPortal/);
    assert.match(connectHtml, /BulkSMS/);
    assert.match(connectHtml, /Clickatell/);
    assert.match(connectHtml, /placeholders/);
    assert.match(connectHtml, /TikTok/);
    assert.match(connectHtml, /LinkedIn/);
    assert.match(connectHtml, /Billy must add the keys later/);
    assert.doesNotMatch(connectHtml, /start with (these )?(3|three)/i);

    const whatsappStub = await fetch(`http://127.0.0.1:${port}/command-centre/connect-accounts/whatsapp`, { redirect: "manual" });
    assert.equal(whatsappStub.status, 200);
    const whatsappHtml = await whatsappStub.text();
    assert.match(whatsappHtml, /Billy must add Meta app credentials later/);
    assert.match(whatsappHtml, /No OAuth/);
    assert.match(whatsappHtml, /Needs provider keys/);
    assert.match(whatsappHtml, /Send test/);
    assert.match(whatsappHtml, /Outbox queued: 0/);
    assert.doesNotMatch(whatsappHtml, /start with (these )?(3|three)/i);

    const emailStub = await fetch(`http://127.0.0.1:${port}/command-centre/connect-accounts/gmail`, { redirect: "manual" });
    assert.equal(emailStub.status, 200);
    const emailHtml = await emailStub.text();
    assert.match(emailHtml, /Billy must add Resend or SMTP keys later/);
    assert.match(emailHtml, /No OAuth/);
    assert.match(emailHtml, /Needs provider keys/);
    assert.match(emailHtml, /Send test/);
    assert.match(emailHtml, /Outbox queued: 0/);
    assert.doesNotMatch(emailHtml, /start with (these )?(3|three)/i);

    const smsStub = await fetch(`http://127.0.0.1:${port}/command-centre/connect-accounts/sms`, { redirect: "manual" });
    assert.equal(smsStub.status, 200);
    const smsHtml = await smsStub.text();
    assert.match(smsHtml, /SMSPortal/);
    assert.match(smsHtml, /BulkSMS/);
    assert.match(smsHtml, /Clickatell/);
    assert.match(smsHtml, /placeholders/);
    assert.match(smsHtml, /Send test/);
    assert.match(smsHtml, /Nothing is sent/);
    assert.doesNotMatch(smsHtml, /start with (these )?(3|three)/i);

    const metaStub = await fetch(`http://127.0.0.1:${port}/command-centre/connect-accounts/meta`, { redirect: "manual" });
    assert.equal(metaStub.status, 200);
    const metaHtml = await metaStub.text();
    assert.match(metaHtml, /Facebook \/ Instagram/);
    assert.match(metaHtml, /Sandbox stub/);
    assert.match(metaHtml, /Nothing is sent/);

    const tiktokStub = await fetch(`http://127.0.0.1:${port}/command-centre/connect-accounts/tiktok`, { redirect: "manual" });
    assert.equal(tiktokStub.status, 200);
    const tiktokHtml = await tiktokStub.text();
    assert.match(tiktokHtml, /Billy must add TikTok keys later/);
    assert.match(tiktokHtml, /No OAuth/);
    assert.match(tiktokHtml, /Needs provider keys/);
    assert.match(tiktokHtml, /Send test/);
    assert.match(tiktokHtml, /Publish/);
    assert.match(tiktokHtml, /Nothing is posted/);
    assert.doesNotMatch(tiktokHtml, /start with (these )?(3|three)/i);

    const linkedinStub = await fetch(`http://127.0.0.1:${port}/command-centre/connect-accounts/linkedin`, { redirect: "manual" });
    assert.equal(linkedinStub.status, 200);
    const linkedinHtml = await linkedinStub.text();
    assert.match(linkedinHtml, /Billy must add LinkedIn keys later/);
    assert.match(linkedinHtml, /No OAuth/);
    assert.match(linkedinHtml, /Needs provider keys/);
    assert.match(linkedinHtml, /Publish/);
    assert.match(linkedinHtml, /Nothing is posted/);
    assert.doesNotMatch(linkedinHtml, /start with (these )?(3|three)/i);

    const social = await fetch(`http://127.0.0.1:${port}/command-centre/social`, { redirect: "manual" });
    assert.equal(social.status, 200);
    const socialHtml = await social.text();
    assert.match(socialHtml, /Sandbox social drafts/);
    assert.match(socialHtml, /Week 1/);
    assert.match(socialHtml, /Introduce the business/);
    assert.match(socialHtml, /SOCIAL_DRAFTS_ENABLED/);
    assert.match(socialHtml, /Billy must approve sends/);
    assert.match(socialHtml, /Publish/);
    assert.match(socialHtml, /Post now/);
    assert.match(socialHtml, /Go live/);
    assert.match(socialHtml, /are refused/);
    assert.match(socialHtml, /Nothing is posted/);
    assert.match(socialHtml, /Outbox queued: 0/);
    assert.doesNotMatch(socialHtml, /start with (these )?(3|three)/i);

    const importContacts = await fetch(`http://127.0.0.1:${port}/command-centre/import-contacts`, { redirect: "manual" });
    assert.equal(importContacts.status, 200);
    const importHtml = await importContacts.text();
    assert.match(importHtml, /Import contacts/);
    assert.match(importHtml, /consent_basis/);
    assert.match(importHtml, /POPIA/);
    assert.match(importHtml, /Import to sandbox/);
    assert.match(importHtml, /Nothing is sent/);
    assert.doesNotMatch(importHtml, /start with (these )?(3|three)/i);

    const onboarding = await fetch(`http://127.0.0.1:${port}/command-centre/onboarding`, { redirect: "manual" });
    assert.equal(onboarding.status, 307);
    assert.match(onboarding.headers.get("location") || "", /\/command-centre\/lead-agent$/);

    const publicTeam = await fetch(`http://127.0.0.1:${port}/team/${"ab".repeat(32)}`, { redirect: "manual" });
    assert.equal(publicTeam.status, 200);
    const publicTeamHtml = await publicTeam.text();
    assert.match(publicTeamHtml, /Recommended team/);
    assert.match(publicTeamHtml, /not active/);

    const live = await fetch(`http://127.0.0.1:${port}/command-centre/agents`, { redirect: "manual" });
    assert.equal(live.status, 200);
    const liveHtml = await live.text();
    assert.match(liveHtml, /Live agents/);

    const booking = await fetch(`http://127.0.0.1:${port}/book/ai-autotech-audit`, { redirect: "manual" });
    assert.equal(booking.status, 200);
    const bookingHtml = await booking.text();
    assert.match(bookingHtml, /Book appointment/);
    assert.match(bookingHtml, /not marketing consent/);

    const directory = await fetch(`http://127.0.0.1:${port}/book/ai-autotech`, { redirect: "manual" });
    assert.equal(directory.status, 200);
    const directoryHtml = await directory.text();
    assert.match(directoryHtml, /ai-autotech-audit/);

    const pipeline = await fetch(`http://127.0.0.1:${port}/command-centre/pipeline`, { redirect: "manual" });
    assert.equal(pipeline.status, 200);

    const contact = await fetch(`http://127.0.0.1:${port}/api/public/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(contact.status, 400);
    const auditApi = await fetch(`http://127.0.0.1:${port}/api/public/audit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(auditApi.status, 400);

    const reviews = await fetch(`http://127.0.0.1:${port}/command-centre/reviews`, { redirect: "manual" });
    assert.equal(reviews.status, 200);
    const reviewsHtml = await reviews.text();
    assert.match(reviewsHtml, /Reviews/);
    assert.match(reviewsHtml, /Nothing is sent/);
    assert.match(reviewsHtml, /review\.received is deferred/);

    const publicReview = await fetch(`http://127.0.0.1:${port}/r/ai-autotech`, { redirect: "manual" });
    assert.equal(publicReview.status, 200);
    const publicReviewHtml = await publicReview.text();
    assert.match(publicReviewHtml, /Leave a review/);
    assert.match(publicReviewHtml, /No message is sent/);

    const referrals = await fetch(`http://127.0.0.1:${port}/command-centre/referrals`, { redirect: "manual" });
    assert.equal(referrals.status, 200);
    const referralsHtml = await referrals.text();
    assert.match(referralsHtml, /Refer &amp; earn/);
    assert.match(referralsHtml, /Copy link/);
    assert.match(referralsHtml, /WhatsApp/);
    assert.match(referralsHtml, /placeholder/i);

    const audit = await fetch(`http://127.0.0.1:${port}/audit?ref=BILLY42`, { redirect: "manual" });
    assert.equal(audit.status, 200);
    assert.match(audit.headers.get("set-cookie") || "", /aat_ref=BILLY42/);
    const auditHtml = await audit.text();
    assert.match(auditHtml, /AI business audit/);
    assert.match(auditHtml, /60 days/);

    const signup = await fetch(`http://127.0.0.1:${port}/signup?ref=BILLY42`, { redirect: "manual" });
    assert.equal(signup.status, 200);
    const signupHtml = await signup.text();
    assert.match(signupHtml, /Bring your referral with you/);

    const invite = await fetch(`http://127.0.0.1:${port}/team/demo-token?ref=BILLY42`, { redirect: "manual" });
    assert.equal(invite.status, 200);
    const inviteHtml = await invite.text();
    assert.match(inviteHtml, /Join this workspace/);

    for (const path of ["/agency", "/agency/snapshots", "/agency/new", "/agency/eastc/settings", "/agency/zentrix/settings"]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual" });
      assert.equal(response.status, 200, path);
    }
    const agencyHtml = await (await fetch(`http://127.0.0.1:${port}/agency`, { redirect: "manual" })).text();
    assert.match(agencyHtml, /Ops readiness/);
    assert.match(agencyHtml, /Steps 20 through 29/);
    assert.match(agencyHtml, /sending_enabled stays false/);
    assert.match(agencyHtml, /CRON_SECRET/);
    assert.match(agencyHtml, /Needs Billy/);
    assert.match(agencyHtml, /BILLING_SANDBOX/);
    assert.match(agencyHtml, /Apply Education pack to EASTC/);
    assert.match(agencyHtml, /Apply Zentrix pack to Zentrix Online/);
    assert.match(agencyHtml, /ZENTRIX_WORKSPACE_PACK_ENABLED/);
    assert.match(agencyHtml, /PWA install/);
    assert.match(agencyHtml, /Optional/);
    assert.match(agencyHtml, /Not a go-live blocker/);
    assert.match(agencyHtml, /w1y2f0-rk/);
    assert.match(agencyHtml, /desj1r-ic/);
    assert.match(agencyHtml, /80ce1e-p8/);
    assert.match(agencyHtml, /\/command-centre\/lead-agent/);
    assert.match(agencyHtml, /Open setup wizard/);
    assert.match(agencyHtml, /\/command-centre\/setup/);
    assert.match(agencyHtml, /Step 32 is also unapplied/);
    assert.match(agencyHtml, /Step 33 is also unapplied/);
    assert.match(agencyHtml, /Step 34 is also unapplied/);
    assert.match(agencyHtml, /Step 35 is also unapplied/);
    assert.match(agencyHtml, /Owner bootstrap/);
    assert.match(agencyHtml, /Ops secrets/);
    assert.match(agencyHtml, /OPS_SECRETS_READY_ENABLED is unset/);
    assert.match(agencyHtml, /data-cron="fixture"/);
    assert.match(agencyHtml, /data-registered="false"/);
    assert.match(agencyHtml, /Open ops secrets/);
    assert.match(agencyHtml, /Auth attach is fixture/);
    assert.match(agencyHtml, /OWNER_BOOTSTRAP_UI_ENABLED is unset/);
    assert.match(agencyHtml, /Open SQL editor/);
    assert.match(agencyHtml, /data-auth-attach="fixture"/);
    assert.match(agencyHtml, /data-write="false"/);
    assert.match(agencyHtml, /phase5l_migration_runner/);
    assert.match(agencyHtml, /MIGRATION_RUNNER_ENABLED is unset/);
    assert.match(agencyHtml, /SQL is not applied/);
    assert.match(agencyHtml, /data-status="pending"/);
    assert.equal(agencyHtml.includes('data-status="applied"'), false);
    const eastcSettings = await (await fetch(`http://127.0.0.1:${port}/agency/eastc/settings`, { redirect: "manual" })).text();
    assert.match(eastcSettings, /Apply Education pack to EASTC/);
    assert.equal(eastcSettings.includes("Apply Zentrix pack to Zentrix Online"), false);
    const zentrixSettings = await (await fetch(`http://127.0.0.1:${port}/agency/zentrix/settings`, { redirect: "manual" })).text();
    assert.equal(zentrixSettings.includes("Apply Education pack to EASTC"), false);
    assert.match(zentrixSettings, /Apply Zentrix pack to Zentrix Online/);
    assert.match(zentrixSettings, /Priority/);
    assert.match(zentrixSettings, /QA \/ reference/);
    assert.match(zentrixSettings, /Nothing is posted/);
    const install = await fetch(`http://127.0.0.1:${port}/command-centre/install`, { redirect: "manual" });
    assert.equal(install.status, 200);
    const installHtml = await install.text();
    assert.match(installHtml, /Install AIOS on your phone/);
    assert.match(installHtml, /iOS Safari/);
    assert.match(installHtml, /Add to Home Screen/);
    assert.match(installHtml, /Android Chrome/);
    assert.match(installHtml, /Add to Home screen/);
    assert.match(installHtml, /Windows/);
    assert.match(installHtml, /PWA/);
    assert.match(installHtml, /No store listing is live/);
    assert.match(installHtml, /PWA_INSTALL_SHELL_ENABLED/);
    assert.match(installHtml, /Fixture only/);
    assert.match(installHtml, /does not write an install event/);
    assert.match(installHtml, /apple-mobile-web-app-capable|mobile-web-app-capable/);
    assert.doesNotMatch(installHtml, /listing is now live|Get it on Google Play|Download on the App Store/i);

    const settingsPage = await fetch(`http://127.0.0.1:${port}/command-centre/settings`, { redirect: "manual" });
    assert.equal(settingsPage.status, 200);
    const settingsPageHtml = await settingsPage.text();
    assert.match(settingsPageHtml, /Install AIOS on your phone/);
    assert.match(settingsPageHtml, /Open install steps/);

    const manifest = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`, { redirect: "manual" });
    assert.equal(manifest.status, 200);
    const manifestJson = await manifest.json();
    assert.equal(manifestJson.name, "AI AutoTech / AIOS");
    assert.equal(manifestJson.short_name, "AIOS");
    assert.equal(manifestJson.start_url, "/command-centre");
    assert.equal(manifestJson.display, "standalone");
    assert.equal(manifestJson.theme_color, "#0B1F3A");
    assert.equal(manifestJson.prefer_related_applications, false);

    const icon = await fetch(`http://127.0.0.1:${port}/icons/aios-192.png`, { redirect: "manual" });
    assert.equal(icon.status, 200);

    const snapshotsHtml = await (await fetch(`http://127.0.0.1:${port}/agency/snapshots`, { redirect: "manual" })).text();
    assert.match(snapshotsHtml, /existing EASTC workspace/);
  } finally {
    stop();
  }
});
