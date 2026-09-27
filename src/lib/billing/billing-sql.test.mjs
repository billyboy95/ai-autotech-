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

async function applyBilling(db) {
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
    create table if not exists public.crm_outbox (
      id uuid primary key default gen_random_uuid(),
      org_id uuid,
      status text
    );
    insert into public.crm_outbox (id, org_id, status) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11', '${EASTC_ORG}', 'queued'),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12', '${EASTC_ORG}', 'approved'),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13', '${EASTC_ORG}', 'sent');
  `);
}

function itn(paymentStatus, eventId, extra = {}) {
  return JSON.stringify({
    sandbox: "true",
    payment_status: paymentStatus,
    plan_code: "starter",
    amount_gross: "499.00",
    token: "sandbox-token-1",
    occurred_at: "2026-09-01T00:00:00.000Z",
    ...extra,
  });
}

test("phase 2f migration keeps sending off and sandbox only", () => {
  const sql = migration("20261019120000_phase2f_billing.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.match(sql, /provider_event_id text not null unique/);
  assert.match(sql, /check \(sandbox\)/);
  assert.equal(/www\.payfast\.co\.za/i.test(sql), false);
});

test("sandbox ITN activates, duplicate is ignored, then dunning suspends and holds the outbox", async () => {
  const db = new PGlite();
  await applyBilling(db);
  await seedMembers(db);

  const first = await db.query(
    `select public.apply_billing_event($1, 'payfast', 'pf-1', 'itn', $2::jsonb) as result`,
    [EASTC_ORG, itn("COMPLETE", "pf-1")],
  );
  assert.equal(first.rows[0].result.duplicate, false);
  assert.equal(first.rows[0].result.status, "active");
  assert.equal(first.rows[0].result.charged, false);
  assert.equal(first.rows[0].result.sending_enabled, false);

  const duplicate = await db.query(
    `select public.apply_billing_event($1, 'payfast', 'pf-1', 'itn', $2::jsonb) as result`,
    [EASTC_ORG, itn("FAILED", "pf-1")],
  );
  assert.equal(duplicate.rows[0].result.duplicate, true);
  assert.equal(duplicate.rows[0].result.status, "active");
  const events = await db.query(`select count(*)::int as n from billing_events`);
  assert.equal(events.rows[0].n, 1);
  const stillActive = await db.query(`select status, sandbox from org_subscriptions where org_id = $1`, [EASTC_ORG]);
  assert.equal(stillActive.rows[0].status, "active");
  assert.equal(stillActive.rows[0].sandbox, true);

  const failed = await db.query(
    `select public.apply_billing_event($1, 'payfast', 'pf-2', 'itn', $2::jsonb) as result`,
    [EASTC_ORG, itn("FAILED", "pf-2")],
  );
  assert.equal(failed.rows[0].result.status, "past_due");
  assert.equal(failed.rows[0].result.charged, false);

  const early = await db.query(
    `select * from public.apply_billing_dunning('2026-09-07T00:00:00.000Z'::timestamptz)`,
  );
  assert.equal(early.rows.length, 0);
  const stillDue = await db.query(`select status from org_subscriptions where org_id = $1`, [EASTC_ORG]);
  assert.equal(stillDue.rows[0].status, "past_due");

  const suspended = await db.query(
    `select * from public.apply_billing_dunning('2026-09-08T00:00:00.000Z'::timestamptz)`,
  );
  assert.equal(suspended.rows.length, 1);
  assert.equal(suspended.rows[0].new_status, "suspended");
  assert.equal(Number(suspended.rows[0].outbox_held), 2);

  const org = await db.query(`select status, sending_enabled from organizations where id = $1`, [EASTC_ORG]);
  assert.equal(org.rows[0].status, "suspended");
  assert.equal(org.rows[0].sending_enabled, false);
  const outbox = await db.query(`select id::text, status from crm_outbox order by id`);
  assert.deepEqual(
    outbox.rows.map((row) => row.status),
    ["held", "held", "sent"],
  );

  await assert.rejects(
    asUser(
      db,
      EASTC_ADMIN,
      `insert into conversations (org_id, channel) values ('${EASTC_ORG}', 'sms')`,
    ),
    /suspended/i,
  );
});

test("usage report matches the ledger and billing rows stay inside the workspace", async () => {
  const db = new PGlite();
  await applyBilling(db);
  await seedMembers(db);

  await db.exec(`
    insert into rate_cards (org_id, meter, unit_cost_cents, markup_multiplier)
    values ('${EASTC_ORG}', 'sms', 18, 2);
    insert into usage_ledger (org_id, meter, quantity, unit_cost_cents, unit_price_cents, cost_cents, source_type, source_id, occurred_at)
    values
      ('${EASTC_ORG}', 'sms', 3, 18, 36, 54, 'outbox', 'usage-sms', '2026-09-02T00:00:00Z'),
      ('${EASTC_ORG}', 'email', 4, 1, 1, 4, 'outbox', 'usage-email', '2026-09-03T00:00:00Z'),
      ('${EASTC_ORG}', 'sms', 100, 18, 18, 1800, 'outbox', 'usage-old', '2026-08-01T00:00:00Z');
  `);

  const report = await db.query(
    `select meter, quantity::int, amount_cents::int
     from public.workspace_usage_report($1, '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z')
     order by meter`,
    [EASTC_ORG],
  );
  assert.deepEqual(report.rows, [
    { meter: "email", quantity: 4, amount_cents: 4 },
    { meter: "sms", quantity: 3, amount_cents: 108 },
  ]);
  const manual = await db.query(
    `select coalesce(sum(round(l.quantity::numeric * l.unit_cost_cents::numeric * coalesce(org_card.markup_multiplier, def_card.markup_multiplier, 1))), 0)::int as total
     from usage_ledger l
     left join rate_cards org_card on org_card.org_id = l.org_id and org_card.meter = l.meter
     left join rate_cards def_card on def_card.org_id is null and def_card.meter = l.meter
     where l.org_id = $1 and l.occurred_at >= '2026-09-01' and l.occurred_at < '2026-10-01'`,
    [EASTC_ORG],
  );
  assert.equal(manual.rows[0].total, 112);

  const stored = await db.query(
    `select public.bill_usage_period($1, '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z') as id`,
    [EASTC_ORG],
  );
  const again = await db.query(
    `select public.bill_usage_period($1, '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z') as id`,
    [EASTC_ORG],
  );
  assert.equal(again.rows[0].id, stored.rows[0].id);
  const saved = await db.query(`select amount_cents::int as amount_cents, status from billing_usage_reports where id = $1`, [
    stored.rows[0].id,
  ]);
  assert.equal(saved.rows[0].amount_cents, 112);
  assert.equal(saved.rows[0].status, "sandbox_pending");

  await db.query(
    `select public.apply_billing_event($1, 'payfast', 'pf-usage', 'itn', $2::jsonb)`,
    [EASTC_ORG, itn("COMPLETE", "pf-usage")],
  );

  const admin = await asUser(
    db,
    EASTC_ADMIN,
    `select status from org_subscriptions where org_id = '${EASTC_ORG}'`,
  );
  assert.equal(admin.rows[0].status, "active");
  await assert.rejects(
    asUser(db, EASTC_ADMIN, `select provider_token from org_subscriptions where org_id = '${EASTC_ORG}'`),
    /permission denied/i,
  );
  const staff = await asUser(
    db,
    EASTC_USER,
    `select status from org_subscriptions where org_id = '${EASTC_ORG}'`,
  );
  assert.equal(staff.rows[0].status, "active");
  const plans = await asUser(db, EASTC_USER, `select code from plans`);
  assert.equal(plans.rows.length, 0);
  const other = await asUser(
    db,
    OTHER_USER,
    `select status from org_subscriptions where org_id = '${EASTC_ORG}'`,
  );
  assert.equal(other.rows.length, 0);
  await assert.rejects(
    asUser(
      db,
      EASTC_ADMIN,
      `select public.apply_billing_event('${EASTC_ORG}', 'payfast', 'pf-forged', 'itn', '{"sandbox":"true","payment_status":"COMPLETE","plan_code":"starter","amount_gross":"499.00"}'::jsonb)`,
    ),
    /permission denied|not allowed/i,
  );

  const link = await asUser(
    db,
    EASTC_ADMIN,
    `select public.create_yoco_sandbox_link('${EASTC_ORG}', 15000, 'Once-off invoice') as result`,
  );
  assert.equal(link.rows[0].result.charged, false);
  assert.equal(link.rows[0].result.provider, "yoco");
  assert.match(link.rows[0].result.reference, /^sandbox-yoco-/);
});
