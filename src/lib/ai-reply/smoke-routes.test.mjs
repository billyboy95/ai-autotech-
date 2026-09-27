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
    assert.doesNotMatch(homeHtml, /start with (these )?(3|three)/i);

    const assistant = await fetch(`http://127.0.0.1:${port}/command-centre/assistant`, { redirect: "manual" });
    assert.equal(assistant.status, 200);
    const assistantHtml = await assistant.text();
    assert.match(assistantHtml, /Assistant/);
    assert.match(assistantHtml, /Fixture only/);
    assert.match(assistantHtml, /Open the pipeline/);
    assert.match(assistantHtml, /Nothing is sent/);
    assert.doesNotMatch(assistantHtml, /start with (these )?(3|three)/i);

    const connectAccounts = await fetch(`http://127.0.0.1:${port}/command-centre/connect-accounts`, { redirect: "manual" });
    assert.equal(connectAccounts.status, 200);
    const connectHtml = await connectAccounts.text();
    assert.match(connectHtml, /Connect accounts/);
    assert.match(connectHtml, /Email \/ Gmail/);
    assert.match(connectHtml, /WhatsApp \(Meta Cloud\)/);
    assert.match(connectHtml, /Needs keys/);
    assert.match(connectHtml, /Connected/);
    assert.match(connectHtml, /Nothing is sent/);
    assert.doesNotMatch(connectHtml, /start with (these )?(3|three)/i);

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
    assert.match(agencyHtml, /Apply Education pack to EASTC/);
    assert.match(agencyHtml, /\/command-centre\/lead-agent/);
    const eastcSettings = await (await fetch(`http://127.0.0.1:${port}/agency/eastc/settings`, { redirect: "manual" })).text();
    assert.match(eastcSettings, /Apply Education pack to EASTC/);
    const zentrixSettings = await (await fetch(`http://127.0.0.1:${port}/agency/zentrix/settings`, { redirect: "manual" })).text();
    assert.equal(zentrixSettings.includes("Apply Education pack to EASTC"), false);
    const snapshotsHtml = await (await fetch(`http://127.0.0.1:${port}/agency/snapshots`, { redirect: "manual" })).text();
    assert.match(snapshotsHtml, /existing EASTC workspace/);
  } finally {
    stop();
  }
});
