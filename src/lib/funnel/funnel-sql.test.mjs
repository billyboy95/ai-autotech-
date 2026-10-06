import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const STAFF_USER = "33333333-3333-4333-8333-333333333333";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const TOKEN = "a".repeat(64);

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function apply(db) {
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
    "20261021120000_phase3a_conversation_ai.sql",
    "20261022120000_phase3b_calendars.sql",
    "20261112120000_phase5p_sales_funnel.sql",
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

test("phase 5p does not send, spend, or create a calendar by itself", () => {
  const sql = migration("20261112120000_phase5p_sales_funnel.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/insert\s+into\s+(public\.)?crm_outbox/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/perform\s+public\.ensure_results_call_calendar/i.test(sql), false);
  assert.match(sql, /accessible_org_ids/);
  assert.match(sql, /has_org_role/);
  assert.match(sql, /crm_notifications/);
  assert.match(sql, /crm_audit_reports/);
  assert.match(sql, /ensure_results_call_calendar/);
  assert.match(sql, /status = 'approved'/);
  assert.match(sql, /sent', false/);
});

test("owner alerts, draft reports, and the results-call helper stay inside the workspace", async () => {
  const db = new PGlite();
  await apply(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@sandbox.example'),
      ('${STAFF_USER}', 'staff@sandbox.example'),
      ('${EASTC_USER}', 'eastc@sandbox.example');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${STAFF_USER}', id, 'agency_staff' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
  `);
  const org = await db.query(`select id from organizations where slug = 'ai-autotech'`);
  const orgId = org.rows[0].id;
  const flags = await db.query(`select sending_enabled from organizations`);
  assert.equal(flags.rows.every((row) => row.sending_enabled === false), true);

  const created = await asUser(
    db,
    AGENCY_USER,
    `select public.ensure_results_call_calendar($1) as result`,
    [orgId],
  );
  assert.equal(created.rows[0].result.created, true);
  assert.equal(created.rows[0].result.sent, false);
  assert.equal(created.rows[0].result.slug, "results-call");
  const again = await asUser(db, AGENCY_USER, `select public.ensure_results_call_calendar($1) as result`, [orgId]);
  assert.equal(again.rows[0].result.created, false);
  assert.equal(again.rows[0].result.slug, "results-call");
  assert.equal(again.rows[0].result.calendar_id, created.rows[0].result.calendar_id);

  await assert.rejects(
    asUser(db, STAFF_USER, `select public.ensure_results_call_calendar($1)`, [orgId]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, EASTC_USER, `select public.ensure_results_call_calendar($1)`, [orgId]),
    /not allowed/i,
  );

  const note = await asUser(
    db,
    AGENCY_USER,
    `select public.record_owner_notification($1, 'audit', 'New audit', 'Internal', '/command-centre/leads/lead-1', 'lead-1', 'audit:one') as result`,
    [orgId],
  );
  const duplicate = await asUser(
    db,
    AGENCY_USER,
    `select public.record_owner_notification($1, 'audit', 'New audit', 'Internal', '/command-centre/leads/lead-1', 'lead-1', 'audit:one') as result`,
    [orgId],
  );
  assert.equal(duplicate.rows[0].result.id, note.rows[0].result.id);
  assert.equal(duplicate.rows[0].result.sent, false);
  const count = await db.query(`select count(*)::int as n from crm_notifications where org_id = $1`, [orgId]);
  assert.equal(count.rows[0].n, 1);

  await assert.rejects(
    asUser(db, EASTC_USER, `select public.record_owner_notification($1, 'audit', 'Nope', '', '/command-centre/notifications', '', 'audit:eastc')`, [orgId]),
    /not allowed/i,
  );
  const hidden = await asUser(db, EASTC_USER, `select count(*)::int as n from crm_notifications`);
  assert.equal(hidden.rows[0].n, 0);
  await assert.rejects(
    asUser(
      db,
      AGENCY_USER,
      `insert into crm_notifications (org_id, kind, title, dedupe_key) values ($1, 'audit', 'Direct', 'audit:direct')`,
      [orgId],
    ),
    /permission denied|row-level security/i,
  );

  await db.exec(`
    insert into crm_audit_leads (id, reference, org_id, company, share_token, consent)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'AAT-SQL', '${orgId}', 'Ndlovu Dental', '${TOKEN}', true);
  `);
  const draft = await db.query(
    `select public.save_audit_report_draft($1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'lead-1', 'Audit report', 'Draft only', '[]'::jsonb, false) as result`,
    [orgId],
  );
  assert.equal(draft.rows[0].result.sent, false);
  const hiddenReport = await db.query(`select public.approved_audit_report_for_token($1) as result`, [TOKEN]);
  assert.equal(hiddenReport.rows[0].result, null);
  await db.query(
    `update crm_audit_reports set status = 'approved', approved_by = '${AGENCY_USER}' where id = $1`,
    [draft.rows[0].result.id],
  );
  const visible = await db.query(`select public.approved_audit_report_for_token($1) as result`, [TOKEN]);
  assert.equal(visible.rows[0].result.title, "Audit report");
  assert.equal(visible.rows[0].result.booking_slug, "results-call");
  assert.equal(JSON.stringify(visible.rows[0].result).includes("@"), false);
});
