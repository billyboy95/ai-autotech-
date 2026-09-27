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

async function applyOnboarding(db) {
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
  await db.exec(`
    create table public.crm_outbox (
      id text primary key,
      org_id uuid,
      channel text not null default 'whatsapp',
      body text not null default '',
      status text not null default 'queued' check (status in ('queued', 'approved', 'sent', 'failed', 'cancelled', 'blocked', 'blocked_consent', 'held'))
    );
  `);
  await db.exec(migration("20261024120000_phase4a_bots.sql"));
  await db.exec(migration("20261026120000_phase4c_aios_pricing.sql"));
  await db.exec(migration("20261029120000_phase5b_lead_onboarding.sql"));
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
  `);
}

test("phase 5b records the full sandbox team and refuses a shorter list", async () => {
  const sql = migration("20261029120000_phase5b_lead_onboarding.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/price_placeholder\s*=\s*false/i.test(sql), false);
  assert.match(sql, /start_recommended_sandbox_team/);
  assert.match(sql, /full team required/);

  const db = new PGlite();
  await applyOnboarding(db);
  await seedMembers(db);

  const slugs = await db.query(
    `select array_agg(i.bot_slug order by i.bot_slug) as slugs
     from public.bot_templates t
     join public.bot_bundles b on b.slug = t.bundle_slug
     join public.bot_bundle_items i on i.bundle_id = b.id
     where t.slug = 'healthcare-clinic'`,
  );
  const team = slugs.rows[0].slugs;
  assert.ok(team.length >= 5);
  assert.ok(team.length <= 8);

  await assert.rejects(
    asUser(
      db,
      EASTC_ADMIN,
      `select public.record_lead_onboarding_trial($1, 'healthcare-clinic', array['receptionist'], '{"niche":"clinic"}'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
      [EASTC_ORG],
    ),
    /full team required/i,
  );
  await assert.rejects(
    asUser(
      db,
      EASTC_ADMIN,
      `select public.record_lead_onboarding_trial($1, 'healthcare-clinic', $2, '{"niche":"clinic"}'::jsonb, '{}'::jsonb, '{"charged":true}'::jsonb)`,
      [EASTC_ORG, team],
    ),
    /sandbox trial only/i,
  );
  const empty = await db.query(`select count(*)::int as n from public.lead_onboarding_drafts`);
  assert.equal(empty.rows[0].n, 0);

  const recorded = await asUser(
    db,
    EASTC_ADMIN,
    `select public.record_lead_onboarding_trial($1, 'healthcare-clinic', $2, $3::jsonb, $4::jsonb, $5::jsonb) as result`,
    [
      EASTC_ORG,
      team,
      JSON.stringify({ niche: "clinic", goals: ["leads"], channels: ["whatsapp"], hours: "09:00-16:00", tools: "Google Calendar" }),
      JSON.stringify({ tone: "Warm", "whatsapp-number": "+27110000000" }),
      JSON.stringify({ currency: "ZAR", prices_exclude_vat: true, price_placeholder: true, charged: false, sandbox: true }),
    ],
  );
  assert.equal(recorded.rows[0].result.sandbox, true);
  assert.equal(recorded.rows[0].result.charged, false);
  assert.equal(recorded.rows[0].result.sending_enabled, false);
  assert.equal(recorded.rows[0].result.full_team, true);
  assert.equal(recorded.rows[0].result.price_placeholder, true);
  assert.equal(recorded.rows[0].result.bots, team.length);

  const prices = await db.query(
    `select coalesce(sum(monthly_price_cents), 0)::int as total from public.bot_catalog where slug = any($1::text[])`,
    [team],
  );
  const percent = team.length >= 10 ? 20 : team.length >= 5 ? 15 : team.length >= 3 ? 10 : 0;
  const discounted = prices.rows[0].total - Math.round((prices.rows[0].total * percent) / 100);
  assert.equal(recorded.rows[0].result.amount_cents, discounted);

  const draft = await db.query(
    `select template_slug, status, sandbox, charged, price_placeholder, cardinality(bot_slugs) as n,
            business->>'niche' as niche, quote->>'prices_exclude_vat' as vat
     from public.lead_onboarding_drafts where org_id = $1`,
    [EASTC_ORG],
  );
  assert.equal(draft.rows[0].template_slug, "healthcare-clinic");
  assert.equal(draft.rows[0].status, "sandbox_trial");
  assert.equal(draft.rows[0].sandbox, true);
  assert.equal(draft.rows[0].charged, false);
  assert.equal(draft.rows[0].price_placeholder, true);
  assert.equal(draft.rows[0].n, team.length);
  assert.equal(draft.rows[0].niche, "clinic");
  assert.equal(draft.rows[0].vat, "true");

  const lines = await db.query(
    `select count(*)::int as n, coalesce(sum(amount_cents), 0)::int as total,
            bool_and(charged = false) as uncharged, bool_and(price_placeholder) as placeholders, bool_and(sandbox) as sandbox
     from public.org_bot_billing_lines where org_id = $1 and bot_slug = any($2::text[])`,
    [EASTC_ORG, team],
  );
  assert.equal(lines.rows[0].n, team.length);
  assert.equal(lines.rows[0].total, discounted);
  assert.equal(lines.rows[0].uncharged, true);
  assert.equal(lines.rows[0].placeholders, true);
  assert.equal(lines.rows[0].sandbox, true);

  await asUser(
    db,
    EASTC_ADMIN,
    `select public.record_lead_onboarding_trial($1, 'healthcare-clinic', $2, '{"niche":"clinic"}'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
    [EASTC_ORG, team],
  );
  const drafts = await db.query(`select count(*)::int as n from public.lead_onboarding_drafts`);
  assert.equal(drafts.rows[0].n, 1);

  const sending = await db.query(`select sending_enabled from public.organizations where id = $1`, [EASTC_ORG]);
  assert.equal(sending.rows[0].sending_enabled, false);

  await assert.rejects(
    asUser(
      db,
      EASTC_USER,
      `select public.record_lead_onboarding_trial($1, 'healthcare-clinic', $2, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)`,
      [EASTC_ORG, team],
    ),
    /not allowed/i,
  );
  const hidden = await asUser(db, OTHER_USER, `select template_slug from public.lead_onboarding_drafts where org_id = $1`, [EASTC_ORG]);
  assert.equal(hidden.rows.length, 0);
  const visible = await asUser(db, EASTC_ADMIN, `select template_slug from public.lead_onboarding_drafts where org_id = $1`, [EASTC_ORG]);
  assert.equal(visible.rows[0].template_slug, "healthcare-clinic");
});
