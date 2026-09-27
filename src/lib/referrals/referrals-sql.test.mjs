import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const FRIEND_USER = "66666666-6666-4666-8666-666666666666";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const NEW_ORG = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const QUIET_ORG = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyReferrals(db) {
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
  await db.exec(migration("20261019120000_phase2f_billing.sql"));
  await db.exec(migration("20261025120000_phase4b_referrals.sql"));
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

async function seed(db) {
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${EASTC_USER}', 'staff@eastc.co.za'),
      ('${EASTC_ADMIN}', 'admin@eastc.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za'),
      ('${FRIEND_USER}', 'friend@new.co.za');
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
    insert into organizations (id, name, slug, org_type, parent_id, form_key)
    values
      ('${NEW_ORG}', 'New Customer', 'new-customer', 'client', (select id from organizations where slug = 'ai-autotech'), 'new-customer'),
      ('${QUIET_ORG}', 'Quiet Customer', 'quiet-customer', 'client', (select id from organizations where slug = 'ai-autotech'), 'quiet-customer');
  `);
}

function itn(paymentStatus, extra = {}) {
  return JSON.stringify({
    sandbox: "true",
    payment_status: paymentStatus,
    plan_code: "starter",
    amount_gross: "499.00",
    token: "sandbox-token-1",
    occurred_at: "2026-10-20T00:00:00.000Z",
    ...extra,
  });
}

test("phase 4b migration keeps the ledger sandbox-only", () => {
  const sql = migration("20261025120000_phase4b_referrals.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/www\.payfast\.co\.za/i.test(sql), false);
  assert.match(sql, /check \(sandbox\)/);
  assert.match(sql, /accessible_org_ids/);
  assert.match(sql, /placeholder/i);
});

test("attribution, self-referral, first payment, and the hold", async () => {
  const db = new PGlite();
  await applyReferrals(db);
  await seed(db);

  const code = await asUser(
    db,
    EASTC_ADMIN,
    `select public.ensure_referral_code('${EASTC_ORG}', null, 'user') as result`,
  );
  const display = code.rows[0].result.display_code;
  assert.match(display, /^[A-Z0-9]{8}$/);

  const click = await db.query(
    `select public.record_referral_click($1, 'audit', null) as result`,
    [display],
  );
  assert.equal(click.rows[0].result.recorded, true);

  const self = await asUser(
    db,
    EASTC_ADMIN,
    `select public.attribute_referral_signup($1, '${NEW_ORG}', 'signup') as result`,
    [display],
  );
  assert.equal(self.rows[0].result.reason, "self_referral");
  assert.equal(self.rows[0].result.rewarded, false);

  const sameOrg = await asUser(
    db,
    FRIEND_USER,
    `select public.attribute_referral_signup($1, '${EASTC_ORG}', 'team') as result`,
    [display],
  );
  assert.equal(sameOrg.rows[0].result.reason, "self_referral");

  const signup = await asUser(
    db,
    FRIEND_USER,
    `select public.attribute_referral_signup($1, '${NEW_ORG}', 'signup') as result`,
    [display],
  );
  assert.equal(signup.rows[0].result.reason, "signed_up");
  assert.equal(signup.rows[0].result.rewarded, false);
  assert.equal(signup.rows[0].result.charged, false);

  const again = await asUser(
    db,
    FRIEND_USER,
    `select public.attribute_referral_signup($1, '${NEW_ORG}', 'signup') as result`,
    [display],
  );
  assert.equal(again.rows[0].result.reason, "already_attributed");

  const rewardsBefore = await db.query(`select count(*)::int as n from referral_rewards`);
  assert.equal(rewardsBefore.rows[0].n, 0);

  await db.query(
    `select public.apply_billing_event($1, 'payfast', 'pf-fail', 'itn', $2::jsonb)`,
    [NEW_ORG, itn("FAILED")],
  );
  const stillNone = await db.query(`select count(*)::int as n from referral_rewards`);
  assert.equal(stillNone.rows[0].n, 0);

  await db.query(
    `select public.apply_billing_event($1, 'payfast', 'pf-ok', 'itn', $2::jsonb)`,
    [NEW_ORG, itn("COMPLETE")],
  );
  const reward = await db.query(
    `select status, amount_cents::int as amount_cents, sandbox, reward_type, hold_until from referral_rewards where referred_org_id = '${NEW_ORG}'`,
  );
  assert.equal(reward.rows.length, 1);
  assert.equal(reward.rows[0].status, "pending");
  assert.equal(reward.rows[0].amount_cents, 50000);
  assert.equal(reward.rows[0].sandbox, true);
  assert.equal(reward.rows[0].reward_type, "account_credit");
  assert.ok(new Date(reward.rows[0].hold_until).getTime() > Date.now());

  const referral = await db.query(`select status from referrals where referred_org_id = '${NEW_ORG}'`);
  assert.equal(referral.rows[0].status, "paid");
  const sending = await db.query(`select sending_enabled from organizations where id = '${NEW_ORG}'`);
  assert.equal(sending.rows[0].sending_enabled, false);

  await db.query(
    `select public.apply_billing_event($1, 'payfast', 'pf-renew', 'itn', $2::jsonb)`,
    [NEW_ORG, itn("COMPLETE", { occurred_at: "2026-11-20T00:00:00.000Z" })],
  );
  const stillOne = await db.query(`select count(*)::int as n from referral_rewards`);
  assert.equal(stillOne.rows[0].n, 1);

  await db.query(
    `select public.apply_billing_event($1, 'payfast', 'pf-quiet', 'itn', $2::jsonb)`,
    [QUIET_ORG, itn("COMPLETE")],
  );
  const quietRewards = await db.query(`select count(*)::int as n from referral_rewards where referred_org_id = '${QUIET_ORG}'`);
  assert.equal(quietRewards.rows[0].n, 0);

  const rewardId = (await db.query(`select id from referral_rewards where referred_org_id = '${NEW_ORG}'`)).rows[0].id;
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.approve_referral_reward('${rewardId}')`),
    /hold period/i,
  );
  await assert.rejects(
    asUser(db, EASTC_ADMIN, `select public.approve_referral_reward('${rewardId}')`),
    /not allowed/i,
  );

  await db.exec(`update referral_rewards set hold_until = now() - interval '1 minute' where id = '${rewardId}'`);
  const approved = await asUser(db, AGENCY_USER, `select public.approve_referral_reward('${rewardId}') as result`);
  assert.equal(approved.rows[0].result.status, "approved");
  assert.equal(approved.rows[0].result.charged, false);
  assert.equal(approved.rows[0].result.sandbox, true);

  const paid = await asUser(db, AGENCY_USER, `select public.mark_referral_reward_paid('${rewardId}') as result`);
  assert.equal(paid.rows[0].result.status, "paid");
  assert.equal(paid.rows[0].result.charged, false);
  const ledger = await db.query(`select status, sandbox from referral_rewards where id = '${rewardId}'`);
  assert.equal(ledger.rows[0].status, "paid");
  assert.equal(ledger.rows[0].sandbox, true);
  const rewarded = await db.query(`select status from referrals where referred_org_id = '${NEW_ORG}'`);
  assert.equal(rewarded.rows[0].status, "rewarded");
  const stillOff = await db.query(`select sending_enabled from organizations where id = '${NEW_ORG}'`);
  assert.equal(stillOff.rows[0].sending_enabled, false);
  await assert.rejects(
    asUser(db, AGENCY_USER, `select public.void_referral_reward('${rewardId}')`),
    /paid ledger/i,
  );
});

test("referral rows stay inside the referrer workspace", async () => {
  const db = new PGlite();
  await applyReferrals(db);
  await seed(db);

  const code = await asUser(
    db,
    EASTC_ADMIN,
    `select public.ensure_referral_code('${EASTC_ORG}', 'EASTC7', 'user') as result`,
  );
  assert.equal(code.rows[0].result.display_code, "EASTC7");

  await asUser(
    db,
    FRIEND_USER,
    `select public.attribute_referral_signup('EASTC7', '${NEW_ORG}', 'signup')`,
  );

  const eastc = await asUser(db, EASTC_USER, `select status from referrals`);
  assert.equal(eastc.rows.length, 1);
  const agency = await asUser(db, AGENCY_USER, `select status from referrals`);
  assert.equal(agency.rows.length, 1);
  const other = await asUser(db, OTHER_USER, `select id from referrals`);
  assert.equal(other.rows.length, 0);
  const otherRewards = await asUser(db, OTHER_USER, `select id from referral_rewards`);
  assert.equal(otherRewards.rows.length, 0);

  await assert.rejects(
    asUser(
      db,
      OTHER_USER,
      `insert into referrals (org_id, code_id, referrer_org_id, status, source) select '${EASTC_ORG}', id, '${EASTC_ORG}', 'clicked', 'audit' from referral_codes limit 1`,
    ),
    /permission denied|row-level security/i,
  );

  await db.exec("set role anon");
  const anonClick = await db.query(`select public.record_referral_click('EASTC7', 'cookie', null) as result`);
  assert.equal(anonClick.rows[0].result.recorded, true);
  await assert.rejects(db.query(`select id from referrals`), /permission denied/i);
  await db.exec("reset role");
});
