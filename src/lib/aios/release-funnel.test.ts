import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { marketingConsentText } from "@/lib/compliance/consent-copy";
import { draftOwnerNotification } from "@/lib/funnel/notify";
import { buildAuditReport } from "@/lib/funnel/report";
import { isSalesFunnelEnabled } from "@/lib/funnel/flag";
import { freeTrialEnabled } from "@/lib/trial/trial";
import { isSalesAgentsEnabled } from "@/lib/sales-agents/flag";
import { commissionsMode } from "@/lib/commissions/flag";
import { workspaceTemplatesEnabled } from "@/lib/snapshots/swap";
import {
  choosePublicIntakeOrg,
  crmLeadMirror,
  intakeContactRow,
  publicFormSource,
} from "@/lib/aios/public-intake";
import {
  channelSnapshots,
  planAuditFollowUp,
  planOnboarding,
  planStop,
} from "@/lib/sales-agents/plan";
import { PROVISION_SQL } from "../../../scripts/provision-ai-autotech.mjs";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const AUDIT_ID = "c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1";
const LEAD_ID = "lead-ndlovu";
const SHARE = "ab".repeat(32);
const IP = "e".repeat(64);
const NOW = "2026-10-06T08:00:00.000Z";
const SLOT = "2026-11-10T07:00:00.000Z";
const CONSENT = marketingConsentText("AI AutoTech");

function migration(name: string) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyRelease(db: PGlite) {
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
    "20261112120500_phase5p_salesperson_commissions.sql",
    "20261112140000_phase5q_sales_agents.sql",
  ]) {
    await db.exec(migration(name));
  }
}

async function asUser(db: PGlite, userId: string, sql: string, params: unknown[] = []) {
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

test("public intake prefers the marked AI AutoTech client and keeps the flags off", () => {
  assert.equal(publicFormSource("/guide/week-1"), "website_guide");
  assert.equal(publicFormSource("contact"), "website_contact");
  const agency = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  const client = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  assert.equal(
    choosePublicIntakeOrg([
      { id: agency, slug: "ai-autotech", settings: {} },
      { id: client, slug: "aiautotech", settings: {} },
    ]),
    agency,
  );
  assert.equal(
    choosePublicIntakeOrg([
      { id: agency, slug: "ai-autotech", settings: {} },
      { id: client, slug: "aiautotech", settings: { public_intake: "aiautotech" } },
    ]),
    client,
  );
  assert.equal(isSalesFunnelEnabled({}), false);
  assert.equal(workspaceTemplatesEnabled({}), false);
  assert.equal(freeTrialEnabled({}), false);
  assert.equal(commissionsMode({}), "fixture");
  assert.equal(isSalesAgentsEnabled({}), false);
});

test("the release funnel walks audit, booking, trial, won, onboarding, and commission without sending", async () => {
  const db = new PGlite();
  await applyRelease(db);
  await db.exec(`
    insert into auth.users (id, email) values ('${AGENCY_USER}', 'billyfaber06@gmail.com');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
  `);

  await db.exec(PROVISION_SQL);
  await db.exec(PROVISION_SQL);
  const client = await db.query<{
    id: string;
    name: string;
    domain: string;
    sender_name: string;
    sending_enabled: boolean;
    form_key: string;
    website: string;
    booking_url: string;
    from_address: string;
    intake: string;
  }>(`
    select id, name, domain, sender_name, sending_enabled, form_key,
      settings->>'website' as website,
      settings->>'booking_url' as booking_url,
      settings#>>'{channels,email,fromAddress}' as from_address,
      settings->>'public_intake' as intake
    from organizations
    where slug = 'aiautotech'
  `);
  assert.equal(client.rows.length, 1);
  const orgId = client.rows[0].id;
  assert.equal(client.rows[0].name, "AI AutoTech");
  assert.equal(client.rows[0].domain, "aiautotech.co.za");
  assert.equal(client.rows[0].website, "https://aiautotech.co.za");
  assert.equal(client.rows[0].booking_url, "https://aiautotech.co.za/book");
  assert.equal(client.rows[0].from_address, "Willem@aiautotech.co.za");
  assert.equal(client.rows[0].sender_name, "AI AutoTech");
  assert.equal(client.rows[0].sending_enabled, false);
  assert.equal(client.rows[0].intake, "aiautotech");
  assert.equal(client.rows[0].form_key, "aiautotech");

  const stage = await db.query<{ id: string }>(
    `select id from pipeline_stages where org_id = $1 and name = 'New' order by position limit 1`,
    [orgId],
  );
  assert.equal(stage.rows.length, 1);

  const mirror = crmLeadMirror({
    id: LEAD_ID,
    name: "Lesego Dlamini",
    company: "Ndlovu Dental",
    phone: "0820001234",
    email: "lesego@ndlovu.example",
    notes: "AI Business Audit AAT-FUNNEL",
    source: "audit",
    website: "https://ndlovu.example",
    industry: "Dental",
    ord: -1,
    auditLeadId: AUDIT_ID,
    stageId: stage.rows[0].id,
  });
  const contact = intakeContactRow({
    name: "Lesego Dlamini",
    email: "lesego@ndlovu.example",
    phone: "0820001234",
    company: "Ndlovu Dental",
    leadId: LEAD_ID,
    source: "audit",
  });
  assert.equal(contact.phone_e164, "+27820001234");
  assert.equal(mirror.email, "lesego@ndlovu.example");
  assert.equal(mirror.audit_lead_id, AUDIT_ID);

  await db.query(
    `insert into crm_audit_leads (
      id, reference, org_id, first_name, last_name, company, email, phone, website, industry,
      consent, consent_text, crm_lead_id, share_token
    ) values (
      $1, 'AAT-FUNNEL', $2, 'Lesego', 'Dlamini', 'Ndlovu Dental', 'lesego@ndlovu.example', '0820001234',
      'https://ndlovu.example', 'Dental', true, $3, $4, $5
    )`,
    [AUDIT_ID, orgId, CONSENT, LEAD_ID, SHARE],
  );
  await db.query(
    `insert into crm_leads (
      id, org_id, name, company, phone, email, stage, notes, source, website, industry,
      audit_lead_id, stage_id, ord, marketing_consent, enrolled
    ) values (
      $1, $2, $3, $4, $5, $6, 'New', $7, 'audit', $8, 'Dental', $9, $10, -1, false, false
    )`,
    [
      mirror.id,
      orgId,
      mirror.name,
      mirror.company,
      mirror.phone,
      mirror.email,
      mirror.notes,
      mirror.website,
      mirror.audit_lead_id,
      mirror.stage_id,
    ],
  );
  await db.query(
    `insert into crm_contacts (
      org_id, first_name, last_name, email, phone_e164, whatsapp_e164, company, lead_id, tags, custom
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, '{}', $9::jsonb)`,
    [
      orgId,
      contact.first_name,
      contact.last_name,
      contact.email,
      contact.phone_e164,
      contact.whatsapp_e164,
      contact.company,
      contact.lead_id,
      JSON.stringify(contact.custom),
    ],
  );

  const note = draftOwnerNotification({
    kind: "audit",
    name: mirror.name,
    company: mirror.company,
    phone: mirror.phone,
    leadId: LEAD_ID,
    sourceId: AUDIT_ID,
    detail: "AAT-FUNNEL",
  });
  const storedNote = await db.query<{ result: { id: string; sent: boolean } }>(
    `select public.record_owner_notification($1, $2, $3, $4, $5, $6, $7) as result`,
    [orgId, note.kind, note.title, note.body, note.href, note.leadId, note.dedupeKey],
  );
  assert.equal(storedNote.rows[0].result.sent, false);
  assert.ok(storedNote.rows[0].result.id);

  const report = buildAuditReport({
    company: "Ndlovu Dental",
    industry: "Dental",
    website: "https://ndlovu.example",
    answers: { hours: "4 hours a week" },
    score: { readiness: 42 },
    recommendations: [{ agent: "WhatsApp receptionist" }],
    recommendedAgents: [],
  });
  const savedReport = await db.query<{ result: { id: string; status: string; sent: boolean } }>(
    `select public.save_audit_report_draft($1, $2, $3, $4, $5, $6::jsonb, false) as result`,
    [orgId, AUDIT_ID, LEAD_ID, report.title, report.narrative, JSON.stringify(report.sections)],
  );
  assert.equal(savedReport.rows[0].result.status, "draft");
  assert.equal(savedReport.rows[0].result.sent, false);

  const approved = await asUser(
    db,
    AGENCY_USER,
    `update crm_audit_reports
     set status = 'approved', approved_by = $2
     where org_id = $1 and audit_lead_id = $3
     returning status, approved_at`,
    [orgId, AGENCY_USER, AUDIT_ID],
  );
  assert.equal(approved.rows[0].status, "approved");
  assert.ok(approved.rows[0].approved_at);

  const channels = channelSnapshots({
    phone: mirror.phone,
    email: mirror.email,
    consents: [],
    suppressions: [],
    formConsent: { accepted: true, text: CONSENT },
  });
  const followUp = planAuditFollowUp({
    now: new Date(NOW),
    sendingEnabled: false,
    senderName: "Billy",
    name: mirror.name,
    company: mirror.company,
    leadId: LEAD_ID,
    auditLeadId: AUDIT_ID,
    reportPath: `/team/${SHARE}`,
    bookingUrl: "https://aiautotech.co.za/book",
    channels,
    trigger: "audit_arrived",
  });
  assert.equal(followUp.drafts.some((item) => item.status === "draft"), true);
  const queued = await db.query<{ result: { stored: number; sent: boolean; sending_enabled: boolean } }>(
    `select public.save_sales_agent_batch($1, $2::jsonb) as result`,
    [orgId, JSON.stringify(followUp)],
  );
  assert.equal(queued.rows[0].result.sent, false);
  assert.equal(queued.rows[0].result.sending_enabled, false);
  assert.ok(Number(queued.rows[0].result.stored) > 0);

  const calendar = await asUser(
    db,
    AGENCY_USER,
    `select public.ensure_results_call_calendar($1) as result`,
    [orgId],
  );
  assert.equal(calendar.rows[0].result.sent, false);
  const slug = String(calendar.rows[0].result.slug);
  const booked = await db.query<{ result: { ok: boolean; lead_id: string; appointment_id: string } }>(
    `select public.book_public_appointment($1, $2::timestamptz, $3, $4, $5, true, $6) as result`,
    [slug, SLOT, mirror.name, mirror.phone, mirror.email, "I agree that this workspace may store my name and contact details to book this results call."],
  );
  assert.equal(booked.rows[0].result.ok, true);
  assert.equal(booked.rows[0].result.lead_id, LEAD_ID);

  const stopped = planStop({
    sendingEnabled: false,
    name: mirror.name,
    company: mirror.company,
    leadId: LEAD_ID,
    auditLeadId: AUDIT_ID,
    stopReason: "booking",
  });
  const stopSaved = await db.query<{ result: { sent: boolean } }>(
    `select public.save_sales_agent_batch($1, $2::jsonb) as result`,
    [orgId, JSON.stringify(stopped)],
  );
  assert.equal(stopSaved.rows[0].result.sent, false);
  const followUps = await db.query<{ status: string }>(
    `select status from crm_sales_drafts where org_id = $1 and kind = 'follow_up'`,
    [orgId],
  );
  assert.equal(followUps.rows.every((row) => row.status === "skipped"), true);

  const trial = await db.query<{ result: { ok: boolean; created: boolean; slug: string; sending_enabled: boolean; charged: boolean } }>(
    `select public.start_free_trial(
      'a2c00000-0000-4000-8000-000000000001',
      'Ndlovu Dental',
      'Lesego Dlamini',
      'lesego@ndlovu.example',
      '0820001234',
      true,
      14,
      $1,
      '',
      $2::timestamptz
    ) as result`,
    [IP, NOW],
  );
  assert.equal(trial.rows[0].result.ok, true);
  assert.equal(trial.rows[0].result.created, true);
  assert.equal(trial.rows[0].result.sending_enabled, false);
  assert.equal(trial.rows[0].result.charged, false);
  assert.equal(trial.rows[0].result.slug, "ndlovu-dental");
  const trialOrg = await db.query<{ sending_enabled: boolean; n: number }>(
    `select sending_enabled,
      (select count(*)::int from pipeline_stages where org_id = organizations.id) as n
     from organizations where slug = 'ndlovu-dental'`,
  );
  assert.equal(trialOrg.rows[0].sending_enabled, false);
  assert.ok(trialOrg.rows[0].n > 0);

  await db.query(
    `update crm_leads set stage = 'Won', won_at = $2::timestamptz, value_zar = 1000 where id = $1 and org_id = $3`,
    [LEAD_ID, NOW, orgId],
  );
  const won = await db.query<{ stage: string }>(`select stage from crm_leads where id = $1`, [LEAD_ID]);
  assert.equal(won.rows[0].stage, "Won");

  const onboarding = planOnboarding({
    now: new Date(NOW),
    sendingEnabled: false,
    senderName: "Billy",
    name: mirror.name,
    company: mirror.company,
    leadId: LEAD_ID,
    sourceKey: `deal_won:${LEAD_ID}`,
    trigger: "deal_won",
    bookingUrl: "https://aiautotech.co.za/book",
    channels,
    profile: null,
  });
  assert.equal(onboarding.onboarding?.items.length, 4);
  assert.equal(onboarding.drafts.some((item) => item.status === "draft"), true);
  const welcome = await db.query<{ result: { sent: boolean; sending_enabled: boolean } }>(
    `select public.save_sales_agent_batch($1, $2::jsonb) as result`,
    [orgId, JSON.stringify(onboarding)],
  );
  assert.equal(welcome.rows[0].result.sent, false);
  assert.equal(welcome.rows[0].result.sending_enabled, false);
  const waiting = await db.query<{ n: number }>(
    `select count(*)::int as n from crm_sales_drafts where org_id = $1 and kind = 'welcome' and status = 'draft'`,
    [orgId],
  );
  assert.ok(waiting.rows[0].n > 0);
  const checklist = await db.query<{ n: number }>(
    `select count(*)::int as n from crm_client_onboarding_items where org_id = $1`,
    [orgId],
  );
  assert.equal(checklist.rows[0].n, 4);

  const person = await asUser(
    db,
    AGENCY_USER,
    `select public.save_commission_salesperson($1, null, 'Nomsa Dlamini', 'nomsa@example.com', 'NOMSA30', true, 30, 'once_off', null) as result`,
    [orgId],
  );
  assert.equal(person.rows[0].result.ok, true);
  assert.equal(person.rows[0].result.money_moved, false);
  const attributed = await asUser(
    db,
    AGENCY_USER,
    `select public.attribute_commission($1, 'code', 'NOMSA30', null, $2, null) as result`,
    [orgId, LEAD_ID],
  );
  assert.equal(attributed.rows[0].result.ok, true);
  const ledger = await asUser(
    db,
    AGENCY_USER,
    `select public.record_commission_receipt($1, $2, 100000, '2026-10-06'::date, 'eft') as result`,
    [orgId, attributed.rows[0].result.id],
  );
  assert.equal(ledger.rows[0].result.ok, true);
  assert.equal(ledger.rows[0].result.booked, true);
  assert.equal(ledger.rows[0].result.money_moved, false);
  assert.equal(ledger.rows[0].result.charged, false);
  const lines = await db.query<{ amount_cents: number; status: string }>(
    `select amount_cents, status from commission_ledger where org_id = $1`,
    [orgId],
  );
  assert.equal(lines.rows.length, 1);
  assert.equal(lines.rows[0].amount_cents, 30000);
  assert.equal(lines.rows[0].status, "pending");

  const sent = await db.query<{ n: number }>(
    `select count(*)::int as n from crm_outbox where sent_at is not null`,
  );
  assert.equal(sent.rows[0].n, 0);
  const flags = await db.query<{ sending_enabled: boolean }>(`select sending_enabled from organizations`);
  assert.equal(flags.rows.every((row) => row.sending_enabled === false), true);
});
