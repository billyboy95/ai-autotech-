-- Phase 5n: sandbox ops secrets readiness notes.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- ops_secrets_notes stores presence only: configured, missing, or fixture.
-- It does not store a secret, a token, a connection string, or an API key.
-- The cron list is names only. This file does not register a cron.
-- Leave OPS_SECRETS_READY_ENABLED unset until this file is applied.
-- Leave MIGRATION_RUNNER_ENABLED, SETUP_WIZARD_ENABLED, OWNER_BOOTSTRAP_UI_ENABLED, and the earlier phase 5 flags unset.
-- Leave AI_REPLY_CRON_ENABLED unset. Do not turn sending on.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5n needs phase 2a access; apply 20260926200000_phase2a_access.sql before this file';
  end if;
end
$need$;

create table if not exists public.ops_secrets_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  cron_presence text not null check (cron_presence in ('configured', 'missing', 'fixture')),
  email_provider text not null check (email_provider in ('configured', 'missing', 'fixture')),
  whatsapp_meta text not null check (whatsapp_meta in ('configured', 'missing', 'fixture')),
  sms_provider text not null check (sms_provider in ('configured', 'missing', 'fixture')),
  payfast_sandbox text not null check (payfast_sandbox in ('configured', 'missing', 'fixture')),
  cron_jobs text[] not null default array['automation', 'workflow-engine', 'billing-cycle', 'ai-reply-drafts']::text[]
    check (cron_jobs = array['automation', 'workflow-engine', 'billing-cycle', 'ai-reply-drafts']::text[]),
  status text not null default 'noted' check (status = 'noted'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  created_at timestamptz not null default now()
);

create index if not exists ops_secrets_notes_org_idx
  on public.ops_secrets_notes (org_id, created_at desc);

alter table public.ops_secrets_notes enable row level security;
alter table public.ops_secrets_notes force row level security;

drop policy if exists ops_secrets_notes_read on public.ops_secrets_notes;
create policy ops_secrets_notes_read on public.ops_secrets_notes
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists ops_secrets_notes_insert on public.ops_secrets_notes;
create policy ops_secrets_notes_insert on public.ops_secrets_notes
  for insert to authenticated
  with check (
    public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
    and cron_presence in ('configured', 'missing', 'fixture')
    and email_provider in ('configured', 'missing', 'fixture')
    and whatsapp_meta in ('configured', 'missing', 'fixture')
    and sms_provider in ('configured', 'missing', 'fixture')
    and payfast_sandbox in ('configured', 'missing', 'fixture')
    and cron_jobs = array['automation', 'workflow-engine', 'billing-cycle', 'ai-reply-drafts']::text[]
    and status = 'noted'
    and sandbox
    and charged = false
  );

revoke all on table public.ops_secrets_notes from public, anon;
grant select, insert on table public.ops_secrets_notes to authenticated;

create or replace function public.ops_secrets_notes_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'ops notes are not updated';
  end if;
  if new.status is distinct from 'noted'
     or new.sandbox is not true
     or new.charged is not false
     or new.cron_presence not in ('configured', 'missing', 'fixture')
     or new.email_provider not in ('configured', 'missing', 'fixture')
     or new.whatsapp_meta not in ('configured', 'missing', 'fixture')
     or new.sms_provider not in ('configured', 'missing', 'fixture')
     or new.payfast_sandbox not in ('configured', 'missing', 'fixture')
     or new.cron_jobs is distinct from array['automation', 'workflow-engine', 'billing-cycle', 'ai-reply-drafts']::text[] then
    raise exception 'sandbox ops note only';
  end if;
  if position('@' in array_to_string(new.cron_jobs, ' ')) > 0
     or position('bearer ' in lower(array_to_string(new.cron_jobs, ' '))) > 0
     or position('postgres://' in lower(array_to_string(new.cron_jobs, ' '))) > 0
     or position('sbp_' in lower(array_to_string(new.cron_jobs, ' '))) > 0 then
    raise exception 'secrets are not stored';
  end if;
  return new;
end;
$$;

drop trigger if exists ops_secrets_notes_guard on public.ops_secrets_notes;
create trigger ops_secrets_notes_guard
  before insert or update on public.ops_secrets_notes
  for each row execute function public.ops_secrets_notes_guard();

create or replace function public.record_ops_secrets_note(
  p_org uuid,
  p_cron text,
  p_email_provider text,
  p_whatsapp text,
  p_sms text,
  p_payfast text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  note_id uuid;
  sending boolean;
  blob text;
  jobs text[] := array['automation', 'workflow-engine', 'billing-cycle', 'ai-reply-drafts']::text[];
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff']) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'workspace required';
  end if;

  blob := coalesce(p_cron, '') || coalesce(p_email_provider, '') || coalesce(p_whatsapp, '') || coalesce(p_sms, '') || coalesce(p_payfast, '');
  if p_cron is null
     or p_email_provider is null
     or p_whatsapp is null
     or p_sms is null
     or p_payfast is null
     or position('@' in blob) > 0
     or position('bearer ' in lower(blob)) > 0
     or position('postgres://' in lower(blob)) > 0
     or position('sbp_' in lower(blob)) > 0
     or position('re_' in lower(blob)) > 0
     or position('sk_' in lower(blob)) > 0 then
    raise exception 'secrets are not stored';
  end if;

  if p_cron not in ('configured', 'missing', 'fixture')
     or p_email_provider not in ('configured', 'missing', 'fixture')
     or p_whatsapp not in ('configured', 'missing', 'fixture')
     or p_sms not in ('configured', 'missing', 'fixture')
     or p_payfast not in ('configured', 'missing', 'fixture') then
    raise exception 'ops secrets note only';
  end if;

  insert into public.ops_secrets_notes (
    org_id,
    cron_presence,
    email_provider,
    whatsapp_meta,
    sms_provider,
    payfast_sandbox,
    cron_jobs,
    status,
    sandbox,
    charged
  )
  values (
    p_org,
    p_cron,
    p_email_provider,
    p_whatsapp,
    p_sms,
    p_payfast,
    jobs,
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
    'cron_presence', p_cron,
    'email_provider', p_email_provider,
    'whatsapp_meta', p_whatsapp,
    'sms_provider', p_sms,
    'payfast_sandbox', p_payfast,
    'cron_jobs', to_jsonb(jobs),
    'registered', false,
    'scheduled', false,
    'applied', false,
    'sending_enabled', coalesce(sending, false),
    'id', note_id
  );
end;
$$;

revoke all on function public.record_ops_secrets_note(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.record_ops_secrets_note(uuid, text, text, text, text, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on table public.ops_secrets_notes to service_role;
    grant execute on function public.record_ops_secrets_note(uuid, text, text, text, text, text) to service_role;
  end if;
end
$service_grants$;

comment on table public.ops_secrets_notes is
  'Sandbox ops secrets note. Stores configured, missing, or fixture only. No secret value. Cron names only. Does not register a cron. sending_enabled stays false.';
