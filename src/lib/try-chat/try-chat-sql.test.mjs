import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const HASH = "ab".repeat(32);

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
    "20261116120000_bot_try_links.sql",
  ]) {
    await db.exec(migration(name));
  }
}

test("try links are deny-all, expire in 7 days, cap at 50, and purge messages after 30 days", { timeout: 180_000 }, async () => {
  const db = new PGlite();
  await apply(db);
  const sandbox = await db.query(`
    select column_name, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'calendars' and column_name = 'sandbox'
  `);
  assert.equal(sandbox.rows.length, 1);

  await db.exec(`
    insert into public.calendars (org_id, name) values ('${EASTC_ORG}', 'Front desk');
    insert into public.calendars (org_id, name, sandbox, description)
    values ('${EASTC_ORG}', 'TEST', true, 'Sandbox test bookings from the try chat.');
  `);
  const calendars = await db.query(`select name, sandbox from public.calendars where org_id = '${EASTC_ORG}' order by name`);
  assert.equal(calendars.rows.find((row) => row.name === "Front desk").sandbox, false);
  assert.equal(calendars.rows.find((row) => row.name === "TEST").sandbox, true);

  await db.exec(`
    insert into public.org_bots (org_id, bot_slug, status, config, sandbox)
    values ('${EASTC_ORG}', 'inbound-lead', 'trial', '{"tone":"warm and plain"}'::jsonb, true);
  `);
  await db.exec(`
    insert into public.bot_try_links (org_id, org_bot_id, token_hash)
    select '${EASTC_ORG}', id, '${HASH}'
    from public.org_bots
    where org_id = '${EASTC_ORG}' and bot_slug = 'inbound-lead';
  `);
  const created = await db.query(`
    select max_messages, used_messages, revoked_at,
      expires_at > now() + interval '6 days' as week_ahead,
      expires_at < now() + interval '8 days' as within_week
    from public.bot_try_links
    where token_hash = '${HASH}'
  `);
  assert.equal(created.rows[0].max_messages, 50);
  assert.equal(created.rows[0].used_messages, 0);
  assert.equal(created.rows[0].revoked_at, null);
  assert.equal(created.rows[0].week_ahead, true);
  assert.equal(created.rows[0].within_week, true);

  await assert.rejects(db.exec(`
    insert into public.bot_try_links (org_id, org_bot_id, token_hash)
    select org_id, id, 'short'
    from public.org_bots
    where org_id = '${EASTC_ORG}' and bot_slug = 'inbound-lead'
  `));

  const link = await db.query(`select id from public.bot_try_links where token_hash = '${HASH}'`);
  const linkId = link.rows[0].id;
  await db.exec(`
    insert into public.bot_try_messages (link_id, role, content, created_at)
    values
      ('${linkId}', 'user', 'old', now() - interval '31 days'),
      ('${linkId}', 'assistant', 'keep', now());
  `);
  const purged = await db.query(`select public.purge_bot_try_messages() as removed`);
  assert.equal(Number(purged.rows[0].removed), 1);
  const left = await db.query(`select content from public.bot_try_messages where link_id = '${linkId}'`);
  assert.deepEqual(left.rows.map((row) => row.content), ["keep"]);

  await db.exec("set role authenticated");
  await assert.rejects(db.query("select id from public.bot_try_links"));
  await db.exec("reset role");
  await db.exec("set role anon");
  await assert.rejects(db.query("select id from public.bot_try_messages"));
  await db.exec("reset role");
  await db.exec("set role authenticated");
  await assert.rejects(db.query("select public.purge_bot_try_messages()"));
  await db.exec("reset role");
});
