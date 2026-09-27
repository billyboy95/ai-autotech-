import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const EASTC_OPEN = "66666666-6666-4666-8666-666666666666";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyComputers(db) {
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
  await db.exec(migration("20261019120000_phase2f_billing.sql"));
  await db.exec(migration("20261024120000_phase4a_bots.sql"));
  await db.exec(migration("20261028120000_phase5a_agent_computers.sql"));
}

async function asUser(db, userId, sql, params = []) {
  await db.exec("reset role");
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
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
      ('${EASTC_OPEN}', 'open@eastc.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za');
    insert into organizations (id, name, slug, org_type, form_key)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Other Agency', 'other-agency', 'agency', 'other-agency');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_ADMIN}', id, 'client_admin' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_OPEN}', id, 'client_user', false from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_USER}', id, 'agency_owner' from organizations where slug = 'other-agency';
  `);
}

test("phase 5a computers stay sandbox, pause over the allowance, and follow assigned-only RLS", async () => {
  const sql = migration("20261028120000_phase5a_agent_computers.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/price_placeholder\s*=\s*false/i.test(sql), false);

  const db = new PGlite();
  await applyComputers(db);
  await seedMembers(db);

  await db.query(
    `insert into public.agent_computers (org_id, bot_slug, allowance_seconds) values ($1, 'inbound-lead', 30)`,
    [EASTC_ORG],
  );
  const created = await db.query(
    `select provider, status, sandbox, hours_used_seconds, live_view_token_hash
     from public.agent_computers where org_id = $1 and bot_slug = 'inbound-lead'`,
    [EASTC_ORG],
  );
  assert.equal(created.rows[0].provider, "fixture");
  assert.equal(created.rows[0].status, "idle");
  assert.equal(created.rows[0].sandbox, true);
  assert.equal(created.rows[0].hours_used_seconds, 0);
  assert.equal(created.rows[0].live_view_token_hash, "");

  await assert.rejects(
    db.query(
      `insert into public.agent_computers (org_id, bot_slug, allowance_seconds, sandbox)
       values ($1, 'outbound-sales', 120, false)`,
      [EASTC_ORG],
    ),
    /sandbox/i,
  );
  await assert.rejects(
    db.query(
      `insert into public.agent_computers (org_id, bot_slug, allowance_seconds, live_view_token_hash)
       values ($1, 'onboarding', 120, 'raw-token')`,
      [EASTC_ORG],
    ),
    /token|check/i,
  );

  await db.query(
    `update public.agent_computers
     set hours_used_seconds = 31, status = 'running'
     where org_id = $1 and bot_slug = 'inbound-lead'`,
    [EASTC_ORG],
  );
  const paused = await db.query(
    `select status, sandbox from public.agent_computers where org_id = $1 and bot_slug = 'inbound-lead'`,
    [EASTC_ORG],
  );
  assert.equal(paused.rows[0].status, "paused");
  assert.equal(paused.rows[0].sandbox, true);

  const hiddenFromAssigned = await asUser(
    db,
    EASTC_USER,
    `select bot_slug from public.agent_computers where org_id = '${EASTC_ORG}'`,
  );
  assert.equal(hiddenFromAssigned.rows.length, 0);

  await db.query(
    `update public.agent_computers set assigned_user_id = $1 where org_id = $2 and bot_slug = 'inbound-lead'`,
    [EASTC_USER, EASTC_ORG],
  );
  const visibleToAssigned = await asUser(
    db,
    EASTC_USER,
    `select bot_slug from public.agent_computers where org_id = '${EASTC_ORG}'`,
  );
  assert.deepEqual(visibleToAssigned.rows.map((row) => row.bot_slug), ["inbound-lead"]);

  await db.query(
    `insert into public.agent_computers (org_id, bot_slug, allowance_seconds, assigned_user_id)
     values ($1, 'ads', 120, $2)`,
    [EASTC_ORG, EASTC_ADMIN],
  );
  const stillOnlyOwn = await asUser(
    db,
    EASTC_USER,
    `select bot_slug from public.agent_computers where org_id = '${EASTC_ORG}' order by bot_slug`,
  );
  assert.deepEqual(stillOnlyOwn.rows.map((row) => row.bot_slug), ["inbound-lead"]);

  const adminSeesBoth = await asUser(
    db,
    EASTC_ADMIN,
    `select bot_slug from public.agent_computers where org_id = '${EASTC_ORG}' order by bot_slug`,
  );
  assert.deepEqual(adminSeesBoth.rows.map((row) => row.bot_slug), ["ads", "inbound-lead"]);

  const openUserSeesBoth = await asUser(
    db,
    EASTC_OPEN,
    `select bot_slug from public.agent_computers where org_id = '${EASTC_ORG}' order by bot_slug`,
  );
  assert.deepEqual(openUserSeesBoth.rows.map((row) => row.bot_slug), ["ads", "inbound-lead"]);

  const ownerSeesBoth = await asUser(
    db,
    AGENCY_USER,
    `select bot_slug from public.agent_computers where org_id = '${EASTC_ORG}' order by bot_slug`,
  );
  assert.deepEqual(ownerSeesBoth.rows.map((row) => row.bot_slug), ["ads", "inbound-lead"]);

  const otherOrg = await asUser(
    db,
    OTHER_USER,
    `select bot_slug from public.agent_computers where org_id = '${EASTC_ORG}'`,
  );
  assert.equal(otherOrg.rows.length, 0);

  await assert.rejects(
    asUser(
      db,
      OTHER_USER,
      `insert into public.agent_computers (org_id, bot_slug, allowance_seconds, sandbox)
       values ('${EASTC_ORG}', 'social-posting', 60, true)`,
    ),
    /row-level security|permission denied|42501/i,
  );
  await assert.rejects(
    asUser(db, EASTC_ADMIN, `delete from public.agent_computers where org_id = '${EASTC_ORG}'`),
    /permission denied|row-level security|42501/i,
  );
  const kept = await db.query(`select count(*)::int as n from public.agent_computers where org_id = $1`, [EASTC_ORG]);
  assert.equal(kept.rows[0].n, 2);

  const minute = await asUser(
    db,
    EASTC_ADMIN,
    `select public.add_agent_computer_fixture_minute($1, 'ads') as result`,
    [EASTC_ORG],
  );
  assert.equal(minute.rows[0].result.charged, false);
  assert.equal(minute.rows[0].result.sandbox, true);
  assert.equal(minute.rows[0].result.hours_used_seconds, 60);
  assert.equal(minute.rows[0].result.status, "idle");

  await assert.rejects(
    asUser(db, EASTC_USER, `select public.add_agent_computer_fixture_minute('${EASTC_ORG}', 'ads')`),
    /not allowed/i,
  );
  const ownMinute = await asUser(
    db,
    EASTC_USER,
    `select public.add_agent_computer_fixture_minute($1, 'inbound-lead') as result`,
    [EASTC_ORG],
  );
  assert.equal(ownMinute.rows[0].result.charged, false);
  assert.equal(ownMinute.rows[0].result.sandbox, true);
  assert.ok(ownMinute.rows[0].result.hours_used_seconds > 31);

  const ensured = await asUser(
    db,
    EASTC_ADMIN,
    `select public.ensure_agent_computer($1, 'onboarding', 18000, null) as result`,
    [EASTC_ORG],
  );
  assert.equal(ensured.rows[0].result.sandbox, true);
  assert.equal(ensured.rows[0].result.provider, "fixture");
  assert.equal(ensured.rows[0].result.charged, false);
  assert.equal(ensured.rows[0].result.hours_used_seconds, 0);

  const subs = await db.query(`select count(*)::int as n from public.org_subscriptions`);
  const lines = await db.query(`select count(*)::int as n from public.org_bot_billing_lines`);
  assert.equal(lines.rows[0].n, 0);
  const sending = await db.query(`select sending_enabled from public.organizations where id = $1`, [EASTC_ORG]);
  assert.equal(sending.rows[0].sending_enabled, false);
  const placeholders = await db.query(`select bool_and(price_placeholder) as ok from public.bot_catalog`);
  assert.equal(placeholders.rows[0].ok, true);
  assert.equal(subs.rows[0].n >= 0, true);
});
