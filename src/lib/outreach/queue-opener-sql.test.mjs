import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const OWNER = "11111111-1111-4111-8111-111111111111";
const STAFF = "33333333-3333-4333-8333-333333333333";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const FILE = "20261114120000_outreach_queue_opener.sql";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function apply(db) {
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    end $$;
  `);
  for (const name of [
    "20260903000000_company_crm.sql",
    "20260926160000_crm_automation.sql",
    "20260926183000_outbound_channels.sql",
    "20260926200000_send_compliance.sql",
    "20260925000000_audit_leads.sql",
    "20260926160000_agency_tenancy.sql",
    "20260926200000_phase2a_access.sql",
    "20261113120000_outreach_funnel.sql",
    FILE,
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
  }
}

async function seed(db) {
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@sandbox.example'),
      ('${STAFF}', 'staff@sandbox.example'),
      ('${EASTC_USER}', 'eastc@sandbox.example');
    insert into memberships (user_id, org_id, role)
      select '${OWNER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
      select '${STAFF}', id, 'agency_staff' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
      select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
  `);
  return (await db.query(`select id from organizations where slug = 'ai-autotech'`)).rows[0].id;
}

test("queue opener migration does not send or turn sending on", () => {
  const sql = migration(FILE);
  const code = sql.replace(/--.*$/gm, "");
  assert.equal(/\bdrop\s+table\b/i.test(code), false);
  assert.equal(/\bdelete\s+from\b/i.test(code), false);
  assert.equal(/sending_enabled\s*=\s*true/i.test(code), false);
  assert.equal(/resend|graph\.facebook|twilio|\bsmtp\b|whatsapp_cloud|api\.sms/i.test(code), false);
  assert.match(sql, /'broker_free_audit_opener', 'email', v_email, v_subject, v_body, 'draft'/);
  assert.match(sql, /broker opener stays draft while sending is off/);
});

test("owner drafts an opener, sending stays off, and stale marketing queued rows cancel", async () => {
  const db = new PGlite();
  await apply(db);
  await db.exec(migration(FILE));
  const orgId = await seed(db);
  const before = (await db.query(`select sending_enabled from organizations where id = $1`, [orgId])).rows[0];
  assert.equal(before.sending_enabled, false);

  const inserted = await asUser(
    db,
    OWNER,
    `insert into crm_outreach_prospects (org_id, business, email, contact_name, hook)
     values ($1, 'Reef Insurance Brokers', 'info@reef.example', 'Thabo Nkosi', 'Since 1983'),
            ($1, 'No Thanks Brokers', 'x@nt.example', 'Ayesha', ''),
            ($1, 'Phone Only Brokers', '', 'Sam', '')
     returning id, business`,
    [orgId],
  );
  const byName = Object.fromEntries(inserted.rows.map((row) => [row.business, row.id]));

  await asUser(db, OWNER, `update crm_outreach_prospects set do_not_contact = true where id = $1`, [byName["No Thanks Brokers"]]);

  const queued = await asUser(
    db,
    OWNER,
    `select public.queue_outreach_openers($1::uuid, array[$2, $3, $4]::uuid[]) as result`,
    [orgId, byName["Reef Insurance Brokers"], byName["No Thanks Brokers"], byName["Phone Only Brokers"]],
  );
  const result = queued.rows[0].result;
  assert.equal(result.sent, false);
  assert.equal(result.queued, 0);
  assert.equal(result.approved, 0);
  assert.equal(result.drafted, 1);
  assert.equal(result.sending_enabled, false);

  const reef = (await db.query(
    `select stage, queued_at, sent_at, notes from crm_outreach_prospects where id = $1`,
    [byName["Reef Insurance Brokers"]],
  )).rows[0];
  assert.equal(reef.stage, "outreach_queued");
  assert.ok(reef.queued_at);
  assert.equal(reef.sent_at, null);
  assert.match(reef.notes, /Not sent/);

  const dnc = (await db.query(`select stage from crm_outreach_prospects where id = $1`, [byName["No Thanks Brokers"]])).rows[0];
  assert.equal(dnc.stage, "not_contacted");

  const outbox = (await db.query(
    `select status, channel, provider, sent_at, purpose, body, subject, template_key from crm_outbox where prospect_id = $1`,
    [byName["Reef Insurance Brokers"]],
  )).rows;
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].status, "draft");
  assert.equal(outbox[0].channel, "email");
  assert.equal(outbox[0].provider, "outbox");
  assert.equal(outbox[0].sent_at, null);
  assert.equal(outbox[0].purpose, "consent_request");
  assert.equal(outbox[0].template_key, "broker_free_audit_opener");
  assert.match(outbox[0].body, /Thabo/);
  assert.match(outbox[0].body, /Reef Insurance Brokers/);
  assert.match(outbox[0].body, /not insurance advice/);
  assert.equal(/i recommend|this policy|premium/i.test(outbox[0].body), false);
  assert.match(outbox[0].subject, /not insurance advice/);

  const again = await asUser(
    db,
    OWNER,
    `select public.queue_outreach_openers($1::uuid, array[$2]::uuid[]) as result`,
    [orgId, byName["Reef Insurance Brokers"]],
  );
  assert.equal(again.rows[0].result.drafted, 0);
  assert.equal(again.rows[0].result.skipped, 1);
  const stillOne = (await db.query(`select count(*)::int as n from crm_outbox where template_key = 'broker_free_audit_opener'`)).rows[0];
  assert.equal(stillOne.n, 1);

  await assert.rejects(
    db.query(`update crm_outbox set status = 'queued' where template_key = 'broker_free_audit_opener'`),
    /stays draft while sending is off/,
  );
  await assert.rejects(
    asUser(db, STAFF, `select public.queue_outreach_openers($1::uuid, array[$2]::uuid[])`, [orgId, byName["Phone Only Brokers"]]),
    /not allowed/,
  );
  await assert.rejects(
    asUser(db, EASTC_USER, `select public.queue_outreach_openers($1::uuid, array[$2]::uuid[])`, [orgId, byName["Reef Insurance Brokers"]]),
    /not allowed/,
  );

  const eastcOrg = (await db.query(`select id from organizations where slug = 'eastc'`)).rows[0].id;
  await db.query(
    `insert into crm_outbox (id, channel, to_address, body, status, org_id, purpose, message_category, template_key)
     values
      ('mkt-1', 'email', 'a@stale.example', 'old', 'queued', $1, 'marketing', 'marketing', 'old_campaign'),
      ('mkt-2', 'email', 'b@stale.example', 'old', 'queued', $1, 'service', 'MARKETING', 'old_campaign'),
      ('svc-1', 'email', 'c@stale.example', 'service', 'queued', $1, 'service', 'service', 'ack_email'),
      ('held-draft', 'email', 'd@stale.example', 'draft', 'draft', $1, 'marketing', 'marketing', 'other_draft'),
      ('approved-1', 'email', 'e@stale.example', 'approved', 'approved', $1, 'marketing', 'marketing', 'old_campaign'),
      ('eastc-1', 'email', 'f@eastc.example', 'other', 'queued', $2, 'marketing', 'marketing', 'old_campaign')`,
    [orgId, eastcOrg],
  );

  const preview = await asUser(db, OWNER, `select public.preview_stale_marketing_outbox($1::uuid) as result`, [orgId]);
  assert.equal(preview.rows[0].result.dry_run, true);
  assert.equal(preview.rows[0].result.changed, false);
  assert.equal(preview.rows[0].result.count, 2);
  assert.equal(preview.rows[0].result.sent, false);
  const listed = preview.rows[0].result.rows.map((row) => row.id).sort();
  assert.deepEqual(listed, ["mkt-1", "mkt-2"]);

  const dry = await asUser(db, OWNER, `select public.cancel_stale_marketing_outbox($1::uuid, false) as result`, [orgId]);
  assert.equal(dry.rows[0].result.cancelled, 0);
  assert.equal(dry.rows[0].result.changed, false);
  const stillQueued = (await db.query(`select count(*)::int as n from crm_outbox where org_id = $1 and status = 'queued'`, [orgId])).rows[0];
  assert.equal(stillQueued.n, 3);

  const cancelled = await asUser(db, OWNER, `select public.cancel_stale_marketing_outbox($1::uuid, true) as result`, [orgId]);
  assert.equal(cancelled.rows[0].result.sent, false);
  assert.equal(cancelled.rows[0].result.cancelled, 2);
  assert.equal(cancelled.rows[0].result.queued, 0);
  assert.equal(cancelled.rows[0].result.sending_enabled, false);

  const left = await db.query(`select id, status from crm_outbox where id in ('mkt-1','mkt-2','svc-1','held-draft','approved-1','eastc-1') order by id`);
  const status = Object.fromEntries(left.rows.map((row) => [row.id, row.status]));
  assert.equal(status["mkt-1"], "cancelled");
  assert.equal(status["mkt-2"], "cancelled");
  assert.equal(status["svc-1"], "queued");
  assert.equal(status["held-draft"], "draft");
  assert.equal(status["approved-1"], "approved");
  assert.equal(status["eastc-1"], "queued");

  const openerStillDraft = (await db.query(`select status, sent_at from crm_outbox where template_key = 'broker_free_audit_opener'`)).rows[0];
  assert.equal(openerStillDraft.status, "draft");
  assert.equal(openerStillDraft.sent_at, null);
  const after = (await db.query(`select sending_enabled from organizations where id = $1`, [orgId])).rows[0];
  assert.equal(after.sending_enabled, false);

  await db.exec("set role anon");
  await assert.rejects(db.query(`select public.queue_outreach_openers('${orgId}'::uuid, array['${byName["Phone Only Brokers"]}']::uuid[])`));
  await db.exec("reset role");
});

test("a suppressed address is not drafted and consent is required to leave draft", async () => {
  const db = new PGlite();
  await apply(db);
  const orgId = await seed(db);
  const inserted = await asUser(
    db,
    OWNER,
    `insert into crm_outreach_prospects (org_id, business, email, contact_name)
     values ($1, 'Stopped Brokers', 'stop@reef.example', 'Lee')
     returning id`,
    [orgId],
  );
  const id = inserted.rows[0].id;
  await db.query(
    `insert into suppressions (org_id, channel, address, reason) values ($1, 'email', 'stop@reef.example', 'manual')`,
    [orgId],
  );
  const blocked = await asUser(db, OWNER, `select public.queue_outreach_openers($1::uuid, array[$2]::uuid[]) as result`, [orgId, id]);
  assert.equal(blocked.rows[0].result.drafted, 0);
  assert.equal(blocked.rows[0].result.blocked, 1);
  assert.equal(blocked.rows[0].result.sent, false);
  const stage = (await db.query(`select stage from crm_outreach_prospects where id = $1`, [id])).rows[0];
  assert.equal(stage.stage, "not_contacted");
  const none = (await db.query(`select count(*)::int as n from crm_outbox where prospect_id = $1`, [id])).rows[0];
  assert.equal(none.n, 0);

  await db.query(`delete from suppressions where address = 'stop@reef.example'`);
  const drafted = await asUser(db, OWNER, `select public.queue_outreach_openers($1::uuid, array[$2]::uuid[]) as result`, [orgId, id]);
  assert.equal(drafted.rows[0].result.drafted, 1);
  assert.equal(drafted.rows[0].result.results[0].status, "draft");

  await db.query(`update organizations set sending_enabled = true where id = $1`, [orgId]);
  await assert.rejects(
    db.query(`update crm_outbox set status = 'queued' where prospect_id = $1`, [id]),
    /recorded marketing consent/,
  );
  await db.query(
    `insert into contact_consents (org_id, channel, purpose, status, basis, address)
     values ($1, 'email', 'marketing', 'opted_in', 'consent', 'stop@reef.example')`,
    [orgId],
  );
  await db.query(`update crm_outbox set status = 'approved' where prospect_id = $1`, [id]);
  const promoted = (await db.query(`select status, sent_at, provider from crm_outbox where prospect_id = $1`, [id])).rows[0];
  assert.equal(promoted.status, "approved");
  assert.equal(promoted.sent_at, null);
  assert.equal(promoted.provider, "outbox");
  await db.query(`update organizations set sending_enabled = false where id = $1`, [orgId]);
  await assert.rejects(
    db.query(`update crm_outbox set status = 'sent', sent_at = now() where prospect_id = $1`, [id]),
    /not sent from this path|stays draft while sending is off/,
  );
});
