import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const STAFF_USER = "33333333-3333-4333-8333-333333333333";
const ADMIN_USER = "44444444-4444-4444-8444-444444444444";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

function checksum() {
  const sql = readFileSync(new URL("../../../supabase/owner-bootstrap.sql", import.meta.url), "utf8");
  return createHash("sha256").update(sql).digest("hex");
}

async function applyPhase5m(db) {
  await db.exec(migration("20260926160000_agency_tenancy.sql"));
  await db.exec(migration("20260926200000_phase2a_access.sql"));
  await db.exec(migration("20261109120000_phase5m_owner_bootstrap.sql"));
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

test("phase 5m stores a sandbox note and does not create an auth user", async () => {
  const sql = migration("20261109120000_phase5m_owner_bootstrap.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.equal(/insert into auth\.users/i.test(sql), false);
  assert.equal(/insert into public\.memberships/i.test(sql), false);
  assert.match(sql, /owner_bootstrap_notes/);
  assert.match(sql, /record_owner_bootstrap_note/);
  assert.match(sql, /secrets are not stored/);
  assert.match(sql, /created_user/);
  assert.match(sql, /status = 'noted'/);
  assert.equal(/email text/i.test(sql), false);

  const hash = checksum();
  const db = new PGlite();
  await applyPhase5m(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@sandbox.example'),
      ('${STAFF_USER}', 'staff@sandbox.example'),
      ('${ADMIN_USER}', 'admin@sandbox.example'),
      ('${EASTC_USER}', 'eastc@sandbox.example');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${STAFF_USER}', id, 'agency_staff' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${ADMIN_USER}', id, 'client_admin' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
  `);

  const org = await db.query(`select id from organizations where slug = 'ai-autotech'`);
  const orgId = org.rows[0].id;
  const usersBefore = await db.query(`select count(*)::int as count from auth.users`);
  const membersBefore = await db.query(`select count(*)::int as count from memberships`);

  await assert.rejects(
    asUser(db, EASTC_USER, `select public.record_owner_bootstrap_note($1, $2, $3, $4)`, [orgId, "missing", "fixture", hash]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, ADMIN_USER, `select public.record_owner_bootstrap_note($1, $2, $3, $4)`, [orgId, "missing", "missing", hash]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.record_owner_bootstrap_note($1, $2, $3, $4)`, [orgId, "billyfaber06@gmail.com", "missing", hash]),
    /secrets are not stored/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.record_owner_bootstrap_note($1, $2, $3, $4)`, [orgId, "configured", "fixture", "sbp_should-not-render"]),
    /secrets are not stored/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.record_owner_bootstrap_note($1, $2, $3, $4)`, [orgId, "configured", "applied", hash]),
    /owner note only/i,
  );

  const saved = await asUser(
    db,
    AGENCY_USER,
    `select public.record_owner_bootstrap_note($1, $2, $3, $4) as note`,
    [orgId, "configured", "missing", hash],
  );
  const note = saved.rows[0].note;
  assert.equal(note.stored, true);
  assert.equal(note.status, "noted");
  assert.equal(note.sandbox, true);
  assert.equal(note.charged, false);
  assert.equal(note.owner_emails, "configured");
  assert.equal(note.auth_attach, "missing");
  assert.equal(note.applied, false);
  assert.equal(note.created_user, false);
  assert.equal(note.sending_enabled, false);
  assert.equal(note.secret, undefined);
  assert.equal(note.email, undefined);

  const staff = await asUser(
    db,
    STAFF_USER,
    `select public.record_owner_bootstrap_note($1, $2, $3, $4) as note`,
    [orgId, "missing", "fixture", hash],
  );
  assert.equal(staff.rows[0].note.stored, true);
  assert.equal(staff.rows[0].note.created_user, false);

  const rows = await db.query(
    `select owner_emails, auth_attach, sql_file, checksum, status, sandbox, charged from owner_bootstrap_notes where org_id = $1 order by created_at`,
    [orgId],
  );
  assert.equal(rows.rows.length, 2);
  assert.equal(rows.rows.every((row) => row.status === "noted" && row.sandbox === true && row.charged === false), true);
  assert.equal(rows.rows[0].sql_file, "supabase/owner-bootstrap.sql");
  assert.equal(rows.rows[0].checksum, hash);
  assert.equal(JSON.stringify(rows.rows).includes("sbp_"), false);
  assert.equal(JSON.stringify(rows.rows).includes("@"), false);

  const columns = await db.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'owner_bootstrap_notes'`,
  );
  const names = columns.rows.map((row) => row.column_name);
  assert.equal(names.includes("owner_emails"), true);
  assert.equal(names.some((name) => /secret|token|password|api_key/.test(name)), false);

  const usersAfter = await db.query(`select count(*)::int as count from auth.users`);
  const membersAfter = await db.query(`select count(*)::int as count from memberships`);
  assert.equal(usersAfter.rows[0].count, usersBefore.rows[0].count);
  assert.equal(membersAfter.rows[0].count, membersBefore.rows[0].count);

  const sending = await db.query(`select sending_enabled from organizations where id = $1`, [orgId]);
  assert.equal(sending.rows[0].sending_enabled, false);

  await assert.rejects(
    db.query(`update owner_bootstrap_notes set status = 'applied' where org_id = $1`, [orgId]),
    /owner notes are not updated/i,
  );
});
