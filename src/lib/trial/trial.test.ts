import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GET } from "@/app/api/cron/trials/route";
import { RESTAURANT_SNAPSHOT_ID } from "@/lib/snapshots/catalog";
import { trialIpHash } from "@/lib/trial/ip";
import { runTrialCron } from "@/server/workers/free-trial";
import {
  DEFAULT_TRIAL_DAYS,
  FREE_TRIAL_UNAVAILABLE,
  POPIA_TRIAL_CONSENT,
  TRIAL_RATE_MAX,
  TRIAL_RATE_WINDOW_MS,
  TRIAL_UPGRADE_HREF,
  decideTrialStart,
  freeTrialEnabled,
  planTrialExpiry,
  trialBanner,
  trialDaysLeft,
  trialEmailBlock,
  trialEndsAt,
  trialLengthDays,
  trialNicheOptions,
  trialRateLimited,
  type TrialStartInput,
} from "@/lib/trial/trial";

const ready: TrialStartInput = {
  snapshotId: RESTAURANT_SNAPSHOT_ID,
  businessName: "Lake Road Burgers",
  contactName: "Lesego Dlamini",
  email: "Lesego@Example.com",
  phone: "0100000099",
  password: "trial-pass-1",
  popia: true,
  honeypot: "",
  limited: false,
};

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("the free trial flag is off unless it is the string true", () => {
  assert.equal(freeTrialEnabled({}), false);
  assert.equal(freeTrialEnabled({ FREE_TRIAL_ENABLED: "" }), false);
  assert.equal(freeTrialEnabled({ FREE_TRIAL_ENABLED: "false" }), false);
  assert.equal(freeTrialEnabled({ FREE_TRIAL_ENABLED: " TRUE " }), true);
  assert.equal(trialLengthDays({}), DEFAULT_TRIAL_DAYS);
  assert.equal(trialLengthDays({ FREE_TRIAL_DAYS: "21" }), 21);
  assert.equal(trialLengthDays({ FREE_TRIAL_DAYS: "0" }), DEFAULT_TRIAL_DAYS);
  assert.equal(trialLengthDays({ FREE_TRIAL_DAYS: "nope" }), DEFAULT_TRIAL_DAYS);
  assert.equal(trialNicheOptions().some((niche) => niche.id === RESTAURANT_SNAPSHOT_ID), true);
});

test("flag off refuses a trial and the public page says it is not available", () => {
  withEnv({ FREE_TRIAL_ENABLED: undefined }, () => {
    const decision = decideTrialStart(ready, {});
    assert.equal(decision.ok, false);
    assert.equal(decision.stored, false);
    if (!decision.ok) assert.equal(decision.code, "disabled");
    assert.equal(decision.message, FREE_TRIAL_UNAVAILABLE);
    const page = readFileSync(new URL("../../app/start/page.tsx", import.meta.url), "utf8");
    assert.match(page, /trial-unavailable/);
    assert.match(page, /FREE_TRIAL_UNAVAILABLE/);
    assert.match(page, /if \(!freeTrialEnabled\(\)\)/);
    const policy = readFileSync(new URL("./trial.ts", import.meta.url), "utf8");
    const form = readFileSync(new URL("../../components/trial/start-form.tsx", import.meta.url), "utf8");
    assert.equal(policy.includes("node:crypto"), false);
    assert.equal(form.includes("node:crypto"), false);
    assert.equal(form.includes("@/lib/trial/ip"), false);
  });
});

test("a valid trial is ready to duplicate a niche template", () => {
  const decision = decideTrialStart(ready, { FREE_TRIAL_ENABLED: "true", FREE_TRIAL_DAYS: "21" });
  assert.equal(decision.ok, true);
  assert.equal(decision.stored, true);
  if (decision.ok && decision.code === "ready") {
    assert.equal(decision.email, "lesego@example.com");
    assert.equal(decision.swap.name, "Lake Road Burgers");
    assert.equal(decision.swap.phone, "0100000099");
    assert.equal(decision.days, 21);
    assert.equal(decision.snapshotId, RESTAURANT_SNAPSHOT_ID);
  } else {
    assert.fail("expected a ready trial");
  }
  const missing = decideTrialStart({ ...ready, popia: false }, { FREE_TRIAL_ENABLED: "true" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.message, /POPIA/);
});

test("a honeypot is accepted and stored nowhere", () => {
  const decision = decideTrialStart({ ...ready, honeypot: "https://spam.example" }, { FREE_TRIAL_ENABLED: "true" });
  assert.equal(decision.ok, true);
  assert.equal(decision.stored, false);
  if (decision.ok) assert.equal(decision.code, "honeypot");
});

test("one trial per email and the rate limit block a second active start", () => {
  assert.equal(trialEmailBlock(null), "ok");
  assert.equal(trialEmailBlock("trialing"), "idempotent");
  assert.equal(trialEmailBlock("paused"), "used");
  const now = Date.now();
  const prior = Array.from({ length: TRIAL_RATE_MAX }, (_, index) => now - index * 1000);
  assert.equal(trialRateLimited(prior, now), true);
  assert.equal(trialRateLimited(prior.slice(0, TRIAL_RATE_MAX - 1), now), false);
  assert.equal(trialRateLimited(prior.map((hit) => hit - TRIAL_RATE_WINDOW_MS - 1), now), false);
  const limited = decideTrialStart({ ...ready, limited: true }, { FREE_TRIAL_ENABLED: "true" });
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.equal(limited.code, "rate");
  assert.equal(trialIpHash("127.0.0.1"), trialIpHash("127.0.0.1"));
  assert.equal(trialIpHash("127.0.0.1") === trialIpHash("127.0.0.2"), false);
});

test("the banner shows days left and the billing upgrade path", () => {
  const start = new Date("2026-10-06T00:00:00Z");
  const ends = trialEndsAt(start, 14);
  assert.equal(ends.toISOString(), "2026-10-20T00:00:00.000Z");
  assert.equal(trialDaysLeft(ends, start), 14);
  assert.equal(trialDaysLeft(ends, new Date("2026-10-19T00:00:01Z")), 1);
  assert.equal(trialDaysLeft(ends, new Date("2026-10-20T00:00:01Z")), 0);
  const live = trialBanner({ status: "trialing", endsAt: ends, now: start });
  assert.equal(live?.href, TRIAL_UPGRADE_HREF);
  assert.match(live?.text ?? "", /14 days left/);
  assert.match(live?.text ?? "", /billing page/);
  assert.match(live?.text ?? "", /Nothing is charged/);
  const paused = trialBanner({ status: "paused", endsAt: ends, now: ends });
  assert.equal(paused?.tone, "block");
  assert.equal(paused?.href, TRIAL_UPGRADE_HREF);
  assert.match(paused?.text ?? "", /read-only/);
  assert.match(paused?.text ?? "", /still here/);
});

test("expiry pauses due trials, warns the ones about to end, and deletes nothing", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const plan = planTrialExpiry(
    [
      { status: "trialing", endsAt: "2026-10-19T00:00:00Z", warningNotifiedAt: null },
      { status: "trialing", endsAt: "2026-10-21T00:00:00Z", warningNotifiedAt: null },
      { status: "trialing", endsAt: "2026-11-01T00:00:00Z", warningNotifiedAt: null },
      { status: "paused", endsAt: "2026-10-01T00:00:00Z", warningNotifiedAt: null },
      { status: "trialing", endsAt: "2026-10-21T12:00:00Z", warningNotifiedAt: "2026-10-19T00:00:00Z" },
    ],
    now,
    2,
  );
  assert.equal(plan.pause.length, 1);
  assert.equal(plan.warn.length, 1);
  assert.equal(plan.warn[0]?.endsAt, "2026-10-21T00:00:00Z");
  assert.equal(plan.deleted, 0);
});

test("the trial cron does nothing while the flag is off", async () => {
  const result = await runTrialCron({ FREE_TRIAL_ENABLED: "" });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.paused, 0);
  assert.equal(result.deleted, 0);
  assert.equal(result.charged, false);

  const previous = {
    secret: process.env.CRON_SECRET,
    vercel: process.env.VERCEL_ENV,
    flag: process.env.FREE_TRIAL_ENABLED,
  };
  process.env.CRON_SECRET = "test-secret";
  process.env.VERCEL_ENV = "production";
  process.env.FREE_TRIAL_ENABLED = "";
  try {
    const denied = await GET(new Request("http://localhost/api/cron/trials"));
    assert.equal(denied.status, 401);
    const allowed = await GET(
      new Request("http://localhost/api/cron/trials", { headers: { authorization: "Bearer test-secret" } }),
    );
    assert.equal(allowed.status, 200);
    const body = (await allowed.json()) as { skipped?: boolean; paused?: number; charged?: boolean; deleted?: number };
    assert.equal(body.skipped, true);
    assert.equal(body.paused, 0);
    assert.equal(body.deleted, 0);
    assert.equal(body.charged, false);
  } finally {
    if (previous.secret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous.secret;
    if (previous.vercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous.vercel;
    if (previous.flag === undefined) delete process.env.FREE_TRIAL_ENABLED;
    else process.env.FREE_TRIAL_ENABLED = previous.flag;
  }
});

test("the migration records POPIA consent and does not delete trial rows", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261112120200_phase5p_free_trial.sql", import.meta.url), "utf8");
  assert.match(sql, /duplicate_workspace/);
  assert.match(sql, /record_owner_notification/);
  assert.ok(sql.includes(POPIA_TRIAL_CONSENT));
  assert.match(sql, /source,\s*'free_trial'| 'free_trial'/);
  assert.equal(/delete\s+from\s+public\.(workspace_trials|organizations|crm_leads)/i.test(sql), false);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
});
