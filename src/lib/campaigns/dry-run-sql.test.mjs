import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

const RECIPIENTS = JSON.stringify([
  { name: "Ayesha Patel", channel: "whatsapp", consent_basis: "consent", stopped: false },
  { name: "Johan Botha", channel: "email", consent_basis: "existing_customer", stopped: false },
  { name: "Thabo Ndlovu", channel: "sms", consent_basis: "", stopped: false },
  { name: "Nomsa Dlamini", channel: "whatsapp", consent_basis: "opted_out", stopped: false },
  { name: "Pieter Venter", channel: "whatsapp", consent_basis: "consent", stopped: true },
]);

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyPhase5e(db) {
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
  await db.exec(migration("20261101120000_phase5e_campaign_dry_run.sql"));
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

test("phase 5e dry-run reports and connect stubs do not send", async () => {
  const sql = migration("20261101120000_phase5e_campaign_dry_run.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/\bdrop table\b/i.test(sql), false);
  assert.equal(/insert\s+into\s+public\.crm_outbox/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.match(sql, /queued_count = 0/);
  assert.match(sql, /provider_keys_present = false/);

  const db = new PGlite();
  await applyPhase5e(db);
  await seedMembers(db);
  await db.exec(`
    create table public.crm_outbox (
      id text primary key,
      lead_id text,
      channel text not null,
      body text not null default '',
      status text not null check (status in ('draft', 'queued', 'approved', 'sent')),
      org_id uuid
    );
  `);

  await assert.rejects(
    asUser(db, EASTC_USER, `select public.save_campaign_dry_run($1, 'Sandbox prospect draft', $2::jsonb)`, [EASTC_ORG, RECIPIENTS]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(
      db,
      EASTC_ADMIN,
      `select public.save_campaign_dry_run($1, 'Sandbox prospect draft', $2::jsonb)`,
      [EASTC_ORG, JSON.stringify([{ name: "Ada", channel: "whatsapp", consent_basis: "consent", send: true }])],
    ),
    /dry run only/i,
  );

  const saved = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_campaign_dry_run($1, 'Sandbox prospect draft', $2::jsonb) as result`,
    [EASTC_ORG, RECIPIENTS],
  );
  const result = saved.rows[0].result;
  assert.equal(result.status, "sandbox");
  assert.equal(result.sandbox, true);
  assert.equal(result.charged, false);
  assert.equal(result.queued, 0);
  assert.equal(result.sent, 0);
  assert.equal(result.sending_enabled, false);
  assert.equal(result.recipient_count, 5);
  assert.equal(result.would_receive, 2);
  assert.equal(result.blocked, 3);
  assert.equal(result.estimated_cost_cents, 67);
  assert.equal(result.consent_breakdown.consent, 1);
  assert.equal(result.consent_breakdown.existing_customer, 1);
  assert.equal(result.consent_breakdown.missing, 1);
  assert.equal(result.consent_breakdown.opted_out, 1);
  assert.equal(result.consent_breakdown.stop, 1);
  assert.equal(result.report.find((row) => row.name === "Pieter Venter").reason, "STOP");
  assert.equal(result.report.find((row) => row.name === "Thabo Ndlovu").reason, "POPIA");
  assert.equal(result.report.find((row) => row.name === "Nomsa Dlamini").reason, "consent");

  const outbox = await db.query(`select count(*)::int as n from public.crm_outbox`);
  assert.equal(outbox.rows[0].n, 0);
  const queued = await db.query(`select count(*)::int as n from public.crm_outbox where status in ('queued', 'sent', 'approved')`);
  assert.equal(queued.rows[0].n, 0);

  const hidden = await asUser(
    db,
    OTHER_USER,
    `select count(*)::int as n from public.campaign_dry_runs where org_id = $1`,
    [EASTC_ORG],
  );
  assert.equal(hidden.rows[0].n, 0);

  await assert.rejects(
    db.query(
      `insert into public.campaign_dry_runs (
        org_id, campaign_name, status, recipient_count, would_receive, blocked_count,
        consent_breakdown, estimated_cost_cents, report, queued_count, sent_count
      ) values (
        '${EASTC_ORG}', 'Nope', 'sandbox', 0, 0, 0, '{}'::jsonb, 0, '[]'::jsonb, 1, 0
      )`,
    ),
    /check constraint|violates check/i,
  );

  const refused = await asUser(
    db,
    EASTC_ADMIN,
    `select public.refuse_campaign_send($1, 'go_live') as result`,
    [EASTC_ORG],
  );
  assert.equal(refused.rows[0].result.refused, true);
  assert.equal(refused.rows[0].result.queued, 0);
  assert.equal(refused.rows[0].result.sent, 0);
  assert.equal(refused.rows[0].result.sending_enabled, false);
  assert.match(refused.rows[0].result.reason, /sending_enabled is false/);

  const stub = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_meta_connect_stub($1, 'whatsapp') as result`,
    [EASTC_ORG],
  );
  assert.equal(stub.rows[0].result.status, "sandbox_stub");
  assert.equal(stub.rows[0].result.secret_stored, false);
  assert.equal(stub.rows[0].result.provider_keys_present, false);
  assert.equal(stub.rows[0].result.charged, false);
  assert.equal(stub.rows[0].result.queued, 0);
  assert.equal(stub.rows[0].result.sending_enabled, false);

  await assert.rejects(
    asUser(db, EASTC_ADMIN, `select public.save_meta_connect_stub($1, 'gmail')`, [EASTC_ORG]),
    /unknown account/i,
  );
  await assert.rejects(
    asUser(db, EASTC_USER, `select public.save_meta_connect_stub($1, 'meta')`, [EASTC_ORG]),
    /not allowed/i,
  );

  const testSend = await asUser(
    db,
    EASTC_ADMIN,
    `select public.refuse_meta_test_send($1, 'whatsapp') as result`,
    [EASTC_ORG],
  );
  assert.equal(testSend.rows[0].result.refused, true);
  assert.equal(testSend.rows[0].result.queued, 0);
  assert.equal(testSend.rows[0].result.sent, 0);
  assert.equal(testSend.rows[0].result.provider_keys_present, false);
  assert.equal(testSend.rows[0].result.dry_run, true);
  assert.equal(testSend.rows[0].result.sending_enabled, false);

  const missingKeys = await asUser(
    db,
    EASTC_ADMIN,
    `select public.refuse_meta_test_send($1, 'meta') as result`,
    [EASTC_ORG],
  );
  assert.equal(missingKeys.rows[0].result.refused, true);
  assert.equal(missingKeys.rows[0].result.provider_keys_present, false);
  assert.equal(missingKeys.rows[0].result.queued, 0);

  await assert.rejects(
    db.query(
      `insert into public.meta_connect_stubs (org_id, account_key, secret_stored)
       values ('${EASTC_ORG}', 'meta', true)`,
    ),
    /check constraint|violates check/i,
  );

  const stillQueued = await db.query(`select count(*)::int as n from public.crm_outbox where status <> 'draft'`);
  assert.equal(stillQueued.rows[0].n, 0);
  const sending = await db.query(`select sending_enabled from public.organizations where id = $1`, [EASTC_ORG]);
  assert.equal(sending.rows[0].sending_enabled, false);

  await db.exec("reset role");
  await db.exec("set role anon");
  await assert.rejects(
    db.query(`select public.save_campaign_dry_run('${EASTC_ORG}', 'Nope', '[]'::jsonb)`),
    /permission denied/i,
  );
});
