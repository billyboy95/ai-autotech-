import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const AGENCY_USER = "11111111-1111-4111-8111-111111111111";
const EASTC_USER = "22222222-2222-4222-8222-222222222222";
const EASTC_ADMIN = "55555555-5555-4555-8555-555555555555";
const OTHER_USER = "33333333-3333-4333-8333-333333333333";
const EASTC_ORG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

function migration(name) {
  return readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

async function applyPhase5g(db) {
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
  await db.exec(migration("20261103120000_phase5g_social_drafts.sql"));
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

async function seedMembers(db) {
  await db.exec(`
    insert into auth.users (id, email) values
      ('${AGENCY_USER}', 'owner@aiautotech.co.za'),
      ('${EASTC_USER}', 'staff@eastc.co.za'),
      ('${EASTC_ADMIN}', 'admin@eastc.co.za'),
      ('${OTHER_USER}', 'owner@other.co.za');
    insert into organizations (id, name, slug, org_type, form_key)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Other Agency', 'other-agency', 'agency', 'other-agency');
    insert into memberships (user_id, org_id, role)
    select '${AGENCY_USER}', id, 'agency_owner' from organizations where slug = 'ai-autotech';
    insert into memberships (user_id, org_id, role, assigned_only)
    select '${EASTC_USER}', id, 'client_user', true from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${EASTC_ADMIN}', id, 'client_admin' from organizations where slug = 'eastc';
    insert into memberships (user_id, org_id, role)
    select '${OTHER_USER}', id, 'agency_owner' from organizations where slug = 'other-agency';
  `);
}

test("phase 5g social drafts and TikTok/LinkedIn stubs do not post", async () => {
  const sql = migration("20261103120000_phase5g_social_drafts.sql");
  assert.equal(/sending_enabled\s*=\s*true/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdelete from\b/i.test(sql), false);
  assert.equal(/\bdrop table\b/i.test(sql), false);
  assert.equal(/insert\s+into\s+public\.crm_outbox/i.test(sql), false);
  assert.equal(/pg_cron|cron\.schedule/i.test(sql), false);
  assert.match(sql, /queued_count = 0/);
  assert.match(sql, /provider_keys_present = false/);
  assert.match(sql, /published = false/);

  const db = new PGlite();
  await applyPhase5g(db);
  await seedMembers(db);
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
    asUser(db, EASTC_USER, `select public.save_social_draft($1, 'week1-intro', 'facebook', 'Week 1 intro', null)`, [EASTC_ORG]),
    /not allowed/i,
  );
  await assert.rejects(
    asUser(db, EASTC_ADMIN, `select public.save_social_draft($1, 'not-a-topic', 'facebook', 'Nope', null)`, [EASTC_ORG]),
    /unknown topic/i,
  );

  const saved = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_social_draft($1, 'week1-intro', 'linkedin', 'Week 1. Introduce the business.', null) as result`,
    [EASTC_ORG],
  );
  const draft = saved.rows[0].result;
  assert.equal(draft.status, "draft");
  assert.equal(draft.platform, "linkedin");
  assert.equal(draft.sandbox, true);
  assert.equal(draft.charged, false);
  assert.equal(draft.published, false);
  assert.equal(draft.queued, 0);
  assert.equal(draft.posted, 0);
  assert.equal(draft.sent, 0);
  assert.equal(draft.sending_enabled, false);
  assert.equal(draft.scheduled_for, null);

  const scheduled = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_social_draft($1, 'week1-intro', 'tiktok', 'Week 1. Edited intro.', '2026-09-28T09:00:00+02') as result`,
    [EASTC_ORG],
  );
  assert.equal(scheduled.rows[0].result.status, "scheduled");
  assert.equal(scheduled.rows[0].result.published, false);
  assert.equal(scheduled.rows[0].result.queued, 0);
  assert.equal(scheduled.rows[0].result.posted, 0);

  const rows = await asUser(
    db,
    EASTC_ADMIN,
    `select topic_key, status, published, queued_count, sent_count from public.social_drafts where org_id = $1`,
    [EASTC_ORG],
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].status, "scheduled");
  assert.equal(rows.rows[0].published, false);
  assert.equal(rows.rows[0].queued_count, 0);
  assert.equal(rows.rows[0].sent_count, 0);

  const hidden = await asUser(
    db,
    OTHER_USER,
    `select count(*)::int as n from public.social_drafts where org_id = $1`,
    [EASTC_ORG],
  );
  assert.equal(hidden.rows[0].n, 0);

  for (const intent of ["publish", "post_now", "go_live"]) {
    const refused = await asUser(
      db,
      EASTC_ADMIN,
      `select public.refuse_social_publish($1, $2) as result`,
      [EASTC_ORG, intent],
    );
    assert.equal(refused.rows[0].result.refused, true);
    assert.equal(refused.rows[0].result.queued, 0);
    assert.equal(refused.rows[0].result.posted, 0);
    assert.equal(refused.rows[0].result.sent, 0);
    assert.equal(refused.rows[0].result.published, false);
    assert.equal(refused.rows[0].result.sending_enabled, false);
    assert.match(refused.rows[0].result.reason, /billy must approve sends/);
  }

  const stillScheduled = await db.query(`select status, published from public.social_drafts where org_id = $1`, [EASTC_ORG]);
  assert.equal(stillScheduled.rows[0].status, "scheduled");
  assert.equal(stillScheduled.rows[0].published, false);

  await assert.rejects(
    db.query(
      `insert into public.social_drafts (org_id, topic_key, platform, body, status, published)
       values ('${EASTC_ORG}', 'week1-how', 'facebook', 'Nope', 'draft', true)`,
    ),
    /check constraint|violates check/i,
  );

  const tiktok = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_social_connect_stub($1, 'tiktok') as result`,
    [EASTC_ORG],
  );
  assert.equal(tiktok.rows[0].result.status, "sandbox_stub");
  assert.equal(tiktok.rows[0].result.provider_label, "tiktok_placeholder");
  assert.equal(tiktok.rows[0].result.secret_stored, false);
  assert.equal(tiktok.rows[0].result.provider_keys_present, false);
  assert.equal(tiktok.rows[0].result.charged, false);
  assert.equal(tiktok.rows[0].result.queued, 0);
  assert.equal(tiktok.rows[0].result.posted, 0);
  assert.equal(tiktok.rows[0].result.sending_enabled, false);

  const linkedin = await asUser(
    db,
    EASTC_ADMIN,
    `select public.save_social_connect_stub($1, 'linkedin') as result`,
    [EASTC_ORG],
  );
  assert.equal(linkedin.rows[0].result.provider_label, "linkedin_placeholder");
  assert.equal(linkedin.rows[0].result.provider_keys_present, false);
  assert.equal(linkedin.rows[0].result.secret_stored, false);

  await assert.rejects(
    asUser(db, EASTC_ADMIN, `select public.save_social_connect_stub($1, 'gmail')`, [EASTC_ORG]),
    /unknown account/i,
  );
  await assert.rejects(
    asUser(db, EASTC_USER, `select public.save_social_connect_stub($1, 'linkedin')`, [EASTC_ORG]),
    /not allowed/i,
  );

  for (const intent of ["send_test", "publish", "send"]) {
    const refused = await asUser(
      db,
      EASTC_ADMIN,
      `select public.refuse_social_connect_send($1, 'tiktok', $2) as result`,
      [EASTC_ORG, intent],
    );
    assert.equal(refused.rows[0].result.refused, true);
    assert.equal(refused.rows[0].result.queued, 0);
    assert.equal(refused.rows[0].result.posted, 0);
    assert.equal(refused.rows[0].result.sent, 0);
    assert.equal(refused.rows[0].result.provider_keys_present, false);
    assert.equal(refused.rows[0].result.dry_run, true);
    assert.equal(refused.rows[0].result.sending_enabled, false);
    assert.match(refused.rows[0].result.reason, /provider keys missing/);
  }

  await assert.rejects(
    db.query(
      `insert into public.social_connect_stubs (org_id, account_key, provider_label, secret_stored)
       values ('${EASTC_ORG}', 'linkedin', 'linkedin_placeholder', true)`,
    ),
    /check constraint|violates check/i,
  );

  const outbox = await db.query(`select count(*)::int as n from public.crm_outbox`);
  assert.equal(outbox.rows[0].n, 0);
  const sending = await db.query(`select sending_enabled from public.organizations where id = $1`, [EASTC_ORG]);
  assert.equal(sending.rows[0].sending_enabled, false);

  await db.exec("reset role");
  await db.exec("set role anon");
  await assert.rejects(
    db.query(`select public.save_social_draft('${EASTC_ORG}', 'week1-intro', 'facebook', 'Nope', null)`),
    /permission denied/i,
  );
});
