import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const AGENCY_ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const EDUCATION_ID = "a2c00000-0000-4000-8000-000000000002";
const TOKEN_HASH = "ab".repeat(32);

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

test("uuid asset keys are not phone numbers and a real phone does not throw", async () => {
  const db = new PGlite();
  await applyBase(db);
  await db.exec(migration("20261016120000_phase2c_snapshots.sql"));

  const uuid = "aaaaaaaa-bbbb-4ccc-8ddd-123456789012";
  const clean = {
    version: 1,
    pipelines: [
      {
        asset_key: `pipeline:${uuid}`,
        name: "Sales",
        stages: [{ asset_key: `stage:${uuid}`, name: "New" }],
      },
    ],
    sequences: [
      {
        asset_key: `sequence:${uuid}`,
        steps: [{ asset_key: `step:${uuid}`, template_asset_key: "123456789012345" }],
      },
    ],
    note: `see ${uuid}`,
    label: `sequence:${uuid}`,
  };
  const cleanIssues = await db.query("select public.snapshot_payload_issues($1::jsonb) as issues", [JSON.stringify(clean)]);
  assert.deepEqual(cleanIssues.rows[0].issues ?? [], []);

  const flagged = {
    ...clean,
    body: `Call 0821234567 about ${uuid}`,
  };
  const phoneIssues = await db.query("select public.snapshot_payload_issues($1::jsonb) as issues", [JSON.stringify(flagged)]);
  assert.deepEqual(phoneIssues.rows[0].issues, ["phone_number"]);
});

test("phase 2c snapshots stay free of contacts, messages, and secrets", async () => {
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

    insert into workspace_pipelines (id, org_id, name, is_default)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '${AGENCY_ORG}', 'Duplicate', false);
    insert into workspace_pipeline_stages (org_id, pipeline_id, name, position, is_won, is_lost)
    values ('${AGENCY_ORG}', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'New', 1, false, false);

    insert into crm_leads (id, name, company, phone, stage, notes, ord, org_id)
    values
      ('lead-new', 'A', 'Co', 'secret.person@example.com', 'New', 'secret.person@example.com', 1, '${AGENCY_ORG}'),
      ('lead-won', 'B', 'Co', '', 'Won', 'super-secret-token-value', 2, '${AGENCY_ORG}');

    insert into workspace_messages (org_id, channel, direction, body, status)
    values ('${AGENCY_ORG}', 'whatsapp', 'outbound', 'SECRET_MESSAGE_BODY', 'draft');

    create schema if not exists private;
    create table if not exists private.channel_secrets (
      id uuid primary key default gen_random_uuid(),
      secret text not null,
      name text not null default ''
    );
    insert into private.channel_secrets (secret, name) values ('super-secret-token-value', 'meta');
  `);

  await db.exec(migration("20261016120000_phase2c_snapshots.sql"));

  const stages = await db.query(
    "select stage_id is not null as linked from crm_leads where id in ('lead-new', 'lead-won') order by id",
  );
  assert.deepEqual(stages.rows.map((row) => row.linked), [false, true]);

  const assetKeys = await db.query(
    "select asset_key from workspace_sequences where name = 'New lead follow-up'",
  );
  assert.equal(assetKeys.rows.length, 1);
  assert.match(String(assetKeys.rows[0].asset_key), /^sequence:/);

  const seeds = await db.query("select name from snapshots order by name");
  assert.deepEqual(seeds.rows.map((row) => row.name), ["Agency Default", "Education / Admissions"]);

  const educationStages = await db.query(
    `select stage->>'name' as name
     from snapshots, jsonb_array_elements(payload->'pipelines') pipe, jsonb_array_elements(pipe->'stages') stage
     where snapshots.id = '${EDUCATION_ID}'
     order by (stage->>'position')::int`,
  );
  assert.deepEqual(educationStages.rows.map((row) => row.name), [
    "Enquiry",
    "Application Started",
    "Docs Submitted",
    "Accepted",
    "Registered",
    "Lost",
  ]);

  const issues = await db.query("select public.snapshot_payload_issues(payload) as issues from snapshots");
  for (const row of issues.rows) {
    assert.deepEqual(row.issues, []);
  }

  const exported = await asUser(db, AGENCY_USER, `select public.snapshot_export('${AGENCY_ORG}'::uuid) as payload`);
  const payload = exported.rows[0].payload;
  const encoded = JSON.stringify(payload);
  assert.deepEqual(Object.keys(payload).sort(), ["custom_fields", "message_templates", "pipelines", "sequences", "version"]);
  assert.equal(encoded.includes("SECRET_MESSAGE_BODY"), false);
  assert.equal(encoded.includes("secret.person@example.com"), false);
  assert.equal(encoded.includes("super-secret-token-value"), false);
  assert.equal(encoded.includes("27646863803"), false);
  assert.equal(encoded.includes("contacts"), false);
  assert.equal(encoded.includes("channel_secrets"), false);

  await assert.rejects(
    () => asUser(db, EASTC_USER, `select public.snapshot_export('${AGENCY_ORG}'::uuid)`),
    /not allowed/i,
  );

  const created = await asUser(
    db,
    AGENCY_USER,
    `select public.provision_client_workspace(
      'New Campus',
      'new-campus',
      '',
      '#0F3D4C',
      '#C4A35A',
      'New Campus',
      '${EDUCATION_ID}'::uuid,
      'admin@newcampus.co.za',
      'starter',
      '${TOKEN_HASH}'
    ) as created`,
  );
  const workspace = created.rows[0].created;
  assert.equal(workspace.sending_enabled, false);
  assert.equal(workspace.slug, "new-campus");
  assert.equal(workspace.plan_key, "starter");

  const orgId = workspace.org_id;
  const flags = await db.query(`select sending_enabled, plan_key, created_from_snapshot_id from organizations where id = '${orgId}'`);
  assert.equal(flags.rows[0].sending_enabled, false);
  assert.equal(flags.rows[0].plan_key, "starter");
  assert.equal(flags.rows[0].created_from_snapshot_id, EDUCATION_ID);

  const appliedStages = await db.query(
    `select name from pipeline_stages where org_id = '${orgId}' order by position`,
  );
  assert.deepEqual(appliedStages.rows.map((row) => row.name), [
    "Enquiry",
    "Application Started",
    "Docs Submitted",
    "Accepted",
    "Registered",
    "Lost",
  ]);

  const messages = await db.query(`select count(*)::int as total from workspace_messages where org_id = '${orgId}'`);
  assert.equal(messages.rows[0].total, 0);
  const invites = await db.query(
    `select role, email from invitations where org_id = '${orgId}'`,
  );
  assert.deepEqual(invites.rows, [{ role: "client_admin", email: "admin@newcampus.co.za" }]);
  const loads = await db.query(
    `select mode from snapshot_loads where target_org_id = '${orgId}' order by created_at`,
  );
  assert.deepEqual(loads.rows.map((row) => row.mode), ["apply"]);

  await db.exec(`
    update message_templates
    set body = 'Client rewrote the docs reminder and kept it local'
    where org_id = '${orgId}' and asset_key = 'template:admissions:docs';

    update snapshots
    set payload = jsonb_set(
      payload,
      '{message_templates}',
      (
        select jsonb_agg(
          case
            when elem->>'asset_key' = 'template:admissions:enquiry'
              then jsonb_set(elem, '{body}', '"Agency updated the enquiry template"')
            else elem
          end
        )
        from jsonb_array_elements(payload->'message_templates') elem
      )
    )
    where id = '${EDUCATION_ID}';
  `);

  const pushed = await asUser(db, AGENCY_USER, `select public.snapshot_push('${EDUCATION_ID}'::uuid) as report`);
  const report = pushed.rows[0].report;
  const byKey = Object.fromEntries(report.map((row) => [row.asset_key, row.result]));
  assert.equal(byKey["template:admissions:docs"], "skipped_client_edit");
  assert.equal(byKey["template:admissions:enquiry"], "updated");

  const bodies = await db.query(
    `select asset_key, body from message_templates where org_id = '${orgId}' and asset_key in ('template:admissions:docs', 'template:admissions:enquiry') order by asset_key`,
  );
  assert.equal(bodies.rows[0].body, "Client rewrote the docs reminder and kept it local");
  assert.equal(bodies.rows[1].body, "Agency updated the enquiry template");

  const stillOff = await db.query(`select sending_enabled from organizations where id = '${orgId}'`);
  assert.equal(stillOff.rows[0].sending_enabled, false);
  const stillNoMessages = await db.query(`select count(*)::int as total from workspace_messages where org_id = '${orgId}'`);
  assert.equal(stillNoMessages.rows[0].total, 0);

  const hidden = await asUser(db, EASTC_USER, `select asset_key from pipelines where org_id = '${orgId}'`);
  assert.equal(hidden.rows.length, 0);

  await assert.rejects(
    () => asUser(
      db,
      EASTC_USER,
      `select public.provision_client_workspace(
        'Stolen', 'stolen', '', '#000000', '#000000', 'Stolen',
        '${EDUCATION_ID}'::uuid, 'x@y.co', 'starter', '${TOKEN_HASH}'
      )`,
    ),
    /not allowed/i,
  );
});
