import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const AGENCY_ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

const ROWS = JSON.stringify([
  { name: "Sandbox Ada Example", business: "Sandbox Co", niche: "clinic", website: "https://sandbox.example/ada", phone: "0820000301", email: "ada@sandbox.example", opening_line: "Sandbox hello", consent_basis: "consent", channel: "whatsapp", stopped: false, suppressed: false },
  { name: "Sandbox Blank Example", business: "Sandbox Blank", niche: "clinic", website: "https://sandbox.example/blank", phone: "0820000302", email: "blank@sandbox.example", opening_line: "Sandbox hello", consent_basis: "", channel: "whatsapp", stopped: false, suppressed: false },
  { name: "Sandbox Stop Example", business: "Sandbox Stop", niche: "trades", website: "https://sandbox.example/stop", phone: "0820000303", email: "stop@sandbox.example", opening_line: "Sandbox hello", consent_basis: "stopped", channel: "whatsapp", stopped: true, suppressed: false },
]);

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyPhase5i(db) {
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
  await db.exec(migration("20260926160000_agency_tenancy.sql"));
  await db.exec(migration("20260926200000_phase2a_access.sql"));
  await db.exec(migration("20261031120000_phase5d_home_chat.sql"));
  await db.exec(migration("20261101120000_phase5e_campaign_dry_run.sql"));
  await db.exec(migration("20261102120000_phase5f_campaign_csv_channels.sql"));
  await db.exec(migration("20261105120000_phase5i_campaign_seed_ops.sql"));
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

test("phase 5i East Rand sandbox seed reuses the phase 5f dry-load and does not send", async () => {
  const sql = migration("20261105120000_phase5i_campaign_seed_ops.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.match(sql, /save_campaign_csv_import/);
  assert.match(sql, /East Rand sandbox \(draft\)/);

  const db = new PGlite();
  await applyPhase5i(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@sandbox.example'),
      ('${EASTC_USER}', 'staff@sandbox.example');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
  `);
  await db.exec(`
    create table public.crm_outbox (
      id text primary key,
      lead_id text,
      channel text not null,
      body text not null default '',
      status text not null check (status in ('draft', 'queued', 'approved', 'sent')),
      org_id uuid
    );
  `);

  await assert.rejects(
    asUser(db, EASTC_USER, `select public.seed_east_rand_sandbox_campaign($1, $2::jsonb)`, [AGENCY_ORG, ROWS]),
    /not allowed/i,
  );

  await assert.rejects(
    asUser(
      db,
      AGENCY_USER,
      `select public.seed_east_rand_sandbox_campaign($1, $2::jsonb)`,
      [AGENCY_ORG, JSON.stringify([{ name: "Sandbox Ada Example", consent_basis: "consent", channel: "whatsapp", send: true }])],
    ),
    /dry load only/i,
  );

  const saved = await asUser(
    db,
    AGENCY_USER,
    `select public.seed_east_rand_sandbox_campaign($1, $2::jsonb) as result`,
    [AGENCY_ORG, ROWS],
  );
  const result = saved.rows[0].result;
  assert.equal(result.status, "sandbox");
  assert.equal(result.campaign_status, "draft");
  assert.equal(result.campaign_name, "East Rand sandbox (draft)");
  assert.equal(result.label, "sandbox");
  assert.equal(result.seed, "east_rand");
  assert.equal(result.reused, false);
  assert.equal(result.sandbox, true);
  assert.equal(result.charged, false);
  assert.equal(result.queued, 0);
  assert.equal(result.sent, 0);
  assert.equal(result.sending_enabled, false);
  assert.equal(result.imported, 2);
  assert.equal(result.skipped, 1);

  const again = await asUser(
    db,
    AGENCY_USER,
    `select public.seed_east_rand_sandbox_campaign($1, $2::jsonb) as result`,
    [AGENCY_ORG, ROWS],
  );
  assert.equal(again.rows[0].result.reused, true);
  assert.equal(again.rows[0].result.queued, 0);
  assert.equal(again.rows[0].result.sent, 0);
  assert.equal(again.rows[0].result.id, result.id);

  const imports = await asUser(
    db,
    AGENCY_USER,
    `select count(*)::int as n from public.campaign_csv_imports where org_id = $1`,
    [AGENCY_ORG],
  );
  assert.equal(imports.rows[0].n, 1);

  const prospects = await asUser(
    db,
    AGENCY_USER,
    `select name, status, queued, sent, sandbox from public.campaign_csv_prospects where org_id = $1 order by name`,
    [AGENCY_ORG],
  );
  assert.equal(prospects.rows.length, 2);
  assert.equal(prospects.rows.every((row) => row.status === "draft" && row.queued === false && row.sent === false && row.sandbox === true), true);
  assert.equal(prospects.rows.some((row) => row.name === "Sandbox Blank Example"), false);

  const refused = await asUser(
    db,
    AGENCY_USER,
    `select public.refuse_east_rand_seed_send($1, 'go_live') as result`,
    [AGENCY_ORG],
  );
  assert.equal(refused.rows[0].result.refused, true);
  assert.equal(refused.rows[0].result.queued, 0);
  assert.equal(refused.rows[0].result.sent, 0);
  assert.equal(refused.rows[0].result.sending_enabled, false);
  assert.equal(refused.rows[0].result.label, "sandbox");
  assert.match(refused.rows[0].result.reason, /sending_enabled is false/);

  const sendNow = await asUser(
    db,
    AGENCY_USER,
    `select public.refuse_east_rand_seed_send($1, 'send_now') as result`,
    [AGENCY_ORG],
  );
  assert.equal(sendNow.rows[0].result.refused, true);
  assert.equal(sendNow.rows[0].result.queued, 0);

  const outbox = await db.query(`select count(*)::int as n from public.crm_outbox`);
  assert.equal(outbox.rows[0].n, 0);

  const sending = await db.query(`select sending_enabled from public.organizations where id = $1`, [AGENCY_ORG]);
  assert.equal(sending.rows[0].sending_enabled, false);
});
