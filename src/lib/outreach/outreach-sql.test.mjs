import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const OWNER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const FILE = "20261113120000_outreach_funnel.sql";

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

test("outreach migration is additive and sends nothing", () => {
  const sql = migration(FILE);
  assert.equal(/\bdrop\s+table\b/i.test(sql), false);
  assert.equal(/\balter\s+table\s+(?!public\.crm_outreach_prospects)/i.test(sql), false);
  assert.equal(/\bdelete\s+from\b/i.test(sql), false);
  assert.equal(/\brename\b/i.test(sql), false);
  assert.equal(/crm_outbox/i.test(sql.replace(/^--.*$/gm, "")), false);
  assert.match(sql, /accessible_org_ids/);
});

test("stages stamp, do-not-contact blocks sending, and rows stay inside the workspace", async () => {
  const db = new PGlite();
  await apply(db);
  await db.exec(`
    insert into auth.users (id, email) values ('${OWNER}', 'owner@sandbox.example'), ('${EASTC_USER}', 'eastc@sandbox.example');
    insert into memberships (user_id, org_id, role) select '${OWNER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only) select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
  `);
  const orgId = (await db.query(`select id from organizations where slug = 'ai-autotech'`)).rows[0].id;

  const inserted = await asUser(
    db,
    OWNER,
    `insert into crm_outreach_prospects (org_id, business, email) values ($1, 'Reef Insurance Brokers', 'info@reef.example'), ($1, 'No Thanks Brokers', 'x@nt.example') returning id, stage`,
    [orgId],
  );
  assert.equal(inserted.rows.length, 2);
  assert.equal(inserted.rows[0].stage, "not_contacted");
  const [reef, nothanks] = inserted.rows.map((r) => r.id);

  await asUser(db, OWNER, `update crm_outreach_prospects set stage = 'sent' where id = $1`, [reef]);
  await asUser(db, OWNER, `update crm_outreach_prospects set stage = 'booked_call1' where id = $1`, [reef]);
  const stamped = (await db.query(`select sent_at, booked_call1_at, replied_at from crm_outreach_prospects where id = $1`, [reef])).rows[0];
  assert.ok(stamped.sent_at);
  assert.ok(stamped.booked_call1_at);
  assert.equal(stamped.replied_at, null);

  await asUser(db, OWNER, `update crm_outreach_prospects set do_not_contact = true, dnc_reason = 'no thanks' where id = $1`, [nothanks]);
  const dnc = (await db.query(`select dnc_at from crm_outreach_prospects where id = $1`, [nothanks])).rows[0];
  assert.ok(dnc.dnc_at);
  await assert.rejects(
    asUser(db, OWNER, `update crm_outreach_prospects set stage = 'sent' where id = $1`, [nothanks]),
    /do-not-contact/,
  );

  const otherOrg = await asUser(db, EASTC_USER, `select count(*)::int as n from crm_outreach_prospects`);
  assert.equal(otherOrg.rows[0].n, 0);
  await assert.rejects(
    asUser(db, EASTC_USER, `insert into crm_outreach_prospects (org_id, business) values ($1, 'Sneaky')`, [orgId]),
  );
  await db.exec("set role anon");
  await assert.rejects(db.query(`select * from crm_outreach_prospects`));
  await db.exec("reset role");
});
