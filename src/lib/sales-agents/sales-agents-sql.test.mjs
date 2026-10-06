import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const AUDIT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

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
    "20261112140000_phase5q_sales_agents.sql",
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

test("phase 5q forces RLS and does not send", () => {
  const sql = migration("20261112140000_phase5q_sales_agents.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.match(sql, /force row level security/);
  assert.match(sql, /crm_sales_drafts/);
  assert.match(sql, /crm_client_onboarding/);
  assert.equal(/\bdelete from\b/i.test(sql), false);
});

test("approval queues the outbox and a skipped draft cannot be approved", async () => {
  const db = new PGlite();
  await apply(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@sandbox.example'),
      ('${EASTC_USER}', 'eastc@sandbox.example');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
  `);
  const org = await db.query(`select id from organizations where slug = 'ai-autotech'`);
  const orgId = org.rows[0].id;
  const before = await db.query(`select sending_enabled from organizations where id = $1`, [orgId]);
  assert.equal(before.rows[0].sending_enabled, false);

  await db.query(
    `insert into crm_audit_leads (id, reference, org_id, company, consent) values ($1, 'AAT-AGENT', $2, 'Ndlovu Dental', true)`,
    [AUDIT, orgId],
  );
  await db.query(
    `insert into crm_leads (id, name, company, phone, email, stage, org_id) values ('lead-sales-1', 'Lesego', 'Ndlovu Dental', '0820000000', 'lesego@prospect.example', 'New', $1)`,
    [orgId],
  );

  const saved = await db.query(`select public.save_sales_agent_batch($1, $2::jsonb) as result`, [
    orgId,
    JSON.stringify({
      sequence: { auditLeadId: AUDIT, leadId: "lead-sales-1", trigger: "audit_arrived", status: "active", stopReason: "" },
      drafts: [
        {
          dedupeKey: `follow_up:${AUDIT}:day0:whatsapp`,
          leadId: "lead-sales-1",
          kind: "follow_up",
          step: "day0",
          channel: "whatsapp",
          status: "draft",
          skipReason: "",
          subject: "Ndlovu Dental audit",
          body: "Hi Lesego. [ADD REAL RESULT]. Reply STOP to opt out.",
          scheduledFor: "2026-10-06T08:00:00.000Z",
          toAddress: "0820000000",
          purpose: "marketing",
        },
        {
          dedupeKey: `follow_up:${AUDIT}:day0:email`,
          leadId: "lead-sales-1",
          kind: "follow_up",
          step: "day0",
          channel: "email",
          status: "skipped",
          skipReason: "No marketing consent for email.",
          subject: "Ndlovu Dental audit",
          body: "",
          scheduledFor: "2026-10-06T08:00:00.000Z",
          toAddress: "lesego@prospect.example",
          purpose: "marketing",
        },
      ],
      notices: [
        {
          kind: "approval",
          title: "1 draft needs approval",
          body: "Nothing is sent.",
          href: "/command-centre/approvals",
          leadId: "lead-sales-1",
          dedupeKey: `approval:${AUDIT}:audit_arrived`,
        },
      ],
      onboarding: {
        trigger: "deal_won",
        sourceKey: "deal_won:lead-sales-1",
        leadId: "lead-sales-1",
        items: [
          { key: "connect_accounts", title: "Connect accounts", href: "/command-centre/connect-accounts", detail: "Connect" },
          { key: "import_contacts", title: "Import contacts", href: "/command-centre/import-contacts", detail: "Import" },
          { key: "apply_template", title: "Apply template", href: "/command-centre/agents/templates", detail: "Template" },
          { key: "book_kickoff", title: "Book kickoff", href: "/command-centre/calendars", detail: "Kickoff" },
        ],
      },
      cancelPending: false,
    }),
  ]);
  assert.equal(saved.rows[0].result.sent, false);
  assert.equal(saved.rows[0].result.sending_enabled, false);

  const hidden = await asUser(db, EASTC_USER, `select count(*)::int as n from crm_sales_drafts`);
  assert.equal(hidden.rows[0].n, 0);
  const visible = await asUser(db, AGENCY_USER, `select count(*)::int as n from crm_sales_drafts`);
  assert.equal(visible.rows[0].n, 2);

  const drafts = await db.query(`select id, channel, status from crm_sales_drafts where org_id = $1 order by channel`, [orgId]);
  const email = drafts.rows.find((row) => row.channel === "email");
  const wa = drafts.rows.find((row) => row.channel === "whatsapp");
  const refused = await asUser(db, AGENCY_USER, `select public.decide_sales_draft($1, $2, 'approve', '') as result`, [orgId, email.id]);
  assert.equal(refused.rows[0].result.ok, false);
  assert.equal(refused.rows[0].result.sent, false);
  const approved = await asUser(db, AGENCY_USER, `select public.decide_sales_draft($1, $2, 'approve', '') as result`, [orgId, wa.id]);
  assert.equal(approved.rows[0].result.status, "approved");
  assert.equal(approved.rows[0].result.outbox_status, "queued");
  assert.equal(approved.rows[0].result.sent, false);
  const outbox = await db.query(`select status, sent_at from crm_outbox where id = $1`, [approved.rows[0].result.outbox_id]);
  assert.equal(outbox.rows[0].status, "queued");
  assert.equal(outbox.rows[0].sent_at, null);
  const after = await db.query(`select sending_enabled from organizations where id = $1`, [orgId]);
  assert.equal(after.rows[0].sending_enabled, false);
  const items = await db.query(`select count(*)::int as n from crm_client_onboarding_items where org_id = $1`, [orgId]);
  assert.equal(items.rows[0].n, 4);
  await assert.rejects(
    asUser(db, EASTC_USER, `select public.decide_sales_draft($1, $2, 'approve', '')`, [orgId, wa.id]),
    /not allowed/i,
  );
});
