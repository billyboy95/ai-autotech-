import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  PHASE_FROM,
  PHASE_TO,
  eastcPeriodFixture,
  metricsMatch,
  parsePeriodMetrics,
  periodMetrics,
  type PeriodInput,
  zentrixPeriodFixture,
} from "@/lib/agency/metrics";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const STAFF = "44444444-4444-4444-8444-444444444444";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const AGENCY_ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const ZENTRIX_ORG = "12121212-1212-4121-8121-121212121212";
const OTHER_AGENCY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const OTHER_CLIENT = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";

const CONV: Record<string, string> = {
  "conv-a": "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
  "conv-b": "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
  "conv-c": "dddddddd-dddd-4ddd-8ddd-ddddddddddd3",
  "conv-d": "dddddddd-dddd-4ddd-8ddd-ddddddddddd4",
  "conv-e": "dddddddd-dddd-4ddd-8ddd-ddddddddddd5",
};

function migration(name: string) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

function sqlText(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function applyRollup(db: PGlite) {
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
  await db.exec(migration("20260926160000_crm_automation.sql"));
  await db.exec(migration("20260926160000_agency_tenancy.sql"));
  await db.exec(migration("20260926200000_phase2a_access.sql"));
  await db.exec(migration("20261015120000_org_scope_phase1_tables.sql"));
  await db.exec(migration("20261015140000_phase2b_channels_popia.sql"));
  await db.exec(migration("20261016120000_phase2c_snapshots.sql"));
  await db.exec(migration("20261017120000_phase2d_workflows.sql"));
  await db.exec(migration("20261018120000_phase2e_inbox.sql"));
  await db.exec(migration("20261019120000_phase2f_billing.sql"));
  await db.exec(migration("20261020120000_phase2g_agency_rollup.sql"));
}

async function asUser(db: PGlite, userId: string, sql: string, params: unknown[] = []) {
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

async function seedOrg(db: PGlite, orgId: string, fixture: PeriodInput, leadPrefix: string, leadName: string) {
  const anchor = `${leadPrefix}-anchor`;
  const leadRows = fixture.leads
    .map((lead, index) => {
      const name = index === 0 ? leadName : `${leadPrefix} ${index}`;
      return `(${sqlText(`${leadPrefix}-${index}`)}, ${sqlText(name)}, ${sqlText(lead.stage)}, ${lead.valueZar}, ${sqlText(lead.createdAt)}::timestamptz, ${lead.wonAt ? `${sqlText(lead.wonAt)}::timestamptz` : "null"}, ${lead.stageChangedAt ? `${sqlText(lead.stageChangedAt)}::timestamptz` : `${sqlText(lead.createdAt)}::timestamptz`}, '${orgId}')`;
    })
    .join(",\n");
  if (leadRows) {
    await db.exec(`
      insert into crm_leads (id, name, stage, value_zar, created_at, won_at, stage_changed_at, org_id)
      values ${leadRows};
    `);
  } else {
    await db.exec(`
      insert into crm_leads (id, name, stage, value_zar, created_at, org_id)
      values (${sqlText(anchor)}, ${sqlText(leadName)}, 'New', 0, '2026-08-01T00:00:00Z', '${orgId}');
    `);
  }

  const channels = new Map<string, string>();
  for (const message of fixture.messages) channels.set(message.conversationId, message.channel);
  if (channels.size) {
    const conversationRows = [...channels.entries()]
      .map(
        ([key, channel]) =>
          `('${CONV[key]}', '${orgId}', ${sqlText(channel)}, '2099-01-01T00:00:00Z'::timestamptz)`,
      )
      .join(",\n");
    await db.exec(`
      insert into conversations (id, org_id, channel, wa_window_expires_at)
      values ${conversationRows};
    `);
  }

  const outboxLead = fixture.leads.length ? `${leadPrefix}-0` : anchor;
  if (fixture.outbox.length) {
    const outboxRows = fixture.outbox
      .map(
        (row) =>
          `(${sqlText(row.id)}, ${sqlText(outboxLead)}, 'email', ${sqlText(row.status)}, ${sqlText(row.createdAt)}::timestamptz, '${orgId}')`,
      )
      .join(",\n");
    await db.exec(`
      insert into crm_outbox (id, lead_id, channel, status, created_at, org_id)
      values ${outboxRows};
    `);
  }

  if (fixture.messages.length) {
    const messageRows = fixture.messages
      .map(
        (message) =>
          `('${orgId}', '${CONV[message.conversationId]}', ${sqlText(message.direction)}, ${sqlText(message.channel)}, ${sqlText(message.status)}, ${sqlText(message.createdAt)}::timestamptz, ${message.outboxId ? sqlText(message.outboxId) : "null"})`,
      )
      .join(",\n");
    await db.exec(`
      insert into messages (org_id, conversation_id, direction, channel, status, created_at, outbox_id)
      values ${messageRows};
    `);
  }

  if (fixture.usage.length) {
    const usageRows = fixture.usage
      .map(
        (row, index) =>
          `('${orgId}', ${sqlText(row.meter)}, ${row.quantity}, ${row.costCents}, ${row.unitPriceCents}, ${row.costCents}, 'outbox', ${sqlText(`${leadPrefix}-usage-${index}`)}, ${sqlText(row.occurredAt)}::timestamptz)`,
      )
      .join(",\n");
    await db.exec(`
      insert into usage_ledger (org_id, meter, quantity, unit_cost_cents, unit_price_cents, cost_cents, source_type, source_id, occurred_at)
      values ${usageRows};
    `);
  }

  if (fixture.consents.length) {
    const consentRows = fixture.consents
      .map(
        (row) =>
          `('${orgId}', 'sms', 'marketing', ${sqlText(row.status)}, 'consent', 'person@example.test', ${sqlText(row.capturedAt)}::timestamptz, ${row.withdrawnAt ? `${sqlText(row.withdrawnAt)}::timestamptz` : "null"})`,
      )
      .join(",\n");
    await db.exec(`
      insert into contact_consents (org_id, channel, purpose, status, basis, address, captured_at, withdrawn_at)
      values ${consentRows};
    `);
  }

  for (const [index, run] of fixture.failedWorkflows.entries()) {
    const event = await db.query<{ id: string }>(
      `insert into events (org_id, type, subject_type, subject_id, occurred_at)
       values ($1, 'lead.created', 'lead', $2, $3::timestamptz)
       returning id`,
      [orgId, `${leadPrefix}-event-${index}`, run.updatedAt],
    );
    const workflow = await db.query<{ id: string }>(
      `insert into workflows (org_id, asset_key, name, trigger_type)
       values ($1, $2, 'Fixture', 'lead.created')
       returning id`,
      [orgId, `${leadPrefix}-flow-${index}`],
    );
    await db.query(
      `insert into workflow_runs (org_id, workflow_id, subject_id, event_id, dedupe_key, status, updated_at)
       values ($1, $2, $3, $4, $5, 'failed', $6::timestamptz)`,
      [orgId, workflow.rows[0].id, `${leadPrefix}-subject`, event.rows[0].id, `${leadPrefix}-run-${index}`, run.updatedAt],
    );
  }

  if (fixture.subscriptionStatus) {
    await db.query(
      `insert into org_subscriptions (org_id, plan_code, provider, status, sandbox)
       values ($1, 'starter', 'manual', $2, true)`,
      [orgId, fixture.subscriptionStatus],
    );
  }
}

function assertSameMetrics(actual: unknown, expectedInput: PeriodInput, label: string) {
  const payload = typeof actual === "string" ? JSON.parse(actual) : actual;
  const parsed = parsePeriodMetrics(payload);
  assert.ok(parsed, `${label} metrics missing`);
  const expected = periodMetrics(expectedInput);
  assert.equal(
    metricsMatch(parsed, expected),
    true,
    `${label}\n${JSON.stringify(parsed)}\n${JSON.stringify(expected)}`,
  );
  return parsed;
}

test("phase 2g migration keeps sending off and exposes the rollup functions", () => {
  const sql = migration("20261020120000_phase2g_agency_rollup.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.match(sql, /function public\.agency_rollup/);
  assert.match(sql, /function public\.resolve_custom_domain/);
  assert.match(sql, /function public\.workspace_period_metrics/);
  assert.match(sql, /agency membership required/);
});

test("agency rollup matches workspace period metrics and denies a client admin", async () => {
  const db = new PGlite();
  await applyRollup(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${EASTC_ADMIN}', 'admin@eastc.co.za'),
      ('${STAFF}', 'staff@aiautotech.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za');
    insert into organizations (id, name, slug, org_type, form_key)
    values ('${OTHER_AGENCY}', 'Other Agency', 'other-agency', 'agency', 'other-agency');
    insert into organizations (id, name, slug, org_type, parent_id, form_key)
    values ('${ZENTRIX_ORG}', 'Zentrix Online', 'zentrix', 'client', '${AGENCY_ORG}', 'zentrix');
    insert into organizations (id, name, slug, org_type, parent_id, form_key)
    values ('${OTHER_CLIENT}', 'Other Client', 'other-client', 'client', '${OTHER_AGENCY}', 'other-client');
    update organizations
    set custom_domain = 'crm.eastc.test',
        branding = '{"enabled":true,"showPlatformName":false,"productName":"EASTC"}'::jsonb
    where id = '${EASTC_ORG}';
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_ADMIN}', id, 'client_admin' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_USER}', id, 'agency_owner' from organizations where slug = 'other-agency';
    insert into memberships (user_id, org_id, role)
    select '${STAFF}', id, 'agency_staff' from organizations where slug = 'ai-autotech';
    insert into member_org_access (member_id, org_id)
    select id, '${EASTC_ORG}' from memberships where user_id = '${STAFF}';
  `);

  await seedOrg(db, EASTC_ORG, eastcPeriodFixture, "eastc", "Secret Pipeline Lead");
  await seedOrg(db, ZENTRIX_ORG, zentrixPeriodFixture, "zentrix", "Zentrix lead");
  await db.exec(`
    insert into crm_leads (id, name, stage, value_zar, created_at, org_id)
    values ('other-lead', 'Other pipeline', 'New', 99999, '2026-09-02T09:00:00Z', '${OTHER_CLIENT}');
  `);

  const rollup = await asUser(
    db,
    AGENCY_USER,
    `select org_id, slug, metrics from public.agency_rollup($1, $2::timestamptz, $3::timestamptz) order by name`,
    [AGENCY_ORG, PHASE_FROM, PHASE_TO],
  );
  assert.deepEqual(
    rollup.rows.map((row) => row.slug),
    ["eastc", "zentrix"],
  );
  const eastcRow = rollup.rows.find((row) => row.slug === "eastc");
  const zentrixRow = rollup.rows.find((row) => row.slug === "zentrix");
  assert.ok(eastcRow);
  assert.ok(zentrixRow);
  const eastcMetrics = assertSameMetrics(eastcRow.metrics, eastcPeriodFixture, "eastc rollup");
  assertSameMetrics(zentrixRow.metrics, zentrixPeriodFixture, "zentrix rollup");
  assert.equal(JSON.stringify(eastcMetrics).includes("99999"), false);

  const dashboard = await asUser(
    db,
    EASTC_ADMIN,
    `select public.workspace_period_metrics($1, $2::timestamptz, $3::timestamptz) as metrics`,
    [EASTC_ORG, PHASE_FROM, PHASE_TO],
  );
  const dashboardMetrics = assertSameMetrics(dashboard.rows[0].metrics, eastcPeriodFixture, "eastc dashboard");
  assert.equal(metricsMatch(dashboardMetrics, eastcMetrics), true);

  await assert.rejects(
    asUser(
      db,
      EASTC_ADMIN,
      `select * from public.agency_rollup($1, $2::timestamptz, $3::timestamptz)`,
      [AGENCY_ORG, PHASE_FROM, PHASE_TO],
    ),
    /agency membership required/,
  );
  await assert.rejects(
    asUser(
      db,
      EASTC_ADMIN,
      `select public.workspace_period_metrics($1, $2::timestamptz, $3::timestamptz)`,
      [AGENCY_ORG, PHASE_FROM, PHASE_TO],
    ),
    /workspace access required/,
  );
  await assert.rejects(
    asUser(
      db,
      OTHER_USER,
      `select * from public.agency_rollup($1, $2::timestamptz, $3::timestamptz)`,
      [AGENCY_ORG, PHASE_FROM, PHASE_TO],
    ),
    /agency membership required/,
  );

  const staff = await asUser(
    db,
    STAFF,
    `select slug from public.agency_rollup($1, $2::timestamptz, $3::timestamptz) order by slug`,
    [AGENCY_ORG, PHASE_FROM, PHASE_TO],
  );
  assert.deepEqual(
    staff.rows.map((row) => row.slug),
    ["eastc"],
  );

  await assert.rejects(
    asUser(
      db,
      AGENCY_USER,
      `select public.period_metrics_for_org($1, $2::timestamptz, $3::timestamptz)`,
      [EASTC_ORG, PHASE_FROM, PHASE_TO],
    ),
    /permission denied/i,
  );

  await db.exec("reset role");
  await db.exec("set role anon");
  try {
    const brand = await db.query(`select public.resolve_custom_domain('crm.eastc.test') as brand`);
    const payload = brand.rows[0].brand as { slug?: string };
    assert.equal(payload.slug, "eastc");
    assert.equal(JSON.stringify(payload).includes("Secret Pipeline Lead"), false);
    await assert.rejects(
      db.query(`select * from public.agency_rollup('${AGENCY_ORG}', '${PHASE_FROM}'::timestamptz, '${PHASE_TO}'::timestamptz)`),
      /permission denied/i,
    );
  } finally {
    await db.exec("reset role");
  }

  const sending = await db.query(
    `select slug, sending_enabled from organizations where slug in ('ai-autotech', 'eastc') order by slug`,
  );
  assert.deepEqual(
    sending.rows.map((row) => ({ slug: row.slug, sending_enabled: row.sending_enabled })),
    [
      { slug: "ai-autotech", sending_enabled: false },
      { slug: "eastc", sending_enabled: false },
    ],
  );
});
