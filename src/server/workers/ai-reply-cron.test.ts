import assert from "node:assert/strict";
import test from "node:test";
import { runAiReplyCron } from "@/server/workers/ai-reply-cron";

test("the conversation AI cron does nothing while its flag is off", async () => {
  const result = await runAiReplyCron({ AI_REPLY_CRON_ENABLED: "false" } as NodeJS.ProcessEnv);
  assert.deepEqual(result, { ok: true, processed: 0, queued: 0, skipped: "flag_off" });
});
