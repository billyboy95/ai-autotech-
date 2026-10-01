import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EXPECTED_FILES,
  STEP_FROM,
  STEP_TO,
  applyViaApi,
  loadPendingSteps,
  parsePendingSteps,
  projectRefFromSupabaseUrl,
  redactSecrets,
  resolveProjectRef,
  resolveTransport,
  run,
  tokenStatus,
} from "./apply-pending-migrations.mjs";

const TOKEN = "sbp_0123456789abcdef";
const REF = "fnysxlswzufdnlbhndxc";
const CHAT_NOTE = "reminder from chat: paste the access token here";

function capture() {
  const out = [];
  const err = [];
  return {
    out,
    err,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    text() {
      return [...out, ...err].join("\n");
    },
  };
}

function unavailableCli() {
  return () => ({ status: 1, stdout: "", stderr: "not found" });
}

test("APPLY-ORDER steps 20 through 36 match the hard-coded list", () => {
  const order = readFileSync(new URL("../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const parsed = parsePendingSteps(order);
  assert.equal(parsed.length, STEP_TO - STEP_FROM + 1);
  assert.deepEqual(
    parsed.map((step) => [step.step, step.file]),
    EXPECTED_FILES,
  );
  assert.equal(parsed[0].name, "phase4c_aios_pricing");
  assert.equal(parsed[parsed.length - 1].name, "phase5o_golive_checklist");
  const loaded = loadPendingSteps(new URL("..", import.meta.url).pathname);
  assert.equal(loaded.length, 17);
  assert.equal(loaded[0].file, EXPECTED_FILES[0][1]);
});

test("dry-run without a token lists steps 20–36 and exits 0", async () => {
  const logs = capture();
  let fetched = 0;
  const code = await run({
    argv: [],
    env: {},
    stdout: logs.stdout,
    stderr: logs.stderr,
    fetchImpl: async () => {
      fetched += 1;
      return { status: 201, text: async () => "[]" };
    },
    spawnImpl: unavailableCli(),
  });
  assert.equal(code, 0);
  assert.equal(fetched, 0);
  const text = logs.text();
  assert.match(text, /Dry-run\. No SQL was sent\./);
  assert.match(text, /Need SUPABASE_ACCESS_TOKEN starting with sbp_ before --apply\./);
  for (const [, file] of EXPECTED_FILES) assert.match(text, new RegExp(file.replaceAll(".", "\\.")));
  assert.match(text, /sending_enabled stays false/);
  assert.equal(text.includes("cron.schedule"), false);
});

test("a token that does not start with sbp_ is refused and never printed", async () => {
  for (const bad of [CHAT_NOTE, "sbp_", "sbp_short", "SBP_0123456789abcdef"]) {
    const logs = capture();
    let fetched = 0;
    const code = await run({
      argv: ["--apply", "--project-ref", REF],
      env: { SUPABASE_ACCESS_TOKEN: bad },
      stdout: logs.stdout,
      stderr: logs.stderr,
      fetchImpl: async () => {
        fetched += 1;
        return { status: 201, text: async () => "[]" };
      },
      spawnImpl: unavailableCli(),
    });
    assert.equal(code, 1, bad);
    assert.equal(fetched, 0, bad);
    const text = logs.text();
    assert.match(text, /Need SUPABASE_ACCESS_TOKEN starting with sbp_/);
    assert.match(text, /Nothing was applied/);
    if (bad !== "sbp_") assert.equal(text.includes(bad), false, bad);
    assert.equal(tokenStatus(bad).ok, false);
  }
});

test("dry-run with a chat-note token refuses before any SQL", async () => {
  const logs = capture();
  const code = await run({
    argv: [],
    env: { SUPABASE_ACCESS_TOKEN: CHAT_NOTE },
    stdout: logs.stdout,
    stderr: logs.stderr,
    fetchImpl: async () => {
      throw new Error("network should not be called");
    },
  });
  assert.equal(code, 1);
  assert.match(logs.text(), /not an sbp_ token/);
  assert.equal(logs.text().includes(CHAT_NOTE), false);
  assert.match(logs.text(), /20261111120000_phase5o_golive_checklist\.sql/);
});

test("--apply without a token or project ref does not call Supabase", async () => {
  const missingToken = capture();
  assert.equal(await run({
    argv: ["--apply", "--project-ref", REF],
    env: {},
    stdout: missingToken.stdout,
    stderr: missingToken.stderr,
    fetchImpl: async () => {
      throw new Error("should not fetch");
    },
  }), 1);
  assert.match(missingToken.text(), /Need SUPABASE_ACCESS_TOKEN starting with sbp_ before --apply/);

  const missingRef = capture();
  let fetched = 0;
  assert.equal(await run({
    argv: ["--apply"],
    env: { SUPABASE_ACCESS_TOKEN: TOKEN },
    stdout: missingRef.stdout,
    stderr: missingRef.stderr,
    fetchImpl: async () => {
      fetched += 1;
      return { status: 201, text: async () => "[]" };
    },
  }), 1);
  assert.equal(fetched, 0);
  assert.match(missingRef.text(), /Need a project ref/);
  assert.equal(missingRef.text().includes(TOKEN), false);
});

test("--apply posts each file in order and stops on the first failure", async () => {
  const calls = [];
  const logs = capture();
  const code = await run({
    argv: ["--apply", "--project-ref", REF],
    env: { SUPABASE_ACCESS_TOKEN: TOKEN },
    stdout: logs.stdout,
    stderr: logs.stderr,
    spawnImpl: unavailableCli(),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 3) return { status: 400, text: async () => `boom ${TOKEN}` };
      return { status: 201, text: async () => "[]" };
    },
  });
  assert.equal(code, 1);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, `https://api.supabase.com/v1/projects/${REF}/database/query`);
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  const files = EXPECTED_FILES.slice(0, 3);
  for (let index = 0; index < files.length; index += 1) {
    const sql = readFileSync(new URL(`../${files[index][1]}`, import.meta.url), "utf8");
    assert.equal(JSON.parse(calls[index].init.body).query, sql);
    assert.equal(JSON.parse(calls[index].init.body).read_only, false);
  }
  const text = logs.text();
  assert.match(text, /Success step 20 phase4c_aios_pricing/);
  assert.match(text, /Success step 21 phase4d_eastc_education/);
  assert.match(text, /Fail step 22 phase5a_agent_computers/);
  assert.match(text, /Stopped\. Later steps were not applied\./);
  assert.equal(text.includes(TOKEN), false);
  assert.match(text, /\[redacted\]/);
  assert.equal(text.includes("apply_education_pack_to_eastc()"), false);
  assert.equal(text.includes("apply_zentrix_workspace_pack()"), false);
});

test("a full apply uses the file bytes and does not add pack or cron SQL", async () => {
  const calls = [];
  const logs = capture();
  const code = await run({
    argv: ["--from", "35", "--apply"],
    env: {
      SUPABASE_ACCESS_TOKEN: TOKEN,
      NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
    },
    stdout: logs.stdout,
    stderr: logs.stderr,
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body).query);
      return { status: 201, text: async () => "[]" };
    },
  });
  assert.equal(code, 0);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], readFileSync(new URL(`../${EXPECTED_FILES[15][1]}`, import.meta.url), "utf8"));
  assert.equal(calls[1], readFileSync(new URL(`../${EXPECTED_FILES[16][1]}`, import.meta.url), "utf8"));
  const text = logs.text();
  assert.match(text, /Success step 35 phase5n_ops_secrets_ready/);
  assert.match(text, /Success step 36 phase5o_golive_checklist/);
  assert.match(text, /Success\. Steps 35–36 applied\./);
  assert.match(text, /Crons were not scheduled/);
  assert.equal(text.includes(TOKEN), false);
  const source = readFileSync(new URL("./apply-pending-migrations.mjs", import.meta.url), "utf8");
  assert.equal(source.includes("select public.apply_education_pack_to_eastc"), false);
  assert.equal(source.includes("select public.apply_zentrix_workspace_pack"), false);
  assert.equal(source.includes("cron.schedule"), false);
});

test("--via cli shells out without putting the token in argv", async () => {
  const calls = [];
  const logs = capture();
  const code = await run({
    argv: ["--apply", "--via", "cli", "--project-ref", REF, "--from=36"],
    env: { SUPABASE_ACCESS_TOKEN: TOKEN },
    stdout: logs.stdout,
    stderr: logs.stderr,
    fetchImpl: async () => {
      throw new Error("API should not be called");
    },
    spawnImpl: (command, args, options) => {
      calls.push({ command, args, options });
      if (args[0] === "db" && args[1] === "query" && args.includes("--help")) {
        return { status: 0, stdout: "help", stderr: "" };
      }
      return { status: 0, stdout: `{"ok":true,"leak":"${TOKEN}"}`, stderr: "" };
    },
  });
  assert.equal(code, 0);
  const query = calls.find((call) => call.args.includes("--file"));
  assert.equal(query.command, "supabase");
  assert.equal(query.args.includes(TOKEN), false);
  assert.equal(query.args.includes("--linked"), true);
  assert.equal(query.args.includes(REF), true);
  assert.match(query.args.find((arg) => arg.endsWith(".sql")), /phase5o_golive_checklist\.sql$/);
  assert.equal(query.options.env.SUPABASE_ACCESS_TOKEN, TOKEN);
  assert.equal(logs.text().includes(TOKEN), false);
  assert.match(logs.text(), /Transport: supabase CLI/);
  assert.match(logs.text(), /Success step 36 phase5o_golive_checklist/);
});

test("--via cli refuses when the CLI is missing", async () => {
  const logs = capture();
  const code = await run({
    argv: ["--apply", "--via", "cli"],
    env: { SUPABASE_ACCESS_TOKEN: TOKEN, SUPABASE_PROJECT_REF: REF },
    stdout: logs.stdout,
    stderr: logs.stderr,
    spawnImpl: unavailableCli(),
    fetchImpl: async () => {
      throw new Error("API should not be called");
    },
  });
  assert.equal(code, 1);
  assert.match(logs.text(), /supabase db query is not available/);
  assert.equal(logs.text().includes(TOKEN), false);
});

test("redaction and project ref parsing hide the token", () => {
  assert.equal(redactSecrets(`nope ${TOKEN} Bearer ${TOKEN}`, TOKEN).includes(TOKEN), false);
  assert.match(redactSecrets("Need SUPABASE_ACCESS_TOKEN starting with sbp_.", TOKEN), /sbp_/);
  assert.equal(projectRefFromSupabaseUrl(`https://${REF}.supabase.co`), REF);
  assert.equal(projectRefFromSupabaseUrl(`https://user:${TOKEN}@${REF}.supabase.co`), "");
  assert.equal(resolveProjectRef({
    flag: "",
    env: { SUPABASE_PROJECT_ID: REF, NEXT_PUBLIC_SUPABASE_URL: "https://other.example" },
  }), REF);
  assert.equal(resolveTransport({ via: "api", spawnImpl: unavailableCli() }).kind, "api");
  assert.equal(resolveTransport({ via: "auto", spawnImpl: unavailableCli() }).kind, "api");
});

test("applyViaApi treats a non-2xx body as a failure and redacts it", async () => {
  await assert.rejects(
    () => applyViaApi({
      sql: "select 1",
      projectRef: REF,
      token: TOKEN,
      fetchImpl: async () => ({ status: 401, text: async () => `denied ${TOKEN}` }),
    }),
    (error) => {
      assert.equal(error.message.includes(TOKEN), false);
      assert.match(error.message, /Management API 401/);
      return true;
    },
  );
});
