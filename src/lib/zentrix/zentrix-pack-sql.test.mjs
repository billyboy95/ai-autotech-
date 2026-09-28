import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const STAFF_USER = "33333333-3333-4333-8333-333333333333";
const RESTRICTED_USER = "44444444-4444-4444-8444-444444444444";
const ZENTRIX_ADMIN = "55555555-5555-4555-8555-555555555555";
const EASTC_ADMIN = "66666666-6666-4666-8666-666666666666";
const ZENTRIX_ORG = "b1000000-0000-4000-8000-000000000010";
const OTHER_ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

function asJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function applyBase(db, { withZentrix = true } = {}) {
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
  if (withZentrix) await db.exec(migration("20260926180000_zentrix_shopify.sql"));
  await db.exec(migration("20261104120000_phase5h_zentrix_workspace_pack.sql"));
  await db.exec(migration("20261104120000_phase5h_zentrix_workspace_pack.sql"));
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

test("step 29 sql does not turn sending on, store a key, or delete rows", () => {
  const sql = migration("20261104120000_phase5h_zentrix_workspace_pack.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\bdelete\s+from\b/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdrop table\b/i.test(sql), false);
  assert.equal(/insert\s+into\s+public\.crm_outbox/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.equal(/shpat_|admin\/api|X-Shopify-Access-Token|oauth/i.test(sql), false);
  assert.match(sql, /apply_zentrix_workspace_pack/);
  assert.match(sql, /refuse_zentrix_outbound/);
  assert.match(sql, /zentrix\.pack_applied/);
  assert.match(sql, /b1000000-0000-4000-8000-000000000010/);
  assert.match(sql, /w1y2f0-rk/);
  assert.match(sql, /desj1r-ic/);
  assert.match(sql, /80ce1e-p8/);
  assert.match(sql, /charged = false/);
  assert.match(sql, /secret_stored = false/);
  assert.match(sql, /provider_keys_present = false/);
});

test("zentrix pack applies once, stays idempotent, and rejects client admins", async () => {
  const db = new PGlite();
  await applyBase(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${STAFF_USER}', 'staff@aiautotech.co.za'),
      ('${RESTRICTED_USER}', 'limited@aiautotech.co.za'),
      ('${ZENTRIX_ADMIN}', 'admin@zentrixonline.co.za'),
      ('${EASTC_ADMIN}', 'admin@eastc.co.za');

    insert into organizations (id, name, slug, status, org_type, parent_id, form_key)
    values (
      '${OTHER_ORG}',
      'Other Campus',
      'other-campus',
      'active',
      'client',
      (select id from organizations where slug = 'ai-autotech'),
      'other-campus'
    );

    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${STAFF_USER}', id, 'agency_staff' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${ZENTRIX_ADMIN}', id, 'client_admin' from organizations where slug = 'zentrix';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_ADMIN}', id, 'client_admin' from organizations where slug = 'eastc';

    with staff as (
      insert into memberships (user_id, org_id, role)
      select '${RESTRICTED_USER}', id, 'agency_staff' from organizations where slug = 'ai-autotech'
      returning id
    )
    insert into member_org_access (member_id, org_id)
    select staff.id, '${OTHER_ORG}'::uuid from staff;

    insert into crm_leads (id, name, company, phone, stage, notes, ord, org_id)
    values ('zentrix-keep', 'Kept Buyer', 'Zentrix', '', 'New', 'do not copy', 1, '${ZENTRIX_ORG}');

    insert into workspace_messages (org_id, channel, direction, body, status)
    values ('${ZENTRIX_ORG}', 'email', 'outbound', 'KEEP_THIS_DRAFT', 'draft');

    insert into workspace_shopify_orders (org_id, shopify_id, email, total_cents)
    values ('${ZENTRIX_ORG}', 'order-keep', 'buyer@example.com', 100);

    create schema if not exists private;
    create table if not exists private.channel_secrets (
      id uuid primary key default gen_random_uuid(),
      secret text not null
    );
    insert into private.channel_secrets (secret) values ('super-secret-token-value');

    create table if not exists public.crm_outbox (
      id text primary key,
      lead_id text,
      channel text not null,
      body text not null default '',
      status text not null,
      org_id uuid
    );

    create table if not exists activity_logs (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      actor_id uuid,
      entity_type text not null,
      entity_id uuid,
      action text not null,
      metadata jsonb not null default '{}'::jsonb,
      org_id uuid
    );
  `);

  await assert.rejects(
    () => asUser(db, ZENTRIX_ADMIN, "select public.apply_zentrix_workspace_pack()"),
    /not allowed/i,
  );
  await assert.rejects(
    () => asUser(db, EASTC_ADMIN, "select public.apply_zentrix_workspace_pack()"),
    /not allowed/i,
  );
  await assert.rejects(
    () => asUser(db, RESTRICTED_USER, "select public.apply_zentrix_workspace_pack()"),
    /not allowed/i,
  );
  await assert.rejects(
    () => asUser(db, ZENTRIX_ADMIN, "select public.refuse_zentrix_outbound($1, 'publish')", [ZENTRIX_ORG]),
    /not allowed/i,
  );

  await assert.rejects(
    () => asUser(
      db,
      AGENCY_USER,
      `insert into public.zentrix_store_stubs (
        org_id, store_key, label, handle, storefront_url, intended_public_host, priority, purpose, ad_target
      ) values (
        '${ZENTRIX_ORG}', 'pets', 'Pets', 'w1y2f0-rk', 'https://w1y2f0-rk.myshopify.com', 'pets.zentrixonline.co.za', true, 'priority', true
      )`,
    ),
    /permission denied|row-level security/i,
  );

  const before = await db.query(`
    select
      (select count(*)::int from crm_leads where org_id = '${ZENTRIX_ORG}') as leads,
      (select count(*)::int from workspace_messages where org_id = '${ZENTRIX_ORG}') as messages,
      (select count(*)::int from workspace_shopify_orders where org_id = '${ZENTRIX_ORG}') as orders,
      (select count(*)::int from organizations where slug = 'zentrix') as zentrix_orgs,
      (select count(*)::int from workspace_shopify_stores where org_id = '${ZENTRIX_ORG}') as stores,
      (select count(*)::int from private.channel_secrets) as secrets,
      (select count(*)::int from public.crm_outbox) as outbox,
      (select sending_enabled from organizations where id = '${ZENTRIX_ORG}') as sending
  `);
  assert.equal(before.rows[0].leads, 1);
  assert.equal(before.rows[0].messages, 1);
  assert.equal(before.rows[0].orders, 1);
  assert.equal(before.rows[0].zentrix_orgs, 1);
  assert.equal(before.rows[0].stores, 10);
  assert.equal(before.rows[0].secrets, 1);
  assert.equal(before.rows[0].outbox, 0);
  assert.equal(before.rows[0].sending, false);

  const first = await asUser(db, STAFF_USER, "select public.apply_zentrix_workspace_pack() as result");
  const applied = asJson(first.rows[0].result);
  assert.equal(applied.slug, "zentrix");
  assert.equal(applied.org_id, ZENTRIX_ORG);
  assert.equal(applied.sending_enabled, false);
  assert.equal(applied.sandbox, true);
  assert.equal(applied.charged, false);
  assert.equal(applied.secret_stored, false);
  assert.equal(applied.provider_keys_present, false);
  assert.equal(applied.published, false);
  assert.equal(applied.queued, 0);
  assert.equal(applied.sent, 0);
  assert.equal(applied.stores.length, 3);
  const byKey = Object.fromEntries(applied.stores.map((store) => [store.store_key, store]));
  assert.equal(byKey.pets.handle, "w1y2f0-rk");
  assert.equal(byKey.pets.storefront_url, "https://w1y2f0-rk.myshopify.com");
  assert.equal(byKey.pets.intended_public_host, "pets.zentrixonline.co.za");
  assert.equal(byKey.pets.priority, true);
  assert.equal(byKey.pets.purpose, "priority");
  assert.equal(byKey.pets.ad_target, true);
  assert.equal(byKey.kitchens.handle, "desj1r-ic");
  assert.equal(byKey.kitchens.priority, true);
  assert.equal(byKey.auto.handle, "80ce1e-p8");
  assert.equal(byKey.auto.priority, false);
  assert.equal(byKey.auto.purpose, "qa_reference");
  assert.equal(byKey.auto.ad_target, false);
  assert.equal(byKey.auto.intended_public_host, "");
  for (const store of applied.stores) {
    assert.equal(store.sandbox, true);
    assert.equal(store.charged, false);
    assert.equal(store.secret_stored, false);
    assert.equal(store.provider_keys_present, false);
    assert.equal(store.published, false);
    assert.equal(store.queued, 0);
    assert.equal(store.sent, 0);
  }

  const domains = await db.query(
    `select niche, myshopify_domain, plan_status
     from workspace_shopify_stores
     where org_id = '${ZENTRIX_ORG}'
     order by niche`,
  );
  const domainByNiche = Object.fromEntries(domains.rows.map((row) => [row.niche, row]));
  assert.equal(domainByNiche.Pets.myshopify_domain, "w1y2f0-rk.myshopify.com");
  assert.equal(domainByNiche.Kitchens.myshopify_domain, "desj1r-ic.myshopify.com");
  assert.equal(domainByNiche.Auto.myshopify_domain, "80ce1e-p8.myshopify.com");
  assert.equal(domainByNiche.Pets.plan_status, "not_connected");
  assert.equal(domainByNiche.Camping.myshopify_domain, "zentrix-camping.myshopify.com");
  assert.equal(domains.rows.length, 10);

  const second = await asUser(db, AGENCY_USER, "select public.apply_zentrix_workspace_pack() as result");
  const again = asJson(second.rows[0].result);
  assert.equal(again.stores.length, 3);
  const counts = await db.query(`
    select
      (select count(*)::int from zentrix_store_stubs where org_id = '${ZENTRIX_ORG}') as stubs,
      (select count(*)::int from crm_leads) as leads,
      (select count(*)::int from workspace_messages) as messages,
      (select count(*)::int from workspace_shopify_orders) as orders,
      (select count(*)::int from organizations where slug = 'zentrix') as zentrix_orgs,
      (select count(*)::int from workspace_shopify_stores) as stores,
      (select count(*)::int from private.channel_secrets) as secrets,
      (select count(*)::int from public.crm_outbox) as outbox,
      (select sending_enabled from organizations where id = '${ZENTRIX_ORG}') as sending,
      (select count(*)::int from org_activity where action = 'zentrix.pack_applied') as activity,
      (select count(*)::int from activity_logs where action = 'zentrix.pack_applied') as logs
  `);
  assert.equal(counts.rows[0].stubs, 3);
  assert.equal(counts.rows[0].leads, 1);
  assert.equal(counts.rows[0].messages, 1);
  assert.equal(counts.rows[0].orders, 1);
  assert.equal(counts.rows[0].zentrix_orgs, 1);
  assert.equal(counts.rows[0].stores, 10);
  assert.equal(counts.rows[0].secrets, 1);
  assert.equal(counts.rows[0].outbox, 0);
  assert.equal(counts.rows[0].sending, false);
  assert.equal(counts.rows[0].activity, 2);
  assert.equal(counts.rows[0].logs, 2);

  const hidden = await asUser(db, EASTC_ADMIN, "select count(*)::int as total from public.zentrix_store_stubs");
  assert.equal(hidden.rows[0].total, 0);
  const visible = await asUser(db, ZENTRIX_ADMIN, "select count(*)::int as total from public.zentrix_store_stubs");
  assert.equal(visible.rows[0].total, 3);

  const refused = await asUser(db, AGENCY_USER, "select public.refuse_zentrix_outbound($1, 'go_live') as result", [ZENTRIX_ORG]);
  const refusal = asJson(refused.rows[0].result);
  assert.equal(refusal.refused, true);
  assert.equal(refusal.queued, 0);
  assert.equal(refusal.posted, 0);
  assert.equal(refusal.sent, 0);
  assert.equal(refusal.published, false);
  assert.equal(refusal.charged, false);
  assert.equal(refusal.ad_spend, false);
  assert.equal(refusal.secret_stored, false);
  assert.equal(refusal.provider_keys_present, false);
  assert.equal(refusal.sending_enabled, false);
  const outboxAfter = await db.query("select count(*)::int as total from public.crm_outbox");
  assert.equal(outboxAfter.rows[0].total, 0);

  await db.exec(`update organizations set sending_enabled = true where id = '${ZENTRIX_ORG}'`);
  await assert.rejects(
    () => asUser(db, AGENCY_USER, "select public.apply_zentrix_workspace_pack()"),
    /sending must stay off/i,
  );
  await db.exec(`update organizations set sending_enabled = false where id = '${ZENTRIX_ORG}'`);
});

test("zentrix pack refuses a missing workspace and a slug that does not match the seed", async () => {
  const missing = new PGlite();
  await applyBase(missing, { withZentrix: false });
  await missing.exec(`
    insert into auth.users (id, email) values ('${AGENCY_USER}', 'owner@aiautotech.co.za');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
  `);
  await assert.rejects(
    () => asUser(missing, AGENCY_USER, "select public.apply_zentrix_workspace_pack()"),
    /Zentrix client workspace was not found/i,
  );

  const clash = new PGlite();
  await applyBase(clash);
  await clash.exec(`
    insert into auth.users (id, email) values ('${AGENCY_USER}', 'owner@aiautotech.co.za');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    update organizations set slug = 'zentrix-moved' where id = '${ZENTRIX_ORG}';
    insert into organizations (id, name, slug, status, org_type, parent_id, form_key)
    values (
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'Second Zentrix',
      'zentrix',
      'active',
      'client',
      (select id from organizations where slug = 'ai-autotech'),
      'zentrix-two'
    );
  `);
  await assert.rejects(
    () => asUser(clash, AGENCY_USER, "select public.apply_zentrix_workspace_pack()"),
    /different organisations/i,
  );
  const orgs = await clash.query("select count(*)::int as total from organizations where slug = 'zentrix'");
  assert.equal(orgs.rows[0].total, 1);
  const stubs = await clash.query("select count(*)::int as total from zentrix_store_stubs");
  assert.equal(stubs.rows[0].total, 0);
});
