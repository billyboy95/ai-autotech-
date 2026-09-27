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
const CONSENT = "I confirm that this person agreed to a review request and can reply STOP.";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyReviews(db) {
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
    "20261023120000_phase3c_reviews.sql",
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

test("phase 3c does not turn sending on, schedule a cron, or add a review trigger", () => {
  const sql = migration("20261023120000_phase3c_reviews.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/cron\.schedule/i.test(sql), false);
  assert.equal(/AI_REPLY_CRON_ENABLED/.test(sql), false);
  assert.match(sql, /review\.received is deferred/);
  assert.doesNotMatch(sql, /'review\.received'/);
  assert.doesNotMatch(sql, /insert\s+into\s+(public\.)?events/i);
  assert.match(sql, /accessible_org_ids/);
  assert.match(sql, /review request drafts are not sent/);
  assert.match(sql, /'status', 'draft'/);
});

test("public submit, consent gate, and tenant isolation", async () => {
  const db = new PGlite();
  await applyReviews(db);
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
  `);

  const before = await db.query("select count(*)::int as n from crm_outbox");
  await assert.rejects(
    () => asUser(
      db,
      EASTC_ADMIN,
      `select public.create_review_request_draft(
        '${EASTC_ORG}'::uuid, 'sms', '0825551234', 'Thabo', '',
        'Hi {{name}} {{link}}', false, '${CONSENT}'
      )`,
    ),
    /consent required/,
  );
  const afterRefuse = await db.query("select count(*)::int as n from crm_outbox");
  assert.equal(afterRefuse.rows[0].n, before.rows[0].n);

  await db.exec(`
    insert into contact_consents (org_id, channel, purpose, status, basis, address, source)
    values ('${EASTC_ORG}', 'email', 'marketing', 'opted_out', 'consent', 'stop@example.com', 'test');
    insert into suppressions (org_id, channel, address, reason)
    values ('${EASTC_ORG}', 'sms', '+27820000000', 'stop_keyword');
  `);
  await assert.rejects(
    () => asUser(
      db,
      EASTC_ADMIN,
      `select public.create_review_request_draft(
        '${EASTC_ORG}'::uuid, 'email', 'stop@example.com', 'Stop', 'Hello',
        'Please review {{link}}', true, '${CONSENT}'
      )`,
    ),
    /consent refused/,
  );
  await assert.rejects(
    () => asUser(
      db,
      EASTC_ADMIN,
      `select public.create_review_request_draft(
        '${EASTC_ORG}'::uuid, 'sms', '0820000000', 'Stop', '',
        'Please review {{link}}', true, '${CONSENT}'
      )`,
    ),
    /suppressed/,
  );
  const still = await db.query("select count(*)::int as n from crm_outbox");
  assert.equal(still.rows[0].n, before.rows[0].n);

  const drafted = await asUser(
    db,
    EASTC_ADMIN,
    `select public.create_review_request_draft(
      '${EASTC_ORG}'::uuid, 'sms', '0825551234', 'Thabo', '',
      'Hi {{name}}, please review {{sender}}: {{link}}', true, '${CONSENT}'
    ) as result`,
  );
  const draft = drafted.rows[0].result;
  assert.equal(draft.ok, true);
  assert.equal(draft.status, "draft");
  assert.equal(draft.sent, false);
  assert.match(draft.public_token, /^rvw[a-z0-9]+$/);

  const outbox = await db.query("select status, template_key, sent_at, purpose, body from crm_outbox where id = $1", [draft.outbox_id]);
  assert.equal(outbox.rows[0].status, "draft");
  assert.equal(outbox.rows[0].template_key, "review_request");
  assert.equal(outbox.rows[0].sent_at, null);
  assert.equal(outbox.rows[0].purpose, "marketing");
  assert.match(outbox.rows[0].body, /\/r\/rvw/);
  assert.match(outbox.rows[0].body, /reply STOP to opt out/);

  const consent = await db.query(
    "select purpose, status, channel from contact_consents where address = '+27825551234' and org_id = $1",
    [EASTC_ORG],
  );
  assert.equal(consent.rows[0].purpose, "marketing");
  assert.equal(consent.rows[0].status, "opted_in");
  assert.equal(consent.rows[0].channel, "sms");

  await assert.rejects(
    () => db.query("update crm_outbox set status = 'queued' where id = $1", [draft.outbox_id]),
    /review request drafts are not sent/,
  );
  await assert.rejects(
    () => db.query("update crm_outbox set status = 'sent', sent_at = now() where id = $1", [draft.outbox_id]),
    /review request drafts are not sent/,
  );

  const outboxBeforeSubmit = await db.query("select count(*)::int as n from crm_outbox");
  const submitted = await db.query(
    "select public.submit_public_review($1, 5, 'Anele', 'Kind staff') as result",
    ["eastc"],
  );
  assert.equal(submitted.rows[0].result.ok, true);
  assert.equal(submitted.rows[0].result.rating, 5);
  const viaToken = await db.query(
    "select public.submit_public_review($1, 4, 'Sipho', 'Clear') as result",
    [draft.public_token],
  );
  assert.equal(viaToken.rows[0].result.ok, true);
  const linked = await db.query("select review_request_id, org_id, source from reviews where id = $1", [viaToken.rows[0].result.review_id]);
  assert.equal(linked.rows[0].review_request_id, draft.request_id);
  assert.equal(linked.rows[0].org_id, EASTC_ORG);
  assert.equal(linked.rows[0].source, "public");

  const outboxAfterSubmit = await db.query("select count(*)::int as n from crm_outbox");
  assert.equal(outboxAfterSubmit.rows[0].n, outboxBeforeSubmit.rows[0].n);
  const sending = await db.query("select bool_or(sending_enabled) as sending from organizations");
  assert.equal(sending.rows[0].sending, false);

  await assert.rejects(
    () => db.query("select public.submit_public_review('eastc', 6, 'No', 'Bad')"),
    /rating required/,
  );

  const catalog = await db.query("select public.public_review_catalog('eastc') as payload");
  const body = JSON.stringify(catalog.rows[0].payload);
  assert.match(body, /Anele/);
  assert.equal(body.includes("+27825551234"), false);
  assert.equal(body.includes("stop@example.com"), false);
  assert.equal(Number(catalog.rows[0].payload.count), 2);

  await db.exec(`
    insert into reviews (org_id, rating, comment, source, reviewer_name)
    values ('${OTHER_ORG}', 1, 'Other only', 'manual', 'Other guest');
  `);

  const eastcUser = await asUser(db, EASTC_USER, "select reviewer_name from reviews order by reviewer_name");
  assert.deepEqual(eastcUser.rows.map((row) => row.reviewer_name), ["Anele", "Sipho"]);

  const eastcAdmin = await asUser(db, EASTC_ADMIN, "select reviewer_name from reviews order by reviewer_name");
  assert.deepEqual(eastcAdmin.rows.map((row) => row.reviewer_name), ["Anele", "Sipho"]);

  const agency = await asUser(db, AGENCY_USER, "select reviewer_name from reviews where org_id = $1 order by reviewer_name", [EASTC_ORG]);
  assert.deepEqual(agency.rows.map((row) => row.reviewer_name), ["Anele", "Sipho"]);

  const other = await asUser(db, OTHER_USER, "select reviewer_name from reviews order by reviewer_name");
  assert.deepEqual(other.rows.map((row) => row.reviewer_name), ["Other guest"]);

  await assert.rejects(
    () => asUser(
      db,
      OTHER_USER,
      `insert into reviews (org_id, rating, comment, source, reviewer_name)
       values ('${EASTC_ORG}', 5, 'Cross', 'manual', 'Intruder')`,
    ),
    /row-level security|permission denied|violates/i,
  );
  await assert.rejects(
    () => asUser(
      db,
      EASTC_USER,
      `insert into reviews (org_id, rating, comment, source, reviewer_name)
       values ('${EASTC_ORG}', 5, 'Staff', 'manual', 'Client user')`,
    ),
    /row-level security|permission denied|violates/i,
  );
  const manual = await asUser(
    db,
    EASTC_ADMIN,
    `insert into reviews (org_id, rating, comment, source, reviewer_name)
     values ('${EASTC_ORG}', 3, 'Logged by staff', 'google', 'Google guest')
     returning reviewer_name`,
  );
  assert.equal(manual.rows[0].reviewer_name, "Google guest");

  const publicAfterManual = await db.query("select public.public_review_catalog('eastc') as payload");
  const names = publicAfterManual.rows[0].payload.recent.map((row) => row.name);
  assert.equal(names.includes("Google guest"), true);
  assert.equal(names.includes("Other guest"), false);

  await db.exec("reset role");
  await db.exec("set role anon");
  await assert.rejects(() => db.query("select * from reviews"), /permission denied/i);
  await assert.rejects(() => db.query("select public.submit_public_review('eastc', 5, 'Anon', 'No')"), /permission denied/i);
  await db.exec("reset role");

  const hidden = await db.query(
    "select count(*)::int as n from reviews where org_id = $1 and reviewer_name = 'Other guest'",
    [AGENCY_ORG],
  );
  assert.equal(hidden.rows[0].n, 0);
});
