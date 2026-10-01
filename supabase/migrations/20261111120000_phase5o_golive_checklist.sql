-- Phase 5o: sandbox go-live readiness checklist.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- golive_checklist_notes stores status enums only: pending, ready, blocked, or fixture.
-- It does not store a secret, a token, a connection string, or an API key.
-- It does not run migration SQL, click Apply, register a cron, or send.
-- Leave GOLIVE_CHECKLIST_ENABLED unset until this file is applied.
-- Leave MIGRATION_RUNNER_ENABLED, SETUP_WIZARD_ENABLED, OWNER_BOOTSTRAP_UI_ENABLED,
-- OPS_SECRETS_READY_ENABLED, and the earlier phase 5 flags unset.
-- Leave AI_REPLY_CRON_ENABLED, ZENTRIX_WORKSPACE_PACK_ENABLED,
-- EAST_RAND_CAMPAIGN_SEED_ENABLED, and PWA_INSTALL_SHELL_ENABLED unset.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5o needs phase 2a access; apply 20260926200000_phase2a_access.sql before this file';
  end if;
end
$need$;

create table if not exists public.golive_checklist_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  migrations text not null check (migrations in ('pending', 'ready', 'blocked', 'fixture')),
  setup_wizard text not null check (setup_wizard in ('pending', 'ready', 'blocked', 'fixture')),
  owner_bootstrap text not null check (owner_bootstrap in ('pending', 'ready', 'blocked', 'fixture')),
  ops_secrets text not null check (ops_secrets in ('pending', 'ready', 'blocked', 'fixture')),
  education_pack text not null check (education_pack in ('pending', 'ready', 'blocked', 'fixture')),
  zentrix_pack text not null check (zentrix_pack in ('pending', 'ready', 'blocked', 'fixture')),
  pwa_install text not null check (pwa_install in ('pending', 'ready', 'blocked', 'fixture')),
  sending text not null check (sending in ('pending', 'ready', 'blocked', 'fixture')),
  status text not null default 'noted' check (status = 'noted'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  created_at timestamptz not null default now()
);

create index if not exists golive_checklist_notes_org_idx
  on public.golive_checklist_notes (org_id, created_at desc);

alter table public.golive_checklist_notes enable row level security;
alter table public.golive_checklist_notes force row level security;

drop policy if exists golive_checklist_notes_read on public.golive_checklist_notes;
create policy golive_checklist_notes_read on public.golive_checklist_notes
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists golive_checklist_notes_insert on public.golive_checklist_notes;
create policy golive_checklist_notes_insert on public.golive_checklist_notes
  for insert to authenticated
  with check (
    public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
    and migrations in ('pending', 'ready', 'blocked', 'fixture')
    and setup_wizard in ('pending', 'ready', 'blocked', 'fixture')
    and owner_bootstrap in ('pending', 'ready', 'blocked', 'fixture')
    and ops_secrets in ('pending', 'ready', 'blocked', 'fixture')
    and education_pack in ('pending', 'ready', 'blocked', 'fixture')
    and zentrix_pack in ('pending', 'ready', 'blocked', 'fixture')
    and pwa_install in ('pending', 'ready', 'blocked', 'fixture')
    and sending = 'blocked'
    and status = 'noted'
    and sandbox
    and charged = false
  );

revoke all on table public.golive_checklist_notes from public, anon;
grant select, insert on table public.golive_checklist_notes to authenticated;

create or replace function public.golive_checklist_notes_guard()
returns trigger
language plpgsql
as $$
declare
  blob text;
begin
  if tg_op = 'UPDATE' then
    raise exception 'golive notes are not updated';
  end if;
  blob := concat_ws(
    ' ',
    new.migrations,
    new.setup_wizard,
    new.owner_bootstrap,
    new.ops_secrets,
    new.education_pack,
    new.zentrix_pack,
    new.pwa_install,
    new.sending,
    new.status
  );
  if position('@' in blob) > 0
     or position('bearer ' in lower(blob)) > 0
     or position('postgres://' in lower(blob)) > 0
     or position('sbp_' in lower(blob)) > 0
     or position('re_' in lower(blob)) > 0
     or position('sk_' in lower(blob)) > 0
     or position('api_key' in lower(blob)) > 0
     or position('cron_secret' in lower(blob)) > 0 then
    raise exception 'secrets are not stored';
  end if;
  if new.status is distinct from 'noted'
     or new.sandbox is not true
     or new.charged is not false
     or new.migrations not in ('pending', 'ready', 'blocked', 'fixture')
     or new.setup_wizard not in ('pending', 'ready', 'blocked', 'fixture')
     or new.owner_bootstrap not in ('pending', 'ready', 'blocked', 'fixture')
     or new.ops_secrets not in ('pending', 'ready', 'blocked', 'fixture')
     or new.education_pack not in ('pending', 'ready', 'blocked', 'fixture')
     or new.zentrix_pack not in ('pending', 'ready', 'blocked', 'fixture')
     or new.pwa_install not in ('pending', 'ready', 'blocked', 'fixture')
     or new.sending is distinct from 'blocked' then
    raise exception 'golive checklist note only';
  end if;
  return new;
end;
$$;

drop trigger if exists golive_checklist_notes_guard on public.golive_checklist_notes;
create trigger golive_checklist_notes_guard
  before insert or update on public.golive_checklist_notes
  for each row execute function public.golive_checklist_notes_guard();

create or replace function public.record_golive_checklist_note(
  p_org uuid,
  p_migrations text,
  p_setup_wizard text,
  p_owner_bootstrap text,
  p_ops_secrets text,
  p_education_pack text,
  p_zentrix_pack text,
  p_pwa_install text,
  p_sending text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  note_id uuid;
  sending boolean;
  blob text;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff']) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'workspace required';
  end if;

  blob := concat_ws(
    '',
    p_migrations,
    p_setup_wizard,
    p_owner_bootstrap,
    p_ops_secrets,
    p_education_pack,
    p_zentrix_pack,
    p_pwa_install,
    p_sending
  );
  if p_migrations is null
     or p_setup_wizard is null
     or p_owner_bootstrap is null
     or p_ops_secrets is null
     or p_education_pack is null
     or p_zentrix_pack is null
     or p_pwa_install is null
     or p_sending is null
     or position('@' in blob) > 0
     or position('bearer ' in lower(blob)) > 0
     or position('postgres://' in lower(blob)) > 0
     or position('sbp_' in lower(blob)) > 0
     or position('re_' in lower(blob)) > 0
     or position('sk_' in lower(blob)) > 0
     or position('api_key' in lower(blob)) > 0
     or position('cron_secret' in lower(blob)) > 0 then
    raise exception 'secrets are not stored';
  end if;

  if p_sending is distinct from 'blocked' then
    raise exception 'sending stays blocked';
  end if;

  if p_migrations not in ('pending', 'ready', 'blocked', 'fixture')
     or p_setup_wizard not in ('pending', 'ready', 'blocked', 'fixture')
     or p_owner_bootstrap not in ('pending', 'ready', 'blocked', 'fixture')
     or p_ops_secrets not in ('pending', 'ready', 'blocked', 'fixture')
     or p_education_pack not in ('pending', 'ready', 'blocked', 'fixture')
     or p_zentrix_pack not in ('pending', 'ready', 'blocked', 'fixture')
     or p_pwa_install not in ('pending', 'ready', 'blocked', 'fixture') then
    raise exception 'golive checklist note only';
  end if;

  insert into public.golive_checklist_notes (
    org_id,
    migrations,
    setup_wizard,
    owner_bootstrap,
    ops_secrets,
    education_pack,
    zentrix_pack,
    pwa_install,
    sending,
    status,
    sandbox,
    charged
  )
  values (
    p_org,
    p_migrations,
    p_setup_wizard,
    p_owner_bootstrap,
    p_ops_secrets,
    p_education_pack,
    p_zentrix_pack,
    p_pwa_install,
    'blocked',
    'noted',
    true,
    false
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
    'migrations', p_migrations,
    'setup_wizard', p_setup_wizard,
    'owner_bootstrap', p_owner_bootstrap,
    'ops_secrets', p_ops_secrets,
    'education_pack', p_education_pack,
    'zentrix_pack', p_zentrix_pack,
    'pwa_install', p_pwa_install,
    'sending', 'blocked',
    'applied', false,
    'clicked_apply', false,
    'registered', false,
    'scheduled', false,
    'sending_enabled', coalesce(sending, false),
    'id', note_id
  );
end;
$$;

revoke all on function public.record_golive_checklist_note(uuid, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.record_golive_checklist_note(uuid, text, text, text, text, text, text, text, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on table public.golive_checklist_notes to service_role;
    grant execute on function public.record_golive_checklist_note(uuid, text, text, text, text, text, text, text, text) to service_role;
  end if;
end
$service_grants$;

comment on table public.golive_checklist_notes is
  'Sandbox go-live checklist snapshot. Stores pending, ready, blocked, or fixture only. sending stays blocked. No secret value. Does not apply SQL or packs. sending_enabled stays false.';
