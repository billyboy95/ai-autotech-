import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const STAFF_USER = "66666666-6666-4666-8666-666666666666";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const AGENCY_SNAPSHOT = "a2c00000-0000-4000-8000-000000000001";
const RESTAURANT_ID = "a2c00000-0000-4000-8000-000000000003";

const SECOND = {
  name: "Second Joint",
  slug: "second-joint",
  primary_colour: "#0B1F3A",
  accent_colour: "#C2410C",
  logo_url: "https://example.com/second-joint-logo.png",
  phone: "0100000002",
  email: "hello@second-joint.example",
  address: "8 Lake Road, Benoni",
  hours: "12:00 to 22:00",
  booking_url: "/book/second-joint-table",
  services_text: "",
  services: [
    { name: "Smash burger", price_label: "R95" },
    { name: "Chips", price_label: "R35" },
  ],
};

const BARN = {
  name: "Burger Barn",
  slug: "burger-barn",
  primary_colour: "#0B1F3A",
  accent_colour: "#B45309",
  logo_url: "https://example.com/burger-barn-logo.png",
  phone: "0100000001",
  email: "hello@burger-barn.example",
  address: "14 Oak Street, Kempton Park",
  hours: "11:00 to 21:00",
  booking_url: "/book/burger-barn-table",
  services_text: "",
  services: [],
};

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyTemplates(db) {
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
    "20261112120000_phase5p_workspace_templates.sql",
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
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

test("duplicate_workspace swaps a restaurant template and stays off", async () => {
  const db = new PGlite();
  await applyTemplates(db);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${STAFF_USER}', 'staff@aiautotech.co.za'),
      ('${EASTC_USER}', 'staff@eastc.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za');
    insert into organizations (id, name, slug, org_type, form_key)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Other Agency', 'other-agency', 'agency', 'other-agency');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${STAFF_USER}', id, 'agency_staff' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_USER}', id, 'client_user' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_USER}', id, 'agency_owner' from organizations where slug = 'other-agency';
  `);

  const seeds = await db.query(
    `select id::text, payload->>'version' as version,
            jsonb_array_length(coalesce(payload->'workflows', '[]'::jsonb)) as workflows,
            jsonb_array_length(coalesce(payload->'calendars', '[]'::jsonb)) as calendars
     from snapshots
     where id in ('${AGENCY_SNAPSHOT}', '${RESTAURANT_ID}')
     order by name`,
  );
  const agency = seeds.rows.find((row) => row.id === AGENCY_SNAPSHOT);
  const restaurant = seeds.rows.find((row) => row.id === RESTAURANT_ID);
  assert.equal(agency.version, "2");
  assert.ok(Number(agency.workflows) >= 3);
  assert.ok(Number(agency.calendars) >= 1);
  assert.equal(restaurant.version, "2");

  const draftKeys = await db.query(
    `select item->>'asset_key' as asset_key, (item->>'active')::boolean as active
     from snapshots, jsonb_array_elements(payload->'workflows') item
     where snapshots.id = '${RESTAURANT_ID}'
     order by item->>'asset_key'`,
  );
  assert.deepEqual(
    draftKeys.rows.map((row) => row.asset_key),
    [
      "workflow:restaurant:booking-confirmation",
      "workflow:restaurant:review-request",
      "workflow:restaurant:win-back",
    ],
  );
  assert.deepEqual(draftKeys.rows.map((row) => row.active), [false, false, false]);

  const agencyDrafts = await db.query(
    `select item->>'asset_key' as asset_key
     from snapshots, jsonb_array_elements(payload->'workflows') item
     where snapshots.id = '${AGENCY_SNAPSHOT}'
       and item->>'asset_key' like 'workflow:agency:%draft'
     order by 1`,
  );
  assert.deepEqual(agencyDrafts.rows.map((row) => row.asset_key), [
    "workflow:agency:audit-booked-draft",
    "workflow:agency:new-lead-draft",
    "workflow:agency:no-reply-draft",
  ]);

  const issues = await db.query(
    `select name, public.snapshot_payload_issues(payload) as issues
     from snapshots
     where id in ('${AGENCY_SNAPSHOT}', '${RESTAURANT_ID}')`,
  );
  for (const row of issues.rows) assert.deepEqual(row.issues ?? [], [], row.name);

  const key = `dup:snapshot:${RESTAURANT_ID}:second-joint`;
  const created = await asUser(
    db,
    AGENCY_USER,
    `select public.duplicate_workspace('snapshot', $1::uuid, $2::jsonb, $3) as result`,
    [RESTAURANT_ID, JSON.stringify(SECOND), key],
  );
  const first = created.rows[0].result;
  assert.equal(first.created, true);
  assert.equal(first.idempotent, false);
  assert.equal(first.sending_enabled, false);
  assert.equal(first.slug, "second-joint");
  assert.equal(first.plan_key, "starter");
  const orgId = first.org_id;

  const again = await asUser(
    db,
    AGENCY_USER,
    `select public.duplicate_workspace('snapshot', $1::uuid, $2::jsonb, $3) as result`,
    [RESTAURANT_ID, JSON.stringify(SECOND), key],
  );
  assert.equal(again.rows[0].result.idempotent, true);
  assert.equal(again.rows[0].result.org_id, orgId);
  const slugs = await db.query(`select count(*)::int as n from organizations where slug = 'second-joint'`);
  assert.equal(slugs.rows[0].n, 1);

  const changed = { ...SECOND, phone: "0100000009" };
  await assert.rejects(
    () =>
      asUser(
        db,
        AGENCY_USER,
        `select public.duplicate_workspace('snapshot', $1::uuid, $2::jsonb, $3)`,
        [RESTAURANT_ID, JSON.stringify(changed), key],
      ),
    /idempotency key already used/i,
  );

  await assert.rejects(
    () =>
      asUser(
        db,
        EASTC_USER,
        `select public.duplicate_workspace('snapshot', $1::uuid, $2::jsonb, $3)`,
        [RESTAURANT_ID, JSON.stringify(BARN), "dup:snapshot:eastc:burger-barn"],
      ),
    /not allowed/i,
  );
  await assert.rejects(
    () =>
      asUser(
        db,
        OTHER_USER,
        `select public.duplicate_workspace('snapshot', $1::uuid, $2::jsonb, $3)`,
        [RESTAURANT_ID, JSON.stringify(BARN), "dup:snapshot:other:burger-barn"],
      ),
    /not allowed/i,
  );

  const barn = await asUser(
    db,
    STAFF_USER,
    `select public.duplicate_workspace('snapshot', $1::uuid, $2::jsonb, $3) as result`,
    [RESTAURANT_ID, JSON.stringify(BARN), `dup:snapshot:${RESTAURANT_ID}:burger-barn`],
  );
  assert.equal(barn.rows[0].result.created, true);
  assert.equal(barn.rows[0].result.slug, "burger-barn");
  assert.equal(barn.rows[0].result.sending_enabled, false);

  const org = await db.query(
    `select sending_enabled, plan_key, industry, created_from_snapshot_id from organizations where id = '${orgId}'`,
  );
  assert.equal(org.rows[0].sending_enabled, false);
  assert.equal(org.rows[0].plan_key, "starter");
  assert.equal(org.rows[0].industry, "Restaurant");
  assert.equal(org.rows[0].created_from_snapshot_id, null);

  const templates = await db.query(
    `select active, body from message_templates where org_id = '${orgId}' order by asset_key`,
  );
  assert.ok(templates.rows.length >= 3);
  assert.equal(templates.rows.every((row) => row.active === false), true);
  const bodies = templates.rows.map((row) => row.body).join("\n");
  assert.match(bodies, /Second Joint/);
  assert.equal(bodies.includes("{{business.name}}"), false);

  const flows = await db.query(`select active from workflows where org_id = '${orgId}'`);
  assert.ok(flows.rows.length >= 3);
  assert.equal(flows.rows.every((row) => row.active === false), true);

  const site = await db.query(`select config from client_website_configs where org_id = '${orgId}'`);
  assert.equal(site.rows[0].config.business_name, "Second Joint");
  assert.equal(site.rows[0].config.phone, "0100000002");
  assert.equal(site.rows[0].config.services[0].name, "Smash burger");

  const knowledge = await db.query(`select entries::text as body from ai_knowledge_bases where org_id = '${orgId}'`);
  assert.match(knowledge.rows[0].body, /0100000002/);

  const ai = await db.query(
    `select enabled, mode, require_human_before_send from ai_reply_settings where org_id = '${orgId}'`,
  );
  assert.equal(ai.rows[0].enabled, false);
  assert.equal(ai.rows[0].mode, "draft_only");
  assert.equal(ai.rows[0].require_human_before_send, true);

  const team = await db.query(`select sandbox, charged, agents from workspace_agent_teams where org_id = '${orgId}'`);
  assert.equal(team.rows[0].sandbox, true);
  assert.equal(team.rows[0].charged, false);
  assert.ok(team.rows[0].agents.includes("receptionist"));

  const bots = await db.query(`select count(*)::int as n, bool_and(sandbox) as sandbox from org_bots where org_id = '${orgId}'`);
  assert.equal(bots.rows[0].n, 5);
  assert.equal(bots.rows[0].sandbox, true);
  const lines = await db.query(`select count(*)::int as n from org_bot_billing_lines where org_id = '${orgId}'`);
  assert.equal(lines.rows[0].n, 0);

  const link = await db.query(`select slug, consent_text from booking_links where org_id = '${orgId}'`);
  assert.equal(link.rows[0].slug, "second-joint-table");
  assert.match(link.rows[0].consent_text, /Second Joint/);

  const calendar = await db.query(`select asset_key from calendars where org_id = '${orgId}'`);
  assert.equal(calendar.rows[0].asset_key, "calendar:restaurant:tables");
  const tags = await db.query(`select count(*)::int as n from workspace_tags where org_id = '${orgId}'`);
  assert.equal(tags.rows[0].n, 5);

  const outbox = await db.query(`select count(*)::int as n from crm_outbox where org_id = '${orgId}'`);
  assert.equal(outbox.rows[0].n, 0);

  const hidden = await asUser(
    db,
    EASTC_USER,
    `select count(*)::int as n from client_website_configs where org_id = '${orgId}'`,
  );
  assert.equal(hidden.rows[0].n, 0);
  const visible = await asUser(
    db,
    AGENCY_USER,
    `select count(*)::int as n from client_website_configs where org_id = '${orgId}'`,
  );
  assert.equal(visible.rows[0].n, 1);

  const copied = await asUser(
    db,
    AGENCY_USER,
    `select public.duplicate_workspace('workspace', $1::uuid, $2::jsonb, $3) as result`,
    [orgId, JSON.stringify({ ...BARN, slug: "barn-copy", name: "Barn Copy" }), "dup:workspace:second:barn-copy"],
  );
  assert.equal(copied.rows[0].result.created, true);
  assert.equal(copied.rows[0].result.sending_enabled, false);
  const copyId = copied.rows[0].result.org_id;
  const copySite = await db.query(`select config->>'business_name' as name from client_website_configs where org_id = '${copyId}'`);
  assert.equal(copySite.rows[0].name, "Barn Copy");
  const copySend = await db.query(`select sending_enabled, bool_and(active) as any_active from organizations o join workflows w on w.org_id = o.id where o.id = '${copyId}' group by sending_enabled`);
  assert.equal(copySend.rows[0].sending_enabled, false);
  assert.equal(copySend.rows[0].any_active, false);
});
