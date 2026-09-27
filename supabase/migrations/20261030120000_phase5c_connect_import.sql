-- Phase 5c: connect checklist progress and contact import drafts.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- A connect click stores needs_keys and a channel placeholder with no secret.
-- Vault is not written. No provider is called. No message is queued.
-- Import rows are drafts only. crm_contacts and crm_outbox are not written.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.channel_connections') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5c needs phase 2b channels; apply 20261015140000_phase2b_channels_popia.sql before this file';
  end if;
end
$need$;

create table if not exists public.connect_checklist (
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_key text not null check (account_key in ('gmail', 'whatsapp', 'sms', 'meta', 'google_calendar', 'tiktok')),
  status text not null default 'needs_keys' check (status = 'needs_keys'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  updated_at timestamptz not null default now(),
  primary key (org_id, account_key)
);

create table if not exists public.contact_import_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'sandbox' check (status = 'sandbox'),
  row_count integer not null check (row_count >= 1 and row_count <= 200),
  rows jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  created_at timestamptz not null default now()
);

create index if not exists contact_import_drafts_org_idx
  on public.contact_import_drafts (org_id, created_at desc);

alter table public.connect_checklist enable row level security;
alter table public.connect_checklist force row level security;
alter table public.contact_import_drafts enable row level security;
alter table public.contact_import_drafts force row level security;

drop policy if exists connect_checklist_read on public.connect_checklist;
create policy connect_checklist_read on public.connect_checklist
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists connect_checklist_insert on public.connect_checklist;
create policy connect_checklist_insert on public.connect_checklist
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists connect_checklist_update on public.connect_checklist;
create policy connect_checklist_update on public.connect_checklist
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists contact_import_drafts_read on public.contact_import_drafts;
create policy contact_import_drafts_read on public.contact_import_drafts
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists contact_import_drafts_insert on public.contact_import_drafts;
create policy contact_import_drafts_insert on public.contact_import_drafts
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

revoke all on table public.connect_checklist from public, anon;
revoke all on table public.contact_import_drafts from public, anon;
grant select, insert, update on table public.connect_checklist to authenticated;
grant select, insert on table public.contact_import_drafts to authenticated;

create or replace function public.mark_connect_account(p_org uuid, p_account_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if p_account_key not in ('gmail', 'whatsapp', 'sms', 'meta', 'google_calendar', 'tiktok') then
    raise exception 'unknown account';
  end if;

  insert into public.connect_checklist (org_id, account_key, status, sandbox, charged, updated_at)
  values (p_org, p_account_key, 'needs_keys', true, false, now())
  on conflict (org_id, account_key) do update
  set status = 'needs_keys',
      sandbox = true,
      charged = false,
      updated_at = now();

  for target in
    select map.channel, map.provider, map.label
    from (
      values
        ('gmail', 'email', 'resend', 'Email / Gmail'),
        ('whatsapp', 'whatsapp', 'meta_cloud', 'WhatsApp (Meta Cloud)'),
        ('sms', 'sms', 'smsportal', 'SMS'),
        ('meta', 'facebook', 'meta', 'Facebook / Instagram'),
        ('meta', 'instagram', 'meta', 'Facebook / Instagram')
    ) as map(account_key, channel, provider, label)
    where map.account_key = p_account_key
  loop
    insert into public.channel_connections (
      org_id, channel, provider, identifier, display_name, status, public_config, updated_at
    ) values (
      p_org, target.channel, target.provider, 'placeholder', target.label, 'pending', '{}'::jsonb, now()
    )
    on conflict (org_id, channel, provider, identifier) do nothing;
  end loop;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'account_key', p_account_key,
    'status', 'needs_keys',
    'sandbox', true,
    'charged', false,
    'secret_stored', false,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

create or replace function public.save_contact_import_draft(p_org uuid, p_rows jsonb, p_summary jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_id uuid;
  sending boolean;
  stored_summary jsonb;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows required';
  end if;

  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 200 then
    raise exception 'import up to 200 contacts';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as elem
    where jsonb_typeof(elem) is distinct from 'object'
       or btrim(coalesce(elem->>'name', '')) = ''
       or lower(coalesce(elem->>'consent_basis', '')) not in ('consent', 'existing_customer')
       or (
         btrim(coalesce(elem->>'phone', '')) = ''
         and btrim(coalesce(elem->>'email', '')) = ''
       )
       or lower(coalesce(elem->>'send', 'false')) = 'true'
       or lower(coalesce(elem->>'status', '')) in ('queued', 'approved', 'sent')
  ) then
    raise exception 'draft rows only';
  end if;

  if lower(coalesce(p_summary->>'charged', 'false')) = 'true'
     or lower(coalesce(p_summary->>'sent', 'false')) = 'true'
     or lower(coalesce(p_summary->>'sandbox', 'true')) = 'false' then
    raise exception 'sandbox draft only';
  end if;

  stored_summary := coalesce(p_summary, '{}'::jsonb) || jsonb_build_object(
    'sandbox', true,
    'charged', false,
    'sent', false
  );

  insert into public.contact_import_drafts (org_id, status, row_count, rows, summary, sandbox, charged)
  values (p_org, 'sandbox', jsonb_array_length(p_rows), p_rows, stored_summary, true, false)
  returning id into draft_id;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'id', draft_id,
    'stored', jsonb_array_length(p_rows),
    'sandbox', true,
    'charged', false,
    'sent', false,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.mark_connect_account(uuid, text) from public, anon;
revoke all on function public.save_contact_import_draft(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.mark_connect_account(uuid, text) to authenticated;
grant execute on function public.save_contact_import_draft(uuid, jsonb, jsonb) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on table public.connect_checklist to service_role;
    grant select, insert on table public.contact_import_drafts to service_role;
    grant execute on function public.mark_connect_account(uuid, text) to service_role;
    grant execute on function public.save_contact_import_draft(uuid, jsonb, jsonb) to service_role;
  end if;
end
$service_grants$;

comment on table public.connect_checklist is
  'Sandbox progress for account connect. needs_keys means no Vault secret is stored.';
comment on table public.contact_import_drafts is
  'Sandbox contact import drafts. Rows are not sent and are not copied to crm_outbox.';
