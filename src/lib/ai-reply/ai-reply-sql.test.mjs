import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const AGENCY_STAFF = "66666666-6666-4666-8666-666666666666";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const CONV = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const OTHER_CONV = "dddddddd-dddd-4ddd-8ddd-ddddddddddd2";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyPhase3(db) {
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
  for (const name of [
    "20260903000000_company_crm.sql",
    "20260926160000_crm_automation.sql",
    "20260926183000_outbound_channels.sql",
    "20260926200000_send_compliance.sql",
    "20260926160000_agency_tenancy.sql",
    "20260926200000_phase2a_access.sql",
    "20261015120000_org_scope_phase1_tables.sql",
    "20261015140000_phase2b_channels_popia.sql",
    "20261016120000_phase2c_snapshots.sql",
    "20261017120000_phase2d_workflows.sql",
    "20261018120000_phase2e_inbox.sql",
    "20261021120000_phase3a_conversation_ai.sql",
  ]) {
    await db.exec(migration(name));
  }
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

test("phase 3a migration keeps sending off and drafts disabled", () => {
  const sql = migration("20261021120000_phase3a_conversation_ai.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.match(sql, /enabled boolean not null default false/);
  assert.match(sql, /require_human_before_send boolean not null default true/);
  assert.match(sql, /consent required/);
  assert.match(sql, /sending is off/);
  assert.match(sql, /agency_owner/);
  assert.match(sql, /client_admin/);
});

test("roles, consent, an unconfigured draft, and a held outbox row", async () => {
  const db = new PGlite();
  await applyPhase3(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${AGENCY_STAFF}', 'staff@aiautotech.co.za'),
      ('${EASTC_USER}', 'staff@eastc.co.za'),
      ('${EASTC_ADMIN}', 'admin@eastc.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za');

    insert into organizations (id, name, slug, org_type, form_key)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Other Agency', 'other-agency', 'agency', 'other-agency');

    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_STAFF}', id, 'agency_staff' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_ADMIN}', id, 'client_admin' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_USER}', id, 'agency_owner' from organizations where slug = 'other-agency';

    insert into conversations (id, org_id, channel, status, assigned_user_id)
    values
      ('${CONV}', '${EASTC_ORG}', 'whatsapp', 'open', '${EASTC_USER}'),
      ('${OTHER_CONV}', '${EASTC_ORG}', 'sms', 'open', null);
  `);

  const flags = await db.query("select sending_enabled from organizations where slug in ('ai-autotech', 'eastc')");
  assert.equal(flags.rows.every((row) => row.sending_enabled === false), true);
  const defaults = await db.query("select count(*)::int as n from ai_reply_settings");
  assert.equal(defaults.rows[0].n, 0);

  await asUser(
    db,
    EASTC_ADMIN,
    `insert into ai_reply_settings (org_id, enabled, mode) values ('${EASTC_ORG}', false, 'draft_only')`,
  );
  const saved = await db.query(`select enabled, mode, require_human_before_send from ai_reply_settings where org_id = '${EASTC_ORG}'`);
  assert.equal(saved.rows[0].enabled, false);
  assert.equal(saved.rows[0].mode, "draft_only");
  assert.equal(saved.rows[0].require_human_before_send, true);

  const userUpdate = await asUser(db, EASTC_USER, `update ai_reply_settings set enabled = true where org_id = '${EASTC_ORG}' returning enabled`);
  assert.equal(userUpdate.rows.length, 0);
  const staffUpdate = await asUser(db, AGENCY_STAFF, `update ai_reply_settings set mode = 'queue_outbox' where org_id = '${EASTC_ORG}' returning mode`);
  assert.equal(staffUpdate.rows.length, 0);
  await assert.rejects(
    () => asUser(db, EASTC_USER, `insert into ai_reply_settings (org_id, enabled) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true)`),
    /row-level security|permission/i,
  );
  const stillOff = await db.query(`select enabled from ai_reply_settings where org_id = '${EASTC_ORG}'`);
  assert.equal(stillOff.rows[0].enabled, false);

  await asUser(
    db,
    AGENCY_USER,
    `update ai_reply_settings set tone = 'warm' where org_id = '${EASTC_ORG}'`,
  );
  const ownerWrote = await db.query(`select tone from ai_reply_settings where org_id = '${EASTC_ORG}'`);
  assert.equal(ownerWrote.rows[0].tone, "warm");

  const other = await asUser(db, OTHER_USER, "select org_id::text from ai_reply_settings");
  assert.equal(other.rows.length, 0);

  await asUser(
    db,
    EASTC_USER,
    `insert into ai_drafts (id, org_id, conversation_id, status, consent_ok, model_meta)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '${EASTC_ORG}', '${CONV}', 'failed', false, '{"failure":"consent_denied","reason":"no opt-in"}'::jsonb)`,
  );
  await assert.rejects(
    () => asUser(
      db,
      EASTC_USER,
      `insert into ai_drafts (org_id, conversation_id, status, consent_ok)
       values ('${EASTC_ORG}', '${OTHER_CONV}', 'pending_review', true)`,
    ),
    /row-level security|permission/i,
  );
  await assert.rejects(
    () => db.query(`update ai_drafts set status = 'queued' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'`),
    /consent required/,
  );
  await assert.rejects(
    () => db.query(`update ai_drafts set status = 'approved' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'`),
    /consent required/,
  );

  await db.query(`
    insert into ai_drafts (id, org_id, conversation_id, status, consent_ok, draft_body, model_meta)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
      '${EASTC_ORG}',
      '${CONV}',
      'failed',
      true,
      '',
      '{"failure":"provider_unconfigured","reason":"AI_REPLY_API_KEY is not set."}'::jsonb
    )
  `);
  const unconfigured = await db.query(`
    select status, model_meta->>'failure' as failure
    from ai_drafts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02'
  `);
  assert.equal(unconfigured.rows[0].status, "failed");
  assert.equal(unconfigured.rows[0].failure, "provider_unconfigured");

  await db.query(`
    insert into ai_drafts (id, org_id, conversation_id, status, consent_ok, draft_body)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
      '${EASTC_ORG}',
      '${CONV}',
      'pending_review',
      true,
      'Thanks, we can help with that.'
    )
  `);
  await db.query(`
    insert into crm_outbox (
      id, org_id, channel, to_address, body, status, provider, provider_id, error, purpose, conversation_id
    ) values (
      'msg_ai_held',
      '${EASTC_ORG}',
      'whatsapp',
      '+27825550101',
      'Thanks, we can help with that.',
      'held',
      'outbox',
      'msg_ai_held',
      'Held. Sending is off for this workspace. Nothing was delivered.',
      'service',
      '${CONV}'
    )
  `);
  await db.query(`
    update ai_drafts
    set status = 'queued', outbox_id = 'msg_ai_held'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'
  `);

  const outbox = await db.query(`select status from crm_outbox where id = 'msg_ai_held'`);
  assert.equal(outbox.rows[0].status, "held");
  const sent = await db.query(`select count(*)::int as n from crm_outbox where status = 'sent'`);
  assert.equal(sent.rows[0].n, 0);
  const sending = await db.query(`select sending_enabled from organizations where id = '${EASTC_ORG}'`);
  assert.equal(sending.rows[0].sending_enabled, false);
  await assert.rejects(
    () => db.query(`update ai_drafts set status = 'sent' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'`),
    /sending is off/,
  );
  const draft = await db.query(`select status from ai_drafts where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'`);
  assert.equal(draft.rows[0].status, "queued");
});
