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
