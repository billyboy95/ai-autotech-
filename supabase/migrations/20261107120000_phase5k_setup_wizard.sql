-- Phase 5k: sandbox setup / go-live checklist events.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- setup_checklist_events stores org_id, step_key, and status only.
-- sandbox stays true. charged stays false. No secret column exists.
-- Leave SETUP_WIZARD_ENABLED unset until this file is applied.
-- Leave AI_REPLY_CRON_ENABLED unset. Do not turn sending on. Do not schedule a cron.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5k needs phase 2a access; apply 20260926200000_phase2a_access.sql before this file';
  end if;
end
$need$;

create table if not exists public.setup_checklist_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  step_key text not null check (step_key in (
    'sql_steps',
    'owner_attach',
    'cron_secret',
    'channel_email',
    'channel_whatsapp',
    'channel_sms',
    'payfast_billing',
    'feature_flags'
  )),
  status text not null check (status in (
    'pending',
    'configured',
    'missing',
    'fixture',
    'noted',
    'leave_unset',
    'connected',
    'not_connected'
  )),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  created_at timestamptz not null default now()
);

create index if not exists setup_checklist_events_org_idx
  on public.setup_checklist_events (org_id, created_at desc);

alter table public.setup_checklist_events enable row level security;
alter table public.setup_checklist_events force row level security;

drop policy if exists setup_checklist_events_read on public.setup_checklist_events;
create policy setup_checklist_events_read on public.setup_checklist_events
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists setup_checklist_events_insert on public.setup_checklist_events;
create policy setup_checklist_events_insert on public.setup_checklist_events
  for insert to authenticated
  with check (
    public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
    and sandbox
    and charged = false
  );

revoke all on table public.setup_checklist_events from public, anon;
grant select, insert on table public.setup_checklist_events to authenticated;

create or replace function public.record_setup_checklist_event(
  p_org uuid,
  p_step_key text,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
  v_step text;
  v_status text;
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'workspace required';
  end if;

  if char_length(coalesce(p_step_key, '')) > 40
     or char_length(coalesce(p_status, '')) > 32
     or position('bearer ' in lower(coalesce(p_step_key, ''))) > 0
     or position('bearer ' in lower(coalesce(p_status, ''))) > 0 then
    raise exception 'secrets are not stored';
  end if;

  v_step := btrim(coalesce(p_step_key, ''));
  v_status := btrim(coalesce(p_status, ''));

  if v_step not in (
    'sql_steps',
    'owner_attach',
    'cron_secret',
    'channel_email',
    'channel_whatsapp',
    'channel_sms',
    'payfast_billing',
    'feature_flags'
  ) then
    raise exception 'checklist step only';
  end if;

  if v_status not in (
    'pending',
    'configured',
    'missing',
    'fixture',
    'noted',
    'leave_unset',
    'connected',
    'not_connected'
  ) then
    raise exception 'checklist status only';
  end if;

  insert into public.setup_checklist_events (org_id, step_key, status, sandbox, charged)
  values (p_org, v_step, v_status, true, false)
  returning id into event_id;

  select o.sending_enabled into sending
  from public.organizations o
  where o.id = p_org;

  return jsonb_build_object(
    'id', event_id,
    'step_key', v_step,
    'status', v_status,
    'sandbox', true,
    'charged', false,
    'stored', true,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.record_setup_checklist_event(uuid, text, text) from public, anon;
grant execute on function public.record_setup_checklist_event(uuid, text, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on table public.setup_checklist_events to service_role;
    grant execute on function public.record_setup_checklist_event(uuid, text, text) to service_role;
  end if;
end
$service_grants$;

comment on table public.setup_checklist_events is
  'Sandbox go-live checklist notes. Stores step and status only. No secrets. sending_enabled stays false.';
