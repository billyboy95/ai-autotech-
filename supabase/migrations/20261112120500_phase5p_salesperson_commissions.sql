-- Salesperson / affiliate commission ledger.
-- Additive. No rows are deleted. sending is not turned on.
-- Rows are a workspace record of amounts staff entered. sandbox must stay true.
-- This file does not call a payment provider and does not move money.
-- The 30 percent default is a placeholder until the workspace owner sets it.
-- This is record-keeping, not tax, payroll, or legal advice.
-- Needs organisations, workspace_deals, crm_leads, accessible_org_ids, and has_org_role.
-- Not part of APPLY-ORDER steps 20 through 36. Do not paste it in that list.

do $commission_need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.workspace_deals') is null
     or to_regclass('public.crm_leads') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'salesperson commissions need organisations, workspace_deals, crm_leads, accessible_org_ids, and has_org_role';
  end if;
end
$commission_need$;

create table if not exists public.commission_salespeople (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact text not null default '',
  code text not null,
  active boolean not null default true,
  percent numeric(5,2) not null default 30 check (percent >= 0 and percent <= 100),
  basis text not null default 'gross_received' check (basis = 'gross_received'),
  cadence text not null default 'once_off' check (cadence in ('once_off', 'recurring')),
  month_limit integer,
  sandbox boolean not null default true check (sandbox),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_salespeople_name_len check (char_length(btrim(name)) between 1 and 80),
  constraint commission_salespeople_contact_len check (char_length(contact) <= 120),
  constraint commission_salespeople_code_fmt check (code ~ '^[A-Z0-9]{4,12}$'),
  constraint commission_salespeople_month_limit check (
    (cadence = 'once_off' and month_limit is null)
    or (cadence = 'recurring' and (month_limit is null or (month_limit >= 1 and month_limit <= 36)))
  )
);

create unique index if not exists commission_salespeople_org_code_uidx
  on public.commission_salespeople (org_id, code);
create index if not exists commission_salespeople_org_idx
  on public.commission_salespeople (org_id, active, name);

comment on table public.commission_salespeople is
  'Affiliate record for one workspace. The percent is a placeholder until the owner sets it. sandbox stays true. No payout is sent.';

comment on column public.commission_salespeople.percent is
  'Placeholder percent of the gross amount received. Default 30 until the owner changes it. Not a tax rate.';

comment on column public.commission_salespeople.basis is
  'gross_received: commission uses the amount staff recorded as received, not the quoted deal total.';

create table if not exists public.commission_attributions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  salesperson_id uuid not null references public.commission_salespeople(id) on delete cascade,
  lead_id text,
  deal_id uuid,
  source text not null check (source in ('code', 'manual')),
  title text not null default 'Sale',
  sandbox boolean not null default true check (sandbox),
  attributed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint commission_attributions_subject check (lead_id is not null or deal_id is not null)
);

create unique index if not exists commission_attributions_lead_uidx
  on public.commission_attributions (org_id, lead_id)
  where lead_id is not null;
create unique index if not exists commission_attributions_deal_uidx
  on public.commission_attributions (org_id, deal_id)
  where deal_id is not null;
create index if not exists commission_attributions_person_idx
  on public.commission_attributions (salesperson_id, created_at desc);

comment on table public.commission_attributions is
  'Links a salesperson to a lead by code, or to a deal by a staff member. One live link per lead and per deal.';

do $commission_attr_fk$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'commission_attributions_lead_fk'
  ) then
    alter table public.commission_attributions
      add constraint commission_attributions_lead_fk
      foreign key (lead_id) references public.crm_leads(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'commission_attributions_deal_fk'
  ) then
    alter table public.commission_attributions
      add constraint commission_attributions_deal_fk
      foreign key (deal_id) references public.workspace_deals(id) on delete cascade;
  end if;
end
$commission_attr_fk$;

create table if not exists public.commission_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  attribution_id uuid not null references public.commission_attributions(id) on delete cascade,
  salesperson_id uuid not null references public.commission_salespeople(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  method text not null default 'eft' check (method in ('eft', 'other')),
  paid_on date not null,
  sandbox boolean not null default true check (sandbox),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists commission_receipts_attr_idx
  on public.commission_receipts (attribution_id, paid_on);

comment on table public.commission_receipts is
  'Amount staff recorded as received, including a manual EFT. Recording this row is the paid mark. No provider is called.';

create table if not exists public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  salesperson_id uuid not null references public.commission_salespeople(id) on delete cascade,
  attribution_id uuid not null references public.commission_attributions(id) on delete cascade,
  receipt_id uuid not null unique references public.commission_receipts(id) on delete cascade,
  title text not null default 'Sale',
  amount_cents bigint not null check (amount_cents >= 0),
  basis_cents bigint not null check (basis_cents > 0),
  percent numeric(5,2) not null check (percent >= 0 and percent <= 100),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'void')),
  period_index integer not null default 1 check (period_index >= 1),
  sandbox boolean not null default true check (sandbox),
  approved_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commission_ledger_person_idx
  on public.commission_ledger (salesperson_id, created_at desc);
create index if not exists commission_ledger_org_idx
  on public.commission_ledger (org_id, status);

comment on table public.commission_ledger is
  'Commission record. status paid is a mark by the owner. The row stays. No money is sent. Not a tax invoice.';

create table if not exists public.commission_audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists commission_audit_org_idx
  on public.commission_audit (org_id, created_at desc);

comment on table public.commission_audit is
  'Who changed a salesperson, attribution, receipt, or ledger mark. Owners can read it.';

create or replace function public.commission_code_key(p_raw text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(p_raw, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

create or replace function public.commission_cents(p_amount bigint, p_percent numeric)
returns bigint
language sql
immutable
as $$
  select case
    when p_amount is null or p_amount <= 0 then 0
    when p_percent is null or p_percent < 0 or p_percent > 100 then 0
    else round((p_amount::numeric * p_percent) / 100)::bigint
  end;
$$;

create or replace function public.save_commission_salesperson(
  p_org uuid,
  p_salesperson uuid,
  p_name text,
  p_contact text,
  p_code text,
  p_active boolean,
  p_percent numeric,
  p_cadence text,
  p_month_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_contact text := left(btrim(coalesce(p_contact, '')), 120);
  v_code text := public.commission_code_key(p_code);
  v_percent numeric(5,2) := round(coalesce(p_percent, 30), 2);
  v_cadence text := coalesce(p_cadence, 'once_off');
  v_limit integer := p_month_limit;
  v_active boolean := coalesce(p_active, true);
  v_id uuid;
  v_before jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Sign in as the workspace owner. Nothing was saved and no money was sent.');
  end if;
  if not public.has_org_role(p_org, array['agency_owner']) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'The workspace owner updates salespeople. Nothing was saved and no money was sent.');
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'reason', 'bad_name', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Add the salesperson name. Nothing was saved.');
  end if;
  if v_code is null or v_code !~ '^[A-Z0-9]{4,12}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_code', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Use a code of 4 to 12 letters or digits. Nothing was saved.');
  end if;
  if v_percent < 0 or v_percent > 100 then
    return jsonb_build_object('ok', false, 'reason', 'bad_percent', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Percent must be from 0 to 100. Nothing was saved.');
  end if;
  if v_cadence not in ('once_off', 'recurring') then
    return jsonb_build_object('ok', false, 'reason', 'bad_cadence', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Choose once-off or recurring. Nothing was saved.');
  end if;
  if v_cadence = 'once_off' then
    v_limit := null;
  elsif v_limit is not null and (v_limit < 1 or v_limit > 36) then
    return jsonb_build_object('ok', false, 'reason', 'bad_limit', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Month limit is 1 to 36, or leave it empty. Nothing was saved.');
  end if;

  if p_salesperson is not null then
    select jsonb_build_object('name', name, 'code', code, 'percent', percent, 'cadence', cadence, 'month_limit', month_limit, 'active', active)
      into v_before
    from public.commission_salespeople
    where id = p_salesperson and org_id = p_org;
    if v_before is null then
      return jsonb_build_object('ok', false, 'reason', 'missing', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'That salesperson is not in this workspace. Nothing was saved.');
    end if;
    update public.commission_salespeople
    set name = v_name,
        contact = v_contact,
        code = v_code,
        active = v_active,
        percent = v_percent,
        basis = 'gross_received',
        cadence = v_cadence,
        month_limit = v_limit,
        sandbox = true,
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_salesperson and org_id = p_org
    returning id into v_id;
  else
    insert into public.commission_salespeople (
      org_id, name, contact, code, active, percent, basis, cadence, month_limit, sandbox, created_by, updated_by
    ) values (
      p_org, v_name, v_contact, v_code, v_active, v_percent, 'gross_received', v_cadence, v_limit, true, auth.uid(), auth.uid()
    )
    returning id into v_id;
  end if;

  insert into public.commission_audit (org_id, actor_id, action, entity_type, entity_id, detail)
  values (
    p_org, auth.uid(), 'salesperson_saved', 'salesperson', v_id,
    jsonb_build_object(
      'before', v_before,
      'name', v_name,
      'code', v_code,
      'percent', v_percent,
      'cadence', v_cadence,
      'month_limit', v_limit,
      'active', v_active,
      'basis', 'gross_received'
    )
  );

  return jsonb_build_object(
    'ok', true, 'reason', 'saved', 'id', v_id, 'charged', false, 'sandbox', true,
    'placeholder', true, 'money_moved', false,
    'message', 'Salesperson saved. The percent stays a workspace record until you change it. No money was sent.'
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'code_taken', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That code is already used in this workspace. Nothing was saved.');
end;
$$;

create or replace function public.attribute_commission(
  p_org uuid,
  p_source text,
  p_code text,
  p_salesperson uuid,
  p_lead_id text,
  p_deal_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := coalesce(p_source, '');
  v_code text := public.commission_code_key(p_code);
  v_lead text := nullif(btrim(coalesce(p_lead_id, '')), '');
  v_person public.commission_salespeople%rowtype;
  v_title text := 'Sale';
  v_id uuid;
  v_deal_title text;
  v_lead_title text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Sign in before attributing a sale. Nothing was saved and no money was sent.');
  end if;
  if not public.has_org_role(p_org, array['agency_owner', 'agency_staff']) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Workspace staff attribute a sale. Nothing was saved and no money was sent.');
  end if;
  if v_source not in ('code', 'manual') then
    return jsonb_build_object('ok', false, 'reason', 'bad_source', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Choose a code on the lead, or a manual attribution on the deal. Nothing was saved.');
  end if;

  if v_source = 'code' then
    if v_code is null or v_lead is null then
      return jsonb_build_object('ok', false, 'reason', 'bad_code', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'A code attribution needs the salesperson code and the lead. Nothing was saved.');
    end if;
    select * into v_person
    from public.commission_salespeople
    where org_id = p_org and code = v_code;
  else
    if p_salesperson is null or p_deal_id is null then
      return jsonb_build_object('ok', false, 'reason', 'bad_manual', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'A manual attribution needs the salesperson and the deal. Nothing was saved.');
    end if;
    select * into v_person
    from public.commission_salespeople
    where id = p_salesperson and org_id = p_org;
  end if;

  if v_person.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_salesperson', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That salesperson code is not in this workspace. Nothing was saved.');
  end if;
  if not v_person.active then
    return jsonb_build_object('ok', false, 'reason', 'inactive', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That salesperson is paused. Nothing was saved.');
  end if;

  if v_lead is not null then
    if not exists (select 1 from public.crm_leads lead where lead.id = v_lead and lead.org_id = p_org) then
      return jsonb_build_object('ok', false, 'reason', 'unknown_lead', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'That lead is not in this workspace. Nothing was saved.');
    end if;
    if exists (
      select 1 from public.commission_attributions
      where org_id = p_org and lead_id = v_lead
    ) then
      return jsonb_build_object('ok', false, 'reason', 'already_attributed', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'That lead already has a salesperson. Nothing was saved.');
    end if;
    select coalesce(nullif(btrim(company), ''), nullif(btrim(name), ''), 'Sale')
      into v_lead_title
    from public.crm_leads
    where id = v_lead and org_id = p_org;
  end if;

  if p_deal_id is not null then
    select title into v_deal_title
    from public.workspace_deals
    where id = p_deal_id and org_id = p_org;
    if v_deal_title is null then
      return jsonb_build_object('ok', false, 'reason', 'unknown_deal', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'That deal is not in this workspace. Nothing was saved.');
    end if;
    if exists (
      select 1 from public.commission_attributions
      where org_id = p_org and deal_id = p_deal_id
    ) then
      return jsonb_build_object('ok', false, 'reason', 'already_attributed', 'charged', false, 'sandbox', true, 'money_moved', false,
        'message', 'That deal already has a salesperson. Nothing was saved.');
    end if;
  elsif v_source = 'manual' then
    return jsonb_build_object('ok', false, 'reason', 'bad_manual', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'A manual attribution needs the deal. Nothing was saved.');
  end if;

  v_title := coalesce(v_deal_title, v_lead_title, 'Sale');

  insert into public.commission_attributions (
    org_id, salesperson_id, lead_id, deal_id, source, title, sandbox, attributed_by
  ) values (
    p_org, v_person.id, v_lead, p_deal_id, v_source, v_title, true, auth.uid()
  )
  returning id into v_id;

  insert into public.commission_audit (org_id, actor_id, action, entity_type, entity_id, detail)
  values (
    p_org, auth.uid(), 'attributed', 'attribution', v_id,
    jsonb_build_object(
      'source', v_source,
      'salesperson_id', v_person.id,
      'code', v_person.code,
      'lead_id', v_lead,
      'deal_id', p_deal_id,
      'title', v_title
    )
  );

  return jsonb_build_object(
    'ok', true, 'reason', 'attributed', 'id', v_id, 'charged', false, 'sandbox', true, 'money_moved', false,
    'message', 'Attribution saved. Commission is recorded after the deal is won and a payment is marked paid. No money was sent.'
  );
end;
$$;

create or replace function public.record_commission_receipt(
  p_org uuid,
  p_attribution uuid,
  p_amount_cents bigint,
  p_paid_on date,
  p_method text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attr public.commission_attributions%rowtype;
  v_person public.commission_salespeople%rowtype;
  v_method text := coalesce(nullif(btrim(coalesce(p_method, '')), ''), 'eft');
  v_won boolean := false;
  v_stage text;
  v_status text;
  v_booked integer := 0;
  v_existing uuid;
  v_receipt uuid;
  v_ledger uuid;
  v_cents bigint;
  v_period integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'Sign in before recording a payment. Nothing was saved and no money was sent.');
  end if;
  if not public.has_org_role(p_org, array['agency_owner', 'agency_staff']) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'Workspace staff record the amount received. Nothing was saved and no money was sent.');
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_paid_on is null then
    return jsonb_build_object('ok', false, 'reason', 'no_amount', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'Enter the amount received and the date. Nothing was saved.');
  end if;
  if v_method not in ('eft', 'other') then
    return jsonb_build_object('ok', false, 'reason', 'bad_method', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'Choose EFT or other. Nothing was saved.');
  end if;

  select * into v_attr
  from public.commission_attributions
  where id = p_attribution and org_id = p_org;
  if v_attr.id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'That attribution is not in this workspace. Nothing was saved.');
  end if;

  select * into v_person
  from public.commission_salespeople
  where id = v_attr.salesperson_id and org_id = p_org;
  if v_person.id is null or not v_person.active then
    return jsonb_build_object('ok', false, 'reason', 'inactive', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'That salesperson is paused. Nothing was saved.');
  end if;

  if v_attr.deal_id is not null then
    select status into v_status
    from public.workspace_deals
    where id = v_attr.deal_id and org_id = p_org;
    v_won := v_status = 'won';
  elsif v_attr.lead_id is not null then
    select stage into v_stage
    from public.crm_leads
    where id = v_attr.lead_id and org_id = p_org;
    v_won := v_stage in ('Won', 'Onboarding/Handover');
  end if;

  if not v_won then
    return jsonb_build_object('ok', false, 'reason', 'deal_not_won', 'charged', false, 'sandbox', true, 'money_moved', false, 'booked', false,
      'message', 'Commission waits until the deal is marked won and the payment is marked paid. Nothing was saved.');
  end if;

  select id into v_existing
  from public.commission_receipts
  where attribution_id = v_attr.id
    and amount_cents = p_amount_cents
    and paid_on = p_paid_on
    and method = v_method
  limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'reason', 'already_recorded', 'id', v_existing, 'booked', false,
      'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That payment is already on the record. No second commission line was added. No money was sent.');
  end if;

  select count(*)::int into v_booked
  from public.commission_ledger
  where attribution_id = v_attr.id and status <> 'void';

  insert into public.commission_receipts (
    org_id, attribution_id, salesperson_id, amount_cents, currency, method, paid_on, sandbox, recorded_by
  ) values (
    p_org, v_attr.id, v_person.id, p_amount_cents, 'ZAR', v_method, p_paid_on, true, auth.uid()
  )
  returning id into v_receipt;

  if v_person.cadence = 'recurring' and v_person.month_limit is not null and v_booked >= v_person.month_limit then
    insert into public.commission_audit (org_id, actor_id, action, entity_type, entity_id, detail)
    values (
      p_org, auth.uid(), 'receipt_recorded', 'receipt', v_receipt,
      jsonb_build_object('salesperson_id', v_person.id, 'amount_cents', p_amount_cents, 'paid_on', p_paid_on, 'method', v_method, 'booked', false, 'reason', 'month_limit')
    );
    return jsonb_build_object('ok', true, 'reason', 'month_limit', 'id', v_receipt, 'booked', false,
      'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Payment recorded. The month limit is already filled, so no commission line was added. No money was sent.');
  end if;

  v_cents := public.commission_cents(p_amount_cents, v_person.percent);
  v_period := v_booked + 1;
  insert into public.commission_ledger (
    org_id, salesperson_id, attribution_id, receipt_id, title, amount_cents, basis_cents, percent,
    currency, status, period_index, sandbox, updated_by
  ) values (
    p_org, v_person.id, v_attr.id, v_receipt, v_attr.title, v_cents, p_amount_cents, v_person.percent,
    'ZAR', 'pending', v_period, true, auth.uid()
  )
  returning id into v_ledger;

  insert into public.commission_audit (org_id, actor_id, action, entity_type, entity_id, detail)
  values (
    p_org, auth.uid(), 'receipt_recorded', 'receipt', v_receipt,
    jsonb_build_object(
      'salesperson_id', v_person.id,
      'ledger_id', v_ledger,
      'amount_cents', p_amount_cents,
      'commission_cents', v_cents,
      'percent', v_person.percent,
      'paid_on', p_paid_on,
      'method', v_method,
      'booked', true
    )
  );

  return jsonb_build_object(
    'ok', true, 'reason', 'booked', 'id', v_ledger, 'receipt_id', v_receipt, 'booked', true,
    'amount_cents', v_cents, 'charged', false, 'sandbox', true, 'money_moved', false,
    'message', 'Commission recorded from the amount received. It stays pending until the owner marks it. No money was sent.'
  );
end;
$$;

create or replace function public.set_commission_ledger_status(
  p_ledger uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commission_ledger%rowtype;
  v_status text := coalesce(p_status, '');
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Sign in as the workspace owner. No money was sent.');
  end if;
  select * into v_row from public.commission_ledger where id = p_ledger;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That ledger row was not found. No money was sent.');
  end if;
  if not public.has_org_role(v_row.org_id, array['agency_owner']) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'The workspace owner marks the ledger. No money was sent.');
  end if;
  if v_status not in ('pending', 'approved', 'paid', 'void') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'Choose pending, approved, paid, or void. No money was sent.');
  end if;
  if not (
    (v_row.status = 'pending' and v_status in ('approved', 'void'))
    or (v_row.status = 'approved' and v_status in ('paid', 'void'))
    or (v_row.status = 'paid' and v_status = 'void')
  ) then
    return jsonb_build_object('ok', false, 'reason', 'bad_status', 'charged', false, 'sandbox', true, 'money_moved', false,
      'message', 'That status change is not available from the current mark. No money was sent.');
  end if;

  update public.commission_ledger
  set status = v_status,
      approved_at = case when v_status = 'approved' then now() else approved_at end,
      paid_at = case when v_status = 'paid' then now() else paid_at end,
      voided_at = case when v_status = 'void' then now() else voided_at end,
      sandbox = true,
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_row.id;

  insert into public.commission_audit (org_id, actor_id, action, entity_type, entity_id, detail)
  values (
    v_row.org_id, auth.uid(), 'ledger_status', 'ledger', v_row.id,
    jsonb_build_object('salesperson_id', v_row.salesperson_id, 'from', v_row.status, 'to', v_status, 'amount_cents', v_row.amount_cents)
  );

  return jsonb_build_object(
    'ok', true, 'reason', v_status, 'id', v_row.id, 'charged', false, 'sandbox', true, 'money_moved', false,
    'message', case v_status
      when 'approved' then 'Marked approved on the ledger. No money was sent.'
      when 'paid' then 'Marked paid on the ledger. No money was sent.'
      else 'Marked void. The row stays on the ledger. No money was sent.'
    end
  );
end;
$$;

alter table public.commission_salespeople enable row level security;
alter table public.commission_salespeople force row level security;
alter table public.commission_attributions enable row level security;
alter table public.commission_attributions force row level security;
alter table public.commission_receipts enable row level security;
alter table public.commission_receipts force row level security;
alter table public.commission_ledger enable row level security;
alter table public.commission_ledger force row level security;
alter table public.commission_audit enable row level security;
alter table public.commission_audit force row level security;

drop policy if exists commission_salespeople_read on public.commission_salespeople;
create policy commission_salespeople_read on public.commission_salespeople
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

drop policy if exists commission_attributions_read on public.commission_attributions;
create policy commission_attributions_read on public.commission_attributions
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

drop policy if exists commission_receipts_read on public.commission_receipts;
create policy commission_receipts_read on public.commission_receipts
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

drop policy if exists commission_ledger_read on public.commission_ledger;
create policy commission_ledger_read on public.commission_ledger
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

drop policy if exists commission_audit_read on public.commission_audit;
create policy commission_audit_read on public.commission_audit
  for select to authenticated
  using (public.has_org_role(org_id, array['agency_owner']));

revoke all on public.commission_salespeople from public, anon, authenticated;
revoke all on public.commission_attributions from public, anon, authenticated;
revoke all on public.commission_receipts from public, anon, authenticated;
revoke all on public.commission_ledger from public, anon, authenticated;
revoke all on public.commission_audit from public, anon, authenticated;
grant select on public.commission_salespeople to authenticated;
grant select on public.commission_attributions to authenticated;
grant select on public.commission_receipts to authenticated;
grant select on public.commission_ledger to authenticated;
grant select on public.commission_audit to authenticated;

revoke all on function public.commission_code_key(text) from public;
revoke all on function public.commission_cents(bigint, numeric) from public;
revoke all on function public.save_commission_salesperson(uuid, uuid, text, text, text, boolean, numeric, text, integer) from public;
revoke all on function public.attribute_commission(uuid, text, text, uuid, text, uuid) from public;
revoke all on function public.record_commission_receipt(uuid, uuid, bigint, date, text) from public;
revoke all on function public.set_commission_ledger_status(uuid, text) from public;

grant execute on function public.commission_code_key(text) to authenticated;
grant execute on function public.commission_cents(bigint, numeric) to authenticated;
grant execute on function public.save_commission_salesperson(uuid, uuid, text, text, text, boolean, numeric, text, integer) to authenticated;
grant execute on function public.attribute_commission(uuid, text, text, uuid, text, uuid) to authenticated;
grant execute on function public.record_commission_receipt(uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.set_commission_ledger_status(uuid, text) to authenticated;

do $commission_suspend$
begin
  if to_regprocedure('public.reject_if_workspace_suspended()') is null then
    return;
  end if;
  drop trigger if exists reject_suspended_write on public.commission_salespeople;
  drop trigger if exists reject_suspended_write on public.commission_attributions;
  drop trigger if exists reject_suspended_write on public.commission_receipts;
  drop trigger if exists reject_suspended_write on public.commission_ledger;
  create trigger reject_suspended_write
    before insert or update or delete on public.commission_salespeople
    for each row execute function public.reject_if_workspace_suspended();
  create trigger reject_suspended_write
    before insert or update or delete on public.commission_attributions
    for each row execute function public.reject_if_workspace_suspended();
  create trigger reject_suspended_write
    before insert or update or delete on public.commission_receipts
    for each row execute function public.reject_if_workspace_suspended();
  create trigger reject_suspended_write
    before insert or update or delete on public.commission_ledger
    for each row execute function public.reject_if_workspace_suspended();
end
$commission_suspend$;

-- Check after a successful paste. Run this on its own. Do not expect it to change rows.
-- select c.relname, c.relrowsecurity, c.relforcerowsecurity
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname in (
--     'commission_salespeople',
--     'commission_attributions',
--     'commission_receipts',
--     'commission_ledger',
--     'commission_audit'
--   )
-- order by c.relname;
-- Expect 5 rows, relrowsecurity true, relforcerowsecurity true.
-- select proname from pg_proc
-- where pronamespace = 'public'::regnamespace
--   and proname in (
--     'save_commission_salesperson',
--     'attribute_commission',
--     'record_commission_receipt',
--     'set_commission_ledger_status'
--   )
-- order by proname;
-- Expect 4 rows. Then leave COMMISSIONS_ENABLED unset.
