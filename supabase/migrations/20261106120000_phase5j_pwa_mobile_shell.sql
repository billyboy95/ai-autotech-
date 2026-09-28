-- Phase 5j: sandbox PWA install intent log.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- install_events stores a local install_intent only. No store API is called.
-- Leave PWA_INSTALL_SHELL_ENABLED unset until this file is applied.
-- Leave AI_REPLY_CRON_ENABLED unset. Do not turn sending on. Do not schedule a cron.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5j needs phase 2a access; apply 20260926200000_phase2a_access.sql before this file';
  end if;
end
$need$;

create table if not exists public.install_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'windows', 'other')),
  intent text not null default 'install_intent' check (intent = 'install_intent'),
  surface text not null default 'browser' check (surface = 'browser'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  created_at timestamptz not null default now()
);

create index if not exists install_events_org_idx
  on public.install_events (org_id, created_at desc);

alter table public.install_events enable row level security;
alter table public.install_events force row level security;

drop policy if exists install_events_read on public.install_events;
create policy install_events_read on public.install_events
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists install_events_insert on public.install_events;
create policy install_events_insert on public.install_events
  for insert to authenticated
  with check (
    public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
    and intent = 'install_intent'
    and surface = 'browser'
    and sandbox
    and charged = false
  );

revoke all on table public.install_events from public, anon;
grant select, insert on table public.install_events to authenticated;

create or replace function public.record_install_intent(p_org uuid, p_platform text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
  v_platform text;
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'workspace required';
  end if;

  v_platform := lower(btrim(coalesce(p_platform, '')));
  if v_platform not in ('ios', 'android', 'windows', 'other') then
    raise exception 'browser platform only';
  end if;

  insert into public.install_events (org_id, platform, intent, surface, sandbox, charged)
  values (p_org, v_platform, 'install_intent', 'browser', true, false)
  returning id into event_id;

  select o.sending_enabled into sending
  from public.organizations o
  where o.id = p_org;

  return jsonb_build_object(
    'id', event_id,
    'intent', 'install_intent',
    'platform', v_platform,
    'surface', 'browser',
    'sandbox', true,
    'charged', false,
    'stored', true,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.record_install_intent(uuid, text) from public, anon;
grant execute on function public.record_install_intent(uuid, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on table public.install_events to service_role;
    grant execute on function public.record_install_intent(uuid, text) to service_role;
  end if;
end
$service_grants$;

comment on table public.install_events is
  'Sandbox browser install_intent rows. No store is contacted. sending_enabled stays false.';
