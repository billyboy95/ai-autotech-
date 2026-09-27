-- Phase 2f: sandbox billing hooks.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- PayFast, Paystack, and Yoco stay sandbox-only. This file does not call a provider.
-- org_subscriptions.sandbox must stay true. A suspended workspace is read-only for signed-in users.

create table if not exists public.plans (
  code text primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  interval text not null default 'month' check (interval in ('month', 'year')),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  snapshot_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plans_org_id_idx on public.plans (org_id);

do $plan_snapshot$
begin
  if to_regclass('public.snapshots') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'plans_snapshot_id_fkey' and conrelid = 'public.plans'::regclass
     ) then
    alter table public.plans
      add constraint plans_snapshot_id_fkey
      foreign key (snapshot_id) references public.snapshots(id) on delete set null;
  end if;
end
$plan_snapshot$;

create table if not exists public.org_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_code text not null references public.plans(code),
  provider text not null check (provider in ('payfast', 'paystack', 'yoco', 'manual')),
  provider_customer_ref text,
  provider_token text,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'suspended', 'cancelled')),
  current_period_end timestamptz,
  next_charge_at timestamptz,
  past_due_at timestamptz,
  suspended_at timestamptz,
  sandbox boolean not null default true check (sandbox),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_subscriptions_org_id_idx on public.org_subscriptions (org_id);
create index if not exists org_subscriptions_dunning_idx on public.org_subscriptions (status, past_due_at);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('payfast', 'paystack', 'yoco', 'manual')),
  provider_event_id text not null unique,
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists billing_events_org_id_idx on public.billing_events (org_id, received_at desc);

create table if not exists public.billing_usage_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  amount_cents bigint not null default 0,
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  status text not null default 'sandbox_pending' check (status in ('sandbox_pending', 'void')),
  provider text,
  created_at timestamptz not null default now(),
  unique (org_id, period_start)
);

create index if not exists billing_usage_reports_org_id_idx on public.billing_usage_reports (org_id, period_start);

create table if not exists public.billing_usage_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  report_id uuid not null references public.billing_usage_reports(id) on delete cascade,
  meter text not null,
  quantity bigint not null,
  amount_cents bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists billing_usage_lines_org_id_idx on public.billing_usage_lines (org_id);
create index if not exists billing_usage_lines_report_idx on public.billing_usage_lines (report_id);

create table if not exists public.billing_payment_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider = 'yoco'),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  description text not null default '',
  status text not null default 'sandbox_draft' check (status in ('sandbox_draft', 'cancelled')),
  reference text not null,
  sandbox boolean not null default true check (sandbox),
  created_at timestamptz not null default now()
);

create index if not exists billing_payment_links_org_id_idx on public.billing_payment_links (org_id);

-- Plans are the agency catalogue. Client admins of a child workspace can read them.
-- Client users cannot. Writes stay with the agency owner.
alter table public.plans enable row level security;
alter table public.plans force row level security;
drop policy if exists plans_read on public.plans;
drop policy if exists plans_write on public.plans;
create policy plans_read on public.plans
  for select to authenticated
  using (
    public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
    or exists (
      select 1 from public.organizations child
      where child.parent_id = plans.org_id
        and public.has_org_role(child.id, array['client_admin'])
    )
  );
create policy plans_write on public.plans
  for all to authenticated
  using (public.has_org_role(org_id, array['agency_owner']))
  with check (public.has_org_role(org_id, array['agency_owner']));

alter table public.org_subscriptions enable row level security;
alter table public.org_subscriptions force row level security;
drop policy if exists org_subscriptions_read on public.org_subscriptions;
create policy org_subscriptions_read on public.org_subscriptions
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

alter table public.billing_events enable row level security;
alter table public.billing_events force row level security;
drop policy if exists billing_events_read on public.billing_events;
create policy billing_events_read on public.billing_events
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

alter table public.billing_usage_reports enable row level security;
alter table public.billing_usage_reports force row level security;
drop policy if exists billing_usage_reports_read on public.billing_usage_reports;
create policy billing_usage_reports_read on public.billing_usage_reports
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

alter table public.billing_usage_lines enable row level security;
alter table public.billing_usage_lines force row level security;
drop policy if exists billing_usage_lines_read on public.billing_usage_lines;
create policy billing_usage_lines_read on public.billing_usage_lines
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

alter table public.billing_payment_links enable row level security;
alter table public.billing_payment_links force row level security;
drop policy if exists billing_payment_links_read on public.billing_payment_links;
create policy billing_payment_links_read on public.billing_payment_links
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

-- Status is visible to every member so a suspended workspace can show a banner.
-- The PayFast token is not granted to signed-in users.
revoke all on public.plans from authenticated;
grant select, insert, update, delete on public.plans to authenticated;

revoke all on public.org_subscriptions from authenticated;
grant select (
  id, org_id, plan_code, provider, status, current_period_end, next_charge_at,
  past_due_at, suspended_at, sandbox, created_at, updated_at
) on public.org_subscriptions to authenticated;

revoke all on public.billing_events from authenticated;
grant select (id, provider, provider_event_id, org_id, type, received_at, processed_at) on public.billing_events to authenticated;

revoke all on public.billing_usage_reports from authenticated;
grant select on public.billing_usage_reports to authenticated;

revoke all on public.billing_usage_lines from authenticated;
grant select on public.billing_usage_lines to authenticated;

revoke all on public.billing_payment_links from authenticated;
grant select on public.billing_payment_links to authenticated;

-- Signed-in users cannot insert subscriptions or events. The webhook uses the service role.
-- auth.uid() is null for the service role and for the SQL editor.

create or replace function public.apply_billing_event(
  p_org uuid,
  p_provider text,
  p_event_id text,
  p_type text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  inserted uuid;
  plan_code text;
  payment_status text;
  occurred timestamptz;
  got_cents bigint;
  expected_cents bigint;
  next_status text;
  token text;
  existing_status text;
begin
  if jwt_role = '' then
    begin
      jwt_role := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if auth.uid() is not null or jwt_role in ('authenticated', 'anon') then
    raise exception 'not allowed';
  end if;
  if p_provider not in ('payfast', 'paystack', 'yoco', 'manual') then
    raise exception 'unsupported provider';
  end if;
  if coalesce(p_payload->>'sandbox', '') <> 'true' then
    raise exception 'live charges are disabled';
  end if;
  if nullif(btrim(p_event_id), '') is null then
    raise exception 'provider_event_id required';
  end if;

  payment_status := upper(coalesce(p_payload->>'payment_status', ''));
  occurred := coalesce(nullif(p_payload->>'occurred_at', '')::timestamptz, now());
  plan_code := nullif(p_payload->>'plan_code', '');
  if plan_code is null then
    select s.plan_code into plan_code from public.org_subscriptions s where s.org_id = p_org;
  end if;

  if payment_status = 'COMPLETE' or p_type = 'subscription.cancel' then
    if plan_code is null or not exists (select 1 from public.plans p where p.code = plan_code) then
      raise exception 'unknown plan';
    end if;
  end if;

  if payment_status = 'COMPLETE' then
    if coalesce(p_payload->>'amount_cents', '') <> '' then
      got_cents := (p_payload->>'amount_cents')::bigint;
    elsif coalesce(p_payload->>'amount_gross', '') <> '' then
      got_cents := round((p_payload->>'amount_gross')::numeric * 100)::bigint;
    else
      raise exception 'amount required';
    end if;
    select p.price_cents into expected_cents from public.plans p where p.code = plan_code;
    if expected_cents is null or got_cents <> expected_cents then
      raise exception 'amount mismatch';
    end if;
  end if;

  insert into public.billing_events (provider, provider_event_id, org_id, type, payload, processed_at)
  values (p_provider, p_event_id, p_org, p_type, p_payload, now())
  on conflict (provider_event_id) do nothing
  returning id into inserted;

  if inserted is null then
    select s.status into existing_status from public.org_subscriptions s where s.org_id = p_org;
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'status', existing_status,
      'org_id', p_org,
      'charged', false,
      'sandbox', true,
      'sending_enabled', false
    );
  end if;

  if p_type = 'subscription.cancel' then
    next_status := 'cancelled';
  elsif payment_status = 'COMPLETE' then
    next_status := 'active';
  elsif payment_status in ('FAILED', 'CANCELLED') then
    next_status := 'past_due';
  else
    next_status := null;
  end if;

  if next_status is not null and plan_code is not null then
    token := nullif(p_payload->>'token', '');
    insert into public.org_subscriptions as s (
      org_id, plan_code, provider, provider_token, status, past_due_at, suspended_at,
      current_period_end, next_charge_at, sandbox, updated_at
    )
    values (
      p_org,
      plan_code,
      p_provider,
      token,
      next_status,
      case when next_status = 'past_due' then occurred else null end,
      null,
      case when next_status = 'active' then occurred + interval '1 month' else null end,
      case when next_status = 'active' then occurred + interval '1 month' else null end,
      true,
      now()
    )
    on conflict (org_id) do update set
      plan_code = excluded.plan_code,
      provider = excluded.provider,
      provider_token = coalesce(excluded.provider_token, s.provider_token),
      status = excluded.status,
      past_due_at = case
        when excluded.status = 'past_due' then coalesce(s.past_due_at, excluded.past_due_at)
        when excluded.status = 'active' then null
        else s.past_due_at
      end,
      suspended_at = case when excluded.status = 'active' then null else s.suspended_at end,
      current_period_end = coalesce(excluded.current_period_end, s.current_period_end),
      next_charge_at = coalesce(excluded.next_charge_at, s.next_charge_at),
      sandbox = true,
      updated_at = now();
  end if;

  if next_status = 'active' then
    update public.organizations
    set status = 'active', updated_at = now()
    where id = p_org and status = 'suspended';
  end if;

  select s.status into existing_status from public.org_subscriptions s where s.org_id = p_org;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'status', coalesce(next_status, existing_status),
    'org_id', p_org,
    'charged', false,
    'sandbox', true,
    'sending_enabled', false
  );
end;
$$;

create or replace function public.apply_billing_dunning(p_now timestamptz default now())
returns table (suspended_org uuid, previous_status text, new_status text, outbox_held integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  rec record;
  held integer;
begin
  if jwt_role = '' then
    begin
      jwt_role := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if auth.uid() is not null or jwt_role in ('authenticated', 'anon') then
    raise exception 'not allowed';
  end if;

  for rec in
    select s.org_id
    from public.org_subscriptions s
    where s.status = 'past_due'
      and s.past_due_at is not null
      and s.past_due_at <= p_now - interval '7 days'
  loop
    update public.org_subscriptions
    set status = 'suspended', suspended_at = p_now, updated_at = p_now
    where org_id = rec.org_id and status = 'past_due';

    update public.organizations
    set status = 'suspended', sending_enabled = false, updated_at = p_now
    where id = rec.org_id and status is distinct from 'archived';

    held := 0;
    if to_regclass('public.crm_outbox') is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'org_id'
       ) then
      execute
        'with held_rows as (
           update public.crm_outbox
           set status = ''held''
           where org_id = $1 and status in (''queued'', ''approved'')
           returning 1
         )
         select count(*)::int from held_rows'
      into held
      using rec.org_id;
    end if;

    suspended_org := rec.org_id;
    previous_status := 'past_due';
    new_status := 'suspended';
    outbox_held := held;
    return next;
  end loop;
end;
$$;

create or replace function public.workspace_usage_report(
  p_org uuid,
  p_from timestamptz,
  p_to timestamptz
) returns table (meter text, quantity bigint, amount_cents bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;
  return query
  select
    l.meter,
    sum(l.quantity)::bigint as quantity,
    sum(round(
      l.quantity::numeric
      * l.unit_cost_cents::numeric
      * coalesce(org_card.markup_multiplier, def_card.markup_multiplier, 1)
    ))::bigint as amount_cents
  from public.usage_ledger l
  left join public.rate_cards org_card
    on org_card.org_id = l.org_id and org_card.meter = l.meter
  left join public.rate_cards def_card
    on def_card.org_id is null and def_card.meter = l.meter
  where l.org_id = p_org
    and l.occurred_at >= p_from
    and l.occurred_at < p_to
  group by l.meter
  order by l.meter;
end;
$$;

create or replace function public.bill_usage_period(
  p_org uuid,
  p_from timestamptz,
  p_to timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  report_id uuid;
  total bigint;
begin
  if jwt_role = '' then
    begin
      jwt_role := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if auth.uid() is not null or jwt_role in ('authenticated', 'anon') then
    raise exception 'not allowed';
  end if;

  select r.id into report_id
  from public.billing_usage_reports r
  where r.org_id = p_org and r.period_start = p_from;
  if report_id is not null then
    return report_id;
  end if;

  select coalesce(sum(line.amount_cents), 0)::bigint into total
  from public.workspace_usage_report(p_org, p_from, p_to) as line;

  insert into public.billing_usage_reports (org_id, period_start, period_end, amount_cents, currency, status)
  values (p_org, p_from, p_to, total, 'ZAR', 'sandbox_pending')
  on conflict (org_id, period_start) do nothing
  returning id into report_id;

  if report_id is null then
    select r.id into report_id
    from public.billing_usage_reports r
    where r.org_id = p_org and r.period_start = p_from;
    return report_id;
  end if;

  insert into public.billing_usage_lines (org_id, report_id, meter, quantity, amount_cents)
  select p_org, report_id, line.meter, line.quantity, line.amount_cents
  from public.workspace_usage_report(p_org, p_from, p_to) as line;

  return report_id;
end;
$$;

create or replace function public.run_billing_cycle(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  period_end timestamptz;
  period_start timestamptz;
  suspended_count integer;
  report_count integer := 0;
  org uuid;
begin
  if jwt_role = '' then
    begin
      jwt_role := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');
    exception when others then
      jwt_role := '';
    end;
  end if;
  if auth.uid() is not null or jwt_role in ('authenticated', 'anon') then
    raise exception 'not allowed';
  end if;

  select count(*)::int into suspended_count from public.apply_billing_dunning(p_now);

  period_end := date_trunc('month', p_now at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg';
  period_start := period_end - interval '1 month';

  for org in
    select s.org_id from public.org_subscriptions s
    where s.status in ('trialing', 'active', 'past_due', 'suspended')
  loop
    perform public.bill_usage_period(org, period_start, period_end);
    report_count := report_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'charged', false,
    'sandbox', true,
    'suspended', suspended_count,
    'reports', report_count,
    'sending_enabled', false
  );
end;
$$;

create or replace function public.create_yoco_sandbox_link(
  p_org uuid,
  p_amount_cents bigint,
  p_description text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text;
  link_id uuid;
begin
  if auth.uid() is null
     or not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount required';
  end if;
  ref := 'sandbox-yoco-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.billing_payment_links (org_id, provider, amount_cents, description, status, reference, sandbox)
  values (p_org, 'yoco', p_amount_cents, coalesce(p_description, ''), 'sandbox_draft', ref, true)
  returning id into link_id;
  return jsonb_build_object(
    'ok', true,
    'id', link_id,
    'reference', ref,
    'sandbox', true,
    'charged', false,
    'provider', 'yoco'
  );
end;
$$;

revoke all on function public.apply_billing_event(uuid, text, text, text, jsonb) from public;
revoke all on function public.apply_billing_dunning(timestamptz) from public;
revoke all on function public.bill_usage_period(uuid, timestamptz, timestamptz) from public;
revoke all on function public.run_billing_cycle(timestamptz) from public;
revoke all on function public.workspace_usage_report(uuid, timestamptz, timestamptz) from public;
revoke all on function public.create_yoco_sandbox_link(uuid, bigint, text) from public;

grant execute on function public.workspace_usage_report(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.create_yoco_sandbox_link(uuid, bigint, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.plans to service_role;
    grant select, insert, update, delete on public.org_subscriptions to service_role;
    grant select, insert, update, delete on public.billing_events to service_role;
    grant select, insert, update, delete on public.billing_usage_reports to service_role;
    grant select, insert, update, delete on public.billing_usage_lines to service_role;
    grant select, insert, update, delete on public.billing_payment_links to service_role;
    grant execute on function public.apply_billing_event(uuid, text, text, text, jsonb) to service_role;
    grant execute on function public.apply_billing_dunning(timestamptz) to service_role;
    grant execute on function public.bill_usage_period(uuid, timestamptz, timestamptz) to service_role;
    grant execute on function public.run_billing_cycle(timestamptz) to service_role;
    grant execute on function public.workspace_usage_report(uuid, timestamptz, timestamptz) to service_role;
    grant execute on function public.create_yoco_sandbox_link(uuid, bigint, text) to service_role;
  end if;
end
$service_grants$;

create or replace function public.reject_if_workspace_suspended()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    target := old.org_id;
  else
    target := new.org_id;
  end if;
  if target is not null and exists (
    select 1 from public.org_subscriptions s
    where s.org_id = target and s.status = 'suspended'
  ) then
    raise exception 'Workspace is suspended. It is read-only until billing is settled.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.reject_if_organization_suspended()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if exists (
    select 1 from public.org_subscriptions s
    where s.org_id = old.id and s.status = 'suspended'
  ) then
    raise exception 'Workspace is suspended. It is read-only until billing is settled.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_if_workspace_suspended() from public;
revoke all on function public.reject_if_organization_suspended() from public;

do $guards$
declare
  rel text;
begin
  foreach rel in array ARRAY[
    'crm_leads', 'crm_clients', 'crm_jobs', 'crm_invoices', 'crm_audit_leads', 'crm_contact_leads',
    'crm_outbox', 'crm_prospects', 'crm_contacts', 'crm_lead_activity',
    'conversations', 'messages', 'conversation_notes',
    'workflows', 'workflow_runs', 'workflow_steps', 'events',
    'channel_connections', 'contact_consents', 'suppressions', 'data_requests',
    'pipelines', 'pipeline_stages', 'message_templates', 'sequences', 'custom_fields',
    'workspace_deals', 'workspace_messages', 'workspace_campaigns', 'workspace_tasks'
  ]
  loop
    if to_regclass('public.' || rel) is null then
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = rel and column_name = 'org_id'
    ) then
      continue;
    end if;
    execute format('drop trigger if exists reject_suspended_write on public.%I', rel);
    execute format(
      'create trigger reject_suspended_write before insert or update or delete on public.%I for each row execute function public.reject_if_workspace_suspended()',
      rel
    );
  end loop;

  drop trigger if exists reject_suspended_org_update on public.organizations;
  create trigger reject_suspended_org_update
    before update on public.organizations
    for each row execute function public.reject_if_organization_suspended();
end
$guards$;

do $seed_plans$
declare
  agency uuid;
begin
  select id into agency from public.organizations where slug = 'ai-autotech';
  if agency is null then
    raise notice 'ai-autotech org missing; plans were not seeded';
    return;
  end if;
  insert into public.plans (org_id, code, name, price_cents, currency, interval, limits, features)
  values
    (
      agency, 'starter', 'Starter', 49900, 'ZAR', 'month',
      '{"users":3,"contacts":1000,"wa_msgs":500,"sms":500}'::jsonb,
      '{"inbox":true}'::jsonb
    ),
    (
      agency, 'growth', 'Growth', 149900, 'ZAR', 'month',
      '{"users":10,"contacts":10000,"wa_msgs":5000,"sms":5000}'::jsonb,
      '{"inbox":true,"workflows":true}'::jsonb
    ),
    (
      agency, 'scale', 'Scale', 399900, 'ZAR', 'month',
      '{"users":30,"contacts":50000,"wa_msgs":20000,"sms":20000}'::jsonb,
      '{"inbox":true,"workflows":true,"snapshots":true}'::jsonb
    )
  on conflict (code) do nothing;
end
$seed_plans$;
