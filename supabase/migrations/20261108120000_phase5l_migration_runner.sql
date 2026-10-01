-- Phase 5l: sandbox pending-SQL migration runner checklist.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- migration_runner_events stores step, filename, and sha256 checksum only.
-- status stays pending. sandbox stays true. charged stays false.
-- This file does not execute migration SQL and does not mark steps 20–33 applied.
-- Leave MIGRATION_RUNNER_ENABLED unset until this file is applied.
-- Leave SETUP_WIZARD_ENABLED and the earlier phase 5 flags unset.
-- Leave AI_REPLY_CRON_ENABLED unset. Do not turn sending on. Do not schedule a cron.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5l needs phase 2a access; apply 20260926200000_phase2a_access.sql before this file';
  end if;
end
$need$;

create table if not exists public.migration_runner_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  step_number integer not null check (step_number between 20 and 33),
  filename text not null check (
    filename ~ '^supabase/migrations/[0-9]{14}_[a-z0-9_]+\.sql$'
    and char_length(filename) <= 120
  ),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status = 'pending'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  created_at timestamptz not null default now()
);

create index if not exists migration_runner_events_org_idx
  on public.migration_runner_events (org_id, step_number, created_at desc);

alter table public.migration_runner_events enable row level security;
alter table public.migration_runner_events force row level security;

drop policy if exists migration_runner_events_read on public.migration_runner_events;
create policy migration_runner_events_read on public.migration_runner_events
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists migration_runner_events_insert on public.migration_runner_events;
create policy migration_runner_events_insert on public.migration_runner_events
  for insert to authenticated
  with check (
    public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
    and status = 'pending'
    and sandbox
    and charged = false
  );

revoke all on table public.migration_runner_events from public, anon;
grant select, insert on table public.migration_runner_events to authenticated;

create or replace function public.migration_runner_events_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'checklist events are not updated';
  end if;
  if new.status is distinct from 'pending'
     or new.sandbox is not true
     or new.charged is not false
     or new.checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'pending sandbox checklist only';
  end if;
  return new;
end;
$$;

drop trigger if exists migration_runner_events_guard on public.migration_runner_events;
create trigger migration_runner_events_guard
  before insert or update on public.migration_runner_events
  for each row execute function public.migration_runner_events_guard();

create or replace function public.record_migration_dry_run(
  p_org uuid,
  p_steps jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  elem jsonb;
  v_step integer;
  v_step_text text;
  v_file text;
  v_checksum text;
  inserted integer := 0;
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'workspace required';
  end if;

  if p_steps is null
     or jsonb_typeof(p_steps) <> 'array'
     or position('bearer ' in lower(p_steps::text)) > 0
     or position('postgres://' in lower(p_steps::text)) > 0
     or position('sbp_' in lower(p_steps::text)) > 0 then
    raise exception 'secrets are not stored';
  end if;

  if jsonb_array_length(p_steps) <> 14
     or (
       select count(distinct item->>'step')
       from jsonb_array_elements(p_steps) item
     ) <> 14 then
    raise exception 'checklist steps only';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_steps) item
    cross join lateral jsonb_object_keys(item) key_name
    where key_name not in ('step', 'filename', 'checksum')
  ) then
    raise exception 'secrets are not stored';
  end if;

  for elem in select value from jsonb_array_elements(p_steps)
  loop
    v_step_text := elem->>'step';
    v_file := elem->>'filename';
    v_checksum := elem->>'checksum';

    if v_step_text !~ '^(2[0-9]|3[0-3])$'
       or v_file is null
       or v_checksum is null
       or v_checksum !~ '^[a-f0-9]{64}$' then
      raise exception 'checklist steps only';
    end if;

    v_step := v_step_text::integer;

    if not exists (
      select 1
      from (values
        (20, 'supabase/migrations/20261026120000_phase4c_aios_pricing.sql'),
        (21, 'supabase/migrations/20261027120000_phase4d_eastc_education.sql'),
        (22, 'supabase/migrations/20261028120000_phase5a_agent_computers.sql'),
        (23, 'supabase/migrations/20261029120000_phase5b_lead_onboarding.sql'),
        (24, 'supabase/migrations/20261030120000_phase5c_connect_import.sql'),
        (25, 'supabase/migrations/20261031120000_phase5d_home_chat.sql'),
        (26, 'supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql'),
        (27, 'supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql'),
        (28, 'supabase/migrations/20261103120000_phase5g_social_drafts.sql'),
        (29, 'supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql'),
        (30, 'supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql'),
        (31, 'supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql'),
        (32, 'supabase/migrations/20261107120000_phase5k_setup_wizard.sql'),
        (33, 'supabase/migrations/20261108120000_phase5l_migration_runner.sql')
      ) as allowed(step, filename)
      where allowed.step = v_step
        and allowed.filename = v_file
    ) then
      raise exception 'checklist file only';
    end if;

    insert into public.migration_runner_events (org_id, step_number, filename, checksum, status, sandbox, charged)
    values (p_org, v_step, v_file, v_checksum, 'pending', true, false);
    inserted := inserted + 1;
  end loop;

  if inserted <> 14 then
    raise exception 'checklist steps only';
  end if;

  select o.sending_enabled into sending
  from public.organizations o
  where o.id = p_org;

  return jsonb_build_object(
    'stored', true,
    'sandbox', true,
    'charged', false,
    'status', 'pending',
    'count', inserted,
    'applied', false,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.record_migration_dry_run(uuid, jsonb) from public, anon;
grant execute on function public.record_migration_dry_run(uuid, jsonb) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on table public.migration_runner_events to service_role;
    grant execute on function public.record_migration_dry_run(uuid, jsonb) to service_role;
  end if;
end
$service_grants$;

comment on table public.migration_runner_events is
  'Sandbox pending-SQL checklist. Stores step, filename, and checksum. Status stays pending. No secrets. SQL is not applied. sending_enabled stays false.';
