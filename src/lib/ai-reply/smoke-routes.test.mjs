import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

test("inbox, conversation AI, calendars, reviews, and public pages respond", { timeout: 180_000 }, async () => {
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

    const booking = await fetch(`http://127.0.0.1:${port}/book/ai-autotech-audit`, { redirect: "manual" });
    assert.equal(booking.status, 200);
    const bookingHtml = await booking.text();
    assert.match(bookingHtml, /Book appointment/);
    assert.match(bookingHtml, /not marketing consent/);

    const directory = await fetch(`http://127.0.0.1:${port}/book/ai-autotech`, { redirect: "manual" });
    assert.equal(directory.status, 200);
    const directoryHtml = await directory.text();
    assert.match(directoryHtml, /ai-autotech-audit/);

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
  } finally {
    stop();
  }
});
