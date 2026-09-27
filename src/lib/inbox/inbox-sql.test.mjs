import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const AGENCY_ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyInbox(db) {
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
  await db.exec(migration("20261015140000_phase2b_channels_popia.sql"));
  await db.exec(migration("20261016120000_phase2c_snapshots.sql"));
  await db.exec(migration("20261017120000_phase2d_workflows.sql"));
  await db.exec(migration("20261018120000_phase2e_inbox.sql"));
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

test("phase 2e migration keeps sending off", () => {
  const sql = migration("20261018120000_phase2e_inbox.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.match(sql, /use template/);
  assert.match(sql, /assigned_only/);
  assert.match(sql, /supabase_realtime/);
});

test("inbox rows stay inside the workspace and assigned_only hides other threads", async () => {
  const db = new PGlite();
  await applyInbox(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${EASTC_USER}', 'staff@eastc.co.za'),
      ('${EASTC_ADMIN}', 'admin@eastc.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za');

    insert into organizations (id, name, slug, org_type, form_key)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Other Agency', 'other-agency', 'agency', 'other-agency');

    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_ADMIN}', id, 'client_admin' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_USER}', id, 'agency_owner' from organizations where slug = 'other-agency';

    insert into channel_connections (id, org_id, channel, provider, identifier, display_name, status)
    values
      ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '${EASTC_ORG}', 'whatsapp', 'meta_cloud', 'EASTC_PHONE', 'EASTC WA', 'connected'),
      ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '${AGENCY_ORG}', 'whatsapp', 'meta_cloud', 'AGENCY_PHONE', 'Agency WA', 'connected');

    insert into conversations (id, org_id, channel, channel_connection_id, status, assigned_user_id, unread_count, wa_window_expires_at)
    values
      ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', '${EASTC_ORG}', 'whatsapp', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'open', '${EASTC_USER}', 1, now() + interval '2 hours'),
      ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', '${EASTC_ORG}', 'sms', null, 'open', null, 3, null),
      ('dddddddd-dddd-4ddd-8ddd-ddddddddddd3', '${AGENCY_ORG}', 'whatsapp', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'open', null, 4, now() + interval '2 hours'),
      ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'email', null, 'open', null, 9, null);

    insert into messages (org_id, conversation_id, direction, channel, body, provider_message_id, status, wa_category)
    values
      ('${EASTC_ORG}', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'in', 'whatsapp', 'EASTC assigned reply', 'wamid-eastc-1', 'received', 'service'),
      ('${EASTC_ORG}', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'in', 'sms', 'EASTC unassigned', 'sms-eastc-1', 'received', ''),
      ('${AGENCY_ORG}', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3', 'in', 'whatsapp', 'AGENCY secret', 'wamid-agency-1', 'received', 'service'),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'in', 'email', 'OTHER secret', 'email-other-1', 'received', '');
  `);

  const flags = await db.query("select sending_enabled from organizations where slug in ('ai-autotech', 'eastc')");
  assert.equal(flags.rows.every((row) => row.sending_enabled === false), true);

  const assigned = await asUser(db, EASTC_USER, "select id::text from conversations order by id");
  assert.deepEqual(assigned.rows.map((row) => row.id), ["dddddddd-dddd-4ddd-8ddd-ddddddddddd1"]);

  const assignedMessages = await asUser(db, EASTC_USER, "select body from messages order by body");
  assert.deepEqual(assignedMessages.rows.map((row) => row.body), ["EASTC assigned reply"]);

  const admin = await asUser(db, EASTC_ADMIN, "select id::text from conversations order by id");
  assert.deepEqual(admin.rows.map((row) => row.id), [
    "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
    "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
  ]);

  const other = await asUser(db, OTHER_USER, "select body from messages order by body");
  assert.deepEqual(other.rows.map((row) => row.body), ["OTHER secret"]);

  const agencySeesClient = await asUser(db, AGENCY_USER, "select count(*)::int as n from conversations");
  assert.equal(agencySeesClient.rows[0].n >= 3, true);
  const agencyMessages = await asUser(db, AGENCY_USER, "select body from messages where body = 'OTHER secret'");
  assert.equal(agencyMessages.rows.length, 0);

  await assert.rejects(
    () => asUser(
      db,
      EASTC_USER,
      `insert into conversations (org_id, channel, status) values ('${AGENCY_ORG}', 'sms', 'open')`,
    ),
    /row-level security|new row violates/i,
  );
});

test("free-form WhatsApp outside the window is rejected and an approved template is kept", async () => {
  const db = new PGlite();
  await applyInbox(db);
  await db.exec(`
    insert into message_templates (id, org_id, asset_key, channel, name, body, wa_category, wa_status)
    values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '${EASTC_ORG}',
      'tpl-enrolment',
      'whatsapp',
      'Enrolment follow-up',
      'Approved body',
      'utility',
      'approved'
    );
    insert into conversations (id, org_id, channel, status, wa_window_expires_at)
    values
      ('dddddddd-dddd-4ddd-8ddd-ddddddddddd5', '${EASTC_ORG}', 'whatsapp', 'open', now() - interval '1 hour'),
      ('dddddddd-dddd-4ddd-8ddd-ddddddddddd6', '${EASTC_ORG}', 'whatsapp', 'open', now() + interval '2 hours');
  `);

  await assert.rejects(
    () => db.query(`
      insert into messages (org_id, conversation_id, direction, channel, body, status, wa_category)
      values ('${EASTC_ORG}', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd5', 'out', 'whatsapp', 'free form', 'held', 'service')
    `),
    /use template/,
  );

  await db.query(`
    insert into messages (org_id, conversation_id, direction, channel, body, status, wa_category, template_id, provider_message_id, outbox_id)
    values (
      '${EASTC_ORG}',
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd5',
      'out',
      'whatsapp',
      'Approved body',
      'held',
      'utility',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'outbox:msg_template',
      'msg_template'
    )
  `);

  await db.query(`
    insert into messages (org_id, conversation_id, direction, channel, body, status, wa_category, provider_message_id)
    values (
      '${EASTC_ORG}',
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd6',
      'out',
      'whatsapp',
      'Inside the window',
      'held',
      'service',
      'outbox:msg_window'
    )
  `);

  const kept = await db.query("select provider_message_id from messages order by provider_message_id");
  assert.deepEqual(kept.rows.map((row) => row.provider_message_id), ["outbox:msg_template", "outbox:msg_window"]);
});

test("message.inbound feeds one workflow run and the service counter ignores other numbers", async () => {
  const db = new PGlite();
  await applyInbox(db);
  await db.exec(`
    insert into channel_connections (id, org_id, channel, provider, identifier, display_name, status)
    values
      ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '${EASTC_ORG}', 'whatsapp', 'meta_cloud', 'EASTC_PHONE', 'EASTC WA', 'connected'),
      ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '${AGENCY_ORG}', 'whatsapp', 'meta_cloud', 'AGENCY_PHONE', 'Agency WA', 'connected');
    insert into conversations (id, org_id, channel, channel_connection_id, status, wa_window_expires_at)
    values
      ('dddddddd-dddd-4ddd-8ddd-ddddddddddd6', '${EASTC_ORG}', 'whatsapp', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'open', now() + interval '2 hours'),
      ('dddddddd-dddd-4ddd-8ddd-ddddddddddd3', '${AGENCY_ORG}', 'whatsapp', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'open', now() + interval '2 hours');
    insert into messages (org_id, conversation_id, direction, channel, body, status, wa_category)
    values
      ('${EASTC_ORG}', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd6', 'out', 'whatsapp', 'one', 'held', 'service'),
      ('${EASTC_ORG}', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd6', 'out', 'whatsapp', 'two', 'queued', 'service'),
      ('${AGENCY_ORG}', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3', 'out', 'whatsapp', 'theirs', 'sent', 'service');
  `);

  const count = await db.query(
    `select public.wa_service_sends_this_month('${EASTC_ORG}', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1') as n`,
  );
  assert.equal(count.rows[0].n, 2);

  const eventId = await db.query(
    `select public.record_workflow_event(
      '${EASTC_ORG}',
      'message.inbound',
      'contact',
      'contact-1',
      '{"channel":"whatsapp"}'::jsonb,
      'message.inbound:conn:wamid.1'
    ) as id`,
  );
  await db.query(
    `select public.record_workflow_event(
      '${EASTC_ORG}',
      'message.inbound',
      'contact',
      'contact-1',
      '{"channel":"whatsapp"}'::jsonb,
      'message.inbound:conn:wamid.1'
    )`,
  );
  const runs = await db.query(
    `select count(*)::int as n from workflow_runs where event_id = '${eventId.rows[0].id}'`,
  );
  assert.equal(runs.rows[0].n, 1);
  const typed = await db.query(
    `select type from events where id = '${eventId.rows[0].id}'`,
  );
  assert.equal(typed.rows[0].type, "message.inbound");
});
