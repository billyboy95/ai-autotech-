import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

test("inbox, conversation AI, calendars, and public booking respond", { timeout: 180_000 }, async () => {
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
    assert.doesNotMatch(botsHtml, /Save 0%/);

    const bot = await fetch(`http://127.0.0.1:${port}/command-centre/bots/inbound-lead`, { redirect: "manual" });
    assert.equal(bot.status, 200);
    const botHtml = await bot.text();
    assert.match(botHtml, /Inbound Lead/);
    assert.match(botHtml, /Activity/);
    assert.match(botHtml, /Reports to/);

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

    const publicTeam = await fetch(`http://127.0.0.1:${port}/team/not-a-real-token`, { redirect: "manual" });
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
  } finally {
    stop();
  }
});
