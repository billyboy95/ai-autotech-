import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const AGENCY_ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const OTHER_ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const CONSENT = "I agree that EASTC may store my name, phone, and email for this booking.";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

function nextMondayNineJohannesburg() {
  const now = new Date();
  const day = now.getUTCDay();
  let add = (1 - day + 7) % 7;
  if (add < 2) add += 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add, 7, 0, 0)).toISOString();
}

async function applyCalendars(db) {
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
    "20260926160000_agency_tenancy.sql",
    "20260926200000_phase2a_access.sql",
    "20261015120000_org_scope_phase1_tables.sql",
    "20261015140000_phase2b_channels_popia.sql",
    "20261016120000_phase2c_snapshots.sql",
    "20261017120000_phase2d_workflows.sql",
    "20261018120000_phase2e_inbox.sql",
    "20261021120000_phase3a_conversation_ai.sql",
    "20261022120000_phase3b_calendars.sql",
  ]) {
    await db.exec(migration(name));
  }
}

async function asUser(db, userId, sql, params = []) {
  await db.exec("reset role");
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
  await db.exec("set role authenticated");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

test("phase 3b migration does not turn sending on or write the outbox", () => {
  const sql = migration("20261022120000_phase3b_calendars.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/insert\s+into\s+(public\.)?crm_outbox/i.test(sql), false);
  assert.match(sql, /appointment\.booked/);
  assert.match(sql, /no appointment_booked value/);
  assert.doesNotMatch(sql, /'appointment_booked'/);
  assert.match(sql, /consent required/);
  assert.match(sql, /inbox_assigned_visible/);
  assert.match(sql, /crm_appointments/);
});

test("consent, workspace isolation, and assigned_only", async () => {
  const db = new PGlite();
  await applyCalendars(db);
  const starts = nextMondayNineJohannesburg();
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${EASTC_USER}', 'staff@eastc.co.za'),
      ('${EASTC_ADMIN}', 'admin@eastc.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za');

    insert into organizations (id, name, slug, org_type, form_key)
    values ('${OTHER_ORG}', 'Other Agency', 'other-agency', 'agency', 'other-agency');

    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_ADMIN}', id, 'client_admin' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_USER}', id, 'agency_owner' from organizations where slug = 'other-agency';

    insert into calendars (id, org_id, name, timezone)
    values
      ('c1111111-1111-4111-8111-111111111111', '${EASTC_ORG}', 'EASTC bookings', 'Africa/Johannesburg'),
      ('c2222222-2222-4222-8222-222222222222', '${AGENCY_ORG}', 'Agency bookings', 'Africa/Johannesburg'),
      ('c3333333-3333-4333-8333-333333333333', '${OTHER_ORG}', 'Other bookings', 'Africa/Johannesburg');

    insert into calendar_availability (org_id, calendar_id, kind, weekday, start_minute, end_minute)
    values ('${EASTC_ORG}', 'c1111111-1111-4111-8111-111111111111', 'weekly', 1, 540, 1020);

    insert into calendar_event_types (id, org_id, calendar_id, name, duration_minutes)
    values
      ('d1111111-1111-4111-8111-111111111111', '${EASTC_ORG}', 'c1111111-1111-4111-8111-111111111111', 'Audit', 20),
      ('d2222222-2222-4222-8222-222222222222', '${AGENCY_ORG}', 'c2222222-2222-4222-8222-222222222222', 'Agency audit', 20),
      ('d3333333-3333-4333-8333-333333333333', '${OTHER_ORG}', 'c3333333-3333-4333-8333-333333333333', 'Other audit', 20);

    insert into booking_links (id, org_id, event_type_id, slug)
    values ('e1111111-1111-4111-8111-111111111111', '${EASTC_ORG}', 'd1111111-1111-4111-8111-111111111111', 'eastc-audit');

    insert into crm_contacts (id, org_id, first_name, email)
    values
      ('f1111111-1111-4111-8111-111111111111', '${EASTC_ORG}', 'Assigned', 'assigned@eastc.co.za'),
      ('f2222222-2222-4222-8222-222222222222', '${AGENCY_ORG}', 'Agency', 'agency@aiautotech.co.za'),
      ('f3333333-3333-4333-8333-333333333333', '${OTHER_ORG}', 'Other', 'other@example.com');

    insert into crm_appointments (
      org_id, calendar_id, event_type_id, contact_id, assigned_user_id,
      starts_at, ends_at, guest_name, guest_email, consent_accepted, consent_text, consent_at
    ) values
      (
        '${EASTC_ORG}', 'c1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111',
        'f1111111-1111-4111-8111-111111111111', '${EASTC_USER}',
        '${starts}'::timestamptz + interval '3 hours', '${starts}'::timestamptz + interval '3 hours 20 minutes',
        'Assigned guest', 'assigned@eastc.co.za', true, '${CONSENT}', now()
      ),
      (
        '${AGENCY_ORG}', 'c2222222-2222-4222-8222-222222222222', 'd2222222-2222-4222-8222-222222222222',
        'f2222222-2222-4222-8222-222222222222', null,
        '${starts}', '${starts}'::timestamptz + interval '20 minutes',
        'Agency guest', 'agency@aiautotech.co.za', true, '${CONSENT}', now()
      ),
      (
        '${OTHER_ORG}', 'c3333333-3333-4333-8333-333333333333', 'd3333333-3333-4333-8333-333333333333',
        'f3333333-3333-4333-8333-333333333333', '${OTHER_USER}',
        '${starts}', '${starts}'::timestamptz + interval '20 minutes',
        'Other guest', 'other@example.com', true, '${CONSENT}', now()
      );
  `);

  const flags = await db.query("select sending_enabled from organizations where slug in ('ai-autotech', 'eastc')");
  assert.equal(flags.rows.every((row) => row.sending_enabled === false), true);

  await assert.rejects(
    () => db.query(
      `insert into crm_appointments (
        org_id, calendar_id, event_type_id, starts_at, ends_at, consent_accepted, consent_text
      ) values (
        '${EASTC_ORG}', 'c1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111',
        now() + interval '3 days', now() + interval '3 days 20 minutes', false, ''
      )`,
    ),
    /consent/i,
  );

  await assert.rejects(
    () => db.query(
      "select public.book_public_appointment($1, $2, $3, $4, $5, false, $6)",
      ["eastc-audit", starts, "No Consent", "0821111111", "noconsent@example.com", CONSENT],
    ),
    /consent required/,
  );

  const outboxBefore = await db.query("select count(*)::int as n from crm_outbox");
  const booked = await db.query(
    "select public.book_public_appointment($1, $2, $3, $4, $5, true, $6) as result",
    ["eastc-audit", starts, "Sipho Dlamini", "0821234567", "sipho@example.com", CONSENT],
  );
  const result = booked.rows[0].result;
  assert.equal(result.ok, true);
  assert.ok(result.appointment_id);
  assert.ok(result.contact_id);
  assert.ok(result.lead_id);

  const appointment = await db.query("select status, consent_accepted, consent_text, guest_email from crm_appointments where id = $1", [result.appointment_id]);
  assert.equal(appointment.rows[0].status, "scheduled");
  assert.equal(appointment.rows[0].consent_accepted, true);
  assert.equal(appointment.rows[0].consent_text, CONSENT);
  assert.equal(appointment.rows[0].guest_email, "sipho@example.com");

  const contact = await db.query("select email, phone_e164, lead_id from crm_contacts where id = $1", [result.contact_id]);
  assert.equal(contact.rows[0].email, "sipho@example.com");
  assert.equal(contact.rows[0].phone_e164, "+27821234567");
  assert.equal(contact.rows[0].lead_id, result.lead_id);

  const lead = await db.query("select stage, source, enrolled, marketing_consent from crm_leads where id = $1", [result.lead_id]);
  assert.equal(lead.rows[0].stage, "Audit booked");
  assert.equal(lead.rows[0].source, "booking");
  assert.equal(lead.rows[0].enrolled, false);
  assert.equal(lead.rows[0].marketing_consent, false);

  const consents = await db.query(
    "select channel, purpose, status from contact_consents where contact_id = $1 order by channel",
    [result.contact_id],
  );
  assert.deepEqual(consents.rows.map((row) => row.purpose), ["service", "service"]);
  assert.equal(consents.rows.every((row) => row.status === "opted_in"), true);
  const marketing = await db.query(
    "select count(*)::int as n from contact_consents where contact_id = $1 and purpose = 'marketing'",
    [result.contact_id],
  );
  assert.equal(marketing.rows[0].n, 0);

  const event = await db.query(
    "select type, subject_id, payload->>'starts_at' as starts_at from events where idempotency_key = $1",
    [`appointment.booked:${result.appointment_id}`],
  );
  assert.equal(event.rows[0].type, "appointment.booked");
  assert.equal(event.rows[0].subject_id, result.lead_id);
  assert.ok(event.rows[0].starts_at);

  const outboxAfter = await db.query("select count(*)::int as n from crm_outbox");
  assert.equal(outboxAfter.rows[0].n, outboxBefore.rows[0].n);
  const sending = await db.query("select bool_or(sending_enabled) as sending from organizations");
  assert.equal(sending.rows[0].sending, false);

  await assert.rejects(
    () => db.query(
      "select public.book_public_appointment($1, $2, $3, $4, $5, true, $6)",
      ["eastc-audit", starts, "Second Person", "0830000000", "second@example.com", CONSENT],
    ),
    /slot taken/,
  );

  const catalog = await db.query("select public.public_booking_catalog('eastc-audit') as payload");
  const body = JSON.stringify(catalog.rows[0].payload);
  assert.equal(body.includes("sipho@example.com"), false);
  assert.equal(body.includes("0821234567"), false);
  assert.match(body, /Audit/);

  const eastcUser = await asUser(db, EASTC_USER, "select guest_name from crm_appointments order by guest_name");
  assert.deepEqual(eastcUser.rows.map((row) => row.guest_name), ["Assigned guest"]);

  const eastcAdmin = await asUser(db, EASTC_ADMIN, "select guest_name from crm_appointments order by guest_name");
  assert.deepEqual(eastcAdmin.rows.map((row) => row.guest_name), ["Assigned guest", "Sipho Dlamini"]);

  const other = await asUser(db, OTHER_USER, "select guest_name from crm_appointments");
  assert.deepEqual(other.rows.map((row) => row.guest_name), ["Other guest"]);

  const agency = await asUser(db, AGENCY_USER, "select guest_name from crm_appointments order by guest_name");
  assert.deepEqual(agency.rows.map((row) => row.guest_name), ["Agency guest", "Assigned guest", "Sipho Dlamini"]);

  await db.exec("reset role");
  await db.exec("set role anon");
  await assert.rejects(() => db.query("select * from crm_appointments"));
  await db.exec("reset role");
});
