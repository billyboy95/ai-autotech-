import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const PROSPECT = "44444444-4444-4444-8444-444444444444";
const RESTAURANT_ID = "a2c00000-0000-4000-8000-000000000003";
const IP_A = "a".repeat(64);
const IP_B = "b".repeat(64);
const IP_HONEY = "c".repeat(64);
const IP_RATE = "d".repeat(64);
const NOW = "2026-10-06T00:00:00Z";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyTrial(db) {
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
  for (const name of [
    "20260903000000_company_crm.sql",
    "20260926160000_crm_automation.sql",
    "20260926183000_outbound_channels.sql",
    "20260926200000_send_compliance.sql",
    "20260925000000_audit_leads.sql",
    "20260926160000_agency_tenancy.sql",
    "20260926200000_phase2a_access.sql",
    "20261015120000_org_scope_phase1_tables.sql",
    "20261015140000_phase2b_channels_popia.sql",
    "20261016120000_phase2c_snapshots.sql",
    "20261017120000_phase2d_workflows.sql",
    "20261018120000_phase2e_inbox.sql",
    "20261019120000_phase2f_billing.sql",
    "20261021120000_phase3a_conversation_ai.sql",
    "20261022120000_phase3b_calendars.sql",
    "20261024120000_phase4a_bots.sql",
    "20261112120000_phase5p_sales_funnel.sql",
    "20261112120100_phase5p_workspace_templates.sql",
    "20261112120200_phase5p_free_trial.sql",
  ]) {
    await db.exec(migration(name));
  }
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
    await db.exec(`select set_config('request.jwt.claim.role', '', false)`);
  }
}

function startSql(email, business, ip, days = 14, popia = true, honeypot = "") {
  return {
    text: `select public.start_free_trial(
      $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz
    ) as result`,
    params: [RESTAURANT_ID, business, "Lesego Dlamini", email, "0100000099", popia, days, ip, honeypot, NOW],
  };
}

test("a free trial duplicates the restaurant template, keeps one per email, and pauses without deleting", async () => {
  const db = new PGlite();
  await applyTrial(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${EASTC_USER}', 'staff@eastc.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za'),
      ('${PROSPECT}', 'lesego@example.com');
    insert into organizations (id, name, slug, org_type, form_key)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Other Agency', 'other-agency', 'agency', 'other-agency');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_USER}', id, 'client_user' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_USER}', id, 'agency_owner' from organizations where slug = 'other-agency';
  `);

  const firstCall = startSql("Lesego@Example.com", "Lake Road Burgers", IP_A);
  const created = await db.query(firstCall.text, firstCall.params);
  const first = created.rows[0].result;
  assert.equal(first.created, true);
  assert.equal(first.idempotent, false);
  assert.equal(first.sending_enabled, false);
  assert.equal(first.charged, false);
  assert.equal(first.status, "trialing");
  assert.equal(first.slug, "lake-road-burgers");
  const orgId = first.org_id;
  const leadId = first.lead_id;

  const org = await db.query(
    `select name, status, sending_enabled, industry from organizations where id = $1`,
    [orgId],
  );
  assert.equal(org.rows[0].name, "Lake Road Burgers");
  assert.equal(org.rows[0].status, "active");
  assert.equal(org.rows[0].sending_enabled, false);
  assert.equal(org.rows[0].industry, "Restaurant");

  const templates = await db.query(`select active, body from message_templates where org_id = $1`, [orgId]);
  assert.ok(templates.rows.length >= 1);
  assert.equal(templates.rows.every((row) => row.active === false), true);
  const bodies = templates.rows.map((row) => row.body).join("\n");
  assert.match(bodies, /Lake Road Burgers/);
  assert.equal(bodies.includes("{{business.name}}"), false);

  const flows = await db.query(`select active from workflows where org_id = $1`, [orgId]);
  assert.ok(flows.rows.length >= 1);
  assert.equal(flows.rows.every((row) => row.active === false), true);

  const subscription = await db.query(
    `select status, sandbox, plan_code from org_subscriptions where org_id = $1`,
    [orgId],
  );
  assert.equal(subscription.rows[0].status, "trialing");
  assert.equal(subscription.rows[0].sandbox, true);
  assert.equal(subscription.rows[0].plan_code, "starter");

  const lead = await db.query(
    `select source, email, marketing_consent, enrolled, org_id
     from crm_leads where id = $1`,
    [leadId],
  );
  assert.equal(lead.rows[0].source, "free_trial");
  assert.equal(lead.rows[0].email, "lesego@example.com");
  assert.equal(lead.rows[0].marketing_consent, false);
  assert.equal(lead.rows[0].enrolled, false);
  const agency = await db.query(`select id from organizations where slug = 'ai-autotech'`);
  assert.equal(lead.rows[0].org_id, agency.rows[0].id);

  const note = await db.query(
    `select kind, title, body from crm_notifications where lead_id = $1`,
    [leadId],
  );
  assert.equal(note.rows.length, 1);
  assert.equal(note.rows[0].kind, "contact");
  assert.match(note.rows[0].title, /Free trial started/);
  assert.match(note.rows[0].body, /Nothing is sent to the lead/);
  assert.equal(note.rows[0].body.includes("lesego@example.com"), false);

  const again = await db.query(firstCall.text, firstCall.params);
  assert.equal(again.rows[0].result.created, false);
  assert.equal(again.rows[0].result.idempotent, true);
  assert.equal(again.rows[0].result.org_id, orgId);
  const oneTrial = await db.query(`select count(*)::int as n from workspace_trials where email = 'lesego@example.com'`);
  assert.equal(oneTrial.rows[0].n, 1);
  const oneOrg = await db.query(`select count(*)::int as n from organizations where slug = 'lake-road-burgers'`);
  assert.equal(oneOrg.rows[0].n, 1);

  const secondCall = startSql("chef@second-kitchen.example", "Second Kitchen", IP_B, 40);
  const second = await db.query(secondCall.text, secondCall.params);
  assert.equal(second.rows[0].result.created, true);
  assert.equal(second.rows[0].result.sending_enabled, false);
  const secondOrg = second.rows[0].result.org_id;

  const before = await db.query(`
    select
      (select count(*)::int from organizations) as orgs,
      (select count(*)::int from crm_leads) as leads,
      (select count(*)::int from workspace_trials) as trials
  `);

  const honey = startSql("bot@example.com", "Bot Kitchen", IP_HONEY, 14, true, "https://spam.example");
  const honeyResult = await db.query(honey.text, honey.params);
  assert.equal(honeyResult.rows[0].result.stored, false);
  assert.equal(honeyResult.rows[0].result.created, false);
  const noBot = await db.query(`select count(*)::int as n from workspace_trials where email = 'bot@example.com'`);
  assert.equal(noBot.rows[0].n, 0);

  await assert.rejects(
    () => db.query(startSql("plain@example.com", "Plain Kitchen", "e".repeat(64), 14, false).text, startSql("plain@example.com", "Plain Kitchen", "e".repeat(64), 14, false).params),
    /POPIA/,
  );

  await db.exec(`
    insert into free_trial_attempts (ip_hash, email, created_at)
    select '${IP_RATE}', 'rate@example.com', '${NOW}'::timestamptz
    from generate_series(1, 5);
  `);
  await assert.rejects(
    () => db.query(startSql("rate-new@example.com", "Rate Kitchen", IP_RATE).text, startSql("rate-new@example.com", "Rate Kitchen", IP_RATE).params),
    /Too many trial requests/,
  );

  const warned = await db.query(
    `select public.expire_free_trials('2026-10-19T00:00:00Z'::timestamptz, 2) as result`,
  );
  assert.equal(warned.rows[0].result.deleted, 0);
  assert.equal(warned.rows[0].result.charged, false);
  assert.equal(Number(warned.rows[0].result.warned) >= 1, true);
  const stillLive = await db.query(`select status, warning_notified_at from workspace_trials where org_id = $1`, [orgId]);
  assert.equal(stillLive.rows[0].status, "trialing");
  assert.ok(stillLive.rows[0].warning_notified_at);

  const paused = await db.query(
    `select public.expire_free_trials('2026-10-20T00:00:01Z'::timestamptz, 2) as result`,
  );
  assert.equal(paused.rows[0].result.deleted, 0);
  assert.equal(paused.rows[0].result.charged, false);
  assert.equal(Number(paused.rows[0].result.paused) >= 1, true);

  const afterTrial = await db.query(
    `select status, paused_at from workspace_trials where org_id = $1`,
    [orgId],
  );
  assert.equal(afterTrial.rows[0].status, "paused");
  assert.ok(afterTrial.rows[0].paused_at);
  const afterOrg = await db.query(`select status, sending_enabled from organizations where id = $1`, [orgId]);
  assert.equal(afterOrg.rows[0].status, "suspended");
  assert.equal(afterOrg.rows[0].sending_enabled, false);
  const afterSub = await db.query(`select status, sandbox from org_subscriptions where org_id = $1`, [orgId]);
  assert.equal(afterSub.rows[0].status, "suspended");
  assert.equal(afterSub.rows[0].sandbox, true);
  const laterTrial = await db.query(`select status from workspace_trials where org_id = $1`, [secondOrg]);
  assert.equal(laterTrial.rows[0].status, "trialing");

  const after = await db.query(`
    select
      (select count(*)::int from organizations) as orgs,
      (select count(*)::int from crm_leads) as leads,
      (select count(*)::int from workspace_trials) as trials
  `);
  assert.equal(after.rows[0].orgs, before.rows[0].orgs);
  assert.equal(after.rows[0].leads, before.rows[0].leads);
  assert.equal(after.rows[0].trials, before.rows[0].trials);

  const ended = await db.query(
    `select title from crm_notifications where dedupe_key = $1`,
    [`contact:trial-end:${orgId}`],
  );
  assert.equal(ended.rows.length, 1);
  assert.match(ended.rows[0].title, /Free trial ended/);

  await assert.rejects(
    () => db.query(startSql("lesego@example.com", "Lake Road Burgers", "f".repeat(64)).text, startSql("lesego@example.com", "Lake Road Burgers", "f".repeat(64)).params),
    /already used a free trial/,
  );

  await db.exec("set role anon");
  await assert.rejects(
    () => db.query(firstCall.text, firstCall.params),
    /permission denied/i,
  );
  await db.exec("reset role");

  const ownerView = await asUser(db, AGENCY_USER, `select count(*)::int as n from workspace_trials`);
  assert.ok(ownerView.rows[0].n >= 1);
  const otherView = await asUser(db, OTHER_USER, `select count(*)::int as n from workspace_trials`);
  assert.equal(otherView.rows[0].n, 0);
  const eastcView = await asUser(db, EASTC_USER, `select count(*)::int as n from workspace_trials`);
  assert.equal(eastcView.rows[0].n, 0);

  const claim = await asUser(db, PROSPECT, `select public.claim_free_trial() as result`);
  assert.equal(claim.rows[0].result.slug, "lake-road-burgers");
  assert.equal(claim.rows[0].result.sending_enabled, false);
  const member = await db.query(
    `select role from memberships where user_id = '${PROSPECT}' and org_id = $1`,
    [orgId],
  );
  assert.equal(member.rows[0].role, "client_admin");
});
