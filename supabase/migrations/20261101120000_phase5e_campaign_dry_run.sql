-- Phase 5e: campaign dry-run reports and Meta/WhatsApp connect stubs.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- A dry run stores a sandbox report. The outbox is not written.
-- A connect stub stores no secret and no provider key. Nothing is queued or sent.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.home_chat_drafts') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5e needs phase 5d; apply 20261031120000_phase5d_home_chat.sql before this file';
  end if;
end
$need$;

create table if not exists public.campaign_dry_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_name text not null check (char_length(btrim(campaign_name)) between 1 and 160),
  status text not null default 'sandbox' check (status = 'sandbox'),
  recipient_count integer not null check (recipient_count >= 0 and recipient_count <= 200),
  would_receive integer not null check (would_receive >= 0),
  blocked_count integer not null check (blocked_count >= 0),
  consent_breakdown jsonb not null,
  estimated_cost_cents integer not null check (estimated_cost_cents >= 0),
  report jsonb not null,
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  queued_count integer not null default 0 check (queued_count = 0),
  sent_count integer not null default 0 check (sent_count = 0),
  created_at timestamptz not null default now(),
  constraint campaign_dry_runs_counts check (would_receive + blocked_count = recipient_count)
);

create index if not exists campaign_dry_runs_org_idx
  on public.campaign_dry_runs (org_id, created_at desc);

create table if not exists public.meta_connect_stubs (
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_key text not null check (account_key in ('whatsapp', 'meta')),
  status text not null default 'sandbox_stub' check (status = 'sandbox_stub'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  secret_stored boolean not null default false check (secret_stored = false),
  provider_keys_present boolean not null default false check (provider_keys_present = false),
  updated_at timestamptz not null default now(),
  primary key (org_id, account_key)
);

alter table public.campaign_dry_runs enable row level security;
alter table public.campaign_dry_runs force row level security;
alter table public.meta_connect_stubs enable row level security;
alter table public.meta_connect_stubs force row level security;

drop policy if exists campaign_dry_runs_read on public.campaign_dry_runs;
create policy campaign_dry_runs_read on public.campaign_dry_runs
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists campaign_dry_runs_insert on public.campaign_dry_runs;
create policy campaign_dry_runs_insert on public.campaign_dry_runs
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists meta_connect_stubs_read on public.meta_connect_stubs;
create policy meta_connect_stubs_read on public.meta_connect_stubs
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists meta_connect_stubs_insert on public.meta_connect_stubs;
create policy meta_connect_stubs_insert on public.meta_connect_stubs
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists meta_connect_stubs_update on public.meta_connect_stubs;
create policy meta_connect_stubs_update on public.meta_connect_stubs
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

revoke all on table public.campaign_dry_runs from public, anon;
revoke all on table public.meta_connect_stubs from public, anon;
grant select, insert on table public.campaign_dry_runs to authenticated;
grant select, insert, update on table public.meta_connect_stubs to authenticated;

create or replace function public.save_campaign_dry_run(
  p_org uuid,
  p_campaign_name text,
  p_recipients jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  elem jsonb;
  v_name text;
  v_campaign text;
  v_channel text;
  v_basis text;
  v_outcome text;
  v_reason text;
  v_stopped boolean;
  v_suppressed boolean;
  report_json jsonb := '[]'::jsonb;
  consent_count integer := 0;
  existing_count integer := 0;
  missing_count integer := 0;
  opted_count integer := 0;
  stop_count integer := 0;
  would_receive integer := 0;
  blocked_count integer := 0;
  cost_cents integer := 0;
  run_id uuid;
  sending boolean;
  breakdown jsonb;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  v_campaign := btrim(coalesce(p_campaign_name, ''));
  if char_length(v_campaign) < 1 or char_length(v_campaign) > 160 then
    raise exception 'campaign name required';
  end if;

  if jsonb_typeof(p_recipients) is distinct from 'array' then
    raise exception 'recipients required';
  end if;

  if jsonb_array_length(p_recipients) > 200 then
    raise exception 'dry run up to 200 recipients';
  end if;

  for elem in select jsonb_array_elements(p_recipients)
  loop
    if jsonb_typeof(elem) is distinct from 'object' then
      raise exception 'dry run only';
    end if;

    if lower(coalesce(elem->>'send', 'false')) in ('true', 't', '1', 'yes')
       or lower(coalesce(elem->>'status', '')) in ('queued', 'approved', 'sent') then
      raise exception 'dry run only';
    end if;

    v_name := btrim(coalesce(elem->>'name', ''));
    if char_length(v_name) < 1 or char_length(v_name) > 120 then
      raise exception 'recipient name required';
    end if;

    v_channel := lower(btrim(coalesce(elem->>'channel', '')));
    v_basis := replace(replace(lower(btrim(coalesce(elem->>'consent_basis', ''))), '-', '_'), ' ', '_');
    v_stopped := lower(coalesce(elem->>'stopped', 'false')) in ('true', 't', '1', 'yes')
      or v_basis in ('stop', 'stopped');
    v_suppressed := lower(coalesce(elem->>'suppressed', 'false')) in ('true', 't', '1', 'yes');

    if v_stopped then
      stop_count := stop_count + 1;
      v_outcome := 'blocked';
      v_reason := 'STOP';
    elsif v_suppressed or v_basis in ('opted_out', 'opt_out', 'optout') then
      opted_count := opted_count + 1;
      v_outcome := 'blocked';
      v_reason := 'consent';
    elsif v_basis = 'consent' then
      consent_count := consent_count + 1;
      if v_channel in ('whatsapp', 'email', 'sms') then
        v_outcome := 'would_receive';
        v_reason := '';
        cost_cents := cost_cents + case v_channel when 'whatsapp' then 62 when 'sms' then 35 when 'email' then 5 else 0 end;
        would_receive := would_receive + 1;
      else
        v_outcome := 'blocked';
        v_reason := 'POPIA';
      end if;
    elsif v_basis = 'existing_customer' then
      existing_count := existing_count + 1;
      if v_channel in ('whatsapp', 'email', 'sms') then
        v_outcome := 'would_receive';
        v_reason := '';
        cost_cents := cost_cents + case v_channel when 'whatsapp' then 62 when 'sms' then 35 when 'email' then 5 else 0 end;
        would_receive := would_receive + 1;
      else
        v_outcome := 'blocked';
        v_reason := 'POPIA';
      end if;
    else
      missing_count := missing_count + 1;
      v_outcome := 'blocked';
      v_reason := 'POPIA';
    end if;

    if v_outcome = 'blocked' then
      blocked_count := blocked_count + 1;
    end if;

    report_json := report_json || jsonb_build_array(jsonb_build_object(
      'name', v_name,
      'channel', case when v_channel = '' then 'none' else v_channel end,
      'outcome', v_outcome,
      'reason', v_reason
    ));
  end loop;

  breakdown := jsonb_build_object(
    'consent', consent_count,
    'existing_customer', existing_count,
    'missing', missing_count,
    'opted_out', opted_count,
    'stop', stop_count
  );

  insert into public.campaign_dry_runs (
    org_id, campaign_name, status, recipient_count, would_receive, blocked_count,
    consent_breakdown, estimated_cost_cents, report, sandbox, charged, queued_count, sent_count
  ) values (
    p_org, v_campaign, 'sandbox', jsonb_array_length(p_recipients), would_receive, blocked_count,
    breakdown, cost_cents, report_json, true, false, 0, 0
  )
  returning id into run_id;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'id', run_id,
    'status', 'sandbox',
    'campaign_name', v_campaign,
    'recipient_count', jsonb_array_length(p_recipients),
    'would_receive', would_receive,
    'blocked', blocked_count,
    'consent_breakdown', breakdown,
    'estimated_cost_cents', cost_cents,
    'report', report_json,
    'sandbox', true,
    'charged', false,
    'queued', 0,
    'sent', 0,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

create or replace function public.refuse_campaign_send(p_org uuid, p_intent text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sending boolean;
  intent text;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  intent := replace(lower(btrim(coalesce(p_intent, ''))), '-', '_');
  if intent not in ('send', 'send_now', 'go_live', 'golive') then
    raise exception 'dry run only';
  end if;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'refused', true,
    'reason', case when coalesce(sending, false) then 'dry run does not send' else 'sending_enabled is false' end,
    'queued', 0,
    'sent', 0,
    'sandbox', true,
    'charged', false,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

create or replace function public.save_meta_connect_stub(p_org uuid, p_account_key text)
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

  if p_account_key not in ('whatsapp', 'meta') then
    raise exception 'unknown account';
  end if;

  insert into public.meta_connect_stubs (
    org_id, account_key, status, sandbox, charged, secret_stored, provider_keys_present, updated_at
  ) values (
    p_org, p_account_key, 'sandbox_stub', true, false, false, false, now()
  )
  on conflict (org_id, account_key) do update
  set status = 'sandbox_stub',
      sandbox = true,
      charged = false,
      secret_stored = false,
      provider_keys_present = false,
      updated_at = now();

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'account_key', p_account_key,
    'status', 'sandbox_stub',
    'sandbox', true,
    'charged', false,
    'secret_stored', false,
    'provider_keys_present', false,
    'queued', 0,
    'sent', 0,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

create or replace function public.refuse_meta_test_send(p_org uuid, p_account_key text)
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

  if p_account_key not in ('whatsapp', 'meta') then
    raise exception 'unknown account';
  end if;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;
  select s.provider_keys_present into keys_present
  from public.meta_connect_stubs s
  where s.org_id = p_org and s.account_key = p_account_key;

  return jsonb_build_object(
    'refused', true,
    'reason', 'provider keys missing',
    'dry_run', true,
    'queued', 0,
    'sent', 0,
    'sandbox', true,
    'charged', false,
    'secret_stored', false,
    'provider_keys_present', coalesce(keys_present, false),
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.save_campaign_dry_run(uuid, text, jsonb) from public, anon;
revoke all on function public.refuse_campaign_send(uuid, text) from public, anon;
revoke all on function public.save_meta_connect_stub(uuid, text) from public, anon;
revoke all on function public.refuse_meta_test_send(uuid, text) from public, anon;
grant execute on function public.save_campaign_dry_run(uuid, text, jsonb) to authenticated;
grant execute on function public.refuse_campaign_send(uuid, text) to authenticated;
grant execute on function public.save_meta_connect_stub(uuid, text) to authenticated;
grant execute on function public.refuse_meta_test_send(uuid, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on table public.campaign_dry_runs to service_role;
    grant select, insert, update on table public.meta_connect_stubs to service_role;
    grant execute on function public.save_campaign_dry_run(uuid, text, jsonb) to service_role;
    grant execute on function public.refuse_campaign_send(uuid, text) to service_role;
    grant execute on function public.save_meta_connect_stub(uuid, text) to service_role;
    grant execute on function public.refuse_meta_test_send(uuid, text) to service_role;
  end if;
end
$service_grants$;

comment on table public.campaign_dry_runs is
  'Sandbox campaign dry-run reports. Queued and sent stay 0. Nothing is charged.';
comment on table public.meta_connect_stubs is
  'Sandbox stub for WhatsApp and Facebook/Instagram. No secret and no provider key is stored.';
