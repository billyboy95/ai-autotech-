import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

function catalog() {
  const order = readFileSync(new URL("../../../supabase/APPLY-ORDER.md", import.meta.url), "utf8");
  const steps = [];
  for (const match of order.matchAll(/^(\d+)\. `(supabase\/migrations\/[^`]+\.sql)`$/gm)) {
    const step = Number(match[1]);
    if (step < 20 || step > 33) continue;
    const file = match[2];
    const checksum = createHash("sha256").update(readFileSync(new URL(`../../../${file}`, import.meta.url))).digest("hex");
    steps.push({ step, filename: file, checksum });
  }
  return steps;
}

async function applyPhase5l(db) {
  await db.exec(migration("20260926160000_agency_tenancy.sql"));
  await db.exec(migration("20260926200000_phase2a_access.sql"));
  await db.exec(migration("20261108120000_phase5l_migration_runner.sql"));
}

async function asUser(db, userId, sql, params = []) {
  await db.exec("reset role");
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
  await db.exec(`select set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec("set role authenticated");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

test("phase 5l stores a pending dry-run and does not apply SQL", async () => {
  const sql = migration("20261108120000_phase5l_migration_runner.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.equal(/pg_read_file|dblink|execute\s+format/i.test(sql), false);
  assert.match(sql, /migration_runner_events/);
  assert.match(sql, /record_migration_dry_run/);
  assert.match(sql, /secrets are not stored/);
  assert.match(sql, /status = 'pending'/);

  const steps = catalog();
  assert.equal(steps.length, 14);
  assert.equal(steps[13].filename, "supabase/migrations/20261108120000_phase5l_migration_runner.sql");

  const db = new PGlite();
  await applyPhase5l(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@sandbox.example'),
      ('${EASTC_USER}', 'staff@sandbox.example');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
  `);

  const org = await db.query(`select id from organizations where slug = 'ai-autotech'`);
  const orgId = org.rows[0].id;

  await assert.rejects(
    asUser(db, EASTC_USER, `select public.record_migration_dry_run($1, $2::jsonb)`, [orgId, JSON.stringify(steps)]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.record_migration_dry_run($1, $2::jsonb)`, [orgId, JSON.stringify(steps.slice(0, 1))]),
    /checklist steps only/i,
  );
  await assert.rejects(
    asUser(
      db,
      AGENCY_USER,
      `select public.record_migration_dry_run($1, $2::jsonb)`,
      [orgId, JSON.stringify([{ step: 20, filename: steps[0].filename, checksum: steps[0].checksum, status: "applied" }])],
    ),
    /secrets are not stored|checklist steps only/i,
  );
  await assert.rejects(
    asUser(
      db,
      AGENCY_USER,
      `select public.record_migration_dry_run($1, $2::jsonb)`,
      [orgId, JSON.stringify([{ step: 33, filename: steps[13].filename, checksum: "sbp_should-not-render" }])],
    ),
    /secrets are not stored/i,
  );

  const saved = await asUser(
    db,
    AGENCY_USER,
    `select public.record_migration_dry_run($1, $2::jsonb) as event`,
    [orgId, JSON.stringify(steps)],
  );
  const event = saved.rows[0].event;
  assert.equal(event.stored, true);
  assert.equal(event.status, "pending");
  assert.equal(event.count, 14);
  assert.equal(event.applied, false);
  assert.equal(event.sandbox, true);
  assert.equal(event.charged, false);
  assert.equal(event.sending_enabled, false);
  assert.equal(event.secret, undefined);

  const rows = await db.query(
    `select step_number, filename, checksum, status, sandbox, charged from migration_runner_events where org_id = $1 order by step_number`,
    [orgId],
  );
  assert.equal(rows.rows.length, 14);
  assert.equal(rows.rows.every((row) => row.status === "pending" && row.sandbox === true && row.charged === false), true);
  assert.equal(rows.rows[0].step_number, 20);
  assert.equal(rows.rows[13].step_number, 33);
  assert.equal(rows.rows[13].checksum, steps[13].checksum);
  assert.equal(JSON.stringify(rows.rows).includes("sbp_"), false);

  const sending = await db.query(`select sending_enabled from organizations where id = $1`, [orgId]);
  assert.equal(sending.rows[0].sending_enabled, false);
});
