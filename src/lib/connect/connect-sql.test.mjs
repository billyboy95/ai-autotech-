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

async function applyConnect(db) {
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
  await db.exec(migration("20261015140000_phase2b_channels_popia.sql"));
  await db.exec(migration("20261030120000_phase5c_connect_import.sql"));
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

test("phase 5c stores connect progress and import drafts without sending", async () => {
  const sql = migration("20261030120000_phase5c_connect_import.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/insert\s+into\s+(public\.)?crm_outbox/i.test(sql), false);
  assert.equal(/insert\s+into\s+(public\.)?crm_contacts/i.test(sql), false);
  assert.equal(/store_channel_secret/i.test(sql), false);

  const db = new PGlite();
  await applyConnect(db);
  await seedMembers(db);

  await assert.rejects(
    asUser(db, EASTC_USER, `select public.mark_connect_account($1, 'gmail')`, [EASTC_ORG]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, EASTC_ADMIN, `select public.mark_connect_account($1, 'slack')`, [EASTC_ORG]),
    /unknown account/i,
  );

  const gmail = await asUser(
    db,
    EASTC_ADMIN,
    `select public.mark_connect_account($1, 'gmail') as result`,
    [EASTC_ORG],
  );
  assert.equal(gmail.rows[0].result.status, "needs_keys");
  assert.equal(gmail.rows[0].result.sandbox, true);
  assert.equal(gmail.rows[0].result.charged, false);
  assert.equal(gmail.rows[0].result.secret_stored, false);
  assert.equal(gmail.rows[0].result.sending_enabled, false);

  await asUser(db, EASTC_ADMIN, `select public.mark_connect_account($1, 'gmail')`, [EASTC_ORG]);
  await asUser(db, EASTC_ADMIN, `select public.mark_connect_account($1, 'meta')`, [EASTC_ORG]);
  await asUser(db, EASTC_ADMIN, `select public.mark_connect_account($1, 'tiktok')`, [EASTC_ORG]);

  const connections = await db.query(
    `select channel, provider, identifier, status, secret_id is null as no_secret
     from public.channel_connections
     where org_id = $1
     order by channel, provider`,
    [EASTC_ORG],
  );
  assert.deepEqual(connections.rows, [
    { channel: "email", provider: "resend", identifier: "placeholder", status: "pending", no_secret: true },
    { channel: "facebook", provider: "meta", identifier: "placeholder", status: "pending", no_secret: true },
    { channel: "instagram", provider: "meta", identifier: "placeholder", status: "pending", no_secret: true },
  ]);
  const secrets = await db.query(`select count(*)::int as n from private.channel_secrets`);
  assert.equal(secrets.rows[0].n, 0);

  const ready = JSON.stringify([
    { name: "Ada Lovelace", phone: "0825550101", email: "ada@example.com", company: "Clinic", consent_basis: "consent" },
  ]);
  await assert.rejects(
    asUser(
      db,
      EASTC_ADMIN,
      `select public.save_contact_import_draft($1, $2::jsonb, '{"sandbox":true,"charged":false,"sent":true}'::jsonb)`,
      [EASTC_ORG, ready],
    ),
    /sandbox draft only/i,
  );
  await assert.rejects(
    asUser(
      db,
      EASTC_ADMIN,
      `select public.save_contact_import_draft($1, $2::jsonb, '{"sandbox":true,"charged":false,"sent":false}'::jsonb)`,
      [EASTC_ORG, JSON.stringify([{ name: "Ada", phone: "1", email: "a@b.co", consent_basis: "consent", send: true }])],
    ),
    /draft rows only/i,
  );

  const saved = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_contact_import_draft($1, $2::jsonb, '{"ready":1,"blocked":0,"sandbox":true,"charged":false,"sent":false}'::jsonb) as result`,
    [EASTC_ORG, ready],
  );
  assert.equal(saved.rows[0].result.stored, 1);
  assert.equal(saved.rows[0].result.sent, false);
  assert.equal(saved.rows[0].result.charged, false);
  assert.equal(saved.rows[0].result.sending_enabled, false);

  const contacts = await db.query(`select count(*)::int as n from public.crm_contacts`);
  assert.equal(contacts.rows[0].n, 0);
  const sending = await db.query(`select sending_enabled from public.organizations where id = $1`, [EASTC_ORG]);
  assert.equal(sending.rows[0].sending_enabled, false);

  const hidden = await asUser(
    db,
    OTHER_USER,
    `select count(*)::int as n from public.contact_import_drafts where org_id = $1`,
    [EASTC_ORG],
  );
  assert.equal(hidden.rows[0].n, 0);

  await db.exec("reset role");
  await db.exec("set role anon");
  await assert.rejects(
    db.query(`select public.mark_connect_account('${EASTC_ORG}', 'sms')`),
    /permission denied/i,
  );
});
