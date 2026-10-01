-- Phase 5m: sandbox owner bootstrap / go-live attach notes.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- owner_bootstrap_notes stores presence only: configured, missing, or fixture.
-- It does not store an email, a secret, a token, or the SQL text.
-- This file does not add Auth users and does not run owner-bootstrap.sql.
-- Leave OWNER_BOOTSTRAP_UI_ENABLED unset until this file is applied.
-- Leave MIGRATION_RUNNER_ENABLED, SETUP_WIZARD_ENABLED, and the earlier phase 5 flags unset.
-- Leave AI_REPLY_CRON_ENABLED unset. Do not turn sending on. Do not schedule a cron.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5m needs phase 2a access; apply 20260926200000_phase2a_access.sql before this file';
  end if;
end
$need$;

create table if not exists public.owner_bootstrap_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_emails text not null check (owner_emails in ('configured', 'missing')),
  auth_attach text not null check (auth_attach in ('configured', 'missing', 'fixture')),
  sql_file text not null check (sql_file = 'supabase/owner-bootstrap.sql'),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  status text not null default 'noted' check (status = 'noted'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  created_at timestamptz not null default now()
);

create index if not exists owner_bootstrap_notes_org_idx
  on public.owner_bootstrap_notes (org_id, created_at desc);

alter table public.owner_bootstrap_notes enable row level security;
alter table public.owner_bootstrap_notes force row level security;

drop policy if exists owner_bootstrap_notes_read on public.owner_bootstrap_notes;
create policy owner_bootstrap_notes_read on public.owner_bootstrap_notes
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists owner_bootstrap_notes_insert on public.owner_bootstrap_notes;
create policy owner_bootstrap_notes_insert on public.owner_bootstrap_notes
  for insert to authenticated
  with check (
    public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
    and owner_emails in ('configured', 'missing')
    and auth_attach in ('configured', 'missing', 'fixture')
    and sql_file = 'supabase/owner-bootstrap.sql'
    and status = 'noted'
    and sandbox
    and charged = false
  );

revoke all on table public.owner_bootstrap_notes from public, anon;
grant select, insert on table public.owner_bootstrap_notes to authenticated;

create or replace function public.owner_bootstrap_notes_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'owner notes are not updated';
  end if;
  if new.status is distinct from 'noted'
     or new.sandbox is not true
     or new.charged is not false
     or new.sql_file is distinct from 'supabase/owner-bootstrap.sql'
     or new.owner_emails not in ('configured', 'missing')
     or new.auth_attach not in ('configured', 'missing', 'fixture')
     or new.checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'sandbox owner note only';
  end if;
  return new;
end;
$$;

drop trigger if exists owner_bootstrap_notes_guard on public.owner_bootstrap_notes;
create trigger owner_bootstrap_notes_guard
  before insert or update on public.owner_bootstrap_notes
  for each row execute function public.owner_bootstrap_notes_guard();

create or replace function public.record_owner_bootstrap_note(
  p_org uuid,
  p_owner_emails text,
  p_auth_attach text,
  p_checksum text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  note_id uuid;
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff']) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'workspace required';
  end if;

  if p_owner_emails is null
     or p_auth_attach is null
     or p_checksum is null
     or position('@' in (p_owner_emails || p_auth_attach || p_checksum)) > 0
     or position('bearer ' in lower(p_owner_emails || p_auth_attach || p_checksum)) > 0
     or position('postgres://' in lower(p_owner_emails || p_auth_attach || p_checksum)) > 0
     or position('sbp_' in lower(p_owner_emails || p_auth_attach || p_checksum)) > 0 then
    raise exception 'secrets are not stored';
  end if;

  if p_owner_emails not in ('configured', 'missing')
     or p_auth_attach not in ('configured', 'missing', 'fixture')
     or p_checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'owner note only';
  end if;

  insert into public.owner_bootstrap_notes (
    org_id, owner_emails, auth_attach, sql_file, checksum, status, sandbox, charged
  )
  values (
    p_org, p_owner_emails, p_auth_attach, 'supabase/owner-bootstrap.sql', p_checksum, 'noted', true, false
  )
  returning id into note_id;

  select o.sending_enabled into sending
  from public.organizations o
  where o.id = p_org;

  return jsonb_build_object(
    'stored', true,
    'sandbox', true,
    'charged', false,
    'status', 'noted',
    'owner_emails', p_owner_emails,
    'auth_attach', p_auth_attach,
    'applied', false,
    'created_user', false,
    'sending_enabled', coalesce(sending, false),
    'id', note_id
  );
end;
$$;

revoke all on function public.record_owner_bootstrap_note(uuid, text, text, text) from public, anon;
grant execute on function public.record_owner_bootstrap_note(uuid, text, text, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on table public.owner_bootstrap_notes to service_role;
    grant execute on function public.record_owner_bootstrap_note(uuid, text, text, text) to service_role;
  end if;
end
$service_grants$;

comment on table public.owner_bootstrap_notes is
  'Sandbox owner-bootstrap note. Stores configured, missing, or fixture only. No email. No secret. Does not create an Auth user. Does not run owner-bootstrap.sql. sending_enabled stays false.';
