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

async function applyBots(db) {
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

test("phase 4a keeps sandbox billing, the bundle discount, and draft-only outbox rows", async () => {
  const db = new PGlite();
  await applyBots(db);
  await seedMembers(db);

  const seeded = await db.query(`select slug from bot_catalog order by slug`);
  const slugs = seeded.rows.map((row) => row.slug);
  assert.ok(slugs.length >= 40);
  for (const slug of ["ads", "inbound-lead", "onboarding", "outbound-sales", "social-posting"]) {
    assert.ok(slugs.includes(slug), slug);
  }
  const departments = await db.query(`select count(distinct department)::int as n from bot_catalog`);
  assert.ok(departments.rows[0].n >= 16);
  const placeholders = await db.query(`select bool_and(price_placeholder) as ok from bot_catalog`);
  assert.equal(placeholders.rows[0].ok, true);

  const savings = await db.query(`
    select slug, separate_total_cents, max_bot_cents, bundle_price_cents, saving_percent
    from bot_bundle_savings
    order by slug
  `);
  const counts = await db.query(`
    select b.slug, count(i.bot_slug)::int as n
    from bot_bundles b
    join bot_bundle_items i on i.bundle_id = b.id
    group by b.slug
  `);
  const countBySlug = Object.fromEntries(counts.rows.map((row) => [row.slug, row.n]));
  const expectPercent = (count) => (count >= 10 ? 20 : count >= 5 ? 15 : count >= 3 ? 10 : 0);
  const bySlug = Object.fromEntries(savings.rows.map((row) => [row.slug, row]));
  assert.equal(bySlug["sales-team"].saving_percent, 10);
  assert.equal(bySlug["marketing-team"].saving_percent, 0);
  assert.equal(bySlug["marketing-team"].bundle_price_cents, bySlug["marketing-team"].separate_total_cents);
  assert.equal(bySlug["full-business"].saving_percent, 15);
  const sheet = await db.query(`select bool_and(price_placeholder) as ok, count(*)::int as n from pricing_sheet`);
  assert.equal(sheet.rows[0].ok, true);
  assert.ok(sheet.rows[0].n >= 11);
  const platform = await db.query(`select amount_cents::int as amount from pricing_sheet where key = 'platform_fee'`);
  assert.equal(platform.rows[0].amount, 29900);
  for (const row of savings.rows) {
    const percent = expectPercent(countBySlug[row.slug]);
    const expected = row.separate_total_cents - Math.round((row.separate_total_cents * percent) / 100);
    assert.equal(row.saving_percent, percent, row.slug);
    assert.equal(row.bundle_price_cents, expected, row.slug);
    assert.ok(row.bundle_price_cents > row.max_bot_cents, row.slug);
    if (percent === 0) assert.equal(row.bundle_price_cents, row.separate_total_cents, row.slug);
    else assert.ok(row.bundle_price_cents < row.separate_total_cents, row.slug);
  }
  const templates = await db.query(`select slug from bot_templates`);
  assert.ok(templates.rows.length >= 17);
  assert.ok(templates.rows.some((row) => row.slug === "faceless-youtube"));
  assert.ok(templates.rows.some((row) => row.slug === "ai-automation-agency"));
  const education = await db.query(`select payload::text as payload from bot_templates where slug = 'education-school'`);
  assert.match(education.rows[0].payload, /stage:admissions:enquiry/);

  const tiers = await db.query(`select slug, tier, monthly_price_cents::int as price from bot_catalog where slug in ('inbound-lead', 'outbound-sales', 'onboarding', 'ads', 'social-posting')`);
  const tierBySlug = Object.fromEntries(tiers.rows.map((row) => [row.slug, row]));
  assert.equal(tierBySlug["inbound-lead"].tier, "included");
  assert.equal(tierBySlug["inbound-lead"].price, 0);
  assert.equal(tierBySlug["outbound-sales"].tier, "pro");
  assert.equal(tierBySlug["outbound-sales"].price, 149900);
  assert.equal(tierBySlug["onboarding"].tier, "starter");
  assert.equal(tierBySlug["onboarding"].price, 69900);
  assert.equal(tierBySlug["ads"].tier, "pro");
  assert.equal(tierBySlug["ads"].price, 149900);
  assert.equal(tierBySlug["social-posting"].tier, "starter");
  assert.equal(tierBySlug["social-posting"].price, 69900);

  const plans = await db.query(`select code, price_cents::int as price, active from plans order by code`);
  const planByCode = Object.fromEntries(plans.rows.map((row) => [row.code, row]));
  assert.equal(planByCode.platform.price, 29900);
  assert.equal(planByCode.platform.active, true);
  assert.equal(planByCode.agent_starter.price, 69900);
  assert.equal(planByCode.agent_pro.price, 149900);
  assert.equal(planByCode.agent_always_on.price, 499900);
  assert.equal(planByCode.starter.active, false);
  assert.equal(planByCode.growth.active, false);
  assert.equal(planByCode.scale.active, false);
  const legacy = await db.query(`select bool_and(features->>'legacy' = 'true') as ok from plans where code in ('starter', 'growth', 'scale')`);
  assert.equal(legacy.rows[0].ok, true);

  const markup = await db.query(`select meter, markup_multiplier::float as markup from rate_cards where org_id is null and meter in ('sms', 'email', 'wa_marketing') order by meter`);
  assert.ok(markup.rows.every((row) => row.markup === 1.5));

  await db.query(`update bot_bundles set bundle_price_cents = $1 where slug = 'sales-team'`, [bySlug["sales-team"].separate_total_cents]);
  const stillDiscounted = await db.query(`select saving_percent::int as saving_percent, bundle_price_cents::int as bundle_price_cents from bot_bundle_savings where slug = 'sales-team'`);
  assert.equal(stillDiscounted.rows[0].saving_percent, 10);
  assert.equal(stillDiscounted.rows[0].bundle_price_cents, bySlug["sales-team"].bundle_price_cents);
  await db.query(`update bot_bundles set bundle_price_cents = $1, discount_percent = 10 where slug = 'sales-team'`, [bySlug["sales-team"].bundle_price_cents]);

  const subsBefore = await db.query(`select count(*)::int as n from org_subscriptions`);
  const applied = await db.query(`select public.apply_bot_template($1, 'sales-team') as result`, [EASTC_ORG]);
  assert.equal(applied.rows[0].result.charged, false);
  assert.equal(applied.rows[0].result.sandbox, true);
  assert.equal(applied.rows[0].result.sending_enabled, false);
  assert.equal(applied.rows[0].result.copied_contacts, false);
  const stages = await db.query(
    `select count(*)::int as n from pipeline_stages where org_id = $1 and asset_key like 'stage:bot:sales-team:%'`,
    [EASTC_ORG],
  );
  assert.equal(stages.rows[0].n, 6);
  await db.query(`select public.apply_bot_template($1, 'sales-team')`, [EASTC_ORG]);
  const stagesAgain = await db.query(
    `select count(*)::int as n from pipeline_stages where org_id = $1 and asset_key like 'stage:bot:sales-team:%'`,
    [EASTC_ORG],
  );
  assert.equal(stagesAgain.rows[0].n, 6);
  const flows = await db.query(
    `select count(*)::int as n from workflows where org_id = $1 and asset_key like 'workflow:bot:%'`,
    [EASTC_ORG],
  );
  assert.equal(flows.rows[0].n, 2);
  const lines = await db.query(
    `select coalesce(sum(amount_cents), 0)::int as total, bool_and(sandbox) as sandbox, bool_and(charged = false) as uncharged, count(*)::int as n
     from org_bot_billing_lines where org_id = $1`,
    [EASTC_ORG],
  );
  assert.equal(lines.rows[0].total, bySlug["sales-team"].bundle_price_cents);
  assert.equal(lines.rows[0].sandbox, true);
  assert.equal(lines.rows[0].uncharged, true);
  assert.equal(lines.rows[0].n, 3);
  const inboundLine = await db.query(
    `select amount_cents::int as amount from org_bot_billing_lines where org_id = $1 and bot_slug = 'inbound-lead'`,
    [EASTC_ORG],
  );
  assert.equal(inboundLine.rows[0].amount, 0);
  const subsAfter = await db.query(`select count(*)::int as n from org_subscriptions`);
  assert.equal(subsAfter.rows[0].n, subsBefore.rows[0].n);
  const sending = await db.query(`select sending_enabled from organizations where id = $1`, [EASTC_ORG]);
  assert.equal(sending.rows[0].sending_enabled, false);

  await assert.rejects(
    db.query(`insert into org_bots (org_id, bot_slug, sandbox) values ($1, 'ads', false)`, [EASTC_ORG]),
    /sandbox|check/i,
  );
  await assert.rejects(
    db.query(
      `insert into org_bot_billing_lines (org_id, bot_slug, amount_cents, sandbox, charged)
       values ($1, 'ads', 100, true, true)`,
      [EASTC_ORG],
    ),
    /charged|check/i,
  );

  const draft = await db.query(
    `select public.record_bot_outbox_draft($1, 'outbound-sales', 'Draft only', 'Hello', 'whatsapp', null) as result`,
    [EASTC_ORG],
  );
  assert.equal(draft.rows[0].result.outbox_status, "draft");
  assert.equal(draft.rows[0].result.queued, false);
  assert.equal(draft.rows[0].result.sent, false);
  const outbox = await db.query(`select status from crm_outbox`);
  assert.deepEqual(outbox.rows.map((row) => row.status), ["draft"]);
  const bad = await db.query(`select count(*)::int as n from crm_outbox where status in ('queued', 'sent')`);
  assert.equal(bad.rows[0].n, 0);

  const visible = await asUser(db, EASTC_USER, `select bot_slug from org_bots where org_id = '${EASTC_ORG}' order by bot_slug`);
  assert.equal(visible.rows.length, 3);
  const catalog = await asUser(db, EASTC_USER, `select slug from bot_catalog`);
  assert.ok(catalog.rows.length >= 40);
  await assert.rejects(
    asUser(db, EASTC_USER, `insert into org_bots (org_id, bot_slug, sandbox) values ('${EASTC_ORG}', 'ads', true)`),
    /row-level security|permission denied|42501/i,
  );
  await assert.rejects(
    asUser(db, EASTC_USER, `insert into bot_runs (org_id, bot_slug, kind, status, summary) values ('${EASTC_ORG}', 'ads', 'ad_draft', 'drafted', 'no')`),
    /row-level security|permission denied|42501/i,
  );
  await assert.rejects(
    asUser(db, EASTC_USER, `select public.apply_bot_template('${EASTC_ORG}', 'marketing-team')`),
    /not allowed/i,
  );
  const hidden = await asUser(db, OTHER_USER, `select bot_slug from org_bots where org_id = '${EASTC_ORG}'`);
  assert.equal(hidden.rows.length, 0);
  const owner = await asUser(db, AGENCY_USER, `select bot_slug from org_bots where org_id = '${EASTC_ORG}'`);
  assert.equal(owner.rows.length, 3);

  const recommended = await asUser(
    db,
    EASTC_ADMIN,
    `select public.start_recommended_sandbox_team($1, array['receptionist','reminder-drafts','document-admin']) as result`,
    [EASTC_ORG],
  );
  assert.equal(recommended.rows[0].result.charged, false);
  assert.equal(recommended.rows[0].result.sandbox, true);
  assert.equal(recommended.rows[0].result.sending_enabled, false);
  const teamPrices = await db.query(
    `select coalesce(sum(monthly_price_cents), 0)::int as total
     from bot_catalog
     where slug in ('receptionist', 'reminder-drafts', 'document-admin')`,
  );
  const teamDiscounted = teamPrices.rows[0].total - Math.round((teamPrices.rows[0].total * 10) / 100);
  assert.equal(recommended.rows[0].result.amount_cents, teamDiscounted);
  const recommendedLines = await db.query(
    `select coalesce(sum(amount_cents), 0)::int as total, bool_and(charged = false) as uncharged
     from org_bot_billing_lines
     where org_id = $1 and bot_slug in ('receptionist', 'reminder-drafts', 'document-admin')`,
    [EASTC_ORG],
  );
  assert.equal(recommendedLines.rows[0].total, teamDiscounted);
  assert.equal(recommendedLines.rows[0].uncharged, true);
  const sendingAfterTeam = await db.query(`select sending_enabled from organizations where id = $1`, [EASTC_ORG]);
  assert.equal(sendingAfterTeam.rows[0].sending_enabled, false);
  await assert.rejects(
    asUser(db, EASTC_USER, `select public.start_recommended_sandbox_team('${EASTC_ORG}', array['receptionist'])`),
    /not allowed/i,
  );

  await db.query(
    `insert into org_subscriptions (org_id, plan_code, provider, status, sandbox) values ($1, 'starter', 'manual', 'suspended', true)`,
    [EASTC_ORG],
  );
  await assert.rejects(
    asUser(db, EASTC_ADMIN, `insert into org_bots (org_id, bot_slug, sandbox) values ('${EASTC_ORG}', 'ads', true)`),
    /suspended/i,
  );
});
