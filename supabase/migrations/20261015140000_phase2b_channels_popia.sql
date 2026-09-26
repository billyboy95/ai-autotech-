-- Phase 2b: per-workspace channels, vault-backed secrets, POPIA contacts, usage ledger.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Secrets are not stored in this file. Workers read them through read_channel_secret.
-- crm_contacts is the POPIA contacts table. Legacy Command Centre public.contacts
-- (schema.sql, full_name) is left untouched when it already exists.

create schema if not exists private;

create table if not exists private.channel_secrets (
  id uuid primary key default gen_random_uuid(),
  secret text not null,
  name text not null default '',
  created_at timestamptz not null default now()
);

revoke all on schema private from public, anon, authenticated;
revoke all on table private.channel_secrets from public, anon, authenticated;

alter table private.channel_secrets enable row level security;

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone_e164 text not null default '',
  whatsapp_e164 text not null default '',
  company text not null default '',
  owner_user_id uuid,
  tags text[] not null default '{}',
  custom jsonb not null default '{}'::jsonb,
  lead_id text,
  client_id text,
  erased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_contacts_org_phone_idx
  on public.crm_contacts (org_id, phone_e164)
  where phone_e164 <> '';

create unique index if not exists crm_contacts_org_email_idx
  on public.crm_contacts (org_id, lower(email))
  where email <> '';

create index if not exists crm_contacts_org_idx on public.crm_contacts (org_id);

alter table public.contact_consents add column if not exists contact_id uuid references public.crm_contacts(id) on delete set null;
alter table public.contact_consents add column if not exists updated_at timestamptz not null default now();

create index if not exists contact_consents_contact_idx on public.contact_consents (contact_id);
create index if not exists contact_consents_address_idx on public.contact_consents (org_id, channel, purpose, address);

create table if not exists public.data_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  type text not null check (type in ('access', 'delete', 'correct')),
  status text not null default 'open' check (status in ('open', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'facebook', 'instagram')),
  provider text not null check (provider in ('resend', 'smtp', 'meta_cloud', 'smsportal', 'bulksms', 'clickatell', 'meta')),
  identifier text not null default '',
  display_name text not null default '',
  secret_id uuid,
  webhook_secret_hash text not null default '',
  status text not null default 'disconnected' check (status in ('disconnected', 'pending', 'connected', 'error')),
  last_verified_at timestamptz,
  public_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists channel_connections_org_idx on public.channel_connections (org_id, channel);
create unique index if not exists channel_connections_identity_idx
  on public.channel_connections (org_id, channel, provider, identifier);

create table if not exists public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  meter text not null check (meter in ('sms', 'wa_marketing', 'wa_utility', 'wa_service', 'email', 'ai_tokens')),
  unit_cost_cents bigint not null,
  markup_multiplier numeric not null default 1,
  currency text not null default 'ZAR',
  created_at timestamptz not null default now()
);

create unique index if not exists rate_cards_default_meter_idx on public.rate_cards (meter) where org_id is null;
create unique index if not exists rate_cards_org_meter_idx on public.rate_cards (org_id, meter) where org_id is not null;

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meter text not null,
  quantity integer not null default 1,
  unit_cost_cents bigint not null,
  unit_price_cents bigint not null default 0,
  cost_cents bigint not null,
  source_type text not null default 'outbox',
  source_id text not null default '',
  channel_connection_id uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists usage_ledger_org_idx on public.usage_ledger (org_id, occurred_at);
create unique index if not exists usage_ledger_source_idx
  on public.usage_ledger (org_id, source_type, source_id)
  where source_id <> '';

create table if not exists public.inbound_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  channel_connection_id uuid references public.channel_connections(id) on delete set null,
  provider text not null default '',
  provider_message_id text not null default '',
  channel text not null default '',
  from_address text not null default '',
  body text not null default '',
  raw jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create unique index if not exists inbound_events_provider_idx
  on public.inbound_events (channel_connection_id, provider_message_id)
  where provider_message_id <> '';

-- South Africa card, ZAR cents. Marketing ~R0.66, utility/service ~R0.13, SMSPortal ~R0.18, email R0.01.
insert into public.rate_cards (org_id, meter, unit_cost_cents, markup_multiplier)
select null, meter, cents, 1
from (values
  ('sms', 18::bigint),
  ('wa_marketing', 66::bigint),
  ('wa_utility', 13::bigint),
  ('wa_service', 13::bigint),
  ('email', 1::bigint)
) as seed(meter, cents)
where not exists (
  select 1 from public.rate_cards existing
  where existing.org_id is null and existing.meter = seed.meter
);

do $outbox$
declare
  constraint_name text;
begin
  if to_regclass('public.crm_outbox') is null then
    return;
  end if;
  alter table public.crm_outbox add column if not exists channel_connection_id uuid;
  alter table public.crm_outbox add column if not exists contact_id uuid;
  alter table public.crm_outbox add column if not exists conversation_id uuid;
  alter table public.crm_outbox add column if not exists purpose text not null default 'marketing';
  alter table public.crm_outbox add column if not exists cost_cents bigint;
  alter table public.crm_outbox add column if not exists workflow_run_id uuid;
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'crm_outbox'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.crm_outbox drop constraint %I', constraint_name);
  end loop;
  alter table public.crm_outbox
    add constraint crm_outbox_status_check
    check (status in ('queued', 'approved', 'sent', 'failed', 'cancelled', 'blocked', 'blocked_consent', 'held'));
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'crm_outbox'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%channel%'
  loop
    execute format('alter table public.crm_outbox drop constraint %I', constraint_name);
  end loop;
  alter table public.crm_outbox
    add constraint crm_outbox_channel_check
    check (channel in ('whatsapp', 'email', 'sms', 'facebook', 'instagram'));
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_outbox'::regclass and conname = 'crm_outbox_purpose_check'
  ) then
    alter table public.crm_outbox
      add constraint crm_outbox_purpose_check
      check (purpose in ('marketing', 'service', 'transactional', 'consent_request'));
  end if;
end
$outbox$;

do $prospects$
declare
  constraint_name text;
begin
  if to_regclass('public.crm_prospects') is null then
    return;
  end if;
  alter table public.crm_prospects add column if not exists area text not null default '';
  alter table public.crm_prospects add column if not exists source_url text not null default '';
  alter table public.crm_prospects add column if not exists outreach_status text not null default '';
  alter table public.crm_prospects add column if not exists consent_basis text not null default '';
  alter table public.crm_prospects add column if not exists consent_requested boolean not null default false;
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'crm_prospects'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.crm_prospects drop constraint %I', constraint_name);
  end loop;
  alter table public.crm_prospects
    add constraint crm_prospects_status_check
    check (status in ('queued', 'in_sequence', 'replied', 'booked', 'stopped', 'not_contacted'));
end
$prospects$;

select public.attach_org_tenancy('public.crm_contacts'::regclass);
select public.attach_org_tenancy('public.data_requests'::regclass);
select public.attach_org_tenancy('public.usage_ledger'::regclass);
select public.attach_org_tenancy('public.inbound_events'::regclass);

alter table public.channel_connections enable row level security;
alter table public.channel_connections force row level security;
drop policy if exists channel_connections_read on public.channel_connections;
drop policy if exists channel_connections_insert on public.channel_connections;
drop policy if exists channel_connections_update on public.channel_connections;
drop policy if exists channel_connections_delete on public.channel_connections;
create policy channel_connections_read on public.channel_connections
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));
create policy channel_connections_insert on public.channel_connections
  for insert to authenticated
  with check (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );
create policy channel_connections_update on public.channel_connections
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));
create policy channel_connections_delete on public.channel_connections
  for delete to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));
grant select, insert, update, delete on public.channel_connections to authenticated;

alter table public.rate_cards enable row level security;
alter table public.rate_cards force row level security;
drop policy if exists rate_cards_read on public.rate_cards;
drop policy if exists rate_cards_write on public.rate_cards;
create policy rate_cards_read on public.rate_cards
  for select to authenticated
  using (org_id is null or org_id in (select public.accessible_org_ids()));
create policy rate_cards_write on public.rate_cards
  for all to authenticated
  using (org_id is not null and public.has_org_role(org_id, array['agency_owner']))
  with check (org_id is not null and public.has_org_role(org_id, array['agency_owner']));
grant select, insert, update, delete on public.rate_cards to authenticated;

-- Writes a secret into Vault when the extension exists, otherwise into private.channel_secrets.
-- Returns the secret id only. Authenticated callers must manage the workspace.
create or replace function public.store_channel_secret(p_connection_id uuid, p_secret text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  conn public.channel_connections%rowtype;
  sid uuid;
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  use_vault boolean := to_regprocedure('vault.create_secret(text,text,text)') is not null
    or to_regprocedure('vault.create_secret(text,text,text,uuid)') is not null;
begin
  if jwt_role = '' then
    begin
      jwt_role := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if auth.uid() is null and jwt_role <> 'service_role' then
    raise exception 'not allowed';
  end if;
  if p_secret is null or length(btrim(p_secret)) = 0 then
    raise exception 'secret required';
  end if;
  select * into conn from public.channel_connections where id = p_connection_id;
  if conn.id is null then
    raise exception 'connection not found';
  end if;
  if auth.uid() is not null and not public.has_org_role(conn.org_id, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if conn.secret_id is not null then
    if use_vault and to_regprocedure('vault.update_secret(uuid,text)') is not null then
      perform vault.update_secret(conn.secret_id, p_secret);
    else
      update private.channel_secrets set secret = p_secret where id = conn.secret_id;
      if not found then
        insert into private.channel_secrets (id, secret, name)
        values (conn.secret_id, p_secret, 'channel:' || p_connection_id::text);
      end if;
    end if;
    return conn.secret_id;
  end if;

  if use_vault then
    sid := vault.create_secret(p_secret, 'channel:' || p_connection_id::text, 'channel connection');
  else
    insert into private.channel_secrets (secret, name)
    values (p_secret, 'channel:' || p_connection_id::text)
    returning id into sid;
  end if;
  update public.channel_connections
  set secret_id = sid, updated_at = now()
  where id = p_connection_id;
  return sid;
end;
$$;

-- Workers only. Authenticated and anon cannot execute this.
create or replace function public.read_channel_secret(p_connection_id uuid)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  sid uuid;
  secret text;
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
begin
  if jwt_role = '' then
    begin
      jwt_role := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if jwt_role <> 'service_role' then
    raise exception 'workers only';
  end if;
  select secret_id into sid from public.channel_connections where id = p_connection_id;
  if sid is null then
    return null;
  end if;
  if to_regclass('vault.decrypted_secrets') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where id = $1'
      into secret
      using sid;
    if secret is not null then
      return secret;
    end if;
  end if;
  select s.secret into secret from private.channel_secrets s where s.id = sid;
  return secret;
end;
$$;

revoke all on function public.store_channel_secret(uuid, text) from public, anon;
revoke all on function public.read_channel_secret(uuid) from public, anon, authenticated;
grant execute on function public.store_channel_secret(uuid, text) to authenticated;

do $service_role$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.store_channel_secret(uuid, text) to service_role;
    grant execute on function public.read_channel_secret(uuid) to service_role;
    grant select, insert, update, delete on
      public.channel_connections,
      public.crm_contacts,
      public.data_requests,
      public.usage_ledger,
      public.inbound_events,
      public.rate_cards,
      public.contact_consents,
      public.suppressions
    to service_role;
  end if;
end
$service_role$;

comment on function public.read_channel_secret(uuid) is
  'Returns a channel secret to the service role only. Authenticated clients cannot execute it.';
comment on column public.channel_connections.secret_id is
  'Pointer to Vault (or private.channel_secrets). The secret value is not in this table.';
