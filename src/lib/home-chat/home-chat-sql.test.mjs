import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyHomeChat(db) {
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
  await db.exec(migration("20260926160000_agency_tenancy.sql"));
  await db.exec(migration("20260926200000_phase2a_access.sql"));
  await db.exec(migration("20261031120000_phase5d_home_chat.sql"));
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

async function seedMembers(db) {
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
  `);
}

test("phase 5d stores drafts and does not send", async () => {
  const sql = migration("20261031120000_phase5d_home_chat.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/\bdrop table\b/i.test(sql), false);
  assert.match(sql, /'draft'/);
  assert.equal(/status\s*=\s*'queued'/i.test(sql), false);
  assert.equal(/status\s*=\s*'sent'/i.test(sql), false);

  const db = new PGlite();
  await applyHomeChat(db);
  await seedMembers(db);

  await assert.rejects(
    asUser(
      db,
      EASTC_USER,
      `select public.save_home_chat_draft($1, 'task', 'Call the lead', 'Call the lead', '', '', '')`,
      [EASTC_ORG],
    ),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(
      db,
      EASTC_ADMIN,
      `select public.save_home_chat_draft($1, 'send', 'Send now', 'Send now', '', '', 'whatsapp')`,
      [EASTC_ORG],
    ),
    /draft kind only/i,
  );

  const task = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_home_chat_draft($1, 'task', 'Call Johan Botha', 'Call Johan Botha', 'lead-johan', 'Johan Botha', '') as result`,
    [EASTC_ORG],
  );
  assert.equal(task.rows[0].result.status, "draft");
  assert.equal(task.rows[0].result.kind, "task");
  assert.equal(task.rows[0].result.sandbox, true);
  assert.equal(task.rows[0].result.charged, false);
  assert.equal(task.rows[0].result.sent, false);
  assert.equal(task.rows[0].result.queued, false);
  assert.equal(task.rows[0].result.outbox_id, null);
  assert.equal(task.rows[0].result.sending_enabled, false);

  const hidden = await asUser(
    db,
    OTHER_USER,
    `select count(*)::int as n from public.home_chat_drafts where org_id = $1`,
    [EASTC_ORG],
  );
  assert.equal(hidden.rows[0].n, 0);

  await assert.rejects(
    db.query(
      `insert into public.home_chat_drafts (org_id, kind, status, title, body, channel)
       values ('${EASTC_ORG}', 'task', 'queued', 'Nope', 'Nope', '')`,
    ),
    /check constraint|violates check/i,
  );

  const grants = await db.query(
    `select privilege_type from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'home_chat_drafts' and grantee = 'authenticated'
     order by privilege_type`,
  );
  assert.deepEqual(grants.rows.map((row) => row.privilege_type), ["INSERT", "SELECT"]);
  const stillDraft = await db.query(`select status from public.home_chat_drafts where org_id = $1`, [EASTC_ORG]);
  assert.equal(stillDraft.rows.every((row) => row.status === "draft"), true);

  await db.exec(`
    create table public.crm_leads (
      id text primary key,
      name text not null default '',
      org_id uuid
    );
    create table public.crm_outbox (
      id text primary key,
      lead_id text not null references public.crm_leads(id),
      channel text not null check (channel in ('whatsapp', 'email', 'sms')),
      body text not null default '',
      status text not null default 'draft' check (status in ('draft', 'queued', 'approved', 'sent')),
      org_id uuid
    );
    insert into public.crm_leads (id, name, org_id)
    values ('lead-ayesha', 'Ayesha Patel', '${EASTC_ORG}');
  `);

  const followUp = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_home_chat_draft($1, 'follow_up', 'Follow up with Ayesha Patel', 'Hi Ayesha, this is AI AutoTech. Reply STOP to opt out.', 'lead-ayesha', 'Ayesha Patel', 'whatsapp') as result`,
    [EASTC_ORG],
  );
  assert.equal(followUp.rows[0].result.status, "draft");
  assert.equal(followUp.rows[0].result.outbox_status, "draft");
  assert.equal(followUp.rows[0].result.sent, false);
  assert.equal(followUp.rows[0].result.sending_enabled, false);
  assert.match(String(followUp.rows[0].result.outbox_id), /^chatdraft_/);

  const outbox = await db.query(`select status, channel, org_id from public.crm_outbox`);
  assert.equal(outbox.rows.length, 1);
  assert.equal(outbox.rows[0].status, "draft");
  assert.equal(outbox.rows[0].channel, "whatsapp");
  assert.equal(outbox.rows[0].org_id, EASTC_ORG);

  const missingLead = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_home_chat_draft($1, 'follow_up', 'Follow up with Johan', 'Hi Johan, this is AI AutoTech. Reply STOP to opt out.', 'lead-johan', 'Johan Botha', 'email') as result`,
    [EASTC_ORG],
  );
  assert.equal(missingLead.rows[0].result.status, "draft");
  assert.equal(missingLead.rows[0].result.outbox_id, null);

  const sentRows = await db.query(`select count(*)::int as n from public.crm_outbox where status <> 'draft'`);
  assert.equal(sentRows.rows[0].n, 0);
  const sending = await db.query(`select sending_enabled from public.organizations where id = $1`, [EASTC_ORG]);
  assert.equal(sending.rows[0].sending_enabled, false);

  await db.exec("reset role");
  await db.exec("set role anon");
  await assert.rejects(
    db.query(`select public.save_home_chat_draft('${EASTC_ORG}', 'task', 'Nope', 'Nope', '', '', '')`),
    /permission denied/i,
  );
});
