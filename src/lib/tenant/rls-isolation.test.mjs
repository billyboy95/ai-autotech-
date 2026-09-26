import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";

async function applyMigrations(db) {
  const company = readFileSync(new URL("../../../supabase/migrations/20260903000000_company_crm.sql", import.meta.url), "utf8");
  const tenancy = readFileSync(new URL("../../../supabase/migrations/20260926160000_agency_tenancy.sql", import.meta.url), "utf8");
  const phase1 = readFileSync(new URL("../../../supabase/migrations/20261015120000_org_scope_phase1_tables.sql", import.meta.url), "utf8");
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
  await db.exec(company);
  await db.exec(tenancy);
  await db.exec(phase1);
}

async function asUser(db, userId, sql) {
  await db.exec("reset role");
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
  await db.exec("set role authenticated");
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}

test("a client user cannot read another organisation's CRM rows", async () => {
  const db = new PGlite();
  await applyMigrations(db);

  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${EASTC_USER}', 'admin@eastc.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za');

    insert into organizations (id, name, slug, org_type, form_key)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Other Agency', 'other-agency', 'agency', 'other-agency');

    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_USER}', id, 'client_user' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_USER}', id, 'agency_owner' from organizations where slug = 'other-agency';

    insert into crm_leads (id, name, company, phone, stage, notes, ord, org_id)
    select 'agency-lead', 'Thabo', 'Thabo Dental', '064', 'New', 'agency book', 1, id
    from organizations where slug = 'ai-autotech';
    insert into crm_leads (id, name, company, phone, stage, notes, ord, org_id)
    select 'eastc-lead', 'Lerato', 'EASTC', '011', 'New', 'student enquiry', 2, id
    from organizations where slug = 'eastc';
    insert into crm_leads (id, name, company, phone, stage, notes, ord, org_id)
    select 'other-lead', 'Secret', 'Other Co', '000', 'New', 'not ours', 3, id
    from organizations where slug = 'other-agency';
  `);

  const eastcRows = await asUser(db, EASTC_USER, "select id from crm_leads order by id");
  assert.deepEqual(eastcRows.rows.map((row) => row.id), ["eastc-lead"]);

  const eastcStages = await asUser(
    db,
    EASTC_USER,
    "select name from workspace_pipeline_stages order by position",
  );
  assert.deepEqual(eastcStages.rows.map((row) => row.name), [
    "Enquiry",
    "Contacted",
    "Campus visit booked",
    "Application",
    "Enrolled",
    "Lost",
  ]);

  await assert.rejects(
      () => asUser(
      db,
      EASTC_USER,
      `insert into crm_leads (id, name, company, phone, stage, notes, ord, org_id)
       values ('stolen', 'X', 'Y', '', 'New', '', 9, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')`,
    ),
    /row-level security|permission denied|new row violates/i,
  );

  const agencyRows = await asUser(db, AGENCY_USER, "select id from crm_leads order by id");
  assert.deepEqual(agencyRows.rows.map((row) => row.id), ["agency-lead", "eastc-lead"]);

  const otherRows = await asUser(db, OTHER_USER, "select id from crm_leads order by id");
  assert.deepEqual(otherRows.rows.map((row) => row.id), ["other-lead"]);

  const seeded = await db.query(
    "select slug, org_type, parent_id is not null as has_parent from organizations order by slug",
  );
  assert.deepEqual(seeded.rows, [
    { slug: "ai-autotech", org_type: "agency", has_parent: false },
    { slug: "eastc", org_type: "client", has_parent: true },
    { slug: "other-agency", org_type: "agency", has_parent: false },
  ]);

  await db.close();
});
