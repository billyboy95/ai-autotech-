import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const AGENCY_ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyBase(db) {
  await db.exec(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
    end
    $$;
  `);
  await db.exec(migration("20260903000000_company_crm.sql"));
  await db.exec(migration("20260926160000_agency_tenancy.sql"));
  await db.exec(migration("20260926200000_phase2a_access.sql"));
}

async function asUser(db, userId, sql, params = []) {
  await db.exec("reset role");
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
  await db.exec("set role authenticated");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

test("phase 2d migration keeps sending off and is the claim lock", () => {
  const sql = migration("20261017120000_phase2d_workflows.sql");
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /limit lim/);
  assert.match(sql, /least\(greatest\(coalesce\(p_limit, 100\), 0\), 100\)/);
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.match(sql, /workflow_engine_enabled boolean not null default false/);
  assert.match(sql, /workflow:assign-and-ack/);
  assert.match(sql, /workflow:pipeline-cron/);
});

test("workflow rows dedupe events, claim due runs, and export without private data", async () => {
  const db = new PGlite();
  await applyBase(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${EASTC_USER}', 'admin@eastc.co.za');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_USER}', id, 'client_user' from organizations where slug = 'eastc';

    insert into crm_leads (id, name, company, phone, stage, notes, ord, org_id)
    values ('lead-secret', 'A', 'Co', 'secret.person@example.com', 'New', 'super-secret-token-value', 1, '${AGENCY_ORG}');

    insert into workspace_messages (org_id, channel, direction, body, status)
    values ('${AGENCY_ORG}', 'whatsapp', 'outbound', 'SECRET_MESSAGE_BODY', 'draft');
  `);
  await db.exec(migration("20261016120000_phase2c_snapshots.sql"));
  await db.exec(migration("20261017120000_phase2d_workflows.sql"));

  const flags = await db.query(
    "select sending_enabled, workflow_engine_enabled from organizations where slug = 'ai-autotech'",
  );
  assert.equal(flags.rows[0].sending_enabled, false);
  assert.equal(flags.rows[0].workflow_engine_enabled, false);

  const seeded = await db.query(
    "select asset_key from workflows where org_id = $1 and asset_key = 'workflow:assign-and-ack'",
    [AGENCY_ORG],
  );
  assert.equal(seeded.rows.length, 1);

  const first = await db.query(
    `select public.record_workflow_event($1, 'form.submitted', 'lead', 'lead-1', '{}'::jsonb, 'form-lead-1') as id`,
    [AGENCY_ORG],
  );
  const second = await db.query(
    `select public.record_workflow_event($1, 'form.submitted', 'lead', 'lead-1', '{}'::jsonb, 'form-lead-1') as id`,
    [AGENCY_ORG],
  );
  assert.equal(first.rows[0].id, second.rows[0].id);
  const runs = await db.query("select dedupe_key, status from workflow_runs where subject_id = 'lead-1'");
  assert.equal(runs.rows.length, 1);
  assert.match(runs.rows[0].dedupe_key, /:lead-1:/);

  const claimed = await db.query("select public.claim_due_workflow_runs(100) as rows");
  assert.equal(claimed.rows[0].rows.length, 1);
  assert.equal(claimed.rows[0].rows[0].status, "running");
  const again = await db.query("select public.claim_due_workflow_runs(100) as rows");
  assert.equal(again.rows[0].rows.length, 0);

  await db.query(
    `insert into workflow_run_logs (org_id, run_id, step_id, status, attempt, error)
     select org_id, id, 'note', 'failed', 1, 'upstream timed out'
     from workflow_runs where subject_id = 'lead-1'`,
  );
  const visible = await asUser(
    db,
    AGENCY_USER,
    "select step_id, status, error from workflow_run_logs",
  );
  assert.equal(visible.rows[0].status, "failed");
  assert.match(visible.rows[0].error, /upstream/);

  const hidden = await asUser(db, EASTC_USER, "select id from workflows where org_id = $1", [AGENCY_ORG]);
  assert.equal(hidden.rows.length, 0);

  const exported = await asUser(db, AGENCY_USER, `select public.snapshot_export('${AGENCY_ORG}'::uuid) as payload`);
  const payload = exported.rows[0].payload;
  const encoded = JSON.stringify(payload);
  assert.ok(Object.keys(payload).includes("workflows"));
  assert.ok(payload.workflows.some((workflow) => workflow.asset_key === "workflow:pipeline-cron"));
  assert.equal(encoded.includes("SECRET_MESSAGE_BODY"), false);
  assert.equal(encoded.includes("secret.person@example.com"), false);
  assert.equal(encoded.includes("super-secret-token-value"), false);
  assert.equal(encoded.includes("contacts"), false);
  assert.equal(encoded.includes("channel_secrets"), false);

  await assert.rejects(
    () => asUser(db, EASTC_USER, `select public.snapshot_export('${AGENCY_ORG}'::uuid)`),
    /not allowed/i,
  );
});
