-- Phase 5g: sandbox social drafts and TikTok/LinkedIn connect stubs.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- A draft can be saved and scheduled locally. Publish, post now, and go live are refused.
-- Nothing is written to the outbox. No provider is called. No secret is stored.
-- No cron is scheduled. A scheduled_for time is a local note only.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.channel_connect_stubs') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.save_channel_connect_stub(uuid, text)') is null then
    raise exception 'phase 5g needs phase 5f; apply 20261102120000_phase5f_campaign_csv_channels.sql before this file';
  end if;
end
$need$;

create table if not exists public.social_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  topic_key text not null check (topic_key in (
    'week1-intro',
    'week1-problem',
    'week1-how',
    'week1-proof',
    'week1-offer'
  )),
  platform text not null check (platform in ('facebook', 'instagram', 'linkedin', 'tiktok')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  scheduled_for timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled')),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  published boolean not null default false check (published = false),
  queued_count integer not null default 0 check (queued_count = 0),
  sent_count integer not null default 0 check (sent_count = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_drafts_org_topic unique (org_id, topic_key),
  constraint social_drafts_schedule check (
    (status = 'draft' and scheduled_for is null)
    or (status = 'scheduled' and scheduled_for is not null)
  )
);

create index if not exists social_drafts_org_idx
  on public.social_drafts (org_id, updated_at desc);

create table if not exists public.social_connect_stubs (
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_key text not null check (account_key in ('tiktok', 'linkedin')),
  provider_label text not null,
  status text not null default 'sandbox_stub' check (status = 'sandbox_stub'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  secret_stored boolean not null default false check (secret_stored = false),
  provider_keys_present boolean not null default false check (provider_keys_present = false),
  updated_at timestamptz not null default now(),
  primary key (org_id, account_key),
  constraint social_connect_stubs_provider check (
    (account_key = 'tiktok' and provider_label = 'tiktok_placeholder')
    or (account_key = 'linkedin' and provider_label = 'linkedin_placeholder')
  )
);

alter table public.social_drafts enable row level security;
alter table public.social_drafts force row level security;
alter table public.social_connect_stubs enable row level security;
alter table public.social_connect_stubs force row level security;

drop policy if exists social_drafts_read on public.social_drafts;
create policy social_drafts_read on public.social_drafts
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists social_drafts_insert on public.social_drafts;
create policy social_drafts_insert on public.social_drafts
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists social_drafts_update on public.social_drafts;
create policy social_drafts_update on public.social_drafts
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists social_connect_stubs_read on public.social_connect_stubs;
create policy social_connect_stubs_read on public.social_connect_stubs
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists social_connect_stubs_insert on public.social_connect_stubs;
create policy social_connect_stubs_insert on public.social_connect_stubs
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists social_connect_stubs_update on public.social_connect_stubs;
create policy social_connect_stubs_update on public.social_connect_stubs
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

revoke all on table public.social_drafts from public, anon;
revoke all on table public.social_connect_stubs from public, anon;
grant select, insert, update on table public.social_drafts to authenticated;
grant select, insert, update on table public.social_connect_stubs to authenticated;

create or replace function public.save_social_draft(
  p_org uuid,
  p_topic_key text,
  p_platform text,
  p_body text,
  p_scheduled_for timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_status text;
  v_id uuid;
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if p_topic_key not in ('week1-intro', 'week1-problem', 'week1-how', 'week1-proof', 'week1-offer') then
    raise exception 'unknown topic';
  end if;

  if p_platform not in ('facebook', 'instagram', 'linkedin', 'tiktok') then
    raise exception 'unknown platform';
  end if;

  v_body := btrim(coalesce(p_body, ''));
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'draft body required';
  end if;

  v_status := case when p_scheduled_for is null then 'draft' else 'scheduled' end;

  insert into public.social_drafts (
    org_id, topic_key, platform, body, scheduled_for, status,
    sandbox, charged, published, queued_count, sent_count, updated_at
  ) values (
    p_org, p_topic_key, p_platform, v_body, p_scheduled_for, v_status,
    true, false, false, 0, 0, now()
  )
  on conflict (org_id, topic_key) do update
  set platform = excluded.platform,
      body = excluded.body,
      scheduled_for = excluded.scheduled_for,
      status = excluded.status,
      sandbox = true,
      charged = false,
      published = false,
      queued_count = 0,
      sent_count = 0,
      updated_at = now()
  returning id into v_id;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'id', v_id,
    'topic_key', p_topic_key,
    'platform', p_platform,
    'status', v_status,
    'scheduled_for', p_scheduled_for,
    'sandbox', true,
    'charged', false,
    'published', false,
    'queued', 0,
    'posted', 0,
    'sent', 0,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

create or replace function public.refuse_social_publish(p_org uuid, p_intent text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'refused', true,
    'reason', 'billy must approve sends',
    'intent', coalesce(p_intent, ''),
    'queued', 0,
    'posted', 0,
    'sent', 0,
    'published', false,
    'sandbox', true,
    'charged', false,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

create or replace function public.save_social_connect_stub(p_org uuid, p_account_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sending boolean;
  label text;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if p_account_key = 'tiktok' then
    label := 'tiktok_placeholder';
  elsif p_account_key = 'linkedin' then
    label := 'linkedin_placeholder';
  else
    raise exception 'unknown account';
  end if;

  insert into public.social_connect_stubs (
    org_id, account_key, provider_label, status, sandbox, charged, secret_stored, provider_keys_present, updated_at
  ) values (
    p_org, p_account_key, label, 'sandbox_stub', true, false, false, false, now()
  )
  on conflict (org_id, account_key) do update
  set provider_label = excluded.provider_label,
      status = 'sandbox_stub',
      sandbox = true,
      charged = false,
      secret_stored = false,
      provider_keys_present = false,
      updated_at = now();

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'account_key', p_account_key,
    'provider_label', label,
    'status', 'sandbox_stub',
    'sandbox', true,
    'charged', false,
    'secret_stored', false,
    'provider_keys_present', false,
    'queued', 0,
    'posted', 0,
    'sent', 0,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

create or replace function public.refuse_social_connect_send(p_org uuid, p_account_key text, p_intent text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sending boolean;
  keys_present boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if p_account_key not in ('tiktok', 'linkedin') then
    raise exception 'unknown account';
  end if;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;
  select s.provider_keys_present into keys_present
  from public.social_connect_stubs s
  where s.org_id = p_org and s.account_key = p_account_key;

  return jsonb_build_object(
    'refused', true,
    'reason', 'provider keys missing',
    'intent', coalesce(p_intent, ''),
    'dry_run', true,
    'queued', 0,
    'posted', 0,
    'sent', 0,
    'sandbox', true,
    'charged', false,
    'secret_stored', false,
    'provider_keys_present', coalesce(keys_present, false),
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.save_social_draft(uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.refuse_social_publish(uuid, text) from public, anon;
revoke all on function public.save_social_connect_stub(uuid, text) from public, anon;
revoke all on function public.refuse_social_connect_send(uuid, text, text) from public, anon;
grant execute on function public.save_social_draft(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.refuse_social_publish(uuid, text) to authenticated;
grant execute on function public.save_social_connect_stub(uuid, text) to authenticated;
grant execute on function public.refuse_social_connect_send(uuid, text, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on table public.social_drafts to service_role;
    grant select, insert, update on table public.social_connect_stubs to service_role;
    grant execute on function public.save_social_draft(uuid, text, text, text, timestamptz) to service_role;
    grant execute on function public.refuse_social_publish(uuid, text) to service_role;
    grant execute on function public.save_social_connect_stub(uuid, text) to service_role;
    grant execute on function public.refuse_social_connect_send(uuid, text, text) to service_role;
  end if;
end
$service_grants$;

comment on table public.social_drafts is
  'Sandbox week-1 social drafts. Status is draft or scheduled locally. published stays false. Nothing is queued or posted.';
comment on table public.social_connect_stubs is
  'Sandbox stub for TikTok and LinkedIn. No secret and no provider key is stored. Send, test, and publish are refused.';
