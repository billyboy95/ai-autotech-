import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";

async function applyMigrations(db) {
  const tenancy = readFileSync(new URL("../../../supabase/migrations/20260926160000_agency_tenancy.sql", import.meta.url), "utf8");
  const phase2a = readFileSync(new URL("../../../supabase/migrations/20260926200000_phase2a_access.sql", import.meta.url), "utf8");
  const phase2b = readFileSync(new URL("../../../supabase/migrations/20261015140000_phase2b_channels_popia.sql", import.meta.url), "utf8");
  await db.exec(tenancy);
  await db.exec(phase2a);
  await db.exec(phase2b);
}

async function asUser(db, userId, sql) {
  await db.exec("reset role");
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
  await db.exec(`select set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec("set role authenticated");
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}

test("authenticated users cannot read channel secrets", async () => {
  const db = new PGlite();
  await applyMigrations(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${EASTC_USER}', 'admin@eastc.co.za');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_USER}', id, 'client_user' from organizations where slug = 'eastc';
  `);

  const secretColumn = await db.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'channel_connections' and column_name in ('secret', 'api_key', 'token')",
  );
  assert.equal(secretColumn.rows.length, 0);

  const inserted = await asUser(
    db,
    AGENCY_USER,
    `insert into channel_connections (org_id, channel, provider, identifier, display_name)
     select id, 'whatsapp', 'meta_cloud', 'AGENCY_PHONE', 'Agency WA' from organizations where slug = 'ai-autotech'
     returning id`,
  );
  const connectionId = inserted.rows[0].id;
  await asUser(db, AGENCY_USER, `select public.store_channel_secret('${connectionId}'::uuid, '{"token":"agency-secret"}')`);

  const eastcVisible = await asUser(db, EASTC_USER, "select identifier from channel_connections");
  assert.deepEqual(eastcVisible.rows, []);

  await assert.rejects(
    () => asUser(db, EASTC_USER, "select secret from private.channel_secrets"),
    /permission denied|does not exist/i,
  );
  await assert.rejects(
    () => asUser(db, AGENCY_USER, `select public.read_channel_secret('${connectionId}'::uuid)`),
    /permission denied/i,
  );

  await db.exec("reset role");
  await db.exec(`select set_config('request.jwt.claim.role', 'service_role', false)`);
  const revealed = await db.query(`select public.read_channel_secret('${connectionId}'::uuid) as secret`);
  assert.equal(revealed.rows[0].secret, '{"token":"agency-secret"}');
});
