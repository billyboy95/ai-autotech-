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
