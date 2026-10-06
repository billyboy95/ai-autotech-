-- AIOS release SQL. Paste this whole file once in the Supabase SQL editor.
-- Order is fixed: sales funnel, workspace templates, free trial, commissions, sales agents.
-- This file does not turn sending_enabled on and does not send email, SMS, or WhatsApp.
-- Do not run this from CI. Apply it only after Billy says yes.
-- After Success, run NOTIFY pgrst, 'reload schema'; as a separate statement.
-- Verification queries live in docs/AIOS-RELEASE.md. Do not paste those into this apply.

-- >>> supabase/migrations/20261112120000_phase5p_sales_funnel.sql

-- Phase 5p: in-app owner alerts, prospect audit report drafts, and a results-call calendar helper.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Nothing in this file writes crm_outbox or emails a lead.
-- ensure_results_call_calendar is defined here and is not called from this file.
-- Leave SALES_FUNNEL_ENABLED unset until this file is applied.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5p needs phase 2a access; apply 20260926200000_phase2a_access.sql before this file';
  end if;
  if to_regclass('public.crm_audit_leads') is null then
    raise exception 'phase 5p needs crm_audit_leads; apply 20260925000000_audit_leads.sql before this file';
  end if;
  if to_regclass('public.calendars') is null
     or to_regclass('public.calendar_event_types') is null
     or to_regclass('public.booking_links') is null
     or to_regclass('public.calendar_availability') is null then
    raise exception 'phase 5p needs calendars; apply 20261022120000_phase3b_calendars.sql before this file';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_audit_leads' and column_name = 'org_id'
  ) then
    raise exception 'phase 5p needs org_id on crm_audit_leads; apply phase 2a before this file';
  end if;
end
$need$;

alter table public.crm_audit_leads add column if not exists share_token text;
create unique index if not exists crm_audit_leads_share_token_idx on public.crm_audit_leads (share_token);

create table if not exists public.crm_notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('audit', 'contact', 'booking', 'workflow')),
  title text not null,
  body text not null default '',
  href text not null default '',
  lead_id text not null default '',
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  constraint crm_notifications_title_check check (length(btrim(title)) between 1 and 160),
  constraint crm_notifications_body_check check (length(body) <= 2000),
  constraint crm_notifications_href_check check (href = '' or href ~ '^/command-centre/'),
  constraint crm_notifications_dedupe_check check (length(btrim(dedupe_key)) between 1 and 180),
  constraint crm_notifications_dedupe_unique unique (org_id, dedupe_key)
);

create index if not exists crm_notifications_org_idx
  on public.crm_notifications (org_id, created_at desc);

create table if not exists public.crm_notification_reads (
  notification_id uuid not null references public.crm_notifications(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists crm_notification_reads_user_idx
  on public.crm_notification_reads (user_id, read_at desc);

create table if not exists public.crm_audit_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  audit_lead_id uuid not null references public.crm_audit_leads(id) on delete cascade,
  lead_id text not null default '',
  status text not null default 'draft' check (status in ('draft', 'approved')),
  title text not null default '',
  narrative text not null default '',
  sections jsonb not null default '[]'::jsonb,
  polished boolean not null default false,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_audit_reports_title_check check (length(title) <= 160),
  constraint crm_audit_reports_narrative_check check (length(narrative) <= 8000),
  constraint crm_audit_reports_unique unique (org_id, audit_lead_id)
);

create index if not exists crm_audit_reports_org_idx
  on public.crm_audit_reports (org_id, status, updated_at desc);

alter table public.crm_notifications enable row level security;
alter table public.crm_notifications force row level security;
alter table public.crm_notification_reads enable row level security;
alter table public.crm_notification_reads force row level security;
alter table public.crm_audit_reports enable row level security;
alter table public.crm_audit_reports force row level security;

drop policy if exists crm_notifications_read on public.crm_notifications;
create policy crm_notifications_read on public.crm_notifications
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists crm_notification_reads_read on public.crm_notification_reads;
create policy crm_notification_reads_read on public.crm_notification_reads
  for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.crm_notifications note
      where note.id = notification_id
        and note.org_id in (select public.accessible_org_ids())
        and public.has_org_role(note.org_id, array['agency_owner', 'agency_staff', 'client_admin'])
    )
  );

drop policy if exists crm_notification_reads_insert on public.crm_notification_reads;
create policy crm_notification_reads_insert on public.crm_notification_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.crm_notifications note
      where note.id = notification_id
        and note.org_id in (select public.accessible_org_ids())
        and public.has_org_role(note.org_id, array['agency_owner', 'agency_staff', 'client_admin'])
    )
  );

drop policy if exists crm_audit_reports_read on public.crm_audit_reports;
create policy crm_audit_reports_read on public.crm_audit_reports
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists crm_audit_reports_update on public.crm_audit_reports;
create policy crm_audit_reports_update on public.crm_audit_reports
  for update to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  )
  with check (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
    and status in ('draft', 'approved')
    and length(title) <= 160
    and length(narrative) <= 8000
  );

revoke all on table public.crm_notifications from public, anon;
revoke all on table public.crm_notification_reads from public, anon;
revoke all on table public.crm_audit_reports from public, anon;
grant select on table public.crm_notifications to authenticated;
grant select, insert on table public.crm_notification_reads to authenticated;
grant select, update on table public.crm_audit_reports to authenticated;

create or replace function public.crm_audit_reports_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'draft' then
    new.approved_at := null;
    new.approved_by := null;
  elsif new.status = 'approved' and new.approved_at is null then
    new.approved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists crm_audit_reports_touch on public.crm_audit_reports;
create trigger crm_audit_reports_touch
  before update on public.crm_audit_reports
  for each row execute function public.crm_audit_reports_touch();

create or replace function public.record_owner_notification(
  p_org uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_href text,
  p_lead_id text,
  p_dedupe_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  note_id uuid;
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := left(coalesce(p_body, ''), 2000);
  v_href text := btrim(coalesce(p_href, ''));
  v_lead text := left(btrim(coalesce(p_lead_id, '')), 80);
  v_key text := left(btrim(coalesce(p_dedupe_key, '')), 180);
begin
  if auth.uid() is null then
    if current_setting('request.jwt.claim.role', true) = 'authenticated' then
      raise exception 'not allowed';
    end if;
  elsif not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations org where org.id = p_org) then
    raise exception 'workspace required';
  end if;
  if v_kind not in ('audit', 'contact', 'booking', 'workflow') then
    raise exception 'notification kind';
  end if;
  if length(v_title) < 1 or length(v_title) > 160 then
    raise exception 'notification title';
  end if;
  if v_key = '' then
    raise exception 'notification key';
  end if;
  if v_href <> '' and v_href !~ '^/command-centre/' then
    raise exception 'notification href';
  end if;

  insert into public.crm_notifications (org_id, kind, title, body, href, lead_id, dedupe_key)
  values (p_org, v_kind, v_title, v_body, v_href, v_lead, v_key)
  on conflict (org_id, dedupe_key) do nothing
  returning id into note_id;

  if note_id is null then
    select id into note_id
    from public.crm_notifications
    where org_id = p_org and dedupe_key = v_key;
  end if;

  return jsonb_build_object('ok', true, 'id', note_id, 'sent', false);
end;
$$;

create or replace function public.save_audit_report_draft(
  p_org uuid,
  p_audit_lead_id uuid,
  p_lead_id text,
  p_title text,
  p_narrative text,
  p_sections jsonb,
  p_polished boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  report_id uuid;
  v_title text := left(btrim(coalesce(p_title, '')), 160);
  v_narrative text := left(coalesce(p_narrative, ''), 8000);
  v_sections jsonb := coalesce(p_sections, '[]'::jsonb);
begin
  if auth.uid() is null then
    if current_setting('request.jwt.claim.role', true) = 'authenticated' then
      raise exception 'not allowed';
    end if;
  else
    raise exception 'not allowed';
  end if;

  if not exists (
    select 1 from public.crm_audit_leads lead
    where lead.id = p_audit_lead_id and lead.org_id = p_org
  ) then
    raise exception 'audit lead required';
  end if;
  if jsonb_typeof(v_sections) <> 'array' or octet_length(v_sections::text) > 20000 then
    raise exception 'report sections';
  end if;

  insert into public.crm_audit_reports (
    org_id, audit_lead_id, lead_id, status, title, narrative, sections, polished
  ) values (
    p_org, p_audit_lead_id, left(btrim(coalesce(p_lead_id, '')), 80), 'draft',
    v_title, v_narrative, v_sections, coalesce(p_polished, false)
  )
  on conflict (org_id, audit_lead_id) do nothing
  returning id into report_id;

  if report_id is null then
    select id into report_id
    from public.crm_audit_reports
    where org_id = p_org and audit_lead_id = p_audit_lead_id;
  end if;

  return jsonb_build_object('ok', true, 'id', report_id, 'status', 'draft', 'sent', false);
end;
$$;

create or replace function public.approved_audit_report_for_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := lower(btrim(coalesce(p_token, '')));
  v_audit uuid;
  v_org uuid;
  v_report public.crm_audit_reports%rowtype;
  v_slug text;
begin
  if auth.uid() is null then
    if current_setting('request.jwt.claim.role', true) = 'authenticated' then
      raise exception 'not allowed';
    end if;
  else
    raise exception 'not allowed';
  end if;

  if v_token !~ '^[a-f0-9]{64}$' then
    return null;
  end if;

  select lead.id, lead.org_id into v_audit, v_org
  from public.crm_audit_leads lead
  where lead.share_token = v_token;

  if v_audit is null then
    return null;
  end if;

  select * into v_report
  from public.crm_audit_reports report
  where report.org_id = v_org
    and report.audit_lead_id = v_audit
    and report.status = 'approved';

  if not found then
    return null;
  end if;

  select link.slug into v_slug
  from public.booking_links link
  join public.calendar_event_types event_type on event_type.id = link.event_type_id
  where link.org_id = v_org
    and link.active
    and event_type.active
  order by case when link.slug like 'results-call%' or event_type.name = 'Results call' then 0 else 1 end,
           link.created_at
  limit 1;

  return jsonb_build_object(
    'title', v_report.title,
    'narrative', v_report.narrative,
    'sections', v_report.sections,
    'booking_slug', v_slug
  );
end;
$$;

create or replace function public.ensure_results_call_calendar(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cal uuid;
  v_event uuid;
  v_link uuid;
  v_slug text;
  v_org_slug text;
  v_created boolean := false;
begin
  if auth.uid() is null or not public.has_org_role(p_org, array['agency_owner']) then
    raise exception 'not allowed';
  end if;

  select slug into v_org_slug from public.organizations where id = p_org;
  if v_org_slug is null then
    raise exception 'workspace required';
  end if;

  select id into v_cal
  from public.calendars
  where org_id = p_org and name = 'Results call'
  order by created_at
  limit 1;

  if v_cal is null then
    insert into public.calendars (org_id, name, timezone, description, active)
    values (
      p_org,
      'Results call',
      'Africa/Johannesburg',
      'Results call after the free audit. No confirmation is sent from this calendar.',
      true
    )
    returning id into v_cal;
    v_created := true;

    insert into public.calendar_availability (
      org_id, calendar_id, kind, weekday, start_minute, end_minute, available
    )
    select p_org, v_cal, 'weekly', day_num, 540, 1020, true
    from generate_series(1, 5) as day_num;
  end if;

  select id into v_event
  from public.calendar_event_types
  where org_id = p_org and calendar_id = v_cal and name = 'Results call'
  order by created_at
  limit 1;

  if v_event is null then
    insert into public.calendar_event_types (
      org_id, calendar_id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes,
      location_mode, location_detail, active
    ) values (
      p_org, v_cal, 'Results call', 30, 0, 0, 'phone', 'We phone you', true
    )
    returning id into v_event;
    v_created := true;
  end if;

  select id, slug into v_link, v_slug
  from public.booking_links
  where org_id = p_org and event_type_id = v_event
  limit 1;

  if v_link is null then
    v_slug := 'results-call';
    if exists (select 1 from public.booking_links where slug = v_slug) then
      v_slug := 'results-call-' || v_org_slug;
    end if;
    if exists (select 1 from public.booking_links where slug = v_slug) then
      v_slug := 'results-call-' || substr(replace(p_org::text, '-', ''), 1, 8);
    end if;
    insert into public.booking_links (org_id, event_type_id, slug, active, consent_text)
    values (
      p_org,
      v_event,
      v_slug,
      true,
      'I agree that this workspace may store my name and contact details to book this results call. No marketing message is sent from this form.'
    )
    returning id into v_link;
    v_created := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'calendar_id', v_cal,
    'event_type_id', v_event,
    'booking_link_id', v_link,
    'slug', v_slug,
    'created', v_created,
    'sent', false
  );
end;
$$;

revoke all on function public.record_owner_notification(uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.save_audit_report_draft(uuid, uuid, text, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.approved_audit_report_for_token(text) from public, anon, authenticated;
revoke all on function public.ensure_results_call_calendar(uuid) from public, anon, authenticated;
grant execute on function public.record_owner_notification(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.ensure_results_call_calendar(uuid) to authenticated;

do $service_grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.record_owner_notification(uuid, text, text, text, text, text, text) to service_role;
    grant execute on function public.save_audit_report_draft(uuid, uuid, text, text, text, jsonb, boolean) to service_role;
    grant execute on function public.approved_audit_report_for_token(text) to service_role;
    grant select, insert, update, delete on public.crm_notifications to service_role;
    grant select, insert, update, delete on public.crm_notification_reads to service_role;
    grant select, insert, update, delete on public.crm_audit_reports to service_role;
  end if;
end
$service_grant$;

-- >>> supabase/migrations/20261112120100_phase5p_workspace_templates.sql

-- Phase 5p: workspace templates (snapshot v2) and duplicate-with-swap.
-- Additive. Does not delete rows. Does not send. Does not charge.
-- sending_enabled stays false. Message templates, sequences, and workflows copied
-- by duplicate_workspace are stored inactive. AI replies stay draft_only and off.
-- Do not apply this file to production from an agent. Paste it once in the SQL editor
-- after 20261112120000_phase5p_sales_funnel.sql (that file follows step 36),
-- only when Billy says yes. Do not use supabase db push.

do $need$
begin
  if to_regclass('public.snapshots') is null
     or to_regclass('public.workflows') is null
     or to_regprocedure('public.snapshot_apply_payload(uuid, jsonb, boolean)') is null
     or to_regprocedure('public.snapshot_payload_issues(jsonb)') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.accessible_org_ids()') is null then
    raise exception 'workspace templates need snapshots, workflows, and agency roles';
  end if;
  if to_regclass('public.calendars') is null or to_regclass('public.booking_links') is null then
    raise exception 'workspace templates need calendars; apply 20261022120000_phase3b_calendars.sql first';
  end if;
  if to_regclass('public.ai_reply_settings') is null then
    raise exception 'workspace templates need AI reply settings; apply 20261021120000_phase3a_conversation_ai.sql first';
  end if;
  if to_regclass('public.org_bots') is null or to_regclass('public.bot_catalog') is null then
    raise exception 'workspace templates need the bot catalogue; apply 20261024120000_phase4a_bots.sql first';
  end if;
end
$need$;

alter table public.calendars add column if not exists asset_key text not null default '';
alter table public.calendar_event_types add column if not exists asset_key text not null default '';
alter table public.booking_links add column if not exists asset_key text not null default '';

create unique index if not exists calendars_org_asset_key_idx
  on public.calendars (org_id, asset_key) where asset_key <> '';
create unique index if not exists calendar_event_types_org_asset_key_idx
  on public.calendar_event_types (org_id, asset_key) where asset_key <> '';
create unique index if not exists booking_links_org_asset_key_idx
  on public.booking_links (org_id, asset_key) where asset_key <> '';

create table if not exists public.workspace_tags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  asset_key text not null,
  name text not null,
  color text not null default '#0B1F3A',
  created_at timestamptz not null default now(),
  unique (org_id, asset_key)
);

create table if not exists public.client_website_configs (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_website_configs_object check (jsonb_typeof(config) = 'object')
);

create table if not exists public.ai_knowledge_bases (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_bases_array check (jsonb_typeof(entries) = 'array')
);

create table if not exists public.workspace_agent_teams (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  template_slug text not null default '',
  agents text[] not null default '{}'::text[],
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_duplicates (
  id uuid primary key default gen_random_uuid(),
  agency_org_id uuid not null references public.organizations(id) on delete cascade,
  idempotency_key text not null,
  source_kind text not null check (source_kind in ('snapshot', 'workspace')),
  source_id uuid not null,
  target_org_id uuid not null references public.organizations(id) on delete cascade,
  swap jsonb not null,
  created_at timestamptz not null default now(),
  unique (agency_org_id, idempotency_key)
);

create index if not exists workspace_duplicates_target_idx on public.workspace_duplicates (target_org_id);

create or replace function public.snapshot_walk_zoned(doc jsonb, forbidden text[], issues text[], public_zone boolean)
returns text[]
language plpgsql
stable
as $$
declare
  key text;
  child jsonb;
  raw text;
  scrubbed text;
  next_zone boolean;
begin
  if doc is null or jsonb_typeof(doc) = 'null' then
    return issues;
  end if;
  if jsonb_typeof(doc) = 'object' then
    for key, child in select entry.key, entry.value from jsonb_each(doc) as entry
    loop
      next_zone := public_zone or lower(key) in ('website', 'ai_knowledge');
      if lower(key) = any (forbidden) then
        if not (public_zone and lower(key) in ('email', 'phone')) then
          issues := array_append(issues, key);
        end if;
      end if;
      if (lower(key) = 'asset_key' or lower(key) like '%\_asset_key' escape '\')
         and jsonb_typeof(child) = 'string' then
        raw := child #>> '{}';
        if raw ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
          issues := array_append(issues, 'email_address');
        end if;
        if raw ~* '(sk_live_|whsec_|api[_-]?key[[:space:]]*[:=]|bearer[[:space:]]+[a-z0-9]|secret[[:space:]]*[:=])' then
          issues := array_append(issues, 'secret_value');
        end if;
      else
        issues := public.snapshot_walk_zoned(child, forbidden, issues, next_zone);
      end if;
    end loop;
  elsif jsonb_typeof(doc) = 'array' then
    for child in select entry.value from jsonb_array_elements(doc) as entry
    loop
      issues := public.snapshot_walk_zoned(child, forbidden, issues, public_zone);
    end loop;
  elsif jsonb_typeof(doc) = 'string' then
    raw := doc #>> '{}';
    if not public_zone and raw ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
      issues := array_append(issues, 'email_address');
    end if;
    if raw ~* '(sk_live_|whsec_|api[_-]?key[[:space:]]*[:=]|bearer[[:space:]]+[a-z0-9]|secret[[:space:]]*[:=])' then
      issues := array_append(issues, 'secret_value');
    end if;
    scrubbed := regexp_replace(
      raw,
      '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
      '',
      'g'
    );
    if not public_zone
       and raw !~ '^(pipeline|stage|template|sequence|step|field|workflow|campaign):[A-Za-z0-9_.:-]+$'
       and scrubbed ~ '[[:digit:]]{10,}' then
      issues := array_append(issues, 'phone_number');
    end if;
  end if;
  return issues;
end;
$$;

create or replace function public.snapshot_walk(doc jsonb, forbidden text[], issues text[])
returns text[]
language plpgsql
stable
as $$
begin
  return public.snapshot_walk_zoned(doc, forbidden, issues, false);
end;
$$;

create or replace function public.snapshot_swap_text(raw text, swap jsonb)
returns text
language plpgsql
immutable
as $$
declare
  result text := coalesce(raw, '');
  key text;
  val text;
begin
  if swap is null or jsonb_typeof(swap) <> 'object' then
    return result;
  end if;
  for key, val in
    select entry.key, entry.value #>> '{}'
    from jsonb_each(swap) as entry
    where jsonb_typeof(entry.value) = 'string'
  loop
    result := replace(result, '{{business.' || key || '}}', coalesce(val, ''));
  end loop;
  return result;
end;
$$;

create or replace function public.snapshot_swap_json(doc jsonb, swap jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  key text;
  child jsonb;
  result jsonb := '{}'::jsonb;
  built jsonb := '[]'::jsonb;
  element jsonb;
begin
  if doc is null or jsonb_typeof(doc) = 'null' then
    return 'null'::jsonb;
  end if;
  if jsonb_typeof(doc) = 'string' then
    return to_jsonb(public.snapshot_swap_text(doc #>> '{}', swap));
  elsif jsonb_typeof(doc) = 'array' then
    for element in select entry.value from jsonb_array_elements(doc) as entry
    loop
      built := built || jsonb_build_array(public.snapshot_swap_json(element, swap));
    end loop;
    return built;
  elsif jsonb_typeof(doc) = 'object' then
    for key, child in select entry.key, entry.value from jsonb_each(doc) as entry
    loop
      result := result || jsonb_build_object(key, public.snapshot_swap_json(child, swap));
    end loop;
    return result;
  end if;
  return doc;
end;
$$;

create or replace function public.snapshot_prepare_duplicate(p_payload jsonb, p_swap jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  swap jsonb := coalesce(p_swap, '{}'::jsonb);
  services jsonb;
  text_value text;
  doc jsonb;
  item jsonb;
  templates jsonb := '[]'::jsonb;
  sequences jsonb := '[]'::jsonb;
  flows jsonb := '[]'::jsonb;
begin
  if btrim(coalesce(swap->>'services_text', '')) = '' then
    if jsonb_typeof(swap->'services') = 'array' and jsonb_array_length(swap->'services') > 0 then
      services := swap->'services';
    else
      services := coalesce(p_payload #> '{website,services}', '[]'::jsonb);
    end if;
    select string_agg(btrim(coalesce(row->>'name', '') || ' ' || coalesce(row->>'price_label', '')), '; ')
    into text_value
    from jsonb_array_elements(coalesce(services, '[]'::jsonb)) as row;
    swap := swap || jsonb_build_object('services_text', coalesce(text_value, ''));
  end if;

  doc := public.snapshot_swap_json(coalesce(p_payload, '{}'::jsonb), swap);

  if jsonb_typeof(doc->'website') = 'object' then
    doc := jsonb_set(
      doc,
      '{website}',
      (doc->'website') || jsonb_build_object(
        'business_name', coalesce(swap->>'name', ''),
        'colours', jsonb_build_object(
          'primary', coalesce(swap->>'primary_colour', '#0B1F3A'),
          'accent', coalesce(swap->>'accent_colour', '#2563EB')
        ),
        'logo_url', coalesce(swap->>'logo_url', ''),
        'phone', coalesce(swap->>'phone', ''),
        'email', coalesce(swap->>'email', ''),
        'address', coalesce(swap->>'address', ''),
        'hours', coalesce(swap->>'hours', ''),
        'booking_url', coalesce(swap->>'booking_url', '')
      ),
      true
    );
    if jsonb_typeof(swap->'services') = 'array' and jsonb_array_length(swap->'services') > 0 then
      doc := jsonb_set(doc, '{website,services}', swap->'services', true);
    end if;
  end if;

  for item in select entry.value from jsonb_array_elements(coalesce(doc->'message_templates', '[]'::jsonb)) as entry
  loop
    templates := templates || jsonb_build_array(item || jsonb_build_object('active', false));
  end loop;
  doc := jsonb_set(doc, '{message_templates}', templates, true);

  for item in select entry.value from jsonb_array_elements(coalesce(doc->'sequences', '[]'::jsonb)) as entry
  loop
    sequences := sequences || jsonb_build_array(item || jsonb_build_object('active', false));
  end loop;
  doc := jsonb_set(doc, '{sequences}', sequences, true);

  for item in select entry.value from jsonb_array_elements(coalesce(doc->'workflows', '[]'::jsonb)) as entry
  loop
    flows := flows || jsonb_build_array(item || jsonb_build_object('active', false));
  end loop;
  doc := jsonb_set(doc, '{workflows}', flows, true);

  if jsonb_typeof(doc->'ai_reply') = 'object' then
    doc := jsonb_set(
      doc,
      '{ai_reply}',
      (doc->'ai_reply') || jsonb_build_object('enabled', false, 'mode', 'draft_only', 'require_human_before_send', true),
      true
    );
  end if;
  if jsonb_typeof(doc->'agent_team') = 'object' then
    doc := jsonb_set(
      doc,
      '{agent_team}',
      (doc->'agent_team') || jsonb_build_object('sandbox', true, 'charged', false),
      true
    );
  end if;

  return doc;
end;
$$;

create or replace function public.snapshot_apply_v2_extras(p_org uuid, p_payload jsonb, p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  event_item jsonb;
  weekly jsonb;
  booking jsonb;
  cal_id uuid;
  evt_id uuid;
  slug_base text;
  suffix text;
  chosen text;
  n integer;
  tone text;
  prompt text;
  team_slug text;
  agents text[];
begin
  for item in select entry.value from jsonb_array_elements(coalesce(p_payload->'tags', '[]'::jsonb)) as entry
  loop
    if coalesce(item->>'asset_key', '') = '' then
      continue;
    end if;
    insert into public.workspace_tags (org_id, asset_key, name, color)
    values (
      p_org,
      item->>'asset_key',
      coalesce(item->>'name', 'Tag'),
      coalesce(nullif(item->>'color', ''), '#0B1F3A')
    )
    on conflict (org_id, asset_key) do update
      set name = excluded.name,
          color = excluded.color;
  end loop;

  for item in select entry.value from jsonb_array_elements(coalesce(p_payload->'calendars', '[]'::jsonb)) as entry
  loop
    if coalesce(item->>'asset_key', '') = '' then
      continue;
    end if;
    insert into public.calendars (org_id, asset_key, name, timezone, description, active)
    values (
      p_org,
      item->>'asset_key',
      coalesce(nullif(item->>'name', ''), 'Calendar'),
      coalesce(nullif(item->>'timezone', ''), 'Africa/Johannesburg'),
      coalesce(item->>'description', ''),
      coalesce((item->>'active')::boolean, true)
    )
    on conflict (org_id, asset_key) where asset_key <> '' do update
      set name = excluded.name,
          timezone = excluded.timezone,
          description = excluded.description,
          active = excluded.active,
          updated_at = now()
    returning id into cal_id;

    if cal_id is null then
      select id into cal_id from public.calendars
      where org_id = p_org and asset_key = item->>'asset_key';
    end if;

    delete from public.calendar_availability
    where calendar_availability.calendar_id = cal_id and kind = 'weekly';

    for weekly in select entry.value from jsonb_array_elements(coalesce(item->'weekly', '[]'::jsonb)) as entry
    loop
      insert into public.calendar_availability (org_id, calendar_id, kind, weekday, start_minute, end_minute, available)
      values (
        p_org,
        cal_id,
        'weekly',
        (weekly->>'weekday')::smallint,
        (weekly->>'start_minute')::smallint,
        (weekly->>'end_minute')::smallint,
        true
      );
    end loop;

    for event_item in select entry.value from jsonb_array_elements(coalesce(item->'event_types', '[]'::jsonb)) as entry
    loop
      if coalesce(event_item->>'asset_key', '') = '' then
        continue;
      end if;
      insert into public.calendar_event_types (
        org_id, calendar_id, asset_key, name, duration_minutes,
        buffer_before_minutes, buffer_after_minutes, location_mode, location_detail, active
      ) values (
        p_org,
        cal_id,
        event_item->>'asset_key',
        coalesce(nullif(event_item->>'name', ''), 'Booking'),
        coalesce((event_item->>'duration_minutes')::integer, 30),
        coalesce((event_item->>'buffer_before_minutes')::integer, 0),
        coalesce((event_item->>'buffer_after_minutes')::integer, 0),
        coalesce(nullif(event_item->>'location_mode', ''), 'phone'),
        coalesce(event_item->>'location_detail', ''),
        true
      )
      on conflict (org_id, asset_key) where asset_key <> '' do update
        set name = excluded.name,
            duration_minutes = excluded.duration_minutes,
            location_mode = excluded.location_mode,
            location_detail = excluded.location_detail,
            updated_at = now()
      returning id into evt_id;

      if evt_id is null then
        select id into evt_id from public.calendar_event_types
        where org_id = p_org and asset_key = event_item->>'asset_key';
      end if;

      booking := coalesce(event_item->'booking', '{}'::jsonb);
      if coalesce(booking->>'asset_key', '') = '' then
        continue;
      end if;
      if exists (
        select 1 from public.booking_links
        where org_id = p_org and asset_key = booking->>'asset_key'
      ) then
        update public.booking_links
        set active = coalesce((booking->>'active')::boolean, true),
            consent_text = coalesce(booking->>'consent_text', '')
        where org_id = p_org and asset_key = booking->>'asset_key';
      else
        slug_base := lower(regexp_replace(coalesce(nullif(p_slug, ''), 'book'), '[^a-z0-9]+', '-', 'g'));
        suffix := lower(regexp_replace(coalesce(nullif(booking->>'slug_suffix', ''), 'book'), '[^a-z0-9]+', '-', 'g'));
        slug_base := btrim(slug_base, '-');
        suffix := btrim(suffix, '-');
        chosen := btrim(slug_base || '-' || suffix, '-');
        if chosen = '' then
          chosen := 'booking';
        end if;
        n := 2;
        while exists (select 1 from public.booking_links existing where existing.slug = chosen) loop
          chosen := btrim(slug_base || '-' || suffix, '-') || '-' || n::text;
          n := n + 1;
          if n > 50 then
            raise exception 'Choose a different booking slug';
          end if;
        end loop;
        insert into public.booking_links (org_id, event_type_id, asset_key, slug, active, consent_text)
        values (
          p_org,
          evt_id,
          booking->>'asset_key',
          chosen,
          coalesce((booking->>'active')::boolean, true),
          coalesce(booking->>'consent_text', '')
        );
      end if;
    end loop;
  end loop;

  if jsonb_typeof(p_payload->'ai_reply') = 'object' then
    tone := coalesce(p_payload #>> '{ai_reply,tone}', '');
    prompt := coalesce(p_payload #>> '{ai_reply,system_prompt}', '');
    insert into public.ai_reply_settings (
      org_id, enabled, mode, tone, system_prompt, max_auto_per_hour, require_human_before_send
    ) values (
      p_org,
      false,
      'draft_only',
      tone,
      prompt,
      least(coalesce((p_payload #>> '{ai_reply,max_auto_per_hour}')::integer, 0), 20),
      true
    )
    on conflict (org_id) do update
      set enabled = false,
          mode = 'draft_only',
          tone = excluded.tone,
          system_prompt = excluded.system_prompt,
          max_auto_per_hour = excluded.max_auto_per_hour,
          require_human_before_send = true,
          updated_at = now();
  end if;

  if jsonb_typeof(p_payload->'ai_knowledge') = 'object' then
    insert into public.ai_knowledge_bases (org_id, entries)
    values (p_org, coalesce(p_payload #> '{ai_knowledge,entries}', '[]'::jsonb))
    on conflict (org_id) do update
      set entries = excluded.entries,
          updated_at = now();
  end if;

  if jsonb_typeof(p_payload->'agent_team') = 'object' then
    team_slug := coalesce(p_payload #>> '{agent_team,template_slug}', '');
    select coalesce(array_agg(entry.value), '{}'::text[])
    into agents
    from jsonb_array_elements_text(coalesce(p_payload #> '{agent_team,agents}', '[]'::jsonb)) as entry(value);
    insert into public.workspace_agent_teams (org_id, template_slug, agents, sandbox, charged)
    values (p_org, team_slug, coalesce(agents, '{}'::text[]), true, false)
    on conflict (org_id) do update
      set template_slug = excluded.template_slug,
          agents = excluded.agents,
          sandbox = true,
          charged = false,
          updated_at = now();

    insert into public.org_bots (org_id, bot_slug, bundle_slug, status, config, sandbox, trial_ends_at)
    select p_org, agent, nullif(team_slug, ''), 'trial', '{}'::jsonb, true, now() + interval '14 days'
    from unnest(coalesce(agents, '{}'::text[])) as agent
    where exists (select 1 from public.bot_catalog catalog where catalog.slug = agent)
    on conflict (org_id, bot_slug) do update
      set sandbox = true,
          status = 'trial',
          updated_at = now();
  end if;

  if jsonb_typeof(p_payload->'website') = 'object' then
    insert into public.client_website_configs (org_id, config)
    values (p_org, p_payload->'website')
    on conflict (org_id) do update
      set config = excluded.config,
          updated_at = now();
  end if;
end;
$$;

create or replace function public.snapshot_export_v2(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base jsonb;
  tags jsonb;
  calendars jsonb := '[]'::jsonb;
  cal record;
  stages jsonb;
  events jsonb;
  weekly jsonb;
  ai jsonb;
  knowledge jsonb;
  team jsonb;
  site jsonb;
  org_slug text;
  result jsonb;
  issues text[];
  shell jsonb := jsonb_build_object(
    'business_name', '{{business.name}}',
    'colours', jsonb_build_object('primary', '{{business.primary_colour}}', 'accent', '{{business.accent_colour}}'),
    'logo_url', '{{business.logo_url}}',
    'phone', '{{business.phone}}',
    'email', '{{business.email}}',
    'address', '{{business.address}}',
    'hours', '{{business.hours}}',
    'services', '[]'::jsonb,
    'booking_url', '{{business.booking_url}}'
  );
begin
  if auth.uid() is null or p_org_id not in (select public.accessible_org_ids()) then
    raise exception 'not allowed';
  end if;

  base := public.snapshot_export(p_org_id);
  select slug into org_slug from public.organizations where id = p_org_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_key', tag.asset_key,
    'name', tag.name,
    'color', tag.color
  ) order by tag.asset_key), '[]'::jsonb)
  into tags
  from public.workspace_tags tag
  where tag.org_id = p_org_id;

  for cal in
    select * from public.calendars
    where org_id = p_org_id and asset_key <> ''
    order by asset_key
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'weekday', row.weekday,
      'start_minute', row.start_minute,
      'end_minute', row.end_minute
    ) order by row.weekday), '[]'::jsonb)
    into weekly
    from public.calendar_availability row
    where row.calendar_id = cal.id and row.kind = 'weekly';

    select coalesce(jsonb_agg(jsonb_build_object(
      'asset_key', event.asset_key,
      'name', event.name,
      'duration_minutes', event.duration_minutes,
      'buffer_before_minutes', event.buffer_before_minutes,
      'buffer_after_minutes', event.buffer_after_minutes,
      'location_mode', event.location_mode,
      'location_detail', event.location_detail,
      'booking', jsonb_build_object(
        'asset_key', link.asset_key,
        'slug_suffix', regexp_replace(link.slug, '^' || org_slug || '-', ''),
        'active', link.active,
        'consent_text', link.consent_text
      )
    ) order by event.asset_key), '[]'::jsonb)
    into events
    from public.calendar_event_types event
    left join public.booking_links link on link.event_type_id = event.id
    where event.calendar_id = cal.id and event.asset_key <> '';

    calendars := calendars || jsonb_build_array(jsonb_build_object(
      'asset_key', cal.asset_key,
      'name', cal.name,
      'timezone', cal.timezone,
      'description', cal.description,
      'active', cal.active,
      'weekly', weekly,
      'event_types', events
    ));
  end loop;

  select jsonb_build_object(
    'enabled', false,
    'mode', 'draft_only',
    'tone', coalesce(settings.tone, ''),
    'system_prompt', coalesce(settings.system_prompt, ''),
    'max_auto_per_hour', least(coalesce(settings.max_auto_per_hour, 0), 20),
    'require_human_before_send', true
  )
  into ai
  from public.ai_reply_settings settings
  where settings.org_id = p_org_id;
  if ai is null then
    ai := jsonb_build_object(
      'enabled', false,
      'mode', 'draft_only',
      'tone', '',
      'system_prompt', '',
      'max_auto_per_hour', 0,
      'require_human_before_send', true
    );
  end if;

  select jsonb_build_object('entries', bases.entries)
  into knowledge
  from public.ai_knowledge_bases bases
  where bases.org_id = p_org_id;
  if knowledge is null then
    knowledge := jsonb_build_object('entries', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'template_slug', teams.template_slug,
    'sandbox', true,
    'charged', false,
    'agents', to_jsonb(teams.agents)
  )
  into team
  from public.workspace_agent_teams teams
  where teams.org_id = p_org_id;
  if team is null then
    team := jsonb_build_object('template_slug', '', 'sandbox', true, 'charged', false, 'agents', '[]'::jsonb);
  end if;

  select configs.config into site from public.client_website_configs configs where configs.org_id = p_org_id;
  if site is null then
    site := shell;
  end if;

  result := base || jsonb_build_object(
    'version', 2,
    'tags', tags,
    'calendars', calendars,
    'ai_reply', ai,
    'ai_knowledge', knowledge,
    'agent_team', team,
    'website', site
  );
  issues := public.snapshot_payload_issues(result);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'snapshot export refused private data';
  end if;
  return result;
end;
$$;

create or replace function public.duplicate_workspace(
  p_source_kind text,
  p_source_id uuid,
  p_swap jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  parent uuid;
  prior public.workspace_duplicates%rowtype;
  snap public.snapshots%rowtype;
  payload jsonb;
  prepared jsonb;
  issues text[];
  clean jsonb;
  chosen_slug text;
  base text;
  n integer := 2;
  new_id uuid;
  enabled boolean;
  primary_colour text;
  accent_colour text;
  industry text;
  sender text;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;
  if p_source_kind not in ('snapshot', 'workspace') then
    raise exception 'Pick a template or a workspace';
  end if;
  if coalesce(p_idempotency_key, '') !~ '^[a-z0-9][a-z0-9_.:-]{7,120}$' then
    raise exception 'idempotency key is invalid';
  end if;

  select o.id into parent
  from public.organizations o
  join public.memberships m on m.org_id = o.id
  where m.user_id = auth.uid()
    and m.role in ('agency_owner', 'agency_staff')
    and o.org_type = 'agency'
  order by (o.slug = 'ai-autotech') desc, o.created_at
  limit 1;
  if parent is null then
    raise exception 'not allowed';
  end if;

  select * into prior
  from public.workspace_duplicates
  where agency_org_id = parent and idempotency_key = p_idempotency_key;
  if found then
    if prior.swap is distinct from p_swap
       or prior.source_kind is distinct from p_source_kind
       or prior.source_id is distinct from p_source_id then
      raise exception 'idempotency key already used';
    end if;
    select sending_enabled into enabled from public.organizations where id = prior.target_org_id;
    if enabled is distinct from false then
      raise exception 'sending must stay off';
    end if;
    return jsonb_build_object(
      'org_id', prior.target_org_id,
      'slug', (select slug from public.organizations where id = prior.target_org_id),
      'sending_enabled', false,
      'idempotent', true,
      'created', false,
      'source_kind', prior.source_kind,
      'source_id', prior.source_id
    );
  end if;

  if length(btrim(coalesce(p_swap->>'name', ''))) < 2 then
    raise exception 'Give the business a name';
  end if;
  if p_swap::text ~* '(sk_live_|whsec_|api[_-]?key[[:space:]]*[:=]|bearer[[:space:]]+[a-z0-9]|secret[[:space:]]*[:=]|javascript:|data:)' then
    raise exception 'That value looks like a key';
  end if;
  if coalesce(p_swap->>'email', '') <> ''
     and p_swap->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'The email address is not usable';
  end if;
  if coalesce(p_swap->>'phone', '') <> ''
     and p_swap->>'phone' !~ '^[0-9+().[:space:]-]{6,24}$' then
    raise exception 'The phone number is not usable';
  end if;
  if coalesce(p_swap->>'logo_url', '') <> '' and p_swap->>'logo_url' !~* '^https?://' then
    raise exception 'The logo URL must start with http:// or https://';
  end if;
  if coalesce(p_swap->>'booking_url', '') <> ''
     and p_swap->>'booking_url' !~* '^https?://'
     and p_swap->>'booking_url' !~ '^/book/' then
    raise exception 'The booking URL is not usable';
  end if;

  primary_colour := case when coalesce(p_swap->>'primary_colour', '') ~ '^#[0-9A-Fa-f]{6}$' then p_swap->>'primary_colour' else '#0B1F3A' end;
  accent_colour := case when coalesce(p_swap->>'accent_colour', '') ~ '^#[0-9A-Fa-f]{6}$' then p_swap->>'accent_colour' else '#2563EB' end;
  base := lower(btrim(coalesce(nullif(btrim(coalesce(p_swap->>'slug', '')), ''), p_swap->>'name')));
  base := btrim(regexp_replace(base, '[^a-z0-9]+', '-', 'g'), '-');
  base := left(base, 48);
  if base = '' then
    raise exception 'Give the workspace a slug';
  end if;
  clean := jsonb_build_object(
    'name', btrim(p_swap->>'name'),
    'slug', base,
    'primary_colour', primary_colour,
    'accent_colour', accent_colour,
    'logo_url', coalesce(p_swap->>'logo_url', ''),
    'phone', coalesce(p_swap->>'phone', ''),
    'email', coalesce(p_swap->>'email', ''),
    'address', coalesce(p_swap->>'address', ''),
    'hours', coalesce(p_swap->>'hours', ''),
    'booking_url', coalesce(p_swap->>'booking_url', ''),
    'services_text', coalesce(p_swap->>'services_text', ''),
    'services', case when jsonb_typeof(p_swap->'services') = 'array' then p_swap->'services' else '[]'::jsonb end
  );

  if p_source_kind = 'snapshot' then
    select * into snap from public.snapshots where id = p_source_id;
    if snap.id is null then
      raise exception 'snapshot not found';
    end if;
    if not public.has_org_role(snap.org_id, array['agency_owner', 'agency_staff']) then
      raise exception 'not allowed';
    end if;
    payload := snap.payload;
    industry := case
      when snap.name ilike '%restaurant%' or snap.name ilike '%burger%' then 'Restaurant'
      when snap.name ilike '%education%' then 'Education'
      else ''
    end;
  else
    if p_source_id not in (select public.accessible_org_ids()) then
      raise exception 'not allowed';
    end if;
    payload := public.snapshot_export_v2(p_source_id);
    industry := '';
  end if;

  prepared := public.snapshot_prepare_duplicate(payload, clean);
  issues := public.snapshot_payload_issues(prepared);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'snapshot payload contains private data';
  end if;

  chosen_slug := base;
  while exists (
    select 1 from public.organizations taken
    where taken.slug = chosen_slug or taken.form_key = chosen_slug
  ) loop
    chosen_slug := base || '-' || n::text;
    n := n + 1;
    if n > 50 then
      raise exception 'Choose a different slug';
    end if;
  end loop;

  sender := btrim(p_swap->>'name');
  insert into public.organizations (
    name, slug, status, org_type, parent_id, legal_name, industry, logo_url,
    primary_color, accent_color, form_key, sending_enabled, sender_name, plan_key, branding, settings
  ) values (
    sender,
    chosen_slug,
    'active',
    'client',
    parent,
    sender,
    industry,
    coalesce(p_swap->>'logo_url', ''),
    primary_colour,
    accent_colour,
    chosen_slug,
    false,
    sender,
    'starter',
    jsonb_build_object('logoUrl', coalesce(p_swap->>'logo_url', ''), 'primaryColor', primary_colour, 'accentColor', accent_colour),
    jsonb_build_object(
      'channels', jsonb_build_object(
        'whatsapp', jsonb_build_object('phoneNumberId', '', 'displayPhone', ''),
        'email', jsonb_build_object('fromAddress', '', 'provider', ''),
        'sms', jsonb_build_object('senderId', '')
      )
    )
  )
  returning id, sending_enabled into new_id, enabled;

  if enabled is distinct from false then
    raise exception 'sending must stay off';
  end if;

  perform public.snapshot_apply_payload(new_id, prepared, true);
  perform public.snapshot_apply_v2_extras(new_id, prepared, chosen_slug);

  select sending_enabled into enabled from public.organizations where id = new_id;
  if enabled is distinct from false then
    raise exception 'sending must stay off';
  end if;

  insert into public.workspace_duplicates (
    agency_org_id, idempotency_key, source_kind, source_id, target_org_id, swap
  ) values (
    parent, p_idempotency_key, p_source_kind, p_source_id, new_id, p_swap
  );

  return jsonb_build_object(
    'org_id', new_id,
    'slug', chosen_slug,
    'sending_enabled', false,
    'idempotent', false,
    'created', true,
    'source_kind', p_source_kind,
    'source_id', p_source_id,
    'plan_key', 'starter'
  );
end;
$$;

revoke all on function public.snapshot_walk_zoned(jsonb, text[], text[], boolean) from public, anon, authenticated;
revoke all on function public.snapshot_swap_text(text, jsonb) from public, anon, authenticated;
revoke all on function public.snapshot_swap_json(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.snapshot_prepare_duplicate(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.snapshot_apply_v2_extras(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.snapshot_export_v2(uuid) from public, anon;
revoke all on function public.duplicate_workspace(text, uuid, jsonb, text) from public, anon;

grant execute on function public.snapshot_export_v2(uuid) to authenticated;
grant execute on function public.duplicate_workspace(text, uuid, jsonb, text) to authenticated;

alter table public.workspace_tags enable row level security;
alter table public.workspace_tags force row level security;
alter table public.client_website_configs enable row level security;
alter table public.client_website_configs force row level security;
alter table public.ai_knowledge_bases enable row level security;
alter table public.ai_knowledge_bases force row level security;
alter table public.workspace_agent_teams enable row level security;
alter table public.workspace_agent_teams force row level security;
alter table public.workspace_duplicates enable row level security;
alter table public.workspace_duplicates force row level security;

drop policy if exists workspace_tags_read on public.workspace_tags;
create policy workspace_tags_read on public.workspace_tags
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists workspace_tags_write on public.workspace_tags;
create policy workspace_tags_write on public.workspace_tags
  for all to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists client_website_configs_read on public.client_website_configs;
create policy client_website_configs_read on public.client_website_configs
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists client_website_configs_write on public.client_website_configs;
create policy client_website_configs_write on public.client_website_configs
  for all to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists ai_knowledge_bases_read on public.ai_knowledge_bases;
create policy ai_knowledge_bases_read on public.ai_knowledge_bases
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists ai_knowledge_bases_write on public.ai_knowledge_bases;
create policy ai_knowledge_bases_write on public.ai_knowledge_bases
  for all to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists workspace_agent_teams_read on public.workspace_agent_teams;
create policy workspace_agent_teams_read on public.workspace_agent_teams
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists workspace_agent_teams_write on public.workspace_agent_teams;
create policy workspace_agent_teams_write on public.workspace_agent_teams
  for all to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists workspace_duplicates_read on public.workspace_duplicates;
create policy workspace_duplicates_read on public.workspace_duplicates
  for select to authenticated
  using (public.has_org_role(agency_org_id, array['agency_owner', 'agency_staff']));

revoke all on public.workspace_tags from public, anon;
revoke all on public.client_website_configs from public, anon;
revoke all on public.ai_knowledge_bases from public, anon;
revoke all on public.workspace_agent_teams from public, anon;
revoke all on public.workspace_duplicates from public, anon;
grant select, insert, update, delete on public.workspace_tags to authenticated;
grant select, insert, update, delete on public.client_website_configs to authenticated;
grant select, insert, update, delete on public.ai_knowledge_bases to authenticated;
grant select, insert, update, delete on public.workspace_agent_teams to authenticated;
grant select on public.workspace_duplicates to authenticated;

-- crm_message_templates.key clashes with the plpgsql variable in snapshot_write_template
-- once org scope adds org_id. Qualify the variable so duplicate can store drafts.
create or replace function public.snapshot_write_template(p_org uuid, item jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  asset text := item->>'asset_key';
  doc jsonb;
  sum text;
  existing message_templates%rowtype;
  result text;
  crm_edited boolean := false;
begin
  if asset is null or btrim(asset) = '' then
    raise exception 'template asset_key required';
  end if;
  if item->>'channel' not in ('whatsapp', 'email', 'sms') then
    raise exception 'template channel is invalid';
  end if;
  doc := public.snapshot_template_doc(
    asset,
    item->>'channel',
    item->>'name',
    coalesce(item->>'subject', ''),
    coalesce(item->>'body', ''),
    coalesce((item->>'active')::boolean, true)
  );
  sum := public.snapshot_checksum(doc);
  if to_regclass('public.crm_message_templates') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'crm_message_templates' and column_name = 'org_id'
     ) then
    select checksum is distinct from source_checksum into crm_edited
    from crm_message_templates
    where org_id = p_org and asset_key = asset
    limit 1;
  end if;
  select * into existing from message_templates where org_id = p_org and asset_key = asset;
  if not found then
    insert into message_templates (org_id, asset_key, channel, name, subject, body, active, source_checksum)
    values (
      p_org,
      asset,
      item->>'channel',
      item->>'name',
      coalesce(item->>'subject', ''),
      coalesce(item->>'body', ''),
      coalesce((item->>'active')::boolean, true),
      sum
    );
    result := 'created';
  elsif (not p_force) and (existing.checksum is distinct from existing.source_checksum or coalesce(crm_edited, false)) then
    result := 'skipped_client_edit';
  elsif existing.checksum = sum then
    result := 'unchanged';
  else
    update message_templates
    set channel = item->>'channel',
        name = item->>'name',
        subject = coalesce(item->>'subject', ''),
        body = coalesce(item->>'body', ''),
        active = coalesce((item->>'active')::boolean, true),
        source_checksum = sum,
        updated_at = now()
    where id = existing.id;
    result := 'updated';
  end if;
  return jsonb_build_object('asset_key', asset, 'kind', 'message_template', 'result', result);
end;
$$;

revoke all on function public.snapshot_write_template(uuid, jsonb, boolean) from public, anon, authenticated;

-- SEED_TEMPLATES

do $seed$
declare
  agency uuid;
  restaurant_payload jsonb := $restaurant${"version":2,"pipelines":[{"asset_key":"pipeline:restaurant","name":"Restaurant","is_default":true,"stages":[{"asset_key":"stage:restaurant:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:restaurant:held","name":"Booking held","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:restaurant:seated","name":"Seated","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:restaurant:review","name":"Review asked","position":4,"is_won":false,"is_lost":false},{"asset_key":"stage:restaurant:regular","name":"Regular","position":5,"is_won":true,"is_lost":false},{"asset_key":"stage:restaurant:lost","name":"Lost","position":6,"is_won":false,"is_lost":true}]}],"message_templates":[{"asset_key":"template:restaurant:booking-whatsapp","channel":"whatsapp","name":"Booking confirmation","subject":"","body":"Hi {{firstName}}, {{business.name}} is holding a table. Address: {{business.address}}. Hours: {{business.hours}}. This is a draft and is not sent.","active":false},{"asset_key":"template:restaurant:booking-email","channel":"email","name":"Booking confirmation","subject":"Table at {{business.name}}","body":"Hi {{firstName}}, {{business.name}} is holding a table at {{business.address}}. This is a draft and is not sent.","active":false},{"asset_key":"template:restaurant:booking-sms","channel":"sms","name":"Booking confirmation","subject":"","body":"{{business.name}} is holding a table. This is a draft and is not sent.","active":false},{"asset_key":"template:restaurant:review-whatsapp","channel":"whatsapp","name":"Review request","subject":"","body":"Hi {{firstName}}, how was {{business.name}}? This review request is a draft and is not sent.","active":false},{"asset_key":"template:restaurant:winback-email","channel":"email","name":"Win-back","subject":"We miss you at {{business.name}}","body":"Hi {{firstName}}, {{business.name}} would like to see you again. Hours: {{business.hours}}. This is a draft and is not sent.","active":false},{"asset_key":"template:restaurant:winback-sms","channel":"sms","name":"Win-back","subject":"","body":"{{business.name}} win-back note. This is a draft and is not sent.","active":false}],"sequences":[{"asset_key":"sequence:restaurant:booking","name":"Booking confirmation","active":false,"steps":[{"asset_key":"step:restaurant:booking:whatsapp","position":1,"delay_hours":0,"channel":"whatsapp","template_asset_key":"template:restaurant:booking-whatsapp"},{"asset_key":"step:restaurant:booking:email","position":2,"delay_hours":0,"channel":"email","template_asset_key":"template:restaurant:booking-email"},{"asset_key":"step:restaurant:booking:sms","position":3,"delay_hours":0,"channel":"sms","template_asset_key":"template:restaurant:booking-sms"}]},{"asset_key":"sequence:restaurant:review","name":"Review request","active":false,"steps":[{"asset_key":"step:restaurant:review:whatsapp","position":1,"delay_hours":24,"channel":"whatsapp","template_asset_key":"template:restaurant:review-whatsapp"}]},{"asset_key":"sequence:restaurant:winback","name":"Win-back","active":false,"steps":[{"asset_key":"step:restaurant:winback:email","position":1,"delay_hours":168,"channel":"email","template_asset_key":"template:restaurant:winback-email"},{"asset_key":"step:restaurant:winback:sms","position":2,"delay_hours":168,"channel":"sms","template_asset_key":"template:restaurant:winback-sms"}]}],"custom_fields":[{"asset_key":"field:restaurant:party","entity":"lead","field_key":"party_size","label":"Party size","field_type":"text","options":[],"required":false,"position":1},{"asset_key":"field:restaurant:seating","entity":"lead","field_key":"seating","label":"Seating","field_type":"text","options":[],"required":false,"position":2},{"asset_key":"field:restaurant:favourite","entity":"lead","field_key":"favourite_order","label":"Favourite order","field_type":"text","options":[],"required":false,"position":3}],"workflows":[{"asset_key":"workflow:restaurant:booking-confirmation","name":"Booking confirmation","active":false,"trigger_type":"appointment.booked","trigger":{},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"Draft a booking confirmation for {{business.name}}. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:restaurant:review-request","name":"Review request","active":false,"trigger_type":"lead.stage_changed","trigger":{},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"Draft a review request for {{business.name}}. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:restaurant:win-back","name":"Win-back","active":false,"trigger_type":"message.no_reply","trigger":{"after_hours":168},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"Draft a win-back note for {{business.name}}. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]}],"tags":[{"asset_key":"tag:restaurant:walk-in","name":"Walk-in","color":"#0B1F3A"},{"asset_key":"tag:restaurant:booking","name":"Booking","color":"#2563EB"},{"asset_key":"tag:restaurant:no-show","name":"No-show","color":"#B45309"},{"asset_key":"tag:restaurant:regular","name":"Regular","color":"#0F766E"},{"asset_key":"tag:restaurant:review","name":"Review","color":"#7C3AED"}],"calendars":[{"asset_key":"calendar:restaurant:tables","name":"Table bookings","timezone":"Africa/Johannesburg","description":"Covers for {{business.name}}.","active":true,"weekly":[{"weekday":0,"start_minute":660,"end_minute":1260},{"weekday":1,"start_minute":660,"end_minute":1260},{"weekday":2,"start_minute":660,"end_minute":1260},{"weekday":3,"start_minute":660,"end_minute":1260},{"weekday":4,"start_minute":660,"end_minute":1260},{"weekday":5,"start_minute":660,"end_minute":1260},{"weekday":6,"start_minute":660,"end_minute":1260}],"event_types":[{"asset_key":"event:restaurant:table","name":"Table booking","duration_minutes":90,"buffer_before_minutes":0,"buffer_after_minutes":0,"location_mode":"in_person","location_detail":"{{business.address}}","booking":{"asset_key":"booking:restaurant:table","slug_suffix":"table","active":true,"consent_text":"I agree that {{business.name}} may store my name and phone number to hold this table. Nothing is sent automatically."}}]}],"ai_reply":{"enabled":false,"mode":"draft_only","tone":"Warm and short.","system_prompt":"Draft replies for {{business.name}}, a restaurant. Hours: {{business.hours}}. Address: {{business.address}}. Use the menu in the knowledge base. Do not invent prices. Do not send.","max_auto_per_hour":0,"require_human_before_send":true},"ai_knowledge":{"entries":[{"asset_key":"kb:restaurant:hours","title":"Hours","body":"{{business.name}} is open {{business.hours}}."},{"asset_key":"kb:restaurant:menu","title":"Menu","body":"{{business.services_text}}"},{"asset_key":"kb:restaurant:find-us","title":"Find us","body":"{{business.name}} is at {{business.address}}. Phone {{business.phone}}. Mail {{business.email}}."}]},"agent_team":{"template_slug":"restaurant-food","sandbox":true,"charged":false,"agents":["receptionist","reminder-drafts","review-replies","social-posting","offer-manager"]},"website":{"business_name":"{{business.name}}","colours":{"primary":"{{business.primary_colour}}","accent":"{{business.accent_colour}}"},"logo_url":"{{business.logo_url}}","phone":"{{business.phone}}","email":"{{business.email}}","address":"{{business.address}}","hours":"{{business.hours}}","services":[{"name":"Classic burger","price_label":"R89"},{"name":"Cheese burger","price_label":"R99"},{"name":"Chips","price_label":"R35"},{"name":"Milkshake","price_label":"R45"}],"booking_url":"{{business.booking_url}}"}}$restaurant$::jsonb;
  agency_extras jsonb := $extras${"version":2,"tags":[{"asset_key":"tag:agency:new-lead","name":"New lead","color":"#0B1F3A"},{"asset_key":"tag:agency:audit","name":"Audit","color":"#2563EB"},{"asset_key":"tag:agency:proposal","name":"Proposal","color":"#0F766E"}],"calendars":[{"asset_key":"calendar:agency:audit","name":"Audit calls","timezone":"Africa/Johannesburg","description":"Short audit calls for {{business.name}}.","active":true,"weekly":[{"weekday":1,"start_minute":480,"end_minute":1020},{"weekday":2,"start_minute":480,"end_minute":1020},{"weekday":3,"start_minute":480,"end_minute":1020},{"weekday":4,"start_minute":480,"end_minute":1020},{"weekday":5,"start_minute":480,"end_minute":1020}],"event_types":[{"asset_key":"event:agency:audit","name":"Audit call","duration_minutes":20,"buffer_before_minutes":0,"buffer_after_minutes":0,"location_mode":"phone","location_detail":"Phone call","booking":{"asset_key":"booking:agency:audit","slug_suffix":"audit","active":true,"consent_text":"I agree that {{business.name}} may store my name and phone number for this audit call. Nothing is sent automatically."}}]}],"ai_reply":{"enabled":false,"mode":"draft_only","tone":"Warm and short.","system_prompt":"Draft replies for {{business.name}}. Hours: {{business.hours}}. Address: {{business.address}}. Do not invent prices. Do not send.","max_auto_per_hour":0,"require_human_before_send":true},"ai_knowledge":{"entries":[{"asset_key":"kb:agency:hours","title":"Hours","body":"{{business.name}} is open {{business.hours}}."},{"asset_key":"kb:agency:services","title":"Services","body":"{{business.services_text}}"},{"asset_key":"kb:agency:find-us","title":"Find us","body":"{{business.name}} is at {{business.address}}. Phone {{business.phone}}."}]},"agent_team":{"template_slug":"ai-automation-agency","sandbox":true,"charged":false,"agents":["inbound-lead","outbound-sales","proposal-writer","onboarding","ads","social-posting","support-replies","blog-drafts"]},"website":{"business_name":"{{business.name}}","colours":{"primary":"{{business.primary_colour}}","accent":"{{business.accent_colour}}"},"logo_url":"{{business.logo_url}}","phone":"{{business.phone}}","email":"{{business.email}}","address":"{{business.address}}","hours":"{{business.hours}}","services":[{"name":"Free audit","price_label":"Quote"},{"name":"CRM setup","price_label":"Quote"},{"name":"Lead follow-up","price_label":"Quote"}],"booking_url":"{{business.booking_url}}"}}$extras$::jsonb;
  agency_drafts jsonb := $drafts$[{"asset_key":"workflow:agency:new-lead-draft","name":"New lead draft","active":false,"trigger_type":"lead.created","trigger":{},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"A new lead arrived for {{business.name}}. This note is a draft. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:agency:audit-booked-draft","name":"Audit booked draft","active":false,"trigger_type":"appointment.booked","trigger":{},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"An audit was booked for {{business.name}}. This note is a draft. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:agency:no-reply-draft","name":"No reply draft","active":false,"trigger_type":"message.no_reply","trigger":{"after_hours":24},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"No reply yet for {{business.name}}. This note is a draft. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]}]$drafts$::jsonb;
  current jsonb;
  kept jsonb;
  issues text[];
begin
  select id into agency from public.organizations where slug = 'ai-autotech';
  if agency is null then
    raise notice 'ai-autotech organisation is missing; template seeds skipped';
    return;
  end if;

  issues := public.snapshot_payload_issues(restaurant_payload);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'restaurant template contains private data: %', issues;
  end if;

  insert into public.snapshots (id, org_id, name, description, payload)
  values (
    'a2c00000-0000-4000-8000-000000000003',
    agency,
    'Restaurant / burger joint',
    'Table bookings, a menu, draft follow-ups, and a sandbox restaurant team. Applying it does not send anything.',
    restaurant_payload
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    payload = excluded.payload,
    updated_at = now();

  select payload into current from public.snapshots where id = 'a2c00000-0000-4000-8000-000000000001';
  if current is null then
    return;
  end if;

  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into kept
  from jsonb_array_elements(coalesce(current->'workflows', '[]'::jsonb)) as item
  where coalesce(item->>'asset_key', '') not in (
    'workflow:agency:new-lead-draft',
    'workflow:agency:audit-booked-draft',
    'workflow:agency:no-reply-draft'
  );

  current := current || agency_extras;
  current := jsonb_set(current, '{workflows}', kept || agency_drafts, true);
  issues := public.snapshot_payload_issues(current);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'agency template contains private data: %', issues;
  end if;

  update public.snapshots
  set payload = current,
      description = 'AI AutoTech sales pipeline, follow-up sequences, message templates, and draft workflows. Applying it does not send anything.',
      updated_at = now()
  where id = 'a2c00000-0000-4000-8000-000000000001';
end
$seed$;

-- >>> supabase/migrations/20261112120200_phase5p_free_trial.sql

-- Phase 5p: public free trial workspaces.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Nothing in this file writes crm_outbox except holding already queued rows when a trial pauses.
-- Nothing in this file sends email, SMS, or WhatsApp.
-- Leave FREE_TRIAL_ENABLED unset until this file is applied. Unset means /start creates nothing.
-- Apply after 20261112120100_phase5p_workspace_templates.sql.
-- Do not apply this file until Billy says yes. Do not use supabase db push from this change alone.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.memberships') is null
     or to_regclass('public.snapshots') is null
     or to_regclass('public.crm_leads') is null
     or to_regclass('public.org_subscriptions') is null then
    raise exception 'free trial needs agency, snapshots, leads, and billing; apply earlier migrations first';
  end if;
  if to_regprocedure('public.duplicate_workspace(text,uuid,jsonb,text)') is null then
    raise exception 'free trial needs duplicate_workspace; apply 20261112120100_phase5p_workspace_templates.sql first';
  end if;
  if to_regprocedure('public.record_owner_notification(uuid,text,text,text,text,text,text)') is null then
    raise exception 'free trial needs record_owner_notification; apply 20261112120000_phase5p_sales_funnel.sql first';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_leads' and column_name = 'org_id'
  ) then
    raise exception 'free trial needs org_id on crm_leads; apply phase 2a before this file';
  end if;
  if not exists (select 1 from public.plans where code = 'starter') then
    raise exception 'free trial needs the starter plan; apply 20261019120000_phase2f_billing.sql first';
  end if;
end
$need$;

create table if not exists public.workspace_trials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  agency_org_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid not null,
  email text not null,
  contact_name text not null,
  phone text not null,
  business_name text not null,
  popia_consent_at timestamptz not null,
  popia_consent_text text not null,
  status text not null default 'trialing' check (status in ('trialing', 'paused')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  paused_at timestamptz,
  warning_notified_at timestamptz,
  lead_id text not null default '',
  created_at timestamptz not null default now(),
  constraint workspace_trials_email_check check (
    email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint workspace_trials_ends_check check (ends_at > started_at),
  constraint workspace_trials_consent_check check (length(btrim(popia_consent_text)) between 20 and 500)
);

create unique index if not exists workspace_trials_email_idx on public.workspace_trials (email);
create index if not exists workspace_trials_due_idx on public.workspace_trials (ends_at) where status = 'trialing';

create table if not exists public.free_trial_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  email text not null default '',
  created_at timestamptz not null default now(),
  constraint free_trial_attempts_ip_check check (ip_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists free_trial_attempts_ip_idx on public.free_trial_attempts (ip_hash, created_at desc);

alter table public.workspace_trials enable row level security;
alter table public.workspace_trials force row level security;
alter table public.free_trial_attempts enable row level security;
alter table public.free_trial_attempts force row level security;

drop policy if exists workspace_trials_read on public.workspace_trials;
create policy workspace_trials_read on public.workspace_trials
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    or public.has_org_role(agency_org_id, array['agency_owner', 'agency_staff'])
  );

revoke all on table public.workspace_trials from public, anon;
revoke all on table public.free_trial_attempts from public, anon, authenticated;
grant select on table public.workspace_trials to authenticated;

create or replace function public.start_free_trial(
  p_snapshot_id uuid,
  p_business_name text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_popia boolean,
  p_days integer,
  p_ip_hash text,
  p_honeypot text,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  parent uuid;
  owner_id uuid;
  existing public.workspace_trials%rowtype;
  snap public.snapshots%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_name text := btrim(coalesce(p_business_name, ''));
  v_contact text := btrim(coalesce(p_contact_name, ''));
  v_days integer := coalesce(p_days, 14);
  base text;
  swap jsonb;
  dup jsonb;
  new_org uuid;
  chosen_slug text;
  enabled boolean;
  ends_at timestamptz;
  v_lead text;
  v_key text;
  consent text := 'I consent to AI AutoTech processing my name, email, phone, and business name to open this free trial, under POPIA. I can ask for the workspace to be closed. This form does not send email, SMS, or WhatsApp.';
  recent integer;
begin
  if jwt_role = '' then
    begin
      jwt_role := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if auth.uid() is not null or jwt_role in ('authenticated', 'anon') then
    raise exception 'not allowed';
  end if;

  if coalesce(p_ip_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'rate limit key is invalid';
  end if;

  select count(*)::int into recent
  from public.free_trial_attempts attempt
  where attempt.ip_hash = p_ip_hash
    and attempt.created_at > p_now - interval '10 minutes';
  if recent >= 5 then
    raise exception 'Too many trial requests. Please try again later.';
  end if;

  insert into public.free_trial_attempts (ip_hash, email)
  values (p_ip_hash, left(v_email, 160));

  if btrim(coalesce(p_honeypot, '')) <> '' then
    return jsonb_build_object('ok', true, 'stored', false, 'created', false, 'charged', false, 'sending_enabled', false);
  end if;

  if p_popia is distinct from true then
    raise exception 'POPIA consent is required';
  end if;
  if length(v_contact) < 2 or length(v_contact) > 80 then
    raise exception 'Give your name';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Give the business a name';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'The email address is not usable';
  end if;
  if v_phone !~ '^[0-9+().[:space:]-]{6,24}$' then
    raise exception 'The phone number is not usable';
  end if;
  if v_days < 1 or v_days > 90 then
    v_days := 14;
  end if;

  select id into parent
  from public.organizations
  where slug = 'ai-autotech' and org_type = 'agency';
  if parent is null then
    raise exception 'An agency workspace is required before a trial can start';
  end if;

  select m.user_id into owner_id
  from public.memberships m
  where m.org_id = parent and m.role = 'agency_owner'
  order by m.created_at
  limit 1;
  if owner_id is null then
    raise exception 'An agency owner is required before a trial can start';
  end if;

  select * into existing from public.workspace_trials where email = v_email;
  if found then
    if existing.status = 'paused' then
      raise exception 'This email already used a free trial';
    end if;
    select slug, sending_enabled into chosen_slug, enabled
    from public.organizations where id = existing.org_id;
    if enabled is distinct from false then
      raise exception 'sending must stay off';
    end if;
    return jsonb_build_object(
      'ok', true,
      'stored', true,
      'created', false,
      'idempotent', true,
      'org_id', existing.org_id,
      'slug', chosen_slug,
      'status', existing.status,
      'ends_at', existing.ends_at,
      'lead_id', existing.lead_id,
      'sending_enabled', false,
      'charged', false
    );
  end if;

  select * into snap from public.snapshots where id = p_snapshot_id and org_id = parent;
  if snap.id is null then
    raise exception 'Pick a template';
  end if;

  base := lower(v_name);
  base := btrim(regexp_replace(base, '[^a-z0-9]+', '-', 'g'), '-');
  base := left(base, 48);
  if base = '' or length(base) < 2 then
    raise exception 'Give the workspace a slug';
  end if;

  swap := jsonb_build_object(
    'name', v_name,
    'slug', base,
    'primary_colour', '#0B1F3A',
    'accent_colour', '#2563EB',
    'logo_url', '',
    'phone', v_phone,
    'email', v_email,
    'address', '',
    'hours', '',
    'booking_url', '',
    'services_text', '',
    'services', '[]'::jsonb
  );
  v_key := 'trial.' || substr(md5(v_email), 1, 32);
  ends_at := p_now + make_interval(days => v_days);
  v_lead := 'ft' || substr(md5(v_email || p_snapshot_id::text), 1, 16);

  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  -- A new statement so auth.uid() sees the owner. duplicate_workspace is unchanged.
  execute 'select public.duplicate_workspace($1, $2, $3, $4)'
    into dup
    using 'snapshot', p_snapshot_id, swap, v_key;
  new_org := (dup->>'org_id')::uuid;
  chosen_slug := dup->>'slug';

  select sending_enabled into enabled from public.organizations where id = new_org;
  if enabled is distinct from false then
    raise exception 'sending must stay off';
  end if;

  insert into public.workspace_trials (
    org_id, agency_org_id, snapshot_id, email, contact_name, phone, business_name,
    popia_consent_at, popia_consent_text, status, started_at, ends_at, lead_id
  ) values (
    new_org, parent, p_snapshot_id, v_email, v_contact, v_phone, v_name,
    p_now, consent, 'trialing', p_now, ends_at, v_lead
  );

  insert into public.org_subscriptions (
    org_id, plan_code, provider, status, current_period_end, next_charge_at, sandbox
  ) values (
    new_org, 'starter', 'manual', 'trialing', ends_at, null, true
  );

  insert into public.crm_leads (
    id, org_id, name, company, phone, email, stage, source, notes, marketing_consent, enrolled, ord
  ) values (
    v_lead,
    parent,
    v_contact,
    v_name,
    v_phone,
    v_email,
    'New',
    'free_trial',
    'Free trial. Niche snapshot ' || snap.name || E'\nPOPIA consent recorded for processing this trial. Marketing consent is off. Sending stays off. Nothing was charged.',
    false,
    false,
    0
  );

  execute 'select public.record_owner_notification($1, $2, $3, $4, $5, $6, $7)'
    using
      parent,
      'contact',
      left('Free trial started for ' || v_name, 160),
      left(
        'Free trial started for ' || v_name || ' (' || v_contact || '). '
        || 'Source: free_trial. Ends ' || to_char(ends_at at time zone 'UTC', 'YYYY-MM-DD') || '. '
        || 'Internal alert. Nothing is sent to the lead. Nothing was charged.',
        2000
      ),
      '/command-centre/leads/' || v_lead,
      v_lead,
      left('contact:trial-start:' || v_lead, 180);

  return jsonb_build_object(
    'ok', true,
    'stored', true,
    'created', true,
    'idempotent', false,
    'org_id', new_org,
    'slug', chosen_slug,
    'status', 'trialing',
    'ends_at', ends_at,
    'lead_id', v_lead,
    'sending_enabled', false,
    'charged', false
  );
end;
$$;

create or replace function public.expire_free_trials(
  p_now timestamptz default now(),
  p_warn_days integer default 2
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  rec public.workspace_trials%rowtype;
  warn_days integer := coalesce(p_warn_days, 2);
  paused integer := 0;
  warned integer := 0;
  held integer;
  org_name text;
begin
  if jwt_role = '' then
    begin
      jwt_role := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if auth.uid() is not null or jwt_role in ('authenticated', 'anon') then
    raise exception 'not allowed';
  end if;
  if warn_days < 1 or warn_days > 14 then
    warn_days := 2;
  end if;

  for rec in
    select * from public.workspace_trials
    where status = 'trialing' and ends_at <= p_now
    order by ends_at
  loop
    update public.organizations
    set status = 'suspended', sending_enabled = false, updated_at = p_now
    where id = rec.org_id and status is distinct from 'archived';

    update public.org_subscriptions
    set status = 'suspended', suspended_at = p_now, sandbox = true, updated_at = p_now
    where org_id = rec.org_id and status is distinct from 'cancelled';

    update public.workspace_trials
    set status = 'paused', paused_at = p_now
    where id = rec.id and status = 'trialing';

    held := 0;
    if to_regclass('public.crm_outbox') is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'org_id'
       ) then
      execute
        'with held_rows as (
           update public.crm_outbox
           set status = ''held''
           where org_id = $1 and status in (''queued'', ''approved'')
           returning 1
         )
         select count(*)::int from held_rows'
      into held
      using rec.org_id;
    end if;

    select name into org_name from public.organizations where id = rec.org_id;
    perform public.record_owner_notification(
      rec.agency_org_id,
      'contact',
      left('Free trial ended for ' || coalesce(org_name, rec.business_name), 160),
      left(
        'Free trial ended for ' || coalesce(org_name, rec.business_name) || '. '
        || 'The workspace is read-only. Data was not deleted. Sending stays off. Nothing was charged.',
        2000
      ),
      case when rec.lead_id <> '' then '/command-centre/leads/' || rec.lead_id else '/command-centre/billing' end,
      rec.lead_id,
      left('contact:trial-end:' || rec.org_id::text, 180)
    );
    paused := paused + 1;
  end loop;

  for rec in
    select * from public.workspace_trials
    where status = 'trialing'
      and warning_notified_at is null
      and ends_at > p_now
      and ends_at <= p_now + make_interval(days => warn_days)
    order by ends_at
  loop
    select name into org_name from public.organizations where id = rec.org_id;
    perform public.record_owner_notification(
      rec.agency_org_id,
      'contact',
      left('Free trial ending for ' || coalesce(org_name, rec.business_name), 160),
      left(
        'Free trial ending for ' || coalesce(org_name, rec.business_name) || '. '
        || 'It pauses when the end date passes. Data is kept. Nothing is sent to the lead. Nothing is charged.',
        2000
      ),
      case when rec.lead_id <> '' then '/command-centre/leads/' || rec.lead_id else '/command-centre/billing' end,
      rec.lead_id,
      left('contact:trial-warn:' || rec.org_id::text, 180)
    );
    update public.workspace_trials
    set warning_notified_at = p_now
    where id = rec.id and warning_notified_at is null;
    warned := warned + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'paused', paused,
    'warned', warned,
    'deleted', 0,
    'charged', false,
    'sending_enabled', false
  );
end;
$$;

create or replace function public.claim_free_trial()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  actor_email text;
  trial public.workspace_trials%rowtype;
  chosen_slug text;
  enabled boolean;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;
  select lower(btrim(coalesce(u.email, ''))) into actor_email
  from auth.users u
  where u.id = uid;
  if actor_email is null or actor_email = '' then
    raise exception 'Sign in required';
  end if;
  select * into trial from public.workspace_trials where email = actor_email;
  if trial.id is null then
    raise exception 'No free trial for this email';
  end if;
  insert into public.memberships (user_id, org_id, role)
  values (uid, trial.org_id, 'client_admin')
  on conflict (user_id, org_id) do nothing;
  select slug, sending_enabled into chosen_slug, enabled
  from public.organizations where id = trial.org_id;
  if enabled is distinct from false then
    raise exception 'sending must stay off';
  end if;
  return jsonb_build_object(
    'ok', true,
    'slug', chosen_slug,
    'status', trial.status,
    'sending_enabled', false,
    'charged', false
  );
end;
$$;

revoke all on function public.start_free_trial(uuid, text, text, text, text, boolean, integer, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.expire_free_trials(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.claim_free_trial() from public, anon;
grant execute on function public.claim_free_trial() to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.start_free_trial(uuid, text, text, text, text, boolean, integer, text, text, timestamptz) to service_role;
    grant execute on function public.expire_free_trials(timestamptz, integer) to service_role;
    grant select, insert on table public.free_trial_attempts to service_role;
    grant select, insert, update on table public.workspace_trials to service_role;
  end if;
end
$service_grants$;

-- >>> supabase/migrations/20261112120500_phase5p_salesperson_commissions.sql

-- Salesperson / affiliate commission ledger.
-- Additive. No rows are deleted. sending is not turned on.
-- Rows are a workspace record of amounts staff entered. sandbox must stay true.
-- This file does not call a payment provider and does not move money.
-- The 30 percent default is a placeholder until the workspace owner sets it.
-- This is record-keeping, not tax, payroll, or legal advice.
-- Needs organisations, workspace_deals, crm_leads, accessible_org_ids, and has_org_role.
-- Not part of APPLY-ORDER steps 20 through 36. Do not paste it in that list.

do $commission_need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.workspace_deals') is null
     or to_regclass('public.crm_leads') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'salesperson commissions need organisations, workspace_deals, crm_leads, accessible_org_ids, and has_org_role';
  end if;
end
$commission_need$;

create table if not exists public.commission_salespeople (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact text not null default '',
  code text not null,
  active boolean not null default true,
  percent numeric(5,2) not null default 30 check (percent >= 0 and percent <= 100),
  basis text not null default 'gross_received' check (basis = 'gross_received'),
  cadence text not null default 'once_off' check (cadence in ('once_off', 'recurring')),
  month_limit integer,
  sandbox boolean not null default true check (sandbox),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_salespeople_name_len check (char_length(btrim(name)) between 1 and 80),
  constraint commission_salespeople_contact_len check (char_length(contact) <= 120),
  constraint commission_salespeople_code_fmt check (code ~ '^[A-Z0-9]{4,12}$'),
  constraint commission_salespeople_month_limit check (
    (cadence = 'once_off' and month_limit is null)
    or (cadence = 'recurring' and (month_limit is null or (month_limit >= 1 and month_limit <= 36)))
  )
);

create unique index if not exists commission_salespeople_org_code_uidx
  on public.commission_salespeople (org_id, code);
create index if not exists commission_salespeople_org_idx
  on public.commission_salespeople (org_id, active, name);

comment on table public.commission_salespeople is
  'Affiliate record for one workspace. The percent is a placeholder until the owner sets it. sandbox stays true. No payout is sent.';

comment on column public.commission_salespeople.percent is
  'Placeholder percent of the gross amount received. Default 30 until the owner changes it. Not a tax rate.';

comment on column public.commission_salespeople.basis is
  'gross_received: commission uses the amount staff recorded as received, not the quoted deal total.';

create table if not exists public.commission_attributions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  salesperson_id uuid not null references public.commission_salespeople(id) on delete cascade,
  lead_id text,
  deal_id uuid,
  source text not null check (source in ('code', 'manual')),
  title text not null default 'Sale',
  sandbox boolean not null default true check (sandbox),
  attributed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint commission_attributions_subject check (lead_id is not null or deal_id is not null)
);

create unique index if not exists commission_attributions_lead_uidx
  on public.commission_attributions (org_id, lead_id)
  where lead_id is not null;
create unique index if not exists commission_attributions_deal_uidx
  on public.commission_attributions (org_id, deal_id)
  where deal_id is not null;
create index if not exists commission_attributions_person_idx
  on public.commission_attributions (salesperson_id, created_at desc);

comment on table public.commission_attributions is
  'Links a salesperson to a lead by code, or to a deal by a staff member. One live link per lead and per deal.';

do $commission_attr_fk$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'commission_attributions_lead_fk'
  ) then
    alter table public.commission_attributions
      add constraint commission_attributions_lead_fk
      foreign key (lead_id) references public.crm_leads(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'commission_attributions_deal_fk'
  ) then
    alter table public.commission_attributions
      add constraint commission_attributions_deal_fk
      foreign key (deal_id) references public.workspace_deals(id) on delete cascade;
  end if;
end
$commission_attr_fk$;

create table if not exists public.commission_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  attribution_id uuid not null references public.commission_attributions(id) on delete cascade,
  salesperson_id uuid not null references public.commission_salespeople(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  method text not null default 'eft' check (method in ('eft', 'other')),
  paid_on date not null,
  sandbox boolean not null default true check (sandbox),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists commission_receipts_attr_idx
  on public.commission_receipts (attribution_id, paid_on);

comment on table public.commission_receipts is
  'Amount staff recorded as received, including a manual EFT. Recording this row is the paid mark. No provider is called.';

create table if not exists public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  salesperson_id uuid not null references public.commission_salespeople(id) on delete cascade,
  attribution_id uuid not null references public.commission_attributions(id) on delete cascade,
  receipt_id uuid not null unique references public.commission_receipts(id) on delete cascade,
  title text not null default 'Sale',
  amount_cents bigint not null check (amount_cents >= 0),
  basis_cents bigint not null check (basis_cents > 0),
  percent numeric(5,2) not null check (percent >= 0 and percent <= 100),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'void')),
  period_index integer not null default 1 check (period_index >= 1),
  sandbox boolean not null default true check (sandbox),
  approved_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commission_ledger_person_idx
  on public.commission_ledger (salesperson_id, created_at desc);
create index if not exists commission_ledger_org_idx
  on public.commission_ledger (org_id, status);

comment on table public.commission_ledger is
  'Commission record. status paid is a mark by the owner. The row stays. No money is sent. Not a tax invoice.';

create table if not exists public.commission_audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists commission_audit_org_idx
  on public.commission_audit (org_id, created_at desc);

comment on table public.commission_audit is
  'Who changed a salesperson, attribution, receipt, or ledger mark. Owners can read it.';

create or replace function public.commission_code_key(p_raw text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(p_raw, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

create or replace function public.commission_cents(p_amount bigint, p_percent numeric)
returns bigint
language sql
immutable
as $$
  select case
    when p_amount is null or p_amount <= 0 then 0
    when p_percent is null or p_percent < 0 or p_percent > 100 then 0
    else round((p_amount::numeric * p_percent) / 100)::bigint
  end;
$$;

create or replace function public.save_commission_salesperson(
  p_org uuid,
  p_salesperson uuid,
  p_name text,
  p_contact text,
  p_code text,
  p_active boolean,
  p_percent numeric,
  p_cadence text,
  p_month_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_contact text := left(btrim(coalesce(p_contact, '')), 120);
  v_code text := public.commission_code_key(p_code);
  v_percent numeric(5,2) := round(coalesce(p_percent, 30), 2);
  v_cadence text := coalesce(p_cadence, 'once_off');
  v_limit integer := p_month_limit;
  v_active boolean := coalesce(p_active, true);
  v_id uuid;
  v_before jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Sign in as the workspace owner. Nothing was saved and no money was sent.');
  end if;
  if not public.has_org_role(p_org, array['agency_owner']) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'The workspace owner updates salespeople. Nothing was saved and no money was sent.');
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'reason', 'bad_name', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Add the salesperson name. Nothing was saved.');
  end if;
  if v_code is null or v_code !~ '^[A-Z0-9]{4,12}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_code', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Use a code of 4 to 12 letters or digits. Nothing was saved.');
  end if;
  if v_percent < 0 or v_percent > 100 then
    return jsonb_build_object('ok', false, 'reason', 'bad_percent', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Percent must be from 0 to 100. Nothing was saved.');
  end if;
  if v_cadence not in ('once_off', 'recurring') then
    return jsonb_build_object('ok', false, 'reason', 'bad_cadence', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Choose once-off or recurring. Nothing was saved.');
  end if;
  if v_cadence = 'once_off' then
    v_limit := null;
  elsif v_limit is not null and (v_limit < 1 or v_limit > 36) then
    return jsonb_build_object('ok', false, 'reason', 'bad_limit', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Month limit is 1 to 36, or leave it empty. Nothing was saved.');
  end if;

  if p_salesperson is not null then
    select jsonb_build_object('name', name, 'code', code, 'percent', percent, 'cadence', cadence, 'month_limit', month_limit, 'active', active)
      into v_before
    from public.commission_salespeople
    where id = p_salesperson and org_id = p_org;
    if v_before is null then
      return jsonb_build_object('ok', false, 'reason', 'missing', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'That salesperson is not in this workspace. Nothing was saved.');
    end if;
    update public.commission_salespeople
    set name = v_name,
        contact = v_contact,
        code = v_code,
        active = v_active,
        percent = v_percent,
        basis = 'gross_received',
        cadence = v_cadence,
        month_limit = v_limit,
        sandbox = true,
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_salesperson and org_id = p_org
    returning id into v_id;
  else
    insert into public.commission_salespeople (
      org_id, name, contact, code, active, percent, basis, cadence, month_limit, sandbox, created_by, updated_by
    ) values (
      p_org, v_name, v_contact, v_code, v_active, v_percent, 'gross_received', v_cadence, v_limit, true, auth.uid(), auth.uid()
    )
    returning id into v_id;
  end if;

  insert into public.commission_audit (org_id, actor_id, action, entity_type, entity_id, detail)
  values (
    p_org, auth.uid(), 'salesperson_saved', 'salesperson', v_id,
    jsonb_build_object(
      'before', v_before,
      'name', v_name,
      'code', v_code,
      'percent', v_percent,
      'cadence', v_cadence,
      'month_limit', v_limit,
      'active', v_active,
      'basis', 'gross_received'
    )
  );

  return jsonb_build_object(
    'ok', true, 'reason', 'saved', 'id', v_id, 'charged', false, 'sandbox', true,
    'placeholder', true, 'money_moved', false,
    'message', 'Salesperson saved. The percent stays a workspace record until you change it. No money was sent.'
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'code_taken', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That code is already used in this workspace. Nothing was saved.');
end;
$$;

create or replace function public.attribute_commission(
  p_org uuid,
  p_source text,
  p_code text,
  p_salesperson uuid,
  p_lead_id text,
  p_deal_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := coalesce(p_source, '');
  v_code text := public.commission_code_key(p_code);
  v_lead text := nullif(btrim(coalesce(p_lead_id, '')), '');
  v_person public.commission_salespeople%rowtype;
  v_title text := 'Sale';
  v_id uuid;
  v_deal_title text;
  v_lead_title text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Sign in before attributing a sale. Nothing was saved and no money was sent.');
  end if;
  if not public.has_org_role(p_org, array['agency_owner', 'agency_staff']) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Workspace staff attribute a sale. Nothing was saved and no money was sent.');
  end if;
  if v_source not in ('code', 'manual') then
    return jsonb_build_object('ok', false, 'reason', 'bad_source', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Choose a code on the lead, or a manual attribution on the deal. Nothing was saved.');
  end if;

  if v_source = 'code' then
    if v_code is null or v_lead is null then
      return jsonb_build_object('ok', false, 'reason', 'bad_code', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'A code attribution needs the salesperson code and the lead. Nothing was saved.');
    end if;
    select * into v_person
    from public.commission_salespeople
    where org_id = p_org and code = v_code;
  else
    if p_salesperson is null or p_deal_id is null then
      return jsonb_build_object('ok', false, 'reason', 'bad_manual', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'A manual attribution needs the salesperson and the deal. Nothing was saved.');
    end if;
    select * into v_person
    from public.commission_salespeople
    where id = p_salesperson and org_id = p_org;
  end if;

  if v_person.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_salesperson', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That salesperson code is not in this workspace. Nothing was saved.');
  end if;
  if not v_person.active then
    return jsonb_build_object('ok', false, 'reason', 'inactive', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That salesperson is paused. Nothing was saved.');
  end if;

  if v_lead is not null then
    if not exists (select 1 from public.crm_leads lead where lead.id = v_lead and lead.org_id = p_org) then
      return jsonb_build_object('ok', false, 'reason', 'unknown_lead', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'That lead is not in this workspace. Nothing was saved.');
    end if;
    if exists (
      select 1 from public.commission_attributions
      where org_id = p_org and lead_id = v_lead
    ) then
      return jsonb_build_object('ok', false, 'reason', 'already_attributed', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'That lead already has a salesperson. Nothing was saved.');
    end if;
    select coalesce(nullif(btrim(company), ''), nullif(btrim(name), ''), 'Sale')
      into v_lead_title
    from public.crm_leads
    where id = v_lead and org_id = p_org;
  end if;

  if p_deal_id is not null then
    select title into v_deal_title
    from public.workspace_deals
    where id = p_deal_id and org_id = p_org;
    if v_deal_title is null then
      return jsonb_build_object('ok', false, 'reason', 'unknown_deal', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'That deal is not in this workspace. Nothing was saved.');
    end if;
    if exists (
      select 1 from public.commission_attributions
      where org_id = p_org and deal_id = p_deal_id
    ) then
      return jsonb_build_object('ok', false, 'reason', 'already_attributed', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'That deal already has a salesperson. Nothing was saved.');
    end if;
  elsif v_source = 'manual' then
    return jsonb_build_object('ok', false, 'reason', 'bad_manual', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'A manual attribution needs the deal. Nothing was saved.');
  end if;

  v_title := coalesce(v_deal_title, v_lead_title, 'Sale');

  insert into public.commission_attributions (
    org_id, salesperson_id, lead_id, deal_id, source, title, sandbox, attributed_by
  ) values (
    p_org, v_person.id, v_lead, p_deal_id, v_source, v_title, true, auth.uid()
  )
  returning id into v_id;

  insert into public.commission_audit (org_id, actor_id, action, entity_type, entity_id, detail)
  values (
    p_org, auth.uid(), 'attributed', 'attribution', v_id,
    jsonb_build_object(
      'source', v_source,
      'salesperson_id', v_person.id,
      'code', v_person.code,
      'lead_id', v_lead,
      'deal_id', p_deal_id,
      'title', v_title
    )
  );

  return jsonb_build_object(
    'ok', true, 'reason', 'attributed', 'id', v_id, 'charged', false, 'sandbox', true, 'money_moved', false,
    'message', 'Attribution saved. Commission is recorded after the deal is won and a payment is marked paid. No money was sent.'
  );
end;
$$;

create or replace function public.record_commission_receipt(
  p_org uuid,
  p_attribution uuid,
  p_amount_cents bigint,
  p_paid_on date,
  p_method text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attr public.commission_attributions%rowtype;
  v_person public.commission_salespeople%rowtype;
  v_method text := coalesce(nullif(btrim(coalesce(p_method, '')), ''), 'eft');
  v_won boolean := false;
  v_stage text;
  v_status text;
  v_booked integer := 0;
  v_existing uuid;
  v_receipt uuid;
  v_ledger uuid;
  v_cents bigint;
  v_period integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'Sign in before recording a payment. Nothing was saved and no money was sent.');
  end if;
  if not public.has_org_role(p_org, array['agency_owner', 'agency_staff']) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'Workspace staff record the amount received. Nothing was saved and no money was sent.');
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_paid_on is null then
    return jsonb_build_object('ok', false, 'reason', 'no_amount', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'Enter the amount received and the date. Nothing was saved.');
  end if;
  if v_method not in ('eft', 'other') then
    return jsonb_build_object('ok', false, 'reason', 'bad_method', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'Choose EFT or other. Nothing was saved.');
  end if;

  select * into v_attr
  from public.commission_attributions
  where id = p_attribution and org_id = p_org;
  if v_attr.id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'That attribution is not in this workspace. Nothing was saved.');
  end if;

  select * into v_person
  from public.commission_salespeople
  where id = v_attr.salesperson_id and org_id = p_org;
  if v_person.id is null or not v_person.active then
    return jsonb_build_object('ok', false, 'reason', 'inactive', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'That salesperson is paused. Nothing was saved.');
  end if;

  if v_attr.deal_id is not null then
    select status into v_status
    from public.workspace_deals
    where id = v_attr.deal_id and org_id = p_org;
    v_won := v_status = 'won';
  elsif v_attr.lead_id is not null then
    select stage into v_stage
    from public.crm_leads
    where id = v_attr.lead_id and org_id = p_org;
    v_won := v_stage in ('Won', 'Onboarding/Handover');
  end if;

  if not v_won then
    return jsonb_build_object('ok', false, 'reason', 'deal_not_won', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'Commission waits until the deal is marked won and the payment is marked paid. Nothing was saved.');
  end if;

  select id into v_existing
  from public.commission_receipts
  where attribution_id = v_attr.id
    and amount_cents = p_amount_cents
    and paid_on = p_paid_on
    and method = v_method
  limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'reason', 'already_recorded', 'id', v_existing, 'booked', false,
      'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That payment is already on the record. No second commission line was added. No money was sent.');
  end if;

  select count(*)::int into v_booked
  from public.commission_ledger
  where attribution_id = v_attr.id and status <> 'void';

  insert into public.commission_receipts (
    org_id, attribution_id, salesperson_id, amount_cents, currency, method, paid_on, sandbox, recorded_by
  ) values (
    p_org, v_attr.id, v_person.id, p_amount_cents, 'ZAR', v_method, p_paid_on, true, auth.uid()
  )
  returning id into v_receipt;

  if v_person.cadence = 'recurring' and v_person.month_limit is not null and v_booked >= v_person.month_limit then
    insert into public.commission_audit (org_id, actor_id, action, entity_type, entity_id, detail)
    values (
      p_org, auth.uid(), 'receipt_recorded', 'receipt', v_receipt,
      jsonb_build_object('salesperson_id', v_person.id, 'amount_cents', p_amount_cents, 'paid_on', p_paid_on, 'method', v_method, 'booked', false, 'reason', 'month_limit')
    );
    return jsonb_build_object('ok', true, 'reason', 'month_limit', 'id', v_receipt, 'booked', false,
      'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Payment recorded. The month limit is already filled, so no commission line was added. No money was sent.');
  end if;

  v_cents := public.commission_cents(p_amount_cents, v_person.percent);
  v_period := v_booked + 1;
  insert into public.commission_ledger (
    org_id, salesperson_id, attribution_id, receipt_id, title, amount_cents, basis_cents, percent,
    currency, status, period_index, sandbox, updated_by
  ) values (
    p_org, v_person.id, v_attr.id, v_receipt, v_attr.title, v_cents, p_amount_cents, v_person.percent,
    'ZAR', 'pending', v_period, true, auth.uid()
  )
  returning id into v_ledger;

  insert into public.commission_audit (org_id, actor_id, action, entity_type, entity_id, detail)
  values (
    p_org, auth.uid(), 'receipt_recorded', 'receipt', v_receipt,
    jsonb_build_object(
      'salesperson_id', v_person.id,
      'ledger_id', v_ledger,
      'amount_cents', p_amount_cents,
      'commission_cents', v_cents,
      'percent', v_person.percent,
      'paid_on', p_paid_on,
      'method', v_method,
      'booked', true
    )
  );

  return jsonb_build_object(
    'ok', true, 'reason', 'booked', 'id', v_ledger, 'receipt_id', v_receipt, 'booked', true,
    'amount_cents', v_cents, 'charged', false, 'sandbox', true, 'money_moved', false,
    'message', 'Commission recorded from the amount received. It stays pending until the owner marks it. No money was sent.'
  );
end;
$$;

create or replace function public.set_commission_ledger_status(
  p_ledger uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commission_ledger%rowtype;
  v_status text := coalesce(p_status, '');
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Sign in as the workspace owner. No money was sent.');
  end if;
  select * into v_row from public.commission_ledger where id = p_ledger;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That ledger row was not found. No money was sent.');
  end if;
  if not public.has_org_role(v_row.org_id, array['agency_owner']) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'The workspace owner marks the ledger. No money was sent.');
  end if;
  if v_status not in ('pending', 'approved', 'paid', 'void') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Choose pending, approved, paid, or void. No money was sent.');
  end if;
  if not (
    (v_row.status = 'pending' and v_status in ('approved', 'void'))
    or (v_row.status = 'approved' and v_status in ('paid', 'void'))
    or (v_row.status = 'paid' and v_status = 'void')
  ) then
    return jsonb_build_object('ok', false, 'reason', 'bad_status', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That status change is not available from the current mark. No money was sent.');
  end if;

  update public.commission_ledger
  set status = v_status,
      approved_at = case when v_status = 'approved' then now() else approved_at end,
      paid_at = case when v_status = 'paid' then now() else paid_at end,
      voided_at = case when v_status = 'void' then now() else voided_at end,
      sandbox = true,
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_row.id;

  insert into public.commission_audit (org_id, actor_id, action, entity_type, entity_id, detail)
  values (
    v_row.org_id, auth.uid(), 'ledger_status', 'ledger', v_row.id,
    jsonb_build_object('salesperson_id', v_row.salesperson_id, 'from', v_row.status, 'to', v_status, 'amount_cents', v_row.amount_cents)
  );

  return jsonb_build_object(
    'ok', true, 'reason', v_status, 'id', v_row.id, 'charged', false, 'sandbox', true, 'money_moved', false,
    'message', case v_status
      when 'approved' then 'Marked approved on the ledger. No money was sent.'
      when 'paid' then 'Marked paid on the ledger. No money was sent.'
      else 'Marked void. The row stays on the ledger. No money was sent.'
    end
  );
end;
$$;

alter table public.commission_salespeople enable row level security;
alter table public.commission_salespeople force row level security;
alter table public.commission_attributions enable row level security;
alter table public.commission_attributions force row level security;
alter table public.commission_receipts enable row level security;
alter table public.commission_receipts force row level security;
alter table public.commission_ledger enable row level security;
alter table public.commission_ledger force row level security;
alter table public.commission_audit enable row level security;
alter table public.commission_audit force row level security;

drop policy if exists commission_salespeople_read on public.commission_salespeople;
create policy commission_salespeople_read on public.commission_salespeople
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

drop policy if exists commission_attributions_read on public.commission_attributions;
create policy commission_attributions_read on public.commission_attributions
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

drop policy if exists commission_receipts_read on public.commission_receipts;
create policy commission_receipts_read on public.commission_receipts
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

drop policy if exists commission_ledger_read on public.commission_ledger;
create policy commission_ledger_read on public.commission_ledger
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

drop policy if exists commission_audit_read on public.commission_audit;
create policy commission_audit_read on public.commission_audit
  for select to authenticated
  using (public.has_org_role(org_id, array['agency_owner']));

revoke all on public.commission_salespeople from public, anon, authenticated;
revoke all on public.commission_attributions from public, anon, authenticated;
revoke all on public.commission_receipts from public, anon, authenticated;
revoke all on public.commission_ledger from public, anon, authenticated;
revoke all on public.commission_audit from public, anon, authenticated;
grant select on public.commission_salespeople to authenticated;
grant select on public.commission_attributions to authenticated;
grant select on public.commission_receipts to authenticated;
grant select on public.commission_ledger to authenticated;
grant select on public.commission_audit to authenticated;

revoke all on function public.commission_code_key(text) from public;
revoke all on function public.commission_cents(bigint, numeric) from public;
revoke all on function public.save_commission_salesperson(uuid, uuid, text, text, text, boolean, numeric, text, integer) from public;
revoke all on function public.attribute_commission(uuid, text, text, uuid, text, uuid) from public;
revoke all on function public.record_commission_receipt(uuid, uuid, bigint, date, text) from public;
revoke all on function public.set_commission_ledger_status(uuid, text) from public;

grant execute on function public.commission_code_key(text) to authenticated;
grant execute on function public.commission_cents(bigint, numeric) to authenticated;
grant execute on function public.save_commission_salesperson(uuid, uuid, text, text, text, boolean, numeric, text, integer) to authenticated;
grant execute on function public.attribute_commission(uuid, text, text, uuid, text, uuid) to authenticated;
grant execute on function public.record_commission_receipt(uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.set_commission_ledger_status(uuid, text) to authenticated;

do $commission_suspend$
begin
  if to_regprocedure('public.reject_if_workspace_suspended()') is null then
    return;
  end if;
  drop trigger if exists reject_suspended_write on public.commission_salespeople;
  drop trigger if exists reject_suspended_write on public.commission_attributions;
  drop trigger if exists reject_suspended_write on public.commission_receipts;
  drop trigger if exists reject_suspended_write on public.commission_ledger;
  create trigger reject_suspended_write
    before insert or update or delete on public.commission_salespeople
    for each row execute function public.reject_if_workspace_suspended();
  create trigger reject_suspended_write
    before insert or update or delete on public.commission_attributions
    for each row execute function public.reject_if_workspace_suspended();
  create trigger reject_suspended_write
    before insert or update or delete on public.commission_receipts
    for each row execute function public.reject_if_workspace_suspended();
  create trigger reject_suspended_write
    before insert or update or delete on public.commission_ledger
    for each row execute function public.reject_if_workspace_suspended();
end
$commission_suspend$;

-- Check after a successful paste. Run this on its own. Do not expect it to change rows.
-- select c.relname, c.relrowsecurity, c.relforcerowsecurity
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname in (
--     'commission_salespeople',
--     'commission_attributions',
--     'commission_receipts',
--     'commission_ledger',
--     'commission_audit'
--   )
-- order by c.relname;
-- Expect 5 rows, relrowsecurity true, relforcerowsecurity true.
-- select proname from pg_proc
-- where pronamespace = 'public'::regnamespace
--   and proname in (
--     'save_commission_salesperson',
--     'attribute_commission',
--     'record_commission_receipt',
--     'set_commission_ledger_status'
--   )
-- order by proname;
-- Expect 4 rows. Then leave COMMISSIONS_ENABLED unset.

-- >>> supabase/migrations/20261112140000_phase5q_sales_agents.sql

-- Phase 5q: sales and onboarding agent drafts.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Drafts stay in the approval queue. Approving queues crm_outbox and does not send.
-- Leave SALES_AGENTS_ENABLED unset until this file is applied.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5q needs phase 2a access';
  end if;
  if to_regclass('public.crm_notifications') is null
     or to_regprocedure('public.record_owner_notification(uuid, text, text, text, text, text, text)') is null then
    raise exception 'phase 5q needs phase 5p sales funnel';
  end if;
  if to_regclass('public.crm_outbox') is null then
    raise exception 'phase 5q needs crm_outbox';
  end if;
  if to_regclass('public.crm_audit_leads') is null then
    raise exception 'phase 5q needs crm_audit_leads';
  end if;
end
$need$;

do $kind$
declare constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'crm_notifications'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.crm_notifications drop constraint %I', constraint_name);
  end loop;
end
$kind$;

alter table public.crm_notifications
  add constraint crm_notifications_kind_check
  check (kind in ('audit', 'contact', 'booking', 'workflow', 'reply', 'approval', 'stalled', 'summary'));

create or replace function public.record_owner_notification(
  p_org uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_href text,
  p_lead_id text,
  p_dedupe_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  note_id uuid;
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := left(coalesce(p_body, ''), 2000);
  v_href text := btrim(coalesce(p_href, ''));
  v_lead text := left(btrim(coalesce(p_lead_id, '')), 80);
  v_key text := left(btrim(coalesce(p_dedupe_key, '')), 180);
begin
  if auth.uid() is null then
    if current_setting('request.jwt.claim.role', true) = 'authenticated' then
      raise exception 'not allowed';
    end if;
  elsif not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations org where org.id = p_org) then
    raise exception 'workspace required';
  end if;
  if v_kind not in ('audit', 'contact', 'booking', 'workflow', 'reply', 'approval', 'stalled', 'summary') then
    raise exception 'notification kind';
  end if;
  if length(v_title) < 1 or length(v_title) > 160 then
    raise exception 'notification title';
  end if;
  if v_key = '' then
    raise exception 'notification key';
  end if;
  if v_href <> '' and v_href !~ '^/command-centre/' then
    raise exception 'notification href';
  end if;

  insert into public.crm_notifications (org_id, kind, title, body, href, lead_id, dedupe_key)
  values (p_org, v_kind, v_title, v_body, v_href, v_lead, v_key)
  on conflict (org_id, dedupe_key) do nothing
  returning id into note_id;

  if note_id is null then
    select id into note_id
    from public.crm_notifications
    where org_id = p_org and dedupe_key = v_key;
  end if;

  return jsonb_build_object('ok', true, 'id', note_id, 'sent', false);
end;
$$;

create table if not exists public.crm_sales_sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  audit_lead_id uuid references public.crm_audit_leads(id) on delete cascade,
  lead_id text not null default '',
  trigger text not null check (trigger in ('audit_arrived', 'report_approved')),
  status text not null default 'active' check (status in ('active', 'stopped', 'completed')),
  stop_reason text not null default '' check (stop_reason in ('', 'booking', 'reply', 'opt_out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_sales_sequences_audit_unique unique (org_id, audit_lead_id)
);

create table if not exists public.crm_sales_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sequence_id uuid references public.crm_sales_sequences(id) on delete cascade,
  lead_id text not null default '',
  kind text not null check (kind in ('follow_up', 'reminder', 'welcome')),
  step text not null check (step in ('day0', 'day2', 'day5', 'reminder_24h', 'reminder_1h', 'welcome')),
  channel text not null check (channel in ('whatsapp', 'email', 'sms')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'skipped')),
  skip_reason text not null default '',
  subject text not null default '',
  body text not null default '',
  scheduled_for timestamptz not null default now(),
  dedupe_key text not null,
  to_address text not null default '',
  purpose text not null default 'marketing' check (purpose in ('marketing', 'service')),
  outbox_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_sales_drafts_dedupe_unique unique (org_id, dedupe_key),
  constraint crm_sales_drafts_body_check check (length(body) <= 4000),
  constraint crm_sales_drafts_skip_check check (length(skip_reason) <= 300),
  constraint crm_sales_drafts_key_check check (length(btrim(dedupe_key)) between 1 and 180)
);

create index if not exists crm_sales_drafts_org_idx
  on public.crm_sales_drafts (org_id, status, scheduled_for);

create table if not exists public.crm_client_onboarding (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id text not null default '',
  trigger text not null check (trigger in ('deal_won', 'invoice_paid')),
  source_key text not null,
  status text not null default 'open' check (status = 'open'),
  created_at timestamptz not null default now(),
  constraint crm_client_onboarding_source_unique unique (org_id, source_key),
  constraint crm_client_onboarding_source_check check (length(btrim(source_key)) between 1 and 180)
);

create table if not exists public.crm_client_onboarding_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  checklist_id uuid not null references public.crm_client_onboarding(id) on delete cascade,
  item_key text not null,
  title text not null,
  href text not null default '',
  detail text not null default '',
  done boolean not null default false,
  ord integer not null default 0,
  constraint crm_client_onboarding_items_unique unique (checklist_id, item_key)
);

alter table public.crm_sales_sequences enable row level security;
alter table public.crm_sales_sequences force row level security;
alter table public.crm_sales_drafts enable row level security;
alter table public.crm_sales_drafts force row level security;
alter table public.crm_client_onboarding enable row level security;
alter table public.crm_client_onboarding force row level security;
alter table public.crm_client_onboarding_items enable row level security;
alter table public.crm_client_onboarding_items force row level security;

drop policy if exists crm_sales_sequences_read on public.crm_sales_sequences;
create policy crm_sales_sequences_read on public.crm_sales_sequences
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists crm_sales_drafts_read on public.crm_sales_drafts;
create policy crm_sales_drafts_read on public.crm_sales_drafts
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists crm_client_onboarding_read on public.crm_client_onboarding;
create policy crm_client_onboarding_read on public.crm_client_onboarding
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists crm_client_onboarding_items_read on public.crm_client_onboarding_items;
create policy crm_client_onboarding_items_read on public.crm_client_onboarding_items
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

revoke all on table public.crm_sales_sequences from public, anon;
revoke all on table public.crm_sales_drafts from public, anon;
revoke all on table public.crm_client_onboarding from public, anon;
revoke all on table public.crm_client_onboarding_items from public, anon;
grant select on table public.crm_sales_sequences to authenticated;
grant select on table public.crm_sales_drafts to authenticated;
grant select on table public.crm_client_onboarding to authenticated;
grant select on table public.crm_client_onboarding_items to authenticated;

create or replace function public.save_sales_agent_batch(p_org uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq jsonb := p_payload->'sequence';
  v_drafts jsonb := coalesce(p_payload->'drafts', '[]'::jsonb);
  v_notices jsonb := coalesce(p_payload->'notices', '[]'::jsonb);
  v_onboarding jsonb := p_payload->'onboarding';
  v_seq_id uuid;
  v_check_id uuid;
  v_stop text := '';
  v_cancel boolean := coalesce((p_payload->>'cancelPending')::boolean, false);
  item jsonb;
  note jsonb;
  step_item jsonb;
  v_status text;
  v_kind text;
  v_step text;
  v_channel text;
  v_key text;
  v_check uuid;
  v_ord integer := 0;
  stored_drafts integer := 0;
  sending boolean := false;
begin
  if auth.uid() is null then
    if current_setting('request.jwt.claim.role', true) = 'authenticated' then
      raise exception 'not allowed';
    end if;
  else
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations org where org.id = p_org) then
    raise exception 'workspace required';
  end if;
  select org.sending_enabled into sending from public.organizations org where org.id = p_org;
  if jsonb_typeof(v_drafts) <> 'array' or jsonb_typeof(v_notices) <> 'array' then
    raise exception 'sales batch';
  end if;

  if v_seq is not null and jsonb_typeof(v_seq) = 'object' and nullif(v_seq->>'auditLeadId', '') is not null then
    if not exists (
      select 1 from public.crm_audit_leads lead
      where lead.id = (v_seq->>'auditLeadId')::uuid and lead.org_id = p_org
    ) then
      raise exception 'audit lead required';
    end if;
    v_stop := case when coalesce(v_seq->>'stopReason', '') in ('booking', 'reply', 'opt_out') then v_seq->>'stopReason' else '' end;
    insert into public.crm_sales_sequences (org_id, audit_lead_id, lead_id, trigger, status, stop_reason)
    values (
      p_org,
      (v_seq->>'auditLeadId')::uuid,
      left(btrim(coalesce(v_seq->>'leadId', '')), 80),
      case when v_seq->>'trigger' = 'report_approved' then 'report_approved' else 'audit_arrived' end,
      case when v_stop = '' then 'active' else 'stopped' end,
      v_stop
    )
    on conflict (org_id, audit_lead_id)
    do update set
      trigger = excluded.trigger,
      status = excluded.status,
      stop_reason = excluded.stop_reason,
      lead_id = excluded.lead_id,
      updated_at = now()
    returning id into v_seq_id;
  end if;

  for item in select value from jsonb_array_elements(v_drafts)
  loop
    v_kind := case when item->>'kind' in ('follow_up', 'reminder', 'welcome') then item->>'kind' else '' end;
    v_step := case
      when item->>'step' in ('day0', 'day2', 'day5', 'reminder_24h', 'reminder_1h', 'welcome') then item->>'step'
      else ''
    end;
    v_channel := case when item->>'channel' in ('whatsapp', 'email', 'sms') then item->>'channel' else '' end;
    v_key := left(btrim(coalesce(item->>'dedupeKey', '')), 180);
    v_status := case when item->>'status' = 'skipped' then 'skipped' else 'draft' end;
    if v_kind = '' or v_step = '' or v_channel = '' or v_key = '' then
      continue;
    end if;
    if v_status = 'draft' and length(btrim(coalesce(item->>'body', ''))) < 1 then
      continue;
    end if;
    insert into public.crm_sales_drafts (
      org_id, sequence_id, lead_id, kind, step, channel, status, skip_reason, subject, body,
      scheduled_for, dedupe_key, to_address, purpose
    ) values (
      p_org,
      case when v_kind = 'follow_up' then v_seq_id else null end,
      left(btrim(coalesce(item->>'leadId', '')), 80),
      v_kind,
      v_step,
      v_channel,
      v_status,
      left(coalesce(item->>'skipReason', ''), 300),
      left(coalesce(item->>'subject', ''), 160),
      left(coalesce(item->>'body', ''), 4000),
      coalesce(nullif(item->>'scheduledFor', '')::timestamptz, now()),
      v_key,
      left(coalesce(item->>'toAddress', ''), 200),
      case when item->>'purpose' = 'service' then 'service' else 'marketing' end
    )
    on conflict (org_id, dedupe_key) do update set
      body = excluded.body,
      subject = excluded.subject,
      updated_at = now()
    where public.crm_sales_drafts.status = 'draft'
      and public.crm_sales_drafts.skip_reason = '';
    stored_drafts := stored_drafts + 1;
  end loop;

  if v_cancel and v_seq_id is not null and v_stop <> '' then
    update public.crm_sales_drafts
    set status = 'skipped',
        skip_reason = left('Stopped: ' || v_stop, 300),
        updated_at = now()
    where org_id = p_org
      and sequence_id = v_seq_id
      and kind = 'follow_up'
      and status = 'draft';

    update public.crm_outbox outbox
    set status = 'cancelled',
        error = left('Stopped: ' || v_stop, 300)
    where outbox.sent_at is null
      and outbox.status in ('queued', 'approved')
      and outbox.id in (
        select draft.outbox_id
        from public.crm_sales_drafts draft
        where draft.sequence_id = v_seq_id
          and draft.kind = 'follow_up'
          and draft.outbox_id <> ''
      );
  end if;

  for note in select value from jsonb_array_elements(v_notices)
  loop
    if coalesce(note->>'kind', '') = '' or coalesce(note->>'title', '') = '' then
      continue;
    end if;
    perform public.record_owner_notification(
      p_org,
      note->>'kind',
      note->>'title',
      coalesce(note->>'body', ''),
      coalesce(note->>'href', '/command-centre/approvals'),
      coalesce(note->>'leadId', ''),
      note->>'dedupeKey'
    );
  end loop;

  if v_onboarding is not null and jsonb_typeof(v_onboarding) = 'object' then
    insert into public.crm_client_onboarding (org_id, lead_id, trigger, source_key)
    values (
      p_org,
      left(btrim(coalesce(v_onboarding->>'leadId', '')), 80),
      case when v_onboarding->>'trigger' = 'invoice_paid' then 'invoice_paid' else 'deal_won' end,
      left(btrim(coalesce(v_onboarding->>'sourceKey', '')), 180)
    )
    on conflict (org_id, source_key) do nothing
    returning id into v_check_id;
    if v_check_id is null then
      select id into v_check_id
      from public.crm_client_onboarding
      where org_id = p_org and source_key = left(btrim(coalesce(v_onboarding->>'sourceKey', '')), 180);
    end if;
    if v_check_id is not null and jsonb_typeof(v_onboarding->'items') = 'array' then
      for step_item in select value from jsonb_array_elements(v_onboarding->'items')
      loop
        if coalesce(step_item->>'key', '') = '' then
          continue;
        end if;
        insert into public.crm_client_onboarding_items (org_id, checklist_id, item_key, title, href, detail, ord)
        values (
          p_org,
          v_check_id,
          left(step_item->>'key', 40),
          left(coalesce(step_item->>'title', ''), 120),
          left(coalesce(step_item->>'href', ''), 200),
          left(coalesce(step_item->>'detail', ''), 500),
          v_ord
        )
        on conflict (checklist_id, item_key) do nothing;
        v_ord := v_ord + 1;
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'stored', stored_drafts,
    'sent', false,
    'sending_enabled', coalesce(sending, false),
    'sequence_id', v_seq_id,
    'checklist_id', v_check_id
  );
end;
$$;

create or replace function public.decide_sales_draft(
  p_org uuid,
  p_draft uuid,
  p_action text,
  p_body text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.crm_sales_drafts%rowtype;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_body text;
  v_outbox text;
  found_lead text;
  has_org boolean;
  has_purpose boolean;
  sending boolean := false;
begin
  if auth.uid() is null or not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  select * into draft
  from public.crm_sales_drafts row
  where row.id = p_draft and row.org_id = p_org
  for update;

  if not found then
    raise exception 'draft required';
  end if;
  if draft.status <> 'draft' or length(btrim(draft.skip_reason)) > 0 then
    return jsonb_build_object('ok', false, 'status', draft.status, 'sent', false, 'outbox_id', '');
  end if;

  select org.sending_enabled into sending from public.organizations org where org.id = p_org;

  if v_action = 'reject' then
    update public.crm_sales_drafts
    set status = 'rejected', updated_at = now()
    where id = draft.id;
    return jsonb_build_object('ok', true, 'status', 'rejected', 'sent', false, 'outbox_id', '', 'sending_enabled', coalesce(sending, false));
  end if;

  if v_action = 'edit' then
    v_body := left(btrim(coalesce(p_body, '')), 4000);
    if v_body = '' then
      raise exception 'draft body';
    end if;
    update public.crm_sales_drafts
    set body = v_body, updated_at = now()
    where id = draft.id;
    return jsonb_build_object('ok', true, 'status', 'draft', 'sent', false, 'outbox_id', '', 'sending_enabled', coalesce(sending, false));
  end if;

  if v_action <> 'approve' then
    raise exception 'draft action';
  end if;

  v_outbox := 'salesq_' || replace(gen_random_uuid()::text, '-', '');
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_leads' and column_name = 'org_id'
  ) into has_org;
  if has_org then
    execute 'select id from public.crm_leads where id = $1 and (org_id is null or org_id = $2)'
      into found_lead using nullif(draft.lead_id, ''), p_org;
  else
    execute 'select id from public.crm_leads where id = $1'
      into found_lead using nullif(draft.lead_id, '');
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'org_id'
  ) into has_org;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'purpose'
  ) into has_purpose;

  if has_org and has_purpose then
    insert into public.crm_outbox (
      id, lead_id, template_key, channel, to_address, subject, body, status, scheduled_for, sent_at, org_id, purpose, message_category
    ) values (
      v_outbox,
      found_lead,
      'sales_agent_' || draft.step || '_' || draft.channel,
      draft.channel,
      draft.to_address,
      draft.subject,
      draft.body,
      'queued',
      draft.scheduled_for,
      null,
      p_org,
      draft.purpose,
      draft.purpose
    );
  elsif has_org then
    insert into public.crm_outbox (
      id, lead_id, template_key, channel, to_address, subject, body, status, scheduled_for, sent_at, org_id
    ) values (
      v_outbox, found_lead, 'sales_agent_' || draft.step || '_' || draft.channel,
      draft.channel, draft.to_address, draft.subject, draft.body, 'queued', draft.scheduled_for, null, p_org
    );
  else
    insert into public.crm_outbox (
      id, lead_id, template_key, channel, to_address, subject, body, status, scheduled_for, sent_at
    ) values (
      v_outbox, found_lead, 'sales_agent_' || draft.step || '_' || draft.channel,
      draft.channel, draft.to_address, draft.subject, draft.body, 'queued', draft.scheduled_for, null
    );
  end if;

  update public.crm_sales_drafts
  set status = 'approved', outbox_id = v_outbox, updated_at = now()
  where id = draft.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'approved',
    'outbox_status', 'queued',
    'outbox_id', v_outbox,
    'sent', false,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.save_sales_agent_batch(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.decide_sales_draft(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.decide_sales_draft(uuid, uuid, text, text) to authenticated;

do $service_grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.save_sales_agent_batch(uuid, jsonb) to service_role;
    grant execute on function public.decide_sales_draft(uuid, uuid, text, text) to service_role;
    grant execute on function public.record_owner_notification(uuid, text, text, text, text, text, text) to service_role;
    grant select, insert, update, delete on public.crm_sales_sequences to service_role;
    grant select, insert, update, delete on public.crm_sales_drafts to service_role;
    grant select, insert, update, delete on public.crm_client_onboarding to service_role;
    grant select, insert, update, delete on public.crm_client_onboarding_items to service_role;
  end if;
end
$service_grant$;

