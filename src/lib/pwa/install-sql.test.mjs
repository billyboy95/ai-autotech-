import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyPhase5j(db) {
  await db.exec(migration("20260926160000_agency_tenancy.sql"));
  await db.exec(migration("20260926200000_phase2a_access.sql"));
  await db.exec(migration("20261106120000_phase5j_pwa_mobile_shell.sql"));
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

test("phase 5j records a sandbox install intent and does not send", async () => {
  const sql = migration("20261106120000_phase5j_pwa_mobile_shell.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.match(sql, /install_intent/);
  assert.match(sql, /record_install_intent/);

  const db = new PGlite();
  await applyPhase5j(db);
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
    asUser(db, EASTC_USER, `select public.record_install_intent($1, $2)`, [orgId, "ios"]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.record_install_intent($1, $2)`, [orgId, "play"]),
    /browser platform only/i,
  );

  const saved = await asUser(db, AGENCY_USER, `select public.record_install_intent($1, $2) as event`, [orgId, "Android"]);
  const event = saved.rows[0].event;
  assert.equal(event.stored, true);
  assert.equal(event.intent, "install_intent");
  assert.equal(event.platform, "android");
  assert.equal(event.surface, "browser");
  assert.equal(event.sandbox, true);
  assert.equal(event.charged, false);
  assert.equal(event.sending_enabled, false);

  const rows = await db.query(`select intent, platform, charged, sandbox from install_events where org_id = $1`, [orgId]);
  assert.equal(rows.rows.length, 1);
  const sending = await db.query(`select sending_enabled from organizations where id = $1`, [orgId]);
  assert.equal(sending.rows[0].sending_enabled, false);
});
