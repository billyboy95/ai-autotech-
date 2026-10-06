import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const STAFF_USER = "44444444-4444-4444-8444-444444444444";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const DEAL_OPEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const DEAL_WON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyCommissions(db) {
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
  await db.exec(migration("20261112120500_phase5p_salesperson_commissions.sql"));
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
      ('${STAFF_USER}', 'staff@aiautotech.co.za'),
      ('${EASTC_ADMIN}', 'admin@eastc.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za');
    insert into organizations (id, name, slug, org_type, form_key)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Other Agency', 'other-agency', 'agency', 'other-agency');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${STAFF_USER}', id, 'agency_staff' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_ADMIN}', id, 'client_admin' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_USER}', id, 'agency_owner' from organizations where slug = 'other-agency';
    insert into crm_leads (id, name, company, stage, org_id)
    values ('lead-workshop', 'Ayesha Patel', 'Patel Logistics', 'New', '${EASTC_ORG}');
    insert into workspace_deals (id, org_id, title, amount_cents, status)
    values
      ('${DEAL_OPEN}', '${EASTC_ORG}', 'Open quote', 1000000, 'open'),
      ('${DEAL_WON}', '${EASTC_ORG}', 'Springs fleet', 1000000, 'won');
  `);
}

test("the commission migration is a ledger only", () => {
  const sql = migration("20261112120500_phase5p_salesperson_commissions.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/\bdrop table\b/i.test(sql), false);
  assert.equal(/www\.payfast\.co\.za/i.test(sql), false);
  assert.match(sql, /check \(sandbox\)/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /gross_received/);
  assert.match(sql, /placeholder/i);
});

test("won plus paid books a percent of the EFT, and the owner marks the ledger", async () => {
  const db = new PGlite();
  await applyCommissions(db);
  await seed(db);

  const flags = await db.query(`
    select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'commission_%'
    order by 1
  `);
  assert.equal(flags.rows.length, 5);
  for (const row of flags.rows) {
    assert.equal(row.rls, true, row.relname);
    assert.equal(row.forced, true, row.relname);
  }

  const saved = await asUser(
    db,
    AGENCY_USER,
    `select public.save_commission_salesperson($1::uuid, null::uuid, 'Nomsa Dlamini', 'sample@example.com', 'nomsa-30', true, 30, 'once_off', null::integer) as result`,
    [EASTC_ORG],
  );
  assert.equal(saved.rows[0].result.ok, true);
  assert.equal(saved.rows[0].result.charged, false);
  assert.equal(saved.rows[0].result.money_moved, false);
  assert.equal(saved.rows[0].result.placeholder, true);
  const nomsa = saved.rows[0].result.id;

  const staffSave = await asUser(
    db,
    STAFF_USER,
    `select public.save_commission_salesperson($1::uuid, null::uuid, 'Staff', '', 'STAFF01', true, 30, 'once_off', null::integer) as result`,
    [EASTC_ORG],
  );
  assert.equal(staffSave.rows[0].result.reason, "forbidden");

  const clientSave = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_commission_salesperson($1::uuid, null::uuid, 'Client', '', 'CLIENT1', true, 30, 'once_off', null::integer) as result`,
    [EASTC_ORG],
  );
  assert.equal(clientSave.rows[0].result.reason, "forbidden");

  const otherSave = await asUser(
    db,
    OTHER_USER,
    `select public.save_commission_salesperson($1::uuid, null::uuid, 'Other', '', 'OTHER001', true, 30, 'once_off', null::integer) as result`,
    [EASTC_ORG],
  );
  assert.equal(otherSave.rows[0].result.reason, "forbidden");

  await assert.rejects(
    asUser(db, AGENCY_USER, `insert into commission_salespeople (org_id, name, code) values ($1::uuid, 'Nope', 'NOPE01')`, [EASTC_ORG]),
    /permission denied|row-level security/i,
  );

  const ownerSees = await asUser(db, AGENCY_USER, `select count(*)::int as n from commission_salespeople`);
  assert.equal(ownerSees.rows[0].n, 1);
  const staffSees = await asUser(db, STAFF_USER, `select count(*)::int as n from commission_salespeople`);
  assert.equal(staffSees.rows[0].n, 1);
  const clientSees = await asUser(db, EASTC_ADMIN, `select count(*)::int as n from commission_salespeople`);
  assert.equal(clientSees.rows[0].n, 0);
  const otherSees = await asUser(db, OTHER_USER, `select count(*)::int as n from commission_salespeople`);
  assert.equal(otherSees.rows[0].n, 0);
  const staffAudit = await asUser(db, STAFF_USER, `select count(*)::int as n from commission_audit`);
  assert.equal(staffAudit.rows[0].n, 0);
  const ownerAudit = await asUser(db, AGENCY_USER, `select actor_id::text as actor_id from commission_audit where action = 'salesperson_saved'`);
  assert.equal(ownerAudit.rows[0].actor_id, AGENCY_USER);

  const attributed = await asUser(
    db,
    STAFF_USER,
    `select public.attribute_commission($1::uuid, 'code', 'NOMSA30', null::uuid, 'lead-workshop', null::uuid) as result`,
    [EASTC_ORG],
  );
  assert.equal(attributed.rows[0].result.ok, true);
  const attribution = attributed.rows[0].result.id;

  const early = await asUser(
    db,
    STAFF_USER,
    `select public.record_commission_receipt($1::uuid, $2::uuid, 400000, '2026-09-12'::date, 'eft') as result`,
    [EASTC_ORG, attribution],
  );
  assert.equal(early.rows[0].result.reason, "deal_not_won");
  assert.equal(early.rows[0].result.booked, false);
  const none = await db.query(`select count(*)::int as n from commission_receipts`);
  assert.equal(none.rows[0].n, 0);

  await db.exec(`update crm_leads set stage = 'Won' where id = 'lead-workshop'`);
  const first = await asUser(
    db,
    STAFF_USER,
    `select public.record_commission_receipt($1::uuid, $2::uuid, 400000, '2026-09-12'::date, 'eft') as result`,
    [EASTC_ORG, attribution],
  );
  assert.equal(first.rows[0].result.reason, "booked");
  assert.equal(first.rows[0].result.amount_cents, 120000);
  assert.equal(first.rows[0].result.charged, false);
  assert.equal(first.rows[0].result.money_moved, false);

  const second = await asUser(
    db,
    STAFF_USER,
    `select public.record_commission_receipt($1::uuid, $2::uuid, 600000, '2026-09-20'::date, 'eft') as result`,
    [EASTC_ORG, attribution],
  );
  assert.equal(second.rows[0].result.amount_cents, 180000);
  const lines = await db.query(`select status, amount_cents::int as amount_cents, basis_cents::int as basis_cents from commission_ledger order by basis_cents`);
  assert.equal(lines.rows.length, 2);
  assert.equal(lines.rows[0].basis_cents, 400000);
  assert.equal(lines.rows[0].amount_cents, 120000);
  assert.notEqual(lines.rows[0].amount_cents, 300000);

  const duplicate = await asUser(
    db,
    STAFF_USER,
    `select public.record_commission_receipt($1::uuid, $2::uuid, 400000, '2026-09-12'::date, 'eft') as result`,
    [EASTC_ORG, attribution],
  );
  assert.equal(duplicate.rows[0].result.reason, "already_recorded");
  const stillTwo = await db.query(`select count(*)::int as n from commission_ledger`);
  assert.equal(stillTwo.rows[0].n, 2);

  const ledgerId = first.rows[0].result.id;
  const staffPaid = await asUser(db, STAFF_USER, `select public.set_commission_ledger_status($1::uuid, 'paid') as result`, [ledgerId]);
  assert.equal(staffPaid.rows[0].result.reason, "forbidden");
  const skip = await asUser(db, AGENCY_USER, `select public.set_commission_ledger_status($1::uuid, 'paid') as result`, [ledgerId]);
  assert.equal(skip.rows[0].result.reason, "bad_status");
  const approved = await asUser(db, AGENCY_USER, `select public.set_commission_ledger_status($1::uuid, 'approved') as result`, [ledgerId]);
  assert.equal(approved.rows[0].result.ok, true);
  const paid = await asUser(db, AGENCY_USER, `select public.set_commission_ledger_status($1::uuid, 'paid') as result`, [ledgerId]);
  assert.equal(paid.rows[0].result.reason, "paid");
  assert.equal(paid.rows[0].result.money_moved, false);
  const marked = await db.query(`select status from commission_ledger where id = $1`, [ledgerId]);
  assert.equal(marked.rows[0].status, "paid");
  const voided = await asUser(db, AGENCY_USER, `select public.set_commission_ledger_status($1::uuid, 'void') as result`, [ledgerId]);
  assert.equal(voided.rows[0].result.reason, "void");
  const kept = await db.query(`select count(*)::int as n from commission_ledger where id = $1`, [ledgerId]);
  assert.equal(kept.rows[0].n, 1);

  const pieter = await asUser(
    db,
    AGENCY_USER,
    `select public.save_commission_salesperson($1::uuid, null::uuid, 'Pieter van Wyk', '0825550199', 'PIETER', true, 30, 'recurring', 2) as result`,
    [EASTC_ORG],
  );
  assert.equal(pieter.rows[0].result.ok, true);
  const manual = await asUser(
    db,
    STAFF_USER,
    `select public.attribute_commission($1::uuid, 'manual', null, $2::uuid, null, $3::uuid) as result`,
    [EASTC_ORG, pieter.rows[0].result.id, DEAL_WON],
  );
  assert.equal(manual.rows[0].result.ok, true);
  const fleet = manual.rows[0].result.id;
  for (const [amount, day, expectBooked] of [
    [500000, "2026-08-03", true],
    [500000, "2026-09-03", true],
    [500000, "2026-10-03", false],
  ]) {
    const receipt = await asUser(
      db,
      STAFF_USER,
      `select public.record_commission_receipt($1::uuid, $2::uuid, $3::bigint, $4::date, 'eft') as result`,
      [EASTC_ORG, fleet, amount, day],
    );
    assert.equal(receipt.rows[0].result.booked, expectBooked, day);
    if (!expectBooked) assert.equal(receipt.rows[0].result.reason, "month_limit");
  }
  const fleetLines = await db.query(`select count(*)::int as n from commission_ledger where attribution_id = $1 and status <> 'void'`, [fleet]);
  assert.equal(fleetLines.rows[0].n, 2);
  const fleetReceipts = await db.query(`select count(*)::int as n from commission_receipts where attribution_id = $1`, [fleet]);
  assert.equal(fleetReceipts.rows[0].n, 3);

  const openAttr = await asUser(
    db,
    STAFF_USER,
    `select public.attribute_commission($1::uuid, 'manual', null, $2::uuid, null, $3::uuid) as result`,
    [EASTC_ORG, pieter.rows[0].result.id, DEAL_OPEN],
  );
  assert.equal(openAttr.rows[0].result.ok, true);
  const refused = await asUser(
    db,
    STAFF_USER,
    `select public.record_commission_receipt($1::uuid, $2::uuid, 100000, '2026-10-04'::date, 'eft') as result`,
    [EASTC_ORG, openAttr.rows[0].result.id],
  );
  assert.equal(refused.rows[0].result.reason, "deal_not_won");

  const paused = await asUser(
    db,
    AGENCY_USER,
    `select public.save_commission_salesperson($1::uuid, $2::uuid, 'Nomsa Dlamini', 'sample@example.com', 'NOMSA30', false, 30, 'once_off', null::integer) as result`,
    [EASTC_ORG, nomsa],
  );
  assert.equal(paused.rows[0].result.ok, true);
  await db.exec(`insert into crm_leads (id, name, company, stage, org_id) values ('lead-next', 'Thabo Ndlovu', 'Ndlovu Dental', 'Won', '${EASTC_ORG}')`);
  const inactive = await asUser(
    db,
    STAFF_USER,
    `select public.attribute_commission($1::uuid, 'code', 'NOMSA30', null::uuid, 'lead-next', null::uuid) as result`,
    [EASTC_ORG],
  );
  assert.equal(inactive.rows[0].result.reason, "inactive");

  const sending = await db.query(`select sending_enabled from organizations where id = '${EASTC_ORG}'`);
  assert.equal(sending.rows[0].sending_enabled, false);
  await assert.rejects(
    db.query(`insert into commission_salespeople (org_id, name, code, sandbox) values ('${EASTC_ORG}', 'Live', 'LIVE01', false)`),
    /sandbox/i,
  );
});
