import assert from "node:assert/strict";
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

async function applyPhase5o(db) {
  await db.exec(migration("20260926160000_agency_tenancy.sql"));
  await db.exec(migration("20260926200000_phase2a_access.sql"));
  await db.exec(migration("20261111120000_phase5o_golive_checklist.sql"));
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

const call = `select public.record_golive_checklist_note($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

test("phase 5o stores a status snapshot and refuses secret-like strings", async () => {
  const sql = migration("20261111120000_phase5o_golive_checklist.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.equal(/apply_education_pack_to_eastc|apply_zentrix_workspace_pack/i.test(sql), false);
  assert.match(sql, /golive_checklist_notes/);
  assert.match(sql, /record_golive_checklist_note/);
  assert.match(sql, /golive_checklist_notes_guard/);
  assert.match(sql, /accessible_org_ids/);
  assert.match(sql, /has_org_role/);
  assert.match(sql, /agency_owner/);
  assert.match(sql, /agency_staff/);
  assert.match(sql, /secrets are not stored/);
  assert.match(sql, /sending stays blocked/);
  assert.match(sql, /status = 'noted'/);

  const db = new PGlite();
  await applyPhase5o(db);
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
  const pending = ["pending", "fixture", "pending", "pending", "pending", "pending", "fixture", "blocked"];

  await assert.rejects(
    asUser(db, EASTC_USER, call, [orgId, ...pending]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, ADMIN_USER, call, [orgId, ...pending]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, call, [orgId, "re_should-not-render", "pending", "pending", "pending", "pending", "pending", "fixture", "blocked"]),
    /secrets are not stored/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, call, [orgId, "pending", "sbp_should-not-render", "pending", "pending", "pending", "pending", "fixture", "blocked"]),
    /secrets are not stored/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, call, [orgId, "pending", "pending", "postgres://user:pass@localhost/db", "pending", "pending", "pending", "fixture", "blocked"]),
    /secrets are not stored/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, call, [orgId, "configured", "pending", "pending", "pending", "pending", "pending", "fixture", "blocked"]),
    /golive checklist note only/i,
  );
  await assert.rejects(
    asUser(db, AGENCY_USER, call, [orgId, "pending", "pending", "pending", "pending", "pending", "pending", "fixture", "ready"]),
    /sending stays blocked/i,
  );

  await assert.rejects(
    db.query(
      `insert into golive_checklist_notes (
         org_id, migrations, setup_wizard, owner_bootstrap, ops_secrets, education_pack, zentrix_pack, pwa_install, sending
       ) values ($1, 're_should-not-render', 'pending', 'pending', 'pending', 'pending', 'pending', 'fixture', 'blocked')`,
      [orgId],
    ),
    /secrets are not stored|check constraint|golive checklist note only/i,
  );
  await assert.rejects(
    db.query(
      `insert into golive_checklist_notes (
         org_id, migrations, setup_wizard, owner_bootstrap, ops_secrets, education_pack, zentrix_pack, pwa_install, sending
       ) values ($1, 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'fixture', 'ready')`,
      [orgId],
    ),
    /sending stays blocked|golive checklist note only|check constraint/i,
  );

  const saved = await asUser(
    db,
    AGENCY_USER,
    `${call} as note`,
    [orgId, "pending", "pending", "fixture", "pending", "ready", "pending", "fixture", "blocked"],
  );
  const note = saved.rows[0].note;
  assert.equal(note.stored, true);
  assert.equal(note.status, "noted");
  assert.equal(note.sandbox, true);
  assert.equal(note.charged, false);
  assert.equal(note.migrations, "pending");
  assert.equal(note.setup_wizard, "pending");
  assert.equal(note.owner_bootstrap, "fixture");
  assert.equal(note.ops_secrets, "pending");
  assert.equal(note.education_pack, "ready");
  assert.equal(note.zentrix_pack, "pending");
  assert.equal(note.pwa_install, "fixture");
  assert.equal(note.sending, "blocked");
  assert.equal(note.applied, false);
  assert.equal(note.clicked_apply, false);
  assert.equal(note.registered, false);
  assert.equal(note.scheduled, false);
  assert.equal(note.sending_enabled, false);
  assert.equal(note.secret, undefined);
  assert.equal(note.value, undefined);

  const staff = await asUser(
    db,
    STAFF_USER,
    `${call} as note`,
    [orgId, "fixture", "pending", "pending", "ready", "pending", "ready", "pending", "blocked"],
  );
  assert.equal(staff.rows[0].note.stored, true);
  assert.equal(staff.rows[0].note.sending, "blocked");
  assert.equal(staff.rows[0].note.applied, false);

  const rows = await db.query(
    `select migrations, setup_wizard, owner_bootstrap, ops_secrets, education_pack, zentrix_pack, pwa_install, sending, status, sandbox, charged
     from golive_checklist_notes where org_id = $1 order by created_at`,
    [orgId],
  );
  assert.equal(rows.rows.length, 2);
  assert.equal(rows.rows.every((row) => row.status === "noted" && row.sandbox === true && row.charged === false && row.sending === "blocked"), true);
  const stored = JSON.stringify(rows.rows);
  assert.equal(stored.includes("sbp_"), false);
  assert.equal(stored.includes("re_"), false);
  assert.equal(stored.includes("postgres://"), false);
  assert.equal(stored.includes("@"), false);
  for (const row of rows.rows) {
    for (const key of ["migrations", "setup_wizard", "owner_bootstrap", "ops_secrets", "education_pack", "zentrix_pack", "pwa_install", "sending"]) {
      assert.ok(["pending", "ready", "blocked", "fixture"].includes(row[key]), `${key}=${row[key]}`);
    }
  }

  const hidden = await asUser(
    db,
    EASTC_USER,
    `select count(*)::int as count from golive_checklist_notes where org_id = $1`,
    [orgId],
  );
  assert.equal(hidden.rows[0].count, 0);

  const columns = await db.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'golive_checklist_notes'`,
  );
  const names = columns.rows.map((row) => row.column_name);
  assert.equal(names.includes("migrations"), true);
  assert.equal(names.includes("sending"), true);
  assert.equal(names.includes("ops_secrets"), true);
  const sensitive = names.filter((name) => name !== "ops_secrets" && /secret|token|password|api_key|email/.test(name));
  assert.deepEqual(sensitive, []);

  const sending = await db.query(`select sending_enabled from organizations where id = $1`, [orgId]);
  assert.equal(sending.rows[0].sending_enabled, false);

  await assert.rejects(
    db.query(`update golive_checklist_notes set status = 'applied' where org_id = $1`, [orgId]),
    /golive notes are not updated/i,
  );
  await assert.rejects(
    db.query(`update golive_checklist_notes set migrations = 're_should-not-render' where org_id = $1`, [orgId]),
    /golive notes are not updated/i,
  );
});
