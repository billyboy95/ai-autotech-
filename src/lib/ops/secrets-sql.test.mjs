import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const STAFF_USER = "33333333-3333-4333-8333-333333333333";
const ADMIN_USER = "44444444-4444-4444-8444-444444444444";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const JOBS = ["automation", "workflow-engine", "billing-cycle", "ai-reply-drafts"];

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyPhase5n(db) {
  await db.exec(migration("20260926160000_agency_tenancy.sql"));
  await db.exec(migration("20260926200000_phase2a_access.sql"));
  await db.exec(migration("20261110120000_phase5n_ops_secrets_ready.sql"));
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

test("phase 5n stores a presence note and does not keep a secret", async () => {
  const sql = migration("20261110120000_phase5n_ops_secrets_ready.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.equal(/email text/i.test(sql), false);
  assert.match(sql, /ops_secrets_notes/);
  assert.match(sql, /record_ops_secrets_note/);
  assert.match(sql, /ops_secrets_notes_guard/);
  assert.match(sql, /accessible_org_ids/);
  assert.match(sql, /has_org_role/);
  assert.match(sql, /secrets are not stored/);
  assert.match(sql, /status = 'noted'/);
  assert.match(sql, /registered/);

  const db = new PGlite();
  await applyPhase5n(db);
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

  await assert.rejects(
    asUser(db, EASTC_USER, `select public.record_ops_secrets_note($1, $2, $3, $4, $5, $6)`, [orgId, "missing", "fixture", "missing", "missing", "missing"]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, ADMIN_USER, `select public.record_ops_secrets_note($1, $2, $3, $4, $5, $6)`, [orgId, "missing", "missing", "missing", "missing", "missing"]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.record_ops_secrets_note($1, $2, $3, $4, $5, $6)`, [orgId, "re_should-not-render", "missing", "missing", "missing", "missing"]),
    /secrets are not stored/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.record_ops_secrets_note($1, $2, $3, $4, $5, $6)`, [orgId, "configured", "sbp_should-not-render", "missing", "missing", "missing"]),
    /secrets are not stored/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.record_ops_secrets_note($1, $2, $3, $4, $5, $6)`, [orgId, "configured", "applied", "missing", "missing", "missing"]),
    /ops secrets note only/i,
  );
  await assert.rejects(
    db.query(
      `insert into ops_secrets_notes (org_id, cron_presence, email_provider, whatsapp_meta, sms_provider, payfast_sandbox, cron_jobs)
       values ($1, 'configured', 'missing', 'missing', 'missing', 'missing', array['automation', 'sbp_should-not-render']::text[])`,
      [orgId],
    ),
    /sandbox ops note only|check constraint|secrets are not stored/i,
  );

  const saved = await asUser(
    db,
    AGENCY_USER,
    `select public.record_ops_secrets_note($1, $2, $3, $4, $5, $6) as note`,
    [orgId, "configured", "missing", "fixture", "missing", "missing"],
  );
  const note = saved.rows[0].note;
  assert.equal(note.stored, true);
  assert.equal(note.status, "noted");
  assert.equal(note.sandbox, true);
  assert.equal(note.charged, false);
  assert.equal(note.cron_presence, "configured");
  assert.equal(note.email_provider, "missing");
  assert.equal(note.whatsapp_meta, "fixture");
  assert.equal(note.sms_provider, "missing");
  assert.equal(note.payfast_sandbox, "missing");
  assert.deepEqual(note.cron_jobs, JOBS);
  assert.equal(note.registered, false);
  assert.equal(note.scheduled, false);
  assert.equal(note.applied, false);
  assert.equal(note.sending_enabled, false);
  assert.equal(note.secret, undefined);
  assert.equal(note.value, undefined);

  const staff = await asUser(
    db,
    STAFF_USER,
    `select public.record_ops_secrets_note($1, $2, $3, $4, $5, $6) as note`,
    [orgId, "missing", "configured", "missing", "fixture", "configured"],
  );
  assert.equal(staff.rows[0].note.stored, true);
  assert.equal(staff.rows[0].note.registered, false);

  const rows = await db.query(
    `select cron_presence, email_provider, whatsapp_meta, sms_provider, payfast_sandbox, cron_jobs, status, sandbox, charged
     from ops_secrets_notes where org_id = $1 order by created_at`,
    [orgId],
  );
  assert.equal(rows.rows.length, 2);
  assert.equal(rows.rows.every((row) => row.status === "noted" && row.sandbox === true && row.charged === false), true);
  assert.deepEqual(rows.rows[0].cron_jobs, JOBS);
  const stored = JSON.stringify(rows.rows);
  assert.equal(stored.includes("sbp_"), false);
  assert.equal(stored.includes("re_"), false);
  assert.equal(stored.includes("@"), false);

  const hidden = await asUser(
    db,
    EASTC_USER,
    `select count(*)::int as count from ops_secrets_notes where org_id = $1`,
    [orgId],
  );
  assert.equal(hidden.rows[0].count, 0);

  const columns = await db.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'ops_secrets_notes'`,
  );
  const names = columns.rows.map((row) => row.column_name);
  assert.equal(names.includes("cron_presence"), true);
  assert.equal(names.includes("email_provider"), true);
  assert.equal(names.some((name) => /secret|token|password|api_key/.test(name)), false);
  assert.equal(names.includes("email"), false);

  const sending = await db.query(`select sending_enabled from organizations where id = $1`, [orgId]);
  assert.equal(sending.rows[0].sending_enabled, false);

  await assert.rejects(
    db.query(`update ops_secrets_notes set status = 'applied' where org_id = $1`, [orgId]),
    /ops notes are not updated/i,
  );
  await assert.rejects(
    db.query(`update ops_secrets_notes set cron_presence = 're_should-not-render' where org_id = $1`, [orgId]),
    /ops notes are not updated/i,
  );
});
