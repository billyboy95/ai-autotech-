import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyPhase5k(db) {
  await db.exec(migration("20260926160000_agency_tenancy.sql"));
  await db.exec(migration("20260926200000_phase2a_access.sql"));
  await db.exec(migration("20261107120000_phase5k_setup_wizard.sql"));
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

test("phase 5k inserts one sandbox checklist event and does not store a secret", async () => {
  const sql = migration("20261107120000_phase5k_setup_wizard.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.match(sql, /setup_checklist_events/);
  assert.match(sql, /record_setup_checklist_event/);
  assert.match(sql, /secrets are not stored/);

  const db = new PGlite();
  await applyPhase5k(db);
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
    asUser(db, EASTC_USER, `select public.record_setup_checklist_event($1, $2, $3)`, [orgId, "cron_secret", "missing"]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.record_setup_checklist_event($1, $2, $3)`, [orgId, "cron_secret", "cron-value-should-not-render"]),
    /secrets are not stored|checklist status only/i,
  );

  const saved = await asUser(
    db,
    AGENCY_USER,
    `select public.record_setup_checklist_event($1, $2, $3) as event`,
    [orgId, "cron_secret", "missing"],
  );
  const event = saved.rows[0].event;
  assert.equal(event.stored, true);
  assert.equal(event.step_key, "cron_secret");
  assert.equal(event.status, "missing");
  assert.equal(event.sandbox, true);
  assert.equal(event.charged, false);
  assert.equal(event.sending_enabled, false);
  assert.equal(event.secret, undefined);

  const rows = await db.query(
    `select org_id, step_key, status, sandbox, charged from setup_checklist_events where org_id = $1`,
    [orgId],
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].step_key, "cron_secret");
  assert.equal(rows.rows[0].status, "missing");
  assert.equal(rows.rows[0].sandbox, true);
  assert.equal(rows.rows[0].charged, false);
  assert.equal(JSON.stringify(rows.rows[0]).includes("cron-value-should-not-render"), false);

  const sending = await db.query(`select sending_enabled from organizations where id = $1`, [orgId]);
  assert.equal(sending.rows[0].sending_enabled, false);
});
