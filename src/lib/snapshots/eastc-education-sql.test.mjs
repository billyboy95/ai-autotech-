import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const STAFF_USER = "33333333-3333-4333-8333-333333333333";
const RESTRICTED_USER = "44444444-4444-4444-8444-444444444444";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const OTHER_ADMIN = "66666666-6666-4666-8666-666666666666";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const OTHER_ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9";
const EDUCATION_ID = "a2c00000-0000-4000-8000-000000000002";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

function asJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
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
  await db.exec(migration("20261016120000_phase2c_snapshots.sql"));
  await db.exec(migration("20261017120000_phase2d_workflows.sql"));
  await db.exec(migration("20261027120000_phase4d_eastc_education.sql"));
  await db.exec(migration("20261027120000_phase4d_eastc_education.sql"));
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

test("step 21 sql does not turn sending on or delete tenant rows", () => {
  const sql = migration("20261027120000_phase4d_eastc_education.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\bdelete\s+from\b/i.test(sql), false);
  assert.match(sql, /apply_education_pack_to_eastc/);
  assert.match(sql, /snapshot\.education_applied/);
  assert.match(sql, /eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1/);
  assert.match(sql, /a2c00000-0000-4000-8000-000000000002/);
});

test("education pack applies to EASTC once, stays idempotent, and rejects client admins", async () => {
  const db = new PGlite();
  await applyBase(db);

  const seeded = await db.query(
    `select payload->'workflows'->0->>'asset_key' as asset_key,
            (payload->'workflows'->0->>'active')::boolean as active,
            jsonb_array_length(payload->'workflows')::int as total
     from snapshots where id = '${EDUCATION_ID}'`,
  );
  assert.equal(seeded.rows[0].asset_key, "workflow:admissions-enquiry");
  assert.equal(seeded.rows[0].active, false);
  assert.equal(seeded.rows[0].total, 1);

  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${STAFF_USER}', 'staff@aiautotech.co.za'),
      ('${RESTRICTED_USER}', 'limited@aiautotech.co.za'),
      ('${EASTC_ADMIN}', 'admin@eastc.co.za'),
      ('${OTHER_ADMIN}', 'admin@othercampus.co.za');

    insert into organizations (id, name, slug, status, org_type, parent_id, form_key)
    values (
      '${OTHER_ORG}',
      'Other Campus',
      'other-campus',
      'active',
      'client',
      (select id from organizations where slug = 'ai-autotech'),
      'other-campus'
    );

    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${STAFF_USER}', id, 'agency_staff' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_ADMIN}', id, 'client_admin' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_ADMIN}', id, 'client_admin' from organizations where id = '${OTHER_ORG}';

    with staff as (
      insert into memberships (user_id, org_id, role)
      select '${RESTRICTED_USER}', id, 'agency_staff' from organizations where slug = 'ai-autotech'
      returning id
    )
    insert into member_org_access (member_id, org_id)
    select staff.id, '${OTHER_ORG}'::uuid from staff;

    insert into crm_leads (id, name, company, phone, stage, notes, ord, org_id)
    values ('eastc-keep', 'Kept Student', 'EASTC', '', 'New', 'do not copy', 1, '${EASTC_ORG}');

    insert into workspace_messages (org_id, channel, direction, body, status)
    values ('${EASTC_ORG}', 'whatsapp', 'outbound', 'KEEP_THIS_DRAFT', 'draft');

    create schema if not exists private;
    create table if not exists private.channel_secrets (
      id uuid primary key default gen_random_uuid(),
      secret text not null
    );
    insert into private.channel_secrets (secret) values ('super-secret-token-value');

    create table if not exists activity_logs (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      actor_id uuid,
      entity_type text not null,
      entity_id uuid,
      action text not null,
      metadata jsonb not null default '{}'::jsonb,
      org_id uuid
    );
  `);

  await assert.rejects(
    () => asUser(db, EASTC_ADMIN, "select public.apply_education_pack_to_eastc()"),
    /not allowed/i,
  );
  await assert.rejects(
    () => asUser(db, OTHER_ADMIN, "select public.apply_education_pack_to_eastc()"),
    /not allowed/i,
  );
  await assert.rejects(
    () => asUser(db, RESTRICTED_USER, "select public.apply_education_pack_to_eastc()"),
    /not allowed/i,
  );
  await assert.rejects(
    () => asUser(
      db,
      EASTC_ADMIN,
      `select public.snapshot_apply('${EDUCATION_ID}'::uuid, '${OTHER_ORG}'::uuid)`,
    ),
    /not allowed/i,
  );

  const before = await db.query(`
    select
      (select count(*)::int from pipelines where org_id = '${EASTC_ORG}') as pipelines,
      (select count(*)::int from pipeline_stages where org_id = '${EASTC_ORG}') as stages,
      (select count(*)::int from crm_leads where org_id = '${EASTC_ORG}') as leads,
      (select count(*)::int from workspace_messages where org_id = '${EASTC_ORG}') as messages,
      (select count(*)::int from organizations where slug = 'eastc') as eastc_orgs,
      (select count(*)::int from pipelines where org_id = '${OTHER_ORG}' and asset_key = 'pipeline:admissions') as other_admissions
  `);
  assert.equal(before.rows[0].leads, 1);
  assert.equal(before.rows[0].messages, 1);
  assert.equal(before.rows[0].eastc_orgs, 1);
  assert.equal(before.rows[0].other_admissions, 0);
  assert.equal(before.rows[0].pipelines >= 1, true);

  const first = await asUser(db, STAFF_USER, "select public.apply_education_pack_to_eastc() as result");
  const applied = asJson(first.rows[0].result);
  assert.equal(applied.slug, "eastc");
  assert.equal(applied.org_id, EASTC_ORG);
  assert.equal(applied.snapshot_id, EDUCATION_ID);
  assert.equal(applied.sending_enabled, false);
  const firstReport = asJson(applied.report);
  const firstByKey = Object.fromEntries(firstReport.map((row) => [row.asset_key, row.result]));
  assert.equal(firstByKey["pipeline:admissions"], "created");
  assert.equal(firstByKey["workflow:admissions-enquiry"], "created");
  assert.equal(firstReport.some((row) => row.result === "created"), true);

  const flags = await db.query(
    `select sending_enabled, workflow_engine_enabled, created_from_snapshot_id
     from organizations where id = '${EASTC_ORG}'`,
  );
  assert.equal(flags.rows[0].sending_enabled, false);
  assert.equal(flags.rows[0].workflow_engine_enabled, false);
  assert.equal(flags.rows[0].created_from_snapshot_id, EDUCATION_ID);

  const stages = await db.query(
    `select stage.name
     from pipeline_stages stage
     join pipelines pipe on pipe.id = stage.pipeline_id
     where stage.org_id = '${EASTC_ORG}' and pipe.asset_key = 'pipeline:admissions'
     order by stage.position`,
  );
  assert.deepEqual(stages.rows.map((row) => row.name), [
    "Enquiry",
    "Application Started",
    "Docs Submitted",
    "Accepted",
    "Registered",
    "Lost",
  ]);

  const kept = await db.query(`
    select
      (select count(*)::int from pipelines where org_id = '${EASTC_ORG}' and name = 'Enrolment') as enrolment,
      (select count(*)::int from pipeline_stages where org_id = '${EASTC_ORG}' and name = 'Campus visit booked') as visit,
      (select count(*)::int from pipelines where org_id = '${EASTC_ORG}' and is_default and asset_key = 'pipeline:admissions') as admissions_default,
      (select count(*)::int from pipelines where org_id = '${EASTC_ORG}' and is_default and asset_key <> 'pipeline:admissions') as other_defaults,
      (select active from sequences where org_id = '${EASTC_ORG}' and asset_key = 'sequence:admissions-follow-up') as sequence_active,
      (select active from workflows where org_id = '${EASTC_ORG}' and asset_key = 'workflow:admissions-enquiry') as workflow_active,
      (select count(*)::int from pipelines where org_id = '${EASTC_ORG}' and checksum is distinct from source_checksum) as edited_pipelines
  `);
  assert.equal(kept.rows[0].enrolment, 1);
  assert.equal(kept.rows[0].visit, 1);
  assert.equal(kept.rows[0].admissions_default, 1);
  assert.equal(kept.rows[0].other_defaults, 0);
  assert.equal(kept.rows[0].sequence_active, false);
  assert.equal(kept.rows[0].workflow_active, false);
  assert.equal(kept.rows[0].edited_pipelines, 0);

  const privateRows = await db.query(`
    select
      (select count(*)::int from crm_leads) as leads,
      (select body from workspace_messages where org_id = '${EASTC_ORG}') as body,
      (select count(*)::int from workspace_messages) as messages,
      (select count(*)::int from private.channel_secrets) as secrets,
      (select count(*)::int from organizations) as orgs
  `);
  assert.equal(privateRows.rows[0].leads, 1);
  assert.equal(privateRows.rows[0].body, "KEEP_THIS_DRAFT");
  assert.equal(privateRows.rows[0].messages, 1);
  assert.equal(privateRows.rows[0].secrets, 1);

  const orgCount = privateRows.rows[0].orgs;
  const pipelineCount = (await db.query(`select count(*)::int as total from pipelines where org_id = '${EASTC_ORG}'`)).rows[0].total;
  const stageCount = (await db.query(`select count(*)::int as total from pipeline_stages where org_id = '${EASTC_ORG}'`)).rows[0].total;
  assert.equal(pipelineCount, before.rows[0].pipelines + 1);
  assert.equal(stageCount, before.rows[0].stages + 6);

  const second = await asUser(db, AGENCY_USER, "select public.apply_education_pack_to_eastc() as result");
  const again = asJson(second.rows[0].result);
  assert.equal(again.sending_enabled, false);
  const secondReport = asJson(again.report);
  assert.equal(secondReport.every((row) => row.result === "unchanged"), true);
  assert.equal(secondReport.some((row) => row.result === "created"), false);

  const after = await db.query(`
    select
      (select count(*)::int from pipelines where org_id = '${EASTC_ORG}') as pipelines,
      (select count(*)::int from pipeline_stages where org_id = '${EASTC_ORG}') as stages,
      (select count(*)::int from message_templates where org_id = '${EASTC_ORG}' and asset_key like 'template:admissions:%') as templates,
      (select count(*)::int from custom_fields where org_id = '${EASTC_ORG}' and asset_key like 'field:admissions:%') as fields,
      (select count(*)::int from workflows where org_id = '${EASTC_ORG}' and asset_key = 'workflow:admissions-enquiry') as workflows,
      (select count(*)::int from organizations) as orgs,
      (select count(*)::int from organizations where slug = 'eastc') as eastc_orgs,
      (select count(*)::int from pipelines where org_id = '${OTHER_ORG}' and asset_key = 'pipeline:admissions') as other_admissions,
      (select bool_and(sending_enabled = false) from organizations) as sending_off
  `);
  assert.equal(after.rows[0].pipelines, pipelineCount);
  assert.equal(after.rows[0].stages, stageCount);
  assert.equal(after.rows[0].templates, 4);
  assert.equal(after.rows[0].fields, 3);
  assert.equal(after.rows[0].workflows, 1);
  assert.equal(after.rows[0].orgs, orgCount);
  assert.equal(after.rows[0].eastc_orgs, 1);
  assert.equal(after.rows[0].other_admissions, 0);
  assert.equal(after.rows[0].sending_off, true);

  const audits = await db.query(
    `select action, acting_as_agency from org_activity
     where org_id = '${EASTC_ORG}' and action = 'snapshot.education_applied'
     order by created_at`,
  );
  assert.equal(audits.rows.length, 2);
  assert.equal(audits.rows.every((row) => row.acting_as_agency === true), true);

  const logs = await db.query(
    `select action from activity_logs where action = 'snapshot.education_applied' order by created_at`,
  );
  assert.equal(logs.rows.length, 2);

  const loads = await db.query(
    `select mode from snapshot_loads where target_org_id = '${EASTC_ORG}' and snapshot_id = '${EDUCATION_ID}' order by created_at`,
  );
  assert.deepEqual(loads.rows.map((row) => row.mode), ["apply", "apply"]);

  await db.exec("reset role");
  await db.exec("set role anon");
  await assert.rejects(
    () => db.query("select public.apply_education_pack_to_eastc()"),
    /permission denied/i,
  );
});
