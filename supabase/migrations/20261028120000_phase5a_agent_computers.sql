-- Phase 5a: per-agent cloud computers.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Sandbox stays true. This file does not call E2B, Browserbase, PayFast, Paystack, or Yoco.
-- Hours are seconds on the meter. Crossing the allowance pauses the row. Nothing is charged.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.org_bots') is null
     or to_regclass('public.bot_catalog') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.attach_org_tenancy(regclass)') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5a needs phase 4a bots; apply 20261024120000_phase4a_bots.sql and step 21 before this file';
  end if;
end
$need$;

create table if not exists public.agent_computers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  bot_install_id uuid references public.org_bots(id) on delete set null,
  bot_slug text not null references public.bot_catalog(slug),
  provider text not null default 'fixture' check (provider in ('fixture', 'e2b')),
  external_id text not null default '',
  status text not null default 'idle' check (status in ('idle', 'running', 'paused', 'error')),
  hours_used_seconds integer not null default 0 check (hours_used_seconds >= 0),
  allowance_seconds integer not null default 0 check (allowance_seconds >= 0),
  live_view_token_hash text not null default '',
  assigned_user_id uuid,
  sandbox boolean not null default true check (sandbox),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, bot_slug),
  constraint agent_computers_token_hash_check check (
    live_view_token_hash = '' or live_view_token_hash ~ '^[a-f0-9]{64}$'
  )
);

create index if not exists agent_computers_status_idx on public.agent_computers (org_id, status);
create index if not exists agent_computers_assignee_idx on public.agent_computers (org_id, assigned_user_id);

create or replace function public.agent_computers_guard()
returns trigger
language plpgsql
as $$
begin
  if new.sandbox is distinct from true then
    raise exception 'agent computers stay sandbox';
  end if;
  if new.hours_used_seconds > new.allowance_seconds then
    new.status := 'paused';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists agent_computers_guard on public.agent_computers;
create trigger agent_computers_guard
  before insert or update on public.agent_computers
  for each row execute function public.agent_computers_guard();

-- Agency owners, agency staff, and client admins see the workspace.
-- A client_user with assigned_only sees a computer only when it is assigned to them.
create or replace function public.agent_computer_visible(p_org uuid, p_assigned uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_org in (select public.accessible_org_ids())
    and (
      public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin'])
      or exists (
        select 1
        from public.memberships m
        where m.user_id = auth.uid()
          and m.org_id = p_org
          and m.role = 'client_user'
          and (
            not m.assigned_only
            or p_assigned is not distinct from auth.uid()
          )
      )
    );
$$;

revoke all on function public.agent_computer_visible(uuid, uuid) from public, anon;
grant execute on function public.agent_computer_visible(uuid, uuid) to authenticated;

select public.attach_org_tenancy('public.agent_computers'::regclass);

revoke delete on public.agent_computers from authenticated;

drop policy if exists org_isolation on public.agent_computers;
drop policy if exists agent_computers_select on public.agent_computers;
create policy agent_computers_select on public.agent_computers
  for select to authenticated
  using (public.agent_computer_visible(org_id, assigned_user_id));

drop policy if exists agent_computers_insert on public.agent_computers;
create policy agent_computers_insert on public.agent_computers
  for insert to authenticated
  with check (
    sandbox
    and public.agent_computer_visible(org_id, assigned_user_id)
    and (
      public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
      or assigned_user_id is not distinct from auth.uid()
    )
  );

drop policy if exists agent_computers_update on public.agent_computers;
create policy agent_computers_update on public.agent_computers
  for update to authenticated
  using (public.agent_computer_visible(org_id, assigned_user_id))
  with check (
    sandbox
    and public.agent_computer_visible(org_id, assigned_user_id)
  );

create or replace function public.ensure_agent_computer(
  p_org uuid,
  p_bot_slug text,
  p_allowance_seconds integer,
  p_assigned uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  install_id uuid;
  row public.agent_computers;
begin
  if p_allowance_seconds is null or p_allowance_seconds < 0 then
    raise exception 'allowance must be zero or more';
  end if;
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin'])
     and not exists (
       select 1
       from public.memberships m
       where m.user_id = auth.uid()
         and m.org_id = p_org
         and m.role = 'client_user'
         and (not m.assigned_only or p_assigned is not distinct from auth.uid())
     ) then
    raise exception 'not allowed';
  end if;
  if not exists (select 1 from public.bot_catalog where slug = p_bot_slug) then
    raise exception 'unknown bot';
  end if;

  select id into install_id
  from public.org_bots
  where org_id = p_org and bot_slug = p_bot_slug;

  insert into public.agent_computers (
    org_id, bot_install_id, bot_slug, provider, external_id, status,
    hours_used_seconds, allowance_seconds, live_view_token_hash, assigned_user_id, sandbox
  ) values (
    p_org, install_id, p_bot_slug, 'fixture', '', 'idle',
    0, p_allowance_seconds, '', p_assigned, true
  )
  on conflict (org_id, bot_slug) do update
    set allowance_seconds = excluded.allowance_seconds,
        bot_install_id = coalesce(public.agent_computers.bot_install_id, excluded.bot_install_id),
        assigned_user_id = coalesce(public.agent_computers.assigned_user_id, excluded.assigned_user_id),
        updated_at = now()
  returning * into row;

  return jsonb_build_object(
    'id', row.id,
    'status', row.status,
    'sandbox', row.sandbox,
    'provider', row.provider,
    'hours_used_seconds', row.hours_used_seconds,
    'allowance_seconds', row.allowance_seconds,
    'charged', false
  );
end;
$$;

revoke all on function public.ensure_agent_computer(uuid, text, integer, uuid) from public, anon;
grant execute on function public.ensure_agent_computer(uuid, text, integer, uuid) to authenticated;

create or replace function public.add_agent_computer_fixture_minute(
  p_org uuid,
  p_bot_slug text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.agent_computers;
begin
  select * into row
  from public.agent_computers
  where org_id = p_org and bot_slug = p_bot_slug;
  if not found then
    raise exception 'computer not found';
  end if;
  if auth.uid() is not null and not public.agent_computer_visible(p_org, row.assigned_user_id) then
    raise exception 'not allowed';
  end if;

  update public.agent_computers
  set hours_used_seconds = hours_used_seconds + 60
  where id = row.id
  returning * into row;

  return jsonb_build_object(
    'id', row.id,
    'status', row.status,
    'sandbox', row.sandbox,
    'hours_used_seconds', row.hours_used_seconds,
    'allowance_seconds', row.allowance_seconds,
    'charged', false
  );
end;
$$;

revoke all on function public.add_agent_computer_fixture_minute(uuid, text) from public, anon;
grant execute on function public.add_agent_computer_fixture_minute(uuid, text) to authenticated;

do $service$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.agent_computers to service_role;
    grant execute on function public.ensure_agent_computer(uuid, text, integer, uuid) to service_role;
    grant execute on function public.add_agent_computer_fixture_minute(uuid, text) to service_role;
  end if;
end
$service$;
