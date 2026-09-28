-- Phase 5f: sandbox campaign CSV dry-load and Email/SMS connect stubs.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- A dry-load writes a draft campaign only. The outbox is not written.
-- A connect stub stores no secret and no provider key. Nothing is queued or sent.
-- No cron is scheduled.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.campaign_dry_runs') is null
     or to_regclass('public.meta_connect_stubs') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.refuse_campaign_send(uuid, text)') is null then
    raise exception 'phase 5f needs phase 5e; apply 20261101120000_phase5e_campaign_dry_run.sql before this file';
  end if;
end
$need$;

create table if not exists public.campaign_csv_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_name text not null check (char_length(btrim(campaign_name)) between 1 and 160),
  status text not null default 'sandbox' check (status = 'sandbox'),
  campaign_status text not null default 'draft' check (campaign_status = 'draft'),
  imported_count integer not null check (imported_count >= 0 and imported_count <= 200),
  skipped_count integer not null check (skipped_count >= 0 and skipped_count <= 200),
  recipient_count integer not null check (recipient_count >= 0 and recipient_count <= 200),
  would_receive integer not null check (would_receive >= 0),
  blocked_count integer not null check (blocked_count >= 0),
  consent_breakdown jsonb not null,
  estimated_cost_cents integer not null check (estimated_cost_cents >= 0),
  report jsonb not null,
  rows jsonb not null,
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  queued_count integer not null default 0 check (queued_count = 0),
  sent_count integer not null default 0 check (sent_count = 0),
  created_at timestamptz not null default now(),
  constraint campaign_csv_imports_counts check (would_receive + blocked_count = recipient_count),
  constraint campaign_csv_imports_split check (imported_count + skipped_count = recipient_count)
);

create index if not exists campaign_csv_imports_org_idx
  on public.campaign_csv_imports (org_id, created_at desc);

create table if not exists public.campaign_csv_prospects (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.campaign_csv_imports(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_name text not null check (char_length(btrim(campaign_name)) between 1 and 160),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  business text not null default '',
  niche text not null default '',
  website text not null default '',
  phone text not null default '',
  email text not null default '',
  opening_line text not null default '',
  consent_basis text not null default '',
  channel text not null default '' check (channel in ('', 'whatsapp', 'email', 'sms')),
  stopped boolean not null default false,
  suppressed boolean not null default false,
  status text not null default 'draft' check (status = 'draft'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  queued boolean not null default false check (queued = false),
  sent boolean not null default false check (sent = false),
  created_at timestamptz not null default now()
);

create index if not exists campaign_csv_prospects_import_idx
  on public.campaign_csv_prospects (org_id, import_id);

create table if not exists public.channel_connect_stubs (
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_key text not null check (account_key in ('gmail', 'sms')),
  provider_label text not null,
  status text not null default 'sandbox_stub' check (status = 'sandbox_stub'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  secret_stored boolean not null default false check (secret_stored = false),
  provider_keys_present boolean not null default false check (provider_keys_present = false),
  updated_at timestamptz not null default now(),
  primary key (org_id, account_key),
  constraint channel_connect_stubs_provider check (
    (account_key = 'gmail' and provider_label = 'resend_smtp')
    or (account_key = 'sms' and provider_label = 'sms_placeholder')
  )
);

alter table public.campaign_csv_imports enable row level security;
alter table public.campaign_csv_imports force row level security;
alter table public.campaign_csv_prospects enable row level security;
alter table public.campaign_csv_prospects force row level security;
alter table public.channel_connect_stubs enable row level security;
alter table public.channel_connect_stubs force row level security;

drop policy if exists campaign_csv_imports_read on public.campaign_csv_imports;
create policy campaign_csv_imports_read on public.campaign_csv_imports
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists campaign_csv_prospects_read on public.campaign_csv_prospects;
create policy campaign_csv_prospects_read on public.campaign_csv_prospects
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists channel_connect_stubs_read on public.channel_connect_stubs;
create policy channel_connect_stubs_read on public.channel_connect_stubs
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists channel_connect_stubs_insert on public.channel_connect_stubs;
create policy channel_connect_stubs_insert on public.channel_connect_stubs
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists channel_connect_stubs_update on public.channel_connect_stubs;
create policy channel_connect_stubs_update on public.channel_connect_stubs
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

revoke all on table public.campaign_csv_imports from public, anon;
revoke all on table public.campaign_csv_prospects from public, anon;
revoke all on table public.channel_connect_stubs from public, anon;
grant select on table public.campaign_csv_imports to authenticated;
grant select on table public.campaign_csv_prospects to authenticated;
grant select, insert, update on table public.channel_connect_stubs to authenticated;

create or replace function public.save_campaign_csv_import(
  p_org uuid,
  p_campaign_name text,
  p_rows jsonb
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
  v_missing boolean;
  report_json jsonb := '[]'::jsonb;
  draft_rows jsonb := '[]'::jsonb;
  consent_count integer := 0;
  existing_count integer := 0;
  missing_count integer := 0;
  opted_count integer := 0;
  stop_count integer := 0;
  would_receive integer := 0;
  blocked_count integer := 0;
  imported_count integer := 0;
  skipped_count integer := 0;
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

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows required';
  end if;

  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 200 then
    raise exception 'dry load up to 200 prospects';
  end if;

  for elem in select jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(elem) is distinct from 'object' then
      raise exception 'dry load only';
    end if;

    if lower(coalesce(elem->>'send', 'false')) in ('true', 't', '1', 'yes')
       or lower(coalesce(elem->>'status', '')) in ('queued', 'approved', 'sent') then
      raise exception 'dry load only';
    end if;

    v_name := btrim(coalesce(elem->>'name', ''));
    if char_length(v_name) < 1 or char_length(v_name) > 120 then
      raise exception 'recipient name required';
    end if;

    if char_length(btrim(coalesce(elem->>'business', ''))) > 200
       or char_length(btrim(coalesce(elem->>'niche', ''))) > 120
       or char_length(btrim(coalesce(elem->>'website', ''))) > 300
       or char_length(btrim(coalesce(elem->>'phone', ''))) > 40
       or char_length(btrim(coalesce(elem->>'email', ''))) > 200
       or char_length(btrim(coalesce(elem->>'opening_line', ''))) > 500 then
      raise exception 'field too long';
    end if;

    v_channel := lower(btrim(coalesce(elem->>'channel', '')));
    if v_channel not in ('whatsapp', 'email', 'sms') then
      if btrim(coalesce(elem->>'phone', '')) <> '' then
        v_channel := 'whatsapp';
      elsif btrim(coalesce(elem->>'email', '')) <> '' then
        v_channel := 'email';
      else
        v_channel := '';
      end if;
    end if;

    v_basis := replace(replace(lower(btrim(coalesce(elem->>'consent_basis', ''))), '-', '_'), ' ', '_');
    if v_basis in ('opted_in', 'yes') then
      v_basis := 'consent';
    elsif v_basis in ('existing', 'customer') then
      v_basis := 'existing_customer';
    end if;

    v_stopped := lower(coalesce(elem->>'stopped', 'false')) in ('true', 't', '1', 'yes')
      or lower(btrim(coalesce(elem->>'status', ''))) = 'stopped'
      or v_basis in ('stop', 'stopped');
    v_suppressed := lower(coalesce(elem->>'suppressed', 'false')) in ('true', 't', '1', 'yes');
    v_missing := not v_stopped
      and not v_suppressed
      and v_basis not in ('consent', 'existing_customer', 'opted_out', 'opt_out', 'optout', 'stop', 'stopped');

    if v_stopped then
      stop_count := stop_count + 1;
      imported_count := imported_count + 1;
      v_outcome := 'blocked';
      v_reason := 'STOP';
    elsif v_suppressed or v_basis in ('opted_out', 'opt_out', 'optout') then
      opted_count := opted_count + 1;
      imported_count := imported_count + 1;
      v_outcome := 'blocked';
      v_reason := 'consent';
    elsif v_basis = 'consent' then
      consent_count := consent_count + 1;
      imported_count := imported_count + 1;
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
      imported_count := imported_count + 1;
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
      skipped_count := skipped_count + 1;
      v_outcome := 'blocked';
      v_reason := 'POPIA';
    end if;

    if v_outcome = 'blocked' then
      blocked_count := blocked_count + 1;
    end if;

    if not v_missing then
      draft_rows := draft_rows || jsonb_build_array(jsonb_build_object(
        'name', v_name,
        'business', btrim(coalesce(elem->>'business', '')),
        'niche', btrim(coalesce(elem->>'niche', '')),
        'website', btrim(coalesce(elem->>'website', '')),
        'phone', btrim(coalesce(elem->>'phone', '')),
        'email', lower(btrim(coalesce(elem->>'email', ''))),
        'opening_line', btrim(coalesce(elem->>'opening_line', '')),
        'consent_basis', v_basis,
        'channel', v_channel,
        'stopped', v_stopped,
        'suppressed', v_suppressed
      ));
    end if;

    report_json := report_json || jsonb_build_array(jsonb_build_object(
      'name', v_name,
      'channel', case when v_channel = '' then 'none' else v_channel end,
      'outcome', v_outcome,
      'reason', v_reason
    ));
  end loop;

  if skipped_count <> missing_count then
    raise exception 'dry load only';
  end if;

  breakdown := jsonb_build_object(
    'consent', consent_count,
    'existing_customer', existing_count,
    'missing', missing_count,
    'opted_out', opted_count,
    'stop', stop_count
  );

  insert into public.campaign_csv_imports (
    org_id, campaign_name, status, campaign_status, imported_count, skipped_count,
    recipient_count, would_receive, blocked_count, consent_breakdown, estimated_cost_cents,
    report, rows, sandbox, charged, queued_count, sent_count
  ) values (
    p_org, v_campaign, 'sandbox', 'draft', imported_count, skipped_count,
    jsonb_array_length(p_rows), would_receive, blocked_count, breakdown, cost_cents,
    report_json, p_rows, true, false, 0, 0
  )
  returning id into run_id;

  insert into public.campaign_csv_prospects (
    import_id, org_id, campaign_name, name, business, niche, website, phone, email,
    opening_line, consent_basis, channel, stopped, suppressed, status, sandbox, charged, queued, sent
  )
  select
    run_id,
    p_org,
    v_campaign,
    btrim(item->>'name'),
    btrim(coalesce(item->>'business', '')),
    btrim(coalesce(item->>'niche', '')),
    btrim(coalesce(item->>'website', '')),
    btrim(coalesce(item->>'phone', '')),
    lower(btrim(coalesce(item->>'email', ''))),
    btrim(coalesce(item->>'opening_line', '')),
    btrim(coalesce(item->>'consent_basis', '')),
    coalesce(item->>'channel', ''),
    coalesce((item->>'stopped')::boolean, false),
    coalesce((item->>'suppressed')::boolean, false),
    'draft',
    true,
    false,
    false,
    false
  from jsonb_array_elements(draft_rows) as item;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'id', run_id,
    'status', 'sandbox',
    'campaign_status', 'draft',
    'campaign_name', v_campaign,
    'imported', imported_count,
    'skipped', skipped_count,
    'recipient_count', jsonb_array_length(p_rows),
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

create or replace function public.refuse_campaign_csv_send(p_org uuid, p_intent text)
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

  intent := replace(replace(lower(btrim(coalesce(p_intent, ''))), '-', '_'), ' ', '_');
  if intent not in ('send', 'send_now', 'go_live', 'golive') then
    raise exception 'dry load only';
  end if;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'refused', true,
    'reason', case when coalesce(sending, false) then 'dry load does not send' else 'sending_enabled is false' end,
    'queued', 0,
    'sent', 0,
    'sandbox', true,
    'charged', false,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

create or replace function public.save_channel_connect_stub(p_org uuid, p_account_key text)
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

  if p_account_key = 'gmail' then
    label := 'resend_smtp';
  elsif p_account_key = 'sms' then
    label := 'sms_placeholder';
  else
    raise exception 'unknown account';
  end if;

  insert into public.channel_connect_stubs (
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
    'sent', 0,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

create or replace function public.refuse_channel_test_send(p_org uuid, p_account_key text)
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

  if p_account_key not in ('gmail', 'sms') then
    raise exception 'unknown account';
  end if;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;
  select s.provider_keys_present into keys_present
  from public.channel_connect_stubs s
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

revoke all on function public.save_campaign_csv_import(uuid, text, jsonb) from public, anon;
revoke all on function public.refuse_campaign_csv_send(uuid, text) from public, anon;
revoke all on function public.save_channel_connect_stub(uuid, text) from public, anon;
revoke all on function public.refuse_channel_test_send(uuid, text) from public, anon;
grant execute on function public.save_campaign_csv_import(uuid, text, jsonb) to authenticated;
grant execute on function public.refuse_campaign_csv_send(uuid, text) to authenticated;
grant execute on function public.save_channel_connect_stub(uuid, text) to authenticated;
grant execute on function public.refuse_channel_test_send(uuid, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on table public.campaign_csv_imports to service_role;
    grant select on table public.campaign_csv_prospects to service_role;
    grant select, insert, update on table public.channel_connect_stubs to service_role;
    grant execute on function public.save_campaign_csv_import(uuid, text, jsonb) to service_role;
    grant execute on function public.refuse_campaign_csv_send(uuid, text) to service_role;
    grant execute on function public.save_channel_connect_stub(uuid, text) to service_role;
    grant execute on function public.refuse_channel_test_send(uuid, text) to service_role;
  end if;
end
$service_grants$;

comment on table public.campaign_csv_imports is
  'Sandbox audit of a campaign CSV dry-load. Missing consent is skipped. Nothing is queued or sent.';
comment on table public.campaign_csv_prospects is
  'Draft prospects from a sandbox CSV dry-load. Status stays draft. Nothing is queued or sent.';
comment on table public.channel_connect_stubs is
  'Sandbox stub for Email (Resend/SMTP) and SMS (SMSPortal, BulkSMS, Clickatell). No secret and no provider key is stored.';
