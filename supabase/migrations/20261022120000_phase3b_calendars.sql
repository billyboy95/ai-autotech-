-- Phase 3b: calendars and public booking pages.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Classic public.appointments (schema.sql) is left untouched. Booking rows
-- live in crm_appointments so this file can run after schema.sql or without it.
-- A booking stores the consent text. It does not write crm_outbox.
-- The workflow hook is the existing trigger appointment.booked.
-- There is no appointment_booked value, so seeded workflows stay valid.

do $need$
begin
  if to_regclass('public.organizations') is null or to_regclass('public.memberships') is null then
    raise exception 'phase 3b needs agency tenancy; apply 20260926160000_agency_tenancy.sql and phase 2a first';
  end if;
  if to_regclass('public.crm_contacts') is null or to_regclass('public.contact_consents') is null then
    raise exception 'phase 3b needs POPIA contacts; apply 20261015140000_phase2b_channels_popia.sql first';
  end if;
  if to_regclass('public.crm_leads') is null then
    raise exception 'phase 3b needs crm_leads; apply 20260903000000_company_crm.sql first';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_leads' and column_name = 'booked_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_leads' and column_name = 'marketing_consent'
  ) then
    raise exception 'phase 3b needs lead booking columns; apply crm_automation and send_compliance before this file';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.inbox_assigned_visible(uuid, uuid)') is null then
    raise exception 'phase 3b needs phase 2a roles and the phase 2e inbox visibility helper';
  end if;
  if to_regprocedure('public.record_workflow_event(uuid,text,text,text,jsonb,text)') is null then
    raise exception 'phase 3b needs the workflow engine; apply 20261017120000_phase2d_workflows.sql first';
  end if;
end
$need$;

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  timezone text not null default 'Africa/Johannesburg',
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendars_name_check check (length(btrim(name)) > 0)
);

create index if not exists calendars_org_idx on public.calendars (org_id, active);

create table if not exists public.calendar_availability (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  kind text not null check (kind in ('weekly', 'exception')),
  weekday smallint,
  start_minute smallint,
  end_minute smallint,
  exception_date date,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  constraint calendar_availability_shape check (
    (
      kind = 'weekly'
      and weekday between 0 and 6
      and start_minute >= 0
      and end_minute <= 1440
      and end_minute > start_minute
      and exception_date is null
      and available
    )
    or (
      kind = 'exception'
      and weekday is null
      and exception_date is not null
      and (
        (available = false and start_minute is null and end_minute is null)
        or (
          available
          and start_minute >= 0
          and end_minute <= 1440
          and end_minute > start_minute
        )
      )
    )
  )
);

create index if not exists calendar_availability_calendar_idx
  on public.calendar_availability (calendar_id, kind, weekday);
create index if not exists calendar_availability_exception_idx
  on public.calendar_availability (calendar_id, exception_date)
  where kind = 'exception';

create table if not exists public.calendar_event_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 180),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 180),
  location_mode text not null default 'phone' check (location_mode in ('phone', 'video', 'in_person', 'custom')),
  location_detail text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_event_types_name_check check (length(btrim(name)) > 0)
);

create index if not exists calendar_event_types_calendar_idx
  on public.calendar_event_types (calendar_id, active);

create table if not exists public.booking_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_type_id uuid not null references public.calendar_event_types(id) on delete cascade,
  slug text not null,
  active boolean not null default true,
  consent_text text not null default '',
  created_at timestamptz not null default now(),
  constraint booking_links_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create unique index if not exists booking_links_slug_idx on public.booking_links (slug);
create unique index if not exists booking_links_event_type_idx on public.booking_links (event_type_id);

create table if not exists public.crm_appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  event_type_id uuid not null references public.calendar_event_types(id) on delete restrict,
  booking_link_id uuid references public.booking_links(id) on delete set null,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  lead_id text,
  assigned_member_id uuid references public.memberships(id) on delete set null,
  assigned_user_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed', 'no_show')),
  guest_name text not null default '',
  guest_phone text not null default '',
  guest_email text not null default '',
  location_mode text not null default 'phone' check (location_mode in ('phone', 'video', 'in_person', 'custom')),
  location_detail text not null default '',
  consent_accepted boolean not null default false,
  consent_text text not null default '',
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_appointments_consent_check check (
    consent_accepted and length(btrim(consent_text)) >= 12 and consent_at is not null
  ),
  constraint crm_appointments_range_check check (ends_at > starts_at)
);

create index if not exists crm_appointments_org_start_idx
  on public.crm_appointments (org_id, starts_at desc);
create index if not exists crm_appointments_calendar_open_idx
  on public.crm_appointments (calendar_id, starts_at)
  where status = 'scheduled';
create index if not exists crm_appointments_assignee_idx
  on public.crm_appointments (org_id, assigned_user_id);

-- Classic Command Centre memberships, only when schema.sql created that table.
do $classic_members$
begin
  if to_regclass('public.organization_members') is null then
    return;
  end if;
  alter table public.crm_appointments add column if not exists organization_member_id uuid;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_appointments'::regclass
      and conname = 'crm_appointments_organization_member_id_fkey'
  ) then
    alter table public.crm_appointments
      add constraint crm_appointments_organization_member_id_fkey
      foreign key (organization_member_id) references public.organization_members(id) on delete set null;
  end if;
end
$classic_members$;

create or replace function public.calendars_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists calendars_touch on public.calendars;
create trigger calendars_touch
  before update on public.calendars
  for each row execute function public.calendars_touch_updated_at();

drop trigger if exists calendar_event_types_touch on public.calendar_event_types;
create trigger calendar_event_types_touch
  before update on public.calendar_event_types
  for each row execute function public.calendars_touch_updated_at();

drop trigger if exists crm_appointments_touch on public.crm_appointments;
create trigger crm_appointments_touch
  before update on public.crm_appointments
  for each row execute function public.calendars_touch_updated_at();

create or replace function public.calendars_enforce_scope()
returns trigger
language plpgsql
as $$
declare
  parent_org uuid;
  member_user uuid;
begin
  if tg_table_name = 'calendar_availability' then
    select org_id into parent_org from public.calendars where id = new.calendar_id;
    if parent_org is null or parent_org is distinct from new.org_id then
      raise exception 'calendar is outside this workspace';
    end if;
  elsif tg_table_name = 'calendar_event_types' then
    select org_id into parent_org from public.calendars where id = new.calendar_id;
    if parent_org is null or parent_org is distinct from new.org_id then
      raise exception 'calendar is outside this workspace';
    end if;
  elsif tg_table_name = 'booking_links' then
    select org_id into parent_org from public.calendar_event_types where id = new.event_type_id;
    if parent_org is null or parent_org is distinct from new.org_id then
      raise exception 'event type is outside this workspace';
    end if;
  elsif tg_table_name = 'crm_appointments' then
    select org_id into parent_org from public.calendars where id = new.calendar_id;
    if parent_org is null or parent_org is distinct from new.org_id then
      raise exception 'calendar is outside this workspace';
    end if;
    if not exists (
      select 1 from public.calendar_event_types et
      where et.id = new.event_type_id and et.org_id = new.org_id and et.calendar_id = new.calendar_id
    ) then
      raise exception 'event type is outside this workspace';
    end if;
    if new.booking_link_id is not null and not exists (
      select 1 from public.booking_links link
      where link.id = new.booking_link_id and link.org_id = new.org_id and link.event_type_id = new.event_type_id
    ) then
      raise exception 'booking link is outside this workspace';
    end if;
    if new.contact_id is not null and not exists (
      select 1 from public.crm_contacts c where c.id = new.contact_id and c.org_id = new.org_id
    ) then
      raise exception 'contact is outside this workspace';
    end if;
    if new.lead_id is not null and to_regclass('public.crm_leads') is not null and not exists (
      select 1 from public.crm_leads lead where lead.id = new.lead_id and lead.org_id = new.org_id
    ) then
      raise exception 'lead is outside this workspace';
    end if;
    if new.assigned_member_id is not null then
      select user_id into member_user
      from public.memberships
      where id = new.assigned_member_id and org_id = new.org_id;
      if member_user is null then
        raise exception 'member is outside this workspace';
      end if;
      if new.assigned_user_id is null then
        new.assigned_user_id := member_user;
      elsif new.assigned_user_id is distinct from member_user then
        raise exception 'member is outside this workspace';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_availability_scope on public.calendar_availability;
create trigger calendar_availability_scope
  before insert or update on public.calendar_availability
  for each row execute function public.calendars_enforce_scope();

drop trigger if exists calendar_event_types_scope on public.calendar_event_types;
create trigger calendar_event_types_scope
  before insert or update on public.calendar_event_types
  for each row execute function public.calendars_enforce_scope();

drop trigger if exists booking_links_scope on public.booking_links;
create trigger booking_links_scope
  before insert or update on public.booking_links
  for each row execute function public.calendars_enforce_scope();

drop trigger if exists crm_appointments_scope on public.crm_appointments;
create trigger crm_appointments_scope
  before insert or update on public.crm_appointments
  for each row execute function public.calendars_enforce_scope();

-- Public catalogue for /book/[slug]. Times only. No guest names, phones, or emails.
create or replace function public.public_booking_catalog(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_link public.booking_links%rowtype;
  v_event public.calendar_event_types%rowtype;
  v_cal public.calendars%rowtype;
  v_org public.organizations%rowtype;
  v_zone text;
  v_weekly jsonb;
  v_exceptions jsonb;
  v_busy jsonb;
  v_links jsonb;
begin
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return jsonb_build_object('kind', 'missing');
  end if;

  select * into v_link from public.booking_links where slug = v_slug and active;
  if found then
    select * into v_event from public.calendar_event_types where id = v_link.event_type_id and active;
    if not found then
      return jsonb_build_object('kind', 'missing');
    end if;
    select * into v_cal from public.calendars where id = v_event.calendar_id and active;
    if not found then
      return jsonb_build_object('kind', 'missing');
    end if;
    select * into v_org from public.organizations where id = v_link.org_id;
    if not found or lower(coalesce(v_org.status, '')) = 'suspended' then
      return jsonb_build_object('kind', 'missing');
    end if;

    v_zone := coalesce(nullif(v_cal.timezone, ''), nullif(v_org.timezone, ''), 'Africa/Johannesburg');

    select coalesce(jsonb_agg(jsonb_build_object(
      'weekday', row.weekday,
      'startMinute', row.start_minute,
      'endMinute', row.end_minute
    ) order by row.weekday, row.start_minute), '[]'::jsonb)
    into v_weekly
    from public.calendar_availability row
    where row.calendar_id = v_cal.id and row.kind = 'weekly';

    select coalesce(jsonb_agg(jsonb_build_object(
      'date', row.exception_date,
      'available', row.available,
      'startMinute', row.start_minute,
      'endMinute', row.end_minute
    ) order by row.exception_date), '[]'::jsonb)
    into v_exceptions
    from public.calendar_availability row
    where row.calendar_id = v_cal.id
      and row.kind = 'exception'
      and row.exception_date >= (now() at time zone v_zone)::date
      and row.exception_date < (now() at time zone v_zone)::date + 21;

    select coalesce(jsonb_agg(jsonb_build_object(
      'startsAt', existing.starts_at,
      'endsAt', existing.ends_at,
      'bufferBefore', et.buffer_before_minutes,
      'bufferAfter', et.buffer_after_minutes
    )), '[]'::jsonb)
    into v_busy
    from public.crm_appointments existing
    join public.calendar_event_types et on et.id = existing.event_type_id
    where existing.calendar_id = v_cal.id
      and existing.status = 'scheduled'
      and existing.ends_at > now() - interval '1 day'
      and existing.starts_at < now() + interval '21 days';

    return jsonb_build_object(
      'kind', 'link',
      'orgName', v_org.name,
      'orgSlug', v_org.slug,
      'senderName', coalesce(nullif(v_org.sender_name, ''), v_org.name),
      'timezone', v_zone,
      'consentText', v_link.consent_text,
      'event', jsonb_build_object(
        'name', v_event.name,
        'durationMinutes', v_event.duration_minutes,
        'bufferBefore', v_event.buffer_before_minutes,
        'bufferAfter', v_event.buffer_after_minutes,
        'locationMode', v_event.location_mode,
        'locationDetail', v_event.location_detail,
        'calendarName', v_cal.name
      ),
      'weekly', v_weekly,
      'exceptions', v_exceptions,
      'busy', v_busy,
      'links', '[]'::jsonb
    );
  end if;

  select * into v_org from public.organizations where slug = v_slug;
  if not found or lower(coalesce(v_org.status, '')) = 'suspended' then
    return jsonb_build_object('kind', 'missing');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', link.slug,
    'name', et.name,
    'durationMinutes', et.duration_minutes,
    'locationMode', et.location_mode
  ) order by et.name), '[]'::jsonb)
  into v_links
  from public.booking_links link
  join public.calendar_event_types et on et.id = link.event_type_id and et.active
  join public.calendars cal on cal.id = et.calendar_id and cal.active
  where link.org_id = v_org.id and link.active;

  return jsonb_build_object(
    'kind', 'org',
    'orgName', v_org.name,
    'orgSlug', v_org.slug,
    'senderName', coalesce(nullif(v_org.sender_name, ''), v_org.name),
    'timezone', coalesce(nullif(v_org.timezone, ''), 'Africa/Johannesburg'),
    'consentText', '',
    'event', null,
    'weekly', '[]'::jsonb,
    'exceptions', '[]'::jsonb,
    'busy', '[]'::jsonb,
    'links', v_links
  );
end;
$$;

-- Creates the appointment only when consent is stored. Does not queue a message.
create or replace function public.book_public_appointment(
  p_slug text,
  p_starts_at timestamptz,
  p_name text,
  p_phone text,
  p_email text,
  p_consent boolean,
  p_consent_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\s+', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_consent text := btrim(coalesce(p_consent_text, ''));
  v_link public.booking_links%rowtype;
  v_event public.calendar_event_types%rowtype;
  v_cal public.calendars%rowtype;
  v_org public.organizations%rowtype;
  v_zone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_ends timestamptz;
  v_dow int;
  v_start_min int;
  v_end_min int;
  v_has_exception boolean;
  v_first text;
  v_last text;
  v_contact uuid;
  v_lead text;
  v_existing_stage text;
  v_appointment uuid := gen_random_uuid();
  v_space int;
begin
  if p_consent is not true or length(v_consent) < 12 then
    raise exception 'consent required';
  end if;
  if v_name = '' then
    raise exception 'name required';
  end if;
  if v_phone ~ '^0[0-9]{9}$' then
    v_phone := '+27' || substring(v_phone from 2);
  elsif v_phone ~ '^27[0-9]{9}$' then
    v_phone := '+' || v_phone;
  end if;
  if v_email = '' and v_phone = '' then
    raise exception 'phone or email required';
  end if;
  if v_email <> '' and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'email invalid';
  end if;
  if p_starts_at is null then
    raise exception 'slot required';
  end if;

  select * into v_link from public.booking_links where slug = v_slug and active;
  if not found then
    raise exception 'booking link is not active';
  end if;
  select * into v_event from public.calendar_event_types where id = v_link.event_type_id and org_id = v_link.org_id and active;
  if not found then
    raise exception 'booking link is not active';
  end if;
  select * into v_cal from public.calendars where id = v_event.calendar_id and org_id = v_link.org_id and active for update;
  if not found then
    raise exception 'booking link is not active';
  end if;
  select * into v_org from public.organizations where id = v_link.org_id;
  if not found or lower(coalesce(v_org.status, '')) = 'suspended' then
    raise exception 'booking link is not active';
  end if;

  v_zone := coalesce(nullif(v_cal.timezone, ''), nullif(v_org.timezone, ''), 'Africa/Johannesburg');
  v_ends := p_starts_at + (v_event.duration_minutes * interval '1 minute');
  v_local_start := p_starts_at at time zone v_zone;
  v_local_end := v_ends at time zone v_zone;
  if v_local_start::date <> v_local_end::date then
    raise exception 'slot crosses midnight';
  end if;
  if p_starts_at <= now() then
    raise exception 'outside hours';
  end if;

  v_dow := extract(dow from v_local_start)::int;
  v_start_min := extract(hour from v_local_start)::int * 60 + extract(minute from v_local_start)::int;
  v_end_min := extract(hour from v_local_end)::int * 60 + extract(minute from v_local_end)::int;
  if extract(second from v_local_start)::int <> 0 then
    raise exception 'outside hours';
  end if;

  select exists (
    select 1 from public.calendar_availability row
    where row.calendar_id = v_cal.id
      and row.kind = 'exception'
      and row.exception_date = v_local_start::date
  ) into v_has_exception;

  if v_has_exception then
    if exists (
      select 1 from public.calendar_availability row
      where row.calendar_id = v_cal.id
        and row.kind = 'exception'
        and row.exception_date = v_local_start::date
        and row.available = false
    ) then
      raise exception 'closed';
    end if;
    if not exists (
      select 1 from public.calendar_availability row
      where row.calendar_id = v_cal.id
        and row.kind = 'exception'
        and row.exception_date = v_local_start::date
        and row.available
        and row.start_minute <= v_start_min
        and row.end_minute >= v_end_min
    ) then
      raise exception 'outside hours';
    end if;
  elsif not exists (
    select 1 from public.calendar_availability row
    where row.calendar_id = v_cal.id
      and row.kind = 'weekly'
      and row.weekday = v_dow
      and row.start_minute <= v_start_min
      and row.end_minute >= v_end_min
  ) then
    raise exception 'outside hours';
  end if;

  if exists (
    select 1
    from public.crm_appointments existing
    join public.calendar_event_types et on et.id = existing.event_type_id
    where existing.calendar_id = v_cal.id
      and existing.status = 'scheduled'
      and tstzrange(
        existing.starts_at - (et.buffer_before_minutes * interval '1 minute'),
        existing.ends_at + (et.buffer_after_minutes * interval '1 minute'),
        '[)'
      ) && tstzrange(
        p_starts_at - (v_event.buffer_before_minutes * interval '1 minute'),
        v_ends + (v_event.buffer_after_minutes * interval '1 minute'),
        '[)'
      )
  ) then
    raise exception 'slot taken';
  end if;

  v_space := position(' ' in v_name);
  if v_space = 0 then
    v_first := v_name;
    v_last := '';
  else
    v_first := substring(v_name from 1 for v_space - 1);
    v_last := btrim(substring(v_name from v_space + 1));
  end if;

  if v_email <> '' then
    select id, lead_id into v_contact, v_lead
    from public.crm_contacts
    where org_id = v_org.id and lower(email) = v_email and erased_at is null
    order by created_at
    limit 1;
  end if;
  if v_contact is null and v_phone <> '' then
    select id, lead_id into v_contact, v_lead
    from public.crm_contacts
    where org_id = v_org.id and phone_e164 = v_phone and erased_at is null
    order by created_at
    limit 1;
  end if;

  if v_contact is null then
    insert into public.crm_contacts (org_id, first_name, last_name, email, phone_e164, company, tags, custom)
    values (v_org.id, v_first, v_last, v_email, v_phone, '', '{}', jsonb_build_object('source', 'booking'))
    returning id into v_contact;
  else
    update public.crm_contacts
    set first_name = case when first_name = '' then v_first else first_name end,
        last_name = case when last_name = '' then v_last else last_name end,
        email = case when email = '' then v_email else email end,
        phone_e164 = case when phone_e164 = '' then v_phone else phone_e164 end,
        updated_at = now()
    where id = v_contact and org_id = v_org.id;
  end if;

  if v_lead is not null and exists (
    select 1 from public.crm_leads lead where lead.id = v_lead and lead.org_id = v_org.id
  ) then
    select stage into v_existing_stage from public.crm_leads where id = v_lead and org_id = v_org.id;
    update public.crm_leads
    set booked_at = p_starts_at,
        stage = case when stage in ('New', 'Contacted') then 'Audit booked' else stage end,
        stage_changed_at = case when v_existing_stage in ('New', 'Contacted') then now() else stage_changed_at end,
        updated_at = now()
    where id = v_lead and org_id = v_org.id;
  else
    v_lead := 'bk' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    insert into public.crm_leads (
      id, org_id, name, company, phone, email, stage, notes, source,
      booked_at, stage_changed_at, enrolled, marketing_consent, ord
    ) values (
      v_lead,
      v_org.id,
      v_name,
      '',
      v_phone,
      v_email,
      'Audit booked',
      'Booked from the public calendar. Consent is stored on the appointment. No confirmation was sent.',
      'booking',
      p_starts_at,
      now(),
      false,
      false,
      0
    );
    update public.crm_contacts set lead_id = v_lead, updated_at = now()
    where id = v_contact and org_id = v_org.id and (lead_id is null or lead_id = '');
  end if;

  if v_email <> '' then
    insert into public.contact_consents (
      org_id, contact_id, channel, purpose, status, basis, address, source, evidence, captured_at
    ) values (
      v_org.id, v_contact, 'email', 'service', 'opted_in', 'consent', v_email, 'booking',
      jsonb_build_object('consent_text', v_consent, 'slug', v_slug, 'appointment_id', v_appointment),
      now()
    );
  end if;
  if v_phone <> '' then
    insert into public.contact_consents (
      org_id, contact_id, channel, purpose, status, basis, address, source, evidence, captured_at
    ) values (
      v_org.id, v_contact, 'sms', 'service', 'opted_in', 'consent', v_phone, 'booking',
      jsonb_build_object('consent_text', v_consent, 'slug', v_slug, 'appointment_id', v_appointment),
      now()
    );
  end if;

  insert into public.crm_appointments (
    id, org_id, calendar_id, event_type_id, booking_link_id, contact_id, lead_id,
    starts_at, ends_at, status, guest_name, guest_phone, guest_email,
    location_mode, location_detail, consent_accepted, consent_text, consent_at
  ) values (
    v_appointment, v_org.id, v_cal.id, v_event.id, v_link.id, v_contact, v_lead,
    p_starts_at, v_ends, 'scheduled', v_name, v_phone, v_email,
    v_event.location_mode, v_event.location_detail, true, v_consent, now()
  );

  perform public.record_workflow_event(
    v_org.id,
    'appointment.booked',
    'lead',
    v_lead,
    jsonb_build_object(
      'starts_at', p_starts_at,
      'lead_id', v_lead,
      'contact_id', v_contact,
      'appointment_id', v_appointment,
      'slug', v_slug
    ),
    'appointment.booked:' || v_appointment::text
  );

  return jsonb_build_object(
    'ok', true,
    'appointment_id', v_appointment,
    'contact_id', v_contact,
    'lead_id', v_lead,
    'starts_at', p_starts_at,
    'ends_at', v_ends
  );
end;
$$;

revoke all on function public.public_booking_catalog(text) from public, anon, authenticated;
revoke all on function public.book_public_appointment(text, timestamptz, text, text, text, boolean, text) from public, anon, authenticated;

do $service_grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.public_booking_catalog(text) to service_role;
    grant execute on function public.book_public_appointment(text, timestamptz, text, text, text, boolean, text) to service_role;
    grant select, insert, update, delete on public.calendars to service_role;
    grant select, insert, update, delete on public.calendar_availability to service_role;
    grant select, insert, update, delete on public.calendar_event_types to service_role;
    grant select, insert, update, delete on public.booking_links to service_role;
    grant select, insert, update, delete on public.crm_appointments to service_role;
  end if;
end
$service_grant$;

alter table public.calendars enable row level security;
alter table public.calendars force row level security;
alter table public.calendar_availability enable row level security;
alter table public.calendar_availability force row level security;
alter table public.calendar_event_types enable row level security;
alter table public.calendar_event_types force row level security;
alter table public.booking_links enable row level security;
alter table public.booking_links force row level security;
alter table public.crm_appointments enable row level security;
alter table public.crm_appointments force row level security;

drop policy if exists calendars_read on public.calendars;
create policy calendars_read on public.calendars
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists calendars_insert on public.calendars;
create policy calendars_insert on public.calendars
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists calendars_update on public.calendars;
create policy calendars_update on public.calendars
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists calendars_delete on public.calendars;
create policy calendars_delete on public.calendars
  for delete to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists calendar_availability_read on public.calendar_availability;
create policy calendar_availability_read on public.calendar_availability
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists calendar_availability_insert on public.calendar_availability;
create policy calendar_availability_insert on public.calendar_availability
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists calendar_availability_update on public.calendar_availability;
create policy calendar_availability_update on public.calendar_availability
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists calendar_availability_delete on public.calendar_availability;
create policy calendar_availability_delete on public.calendar_availability
  for delete to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists calendar_event_types_read on public.calendar_event_types;
create policy calendar_event_types_read on public.calendar_event_types
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists calendar_event_types_insert on public.calendar_event_types;
create policy calendar_event_types_insert on public.calendar_event_types
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists calendar_event_types_update on public.calendar_event_types;
create policy calendar_event_types_update on public.calendar_event_types
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists calendar_event_types_delete on public.calendar_event_types;
create policy calendar_event_types_delete on public.calendar_event_types
  for delete to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists booking_links_read on public.booking_links;
create policy booking_links_read on public.booking_links
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists booking_links_insert on public.booking_links;
create policy booking_links_insert on public.booking_links
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists booking_links_update on public.booking_links;
create policy booking_links_update on public.booking_links
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists booking_links_delete on public.booking_links;
create policy booking_links_delete on public.booking_links
  for delete to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

-- Same assigned_only rule as conversations. Other workspaces stay hidden.
drop policy if exists crm_appointments_visible on public.crm_appointments;
create policy crm_appointments_visible on public.crm_appointments
  for all to authenticated
  using (public.inbox_assigned_visible(org_id, assigned_user_id))
  with check (public.inbox_assigned_visible(org_id, assigned_user_id));

revoke all on public.calendars from public, anon;
revoke all on public.calendar_availability from public, anon;
revoke all on public.calendar_event_types from public, anon;
revoke all on public.booking_links from public, anon;
revoke all on public.crm_appointments from public, anon;
grant select, insert, update, delete on public.calendars to authenticated;
grant select, insert, update, delete on public.calendar_availability to authenticated;
grant select, insert, update, delete on public.calendar_event_types to authenticated;
grant select, insert, update, delete on public.booking_links to authenticated;
grant select, insert, update, delete on public.crm_appointments to authenticated;
