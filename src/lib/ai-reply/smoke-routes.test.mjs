import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

test("inbox and conversation AI settings respond", { timeout: 180_000 }, async () => {
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
  } finally {
    stop();
  }
});
