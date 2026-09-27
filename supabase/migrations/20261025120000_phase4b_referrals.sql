-- Phase 4b: referral ledger.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Rewards are ledger entries. sandbox must stay true. This file does not call a provider
-- and does not move money. Amounts are placeholders until Billy confirms them.
-- Apply after phase 2f (billing_events). Steps 17 and 18 are separate open pull requests.

do $phase4b_need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.billing_events') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 4b needs organisations, accessible_org_ids, and billing_events; apply phase 2f first';
  end if;
end
$phase4b_need$;

create table if not exists public.referral_program_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default true,
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  hold_days integer not null default 14 check (hold_days >= 0 and hold_days <= 365),
  reward_type text not null default 'account_credit'
    check (reward_type in ('account_credit', 'percent_off_months', 'cash_commission')),
  account_credit_cents bigint not null default 50000 check (account_credit_cents >= 0),
  percent_off numeric(5,2) not null default 10 check (percent_off >= 0 and percent_off <= 100),
  percent_off_months integer not null default 1 check (percent_off_months >= 0 and percent_off_months <= 24),
  cash_commission_cents bigint not null default 25000 check (cash_commission_cents >= 0),
  tiers jsonb not null default '[
    {"name":"Starter","paid_referrals":1,"reward_type":"account_credit","amount_cents":50000},
    {"name":"Advocate","paid_referrals":3,"reward_type":"account_credit","amount_cents":75000},
    {"name":"Partner","paid_referrals":10,"reward_type":"cash_commission","amount_cents":100000}
  ]'::jsonb,
  sandbox boolean not null default true check (sandbox),
  updated_at timestamptz not null default now()
);

comment on table public.referral_program_settings is
  'Agency referral rules. Amounts are placeholders until Billy confirms them. sandbox stays true.';

comment on column public.referral_program_settings.account_credit_cents is
  'Placeholder ZAR cents for account credit. Confirm with Billy before treating this as a payout.';

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  code text not null,
  vanity_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_codes_code_fmt check (code ~ '^[A-Z0-9]{4,12}$'),
  constraint referral_codes_vanity_fmt check (vanity_code is null or vanity_code ~ '^[A-Z0-9]{4,16}$')
);

create unique index if not exists referral_codes_code_uidx on public.referral_codes (code);
create unique index if not exists referral_codes_vanity_uidx on public.referral_codes (vanity_code) where vanity_code is not null;
create unique index if not exists referral_codes_user_uidx on public.referral_codes (user_id) where user_id is not null;
create unique index if not exists referral_codes_org_uidx on public.referral_codes (org_id) where user_id is null;
create index if not exists referral_codes_org_idx on public.referral_codes (org_id);

comment on table public.referral_codes is
  'One short code per user, or one organisation code when user_id is null. Optional vanity_code.';

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code_id uuid not null references public.referral_codes(id) on delete cascade,
  referrer_user_id uuid references auth.users(id) on delete set null,
  referrer_org_id uuid not null references public.organizations(id) on delete cascade,
  referred_org_id uuid references public.organizations(id) on delete set null,
  referred_user_id uuid references auth.users(id) on delete set null,
  referred_lead_id text,
  status text not null default 'clicked'
    check (status in ('clicked', 'signed_up', 'paid', 'rewarded', 'void')),
  source text not null check (source in ('audit', 'signup', 'team', 'cookie', 'billing')),
  sandbox boolean not null default true check (sandbox),
  clicked_at timestamptz not null default now(),
  signed_up_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referrals_org_idx on public.referrals (org_id, created_at desc);
create index if not exists referrals_code_idx on public.referrals (code_id, status);
create unique index if not exists referrals_referred_org_uidx
  on public.referrals (referred_org_id)
  where referred_org_id is not null and status <> 'void';

comment on table public.referrals is
  'Org-scoped referral. org_id is the referrer workspace. One live referral per referred organisation.';

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  referral_id uuid not null unique references public.referrals(id) on delete cascade,
  referred_org_id uuid not null unique references public.organizations(id) on delete cascade,
  reward_type text not null
    check (reward_type in ('account_credit', 'percent_off_months', 'cash_commission')),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  percent_off numeric(5,2),
  months integer,
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'void')),
  sandbox boolean not null default true check (sandbox),
  hold_until timestamptz not null,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referral_rewards_org_idx on public.referral_rewards (org_id, created_at desc);

comment on table public.referral_rewards is
  'Sandbox ledger only. One reward per referred organisation. status void keeps the row. No payout is sent.';

create or replace function public.referral_code_key(p_raw text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(p_raw, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

create or replace function public.generate_referral_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  out text := '';
  i int;
  n int;
begin
  for i in 1..8 loop
    n := get_byte(decode(substr(raw, (i - 1) * 2 + 1, 2), 'hex'), 0);
    out := out || substr(alphabet, (n % length(alphabet)) + 1, 1);
  end loop;
  return out;
end;
$$;

create or replace function public.referral_code_taken(p_key text, p_except uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.referral_codes c
    where (p_except is null or c.id <> p_except)
      and (c.code = p_key or c.vanity_code = p_key)
  );
$$;

create or replace function public.record_referral_click(
  p_code text,
  p_source text,
  p_lead_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := public.referral_code_key(p_code);
  found public.referral_codes%rowtype;
  attached uuid;
  lead text := nullif(btrim(coalesce(p_lead_id, '')), '');
begin
  if key is null or key !~ '^[A-Z0-9]{4,16}$' then
    return jsonb_build_object('ok', false, 'recorded', false, 'reason', 'invalid_code');
  end if;
  if p_source not in ('audit', 'signup', 'team', 'cookie') then
    return jsonb_build_object('ok', false, 'recorded', false, 'reason', 'invalid_source');
  end if;

  select * into found
  from public.referral_codes
  where active and (code = key or vanity_code = key)
  limit 1;
  if found.id is null then
    return jsonb_build_object('ok', false, 'recorded', false, 'reason', 'unknown_code');
  end if;

  if lead is not null then
    update public.referrals
    set referred_lead_id = lead, updated_at = now()
    where id = (
      select r.id
      from public.referrals r
      where r.code_id = found.id
        and r.status = 'clicked'
        and r.referred_org_id is null
        and r.referred_lead_id is null
      order by r.clicked_at desc
      limit 1
    )
    returning id into attached;
    if attached is not null then
      return jsonb_build_object('ok', true, 'recorded', true, 'attached', true, 'sandbox', true);
    end if;
  end if;

  insert into public.referrals (
    org_id, code_id, referrer_user_id, referrer_org_id, referred_lead_id,
    status, source, sandbox
  ) values (
    found.org_id, found.id, found.user_id, found.org_id, lead,
    'clicked', p_source, true
  );

  return jsonb_build_object('ok', true, 'recorded', true, 'attached', false, 'sandbox', true);
end;
$$;

create or replace function public.ensure_referral_code(
  p_org uuid,
  p_vanity text default null,
  p_scope text default 'user'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  existing public.referral_codes%rowtype;
  key text := nullif(public.referral_code_key(p_vanity), '');
  candidate text;
  attempt int;
  created_id uuid;
begin
  if actor is null then
    raise exception 'Sign in to get a referral link';
  end if;
  if p_org is null or p_org not in (select public.accessible_org_ids()) then
    raise exception 'not allowed';
  end if;
  if p_scope not in ('user', 'org') then
    raise exception 'invalid scope';
  end if;
  if key is not null and key !~ '^[A-Z0-9]{4,16}$' then
    raise exception 'Use 4 to 16 letters or numbers';
  end if;

  if p_scope = 'org' then
    if not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
      raise exception 'not allowed';
    end if;
    select * into existing
    from public.referral_codes
    where org_id = p_org and user_id is null
    limit 1;
  else
    select * into existing
    from public.referral_codes
    where user_id = actor
    limit 1;
  end if;

  if existing.id is not null then
    if key is not null and key is distinct from existing.vanity_code then
      if public.referral_code_taken(key, existing.id) or key = existing.code then
        raise exception 'That code is already in use';
      end if;
      update public.referral_codes
      set vanity_code = key, updated_at = now()
      where id = existing.id;
      existing.vanity_code := key;
    end if;
    return jsonb_build_object(
      'ok', true,
      'id', existing.id,
      'code', existing.code,
      'vanity_code', existing.vanity_code,
      'display_code', coalesce(existing.vanity_code, existing.code),
      'sandbox', true
    );
  end if;

  if key is not null and public.referral_code_taken(key, null) then
    raise exception 'That code is already in use';
  end if;

  for attempt in 1..8 loop
    candidate := public.generate_referral_code();
    if public.referral_code_taken(candidate, null) then
      continue;
    end if;
    begin
      insert into public.referral_codes (org_id, user_id, code, vanity_code)
      values (p_org, case when p_scope = 'user' then actor else null end, candidate, key)
      returning id into created_id;
      exit;
    exception when unique_violation then
      created_id := null;
    end;
  end loop;

  if created_id is null then
    raise exception 'could not allocate a referral code';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', created_id,
    'code', candidate,
    'vanity_code', key,
    'display_code', coalesce(key, candidate),
    'sandbox', true
  );
end;
$$;

create or replace function public.attribute_referral_signup(
  p_code text,
  p_referred_org uuid,
  p_source text default 'signup'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  key text := public.referral_code_key(p_code);
  found public.referral_codes%rowtype;
  attached uuid;
begin
  if actor is null then
    raise exception 'Sign in to attribute a referral';
  end if;
  if p_referred_org is null then
    return jsonb_build_object('ok', false, 'reason', 'org_required', 'rewarded', false);
  end if;
  if p_source not in ('signup', 'team') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_source', 'rewarded', false);
  end if;
  if key is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code', 'rewarded', false);
  end if;

  select * into found
  from public.referral_codes
  where active and (code = key or vanity_code = key)
  limit 1;
  if found.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_code', 'rewarded', false);
  end if;

  if exists (
    select 1 from public.referrals r
    where r.referred_org_id = p_referred_org and r.status <> 'void'
  ) then
    return jsonb_build_object('ok', true, 'reason', 'already_attributed', 'rewarded', false, 'sandbox', true);
  end if;

  if actor = found.user_id
     or p_referred_org = found.org_id
     or exists (
       select 1 from public.memberships m
       where m.user_id = actor and m.org_id = found.org_id
     )
     or exists (
       select 1 from public.memberships m
       where found.user_id is not null
         and m.user_id = found.user_id
         and m.org_id = p_referred_org
     ) then
    return jsonb_build_object('ok', false, 'reason', 'self_referral', 'rewarded', false, 'sandbox', true);
  end if;

  update public.referrals
  set status = 'signed_up',
      source = p_source,
      referred_org_id = p_referred_org,
      referred_user_id = actor,
      signed_up_at = now(),
      updated_at = now()
  where id = (
    select r.id
    from public.referrals r
    where r.code_id = found.id
      and r.status = 'clicked'
      and r.referred_org_id is null
    order by r.clicked_at desc
    limit 1
  )
  returning id into attached;

  if attached is null then
    insert into public.referrals (
      org_id, code_id, referrer_user_id, referrer_org_id,
      referred_org_id, referred_user_id, status, source, sandbox, signed_up_at
    ) values (
      found.org_id, found.id, found.user_id, found.org_id,
      p_referred_org, actor, 'signed_up', p_source, true, now()
    )
    returning id into attached;
  end if;

  return jsonb_build_object(
    'ok', true,
    'reason', 'signed_up',
    'referral_id', attached,
    'rewarded', false,
    'sandbox', true,
    'charged', false
  );
end;
$$;

create or replace function public.attribute_referral_first_payment(
  p_org uuid,
  p_paid_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  complete_count int;
  rec public.referrals%rowtype;
  settings public.referral_program_settings%rowtype;
  agency uuid;
  paying int;
  chosen jsonb;
  rtype text;
  amount bigint;
  pct numeric;
  months int;
  reward_id uuid;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
begin
  if auth.uid() is not null then
    raise exception 'not allowed';
  end if;
  if p_org is null then
    return jsonb_build_object('ok', false, 'rewarded', false, 'reason', 'org_required', 'charged', false, 'sandbox', true);
  end if;

  select count(*)::int into complete_count
  from public.billing_events e
  where e.org_id = p_org
    and upper(coalesce(e.payload->>'payment_status', '')) = 'COMPLETE'
    and coalesce(e.payload->>'sandbox', '') = 'true';

  if complete_count <> 1 then
    return jsonb_build_object('ok', true, 'rewarded', false, 'reason', 'not_first_payment', 'charged', false, 'sandbox', true);
  end if;

  select * into rec
  from public.referrals r
  where r.referred_org_id = p_org
    and r.status in ('signed_up', 'paid')
  order by r.signed_up_at nulls last, r.created_at
  limit 1;

  if rec.id is null then
    return jsonb_build_object('ok', true, 'rewarded', false, 'reason', 'no_referral', 'charged', false, 'sandbox', true);
  end if;
  if rec.status = 'void' then
    return jsonb_build_object('ok', true, 'rewarded', false, 'reason', 'void', 'charged', false, 'sandbox', true);
  end if;

  if rec.referrer_org_id = p_org
     or (rec.referrer_user_id is not null and rec.referrer_user_id = rec.referred_user_id)
     or (
       rec.referrer_user_id is not null and exists (
         select 1 from public.memberships m
         where m.user_id = rec.referrer_user_id and m.org_id = p_org
       )
     )
     or (
       rec.referred_user_id is not null and exists (
         select 1 from public.memberships m
         where m.user_id = rec.referred_user_id and m.org_id = rec.referrer_org_id
       )
     ) then
    update public.referrals
    set status = 'void', updated_at = now()
    where id = rec.id and status <> 'void';
    return jsonb_build_object('ok', false, 'rewarded', false, 'reason', 'self_referral', 'charged', false, 'sandbox', true);
  end if;

  if exists (select 1 from public.referral_rewards rw where rw.referred_org_id = p_org) then
    return jsonb_build_object('ok', true, 'rewarded', false, 'reason', 'already_rewarded', 'charged', false, 'sandbox', true);
  end if;

  select o.parent_id into agency from public.organizations o where o.id = p_org;
  if agency is null then
    select o.parent_id into agency from public.organizations o where o.id = rec.referrer_org_id;
  end if;
  if agency is null then
    agency := rec.referrer_org_id;
  end if;

  select * into settings from public.referral_program_settings s where s.org_id = agency;

  paying := 1 + coalesce((
    select count(*)::int
    from public.referrals r
    where r.code_id = rec.code_id
      and r.id <> rec.id
      and r.status in ('paid', 'rewarded')
  ), 0);

  chosen := null;
  if settings.org_id is not null and jsonb_typeof(settings.tiers) = 'array' then
    begin
      select t into chosen
      from jsonb_array_elements(settings.tiers) t
      where coalesce((t->>'paid_referrals')::int, 0) <= paying
      order by coalesce((t->>'paid_referrals')::int, 0) desc
      limit 1;
    exception when others then
      chosen := null;
    end;
  end if;

  rtype := coalesce(chosen->>'reward_type', settings.reward_type, 'account_credit');
  if rtype not in ('account_credit', 'percent_off_months', 'cash_commission') then
    rtype := 'account_credit';
  end if;

  if rtype = 'percent_off_months' then
    pct := coalesce(nullif(chosen->>'percent_off', '')::numeric, settings.percent_off, 10);
    months := coalesce(nullif(chosen->>'months', '')::int, settings.percent_off_months, 1);
    amount := 0;
  elsif rtype = 'cash_commission' then
    amount := coalesce(nullif(chosen->>'amount_cents', '')::bigint, settings.cash_commission_cents, 25000);
    pct := null;
    months := null;
  else
    rtype := 'account_credit';
    amount := coalesce(nullif(chosen->>'amount_cents', '')::bigint, settings.account_credit_cents, 50000);
    pct := null;
    months := null;
  end if;

  insert into public.referral_rewards (
    org_id, referral_id, referred_org_id, reward_type, amount_cents, percent_off, months,
    currency, status, sandbox, hold_until
  ) values (
    rec.org_id,
    rec.id,
    p_org,
    rtype,
    greatest(amount, 0),
    pct,
    months,
    'ZAR',
    'pending',
    true,
    v_paid_at + make_interval(days => coalesce(settings.hold_days, 14))
  )
  on conflict (referred_org_id) do nothing
  returning id into reward_id;

  update public.referrals
  set status = 'paid', paid_at = v_paid_at, updated_at = now()
  where id = rec.id and status <> 'void';

  return jsonb_build_object(
    'ok', true,
    'rewarded', reward_id is not null,
    'reward_id', reward_id,
    'reason', 'pending_hold',
    'status', 'pending',
    'charged', false,
    'sandbox', true
  );
end;
$$;

create or replace function public.referral_after_billing_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if upper(coalesce(new.payload->>'payment_status', '')) = 'COMPLETE'
     and coalesce(new.payload->>'sandbox', '') = 'true' then
    begin
      perform public.attribute_referral_first_payment(new.org_id, coalesce(new.received_at, now()));
    exception when others then
      raise warning 'referral attribution skipped: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists referral_after_billing_event on public.billing_events;
create trigger referral_after_billing_event
  after insert on public.billing_events
  for each row execute function public.referral_after_billing_event();

create or replace function public.approve_referral_reward(p_reward uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reward public.referral_rewards%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to approve a reward';
  end if;
  select * into reward from public.referral_rewards where id = p_reward;
  if reward.id is null then
    raise exception 'Reward not found';
  end if;
  if not public.has_org_role(reward.org_id, array['agency_owner', 'agency_staff']) then
    raise exception 'not allowed';
  end if;
  if reward.sandbox is not true then
    raise exception 'live payouts are disabled';
  end if;
  if reward.status = 'void' then
    raise exception 'Reward is void';
  end if;
  if reward.status <> 'pending' then
    raise exception 'Reward is not pending';
  end if;
  if reward.hold_until > now() then
    raise exception 'hold period has not ended';
  end if;

  update public.referral_rewards
  set status = 'approved', approved_at = now(), updated_at = now(), sandbox = true
  where id = reward.id;

  return jsonb_build_object('ok', true, 'status', 'approved', 'charged', false, 'sandbox', true);
end;
$$;

create or replace function public.void_referral_reward(p_reward uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reward public.referral_rewards%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to void a reward';
  end if;
  select * into reward from public.referral_rewards where id = p_reward;
  if reward.id is null then
    raise exception 'Reward not found';
  end if;
  if not public.has_org_role(reward.org_id, array['agency_owner', 'agency_staff']) then
    raise exception 'not allowed';
  end if;
  if reward.status = 'paid' then
    raise exception 'Paid ledger entries stay in the book';
  end if;

  update public.referral_rewards
  set status = 'void', updated_at = now(), sandbox = true
  where id = reward.id;
  update public.referrals
  set status = 'void', updated_at = now()
  where id = reward.referral_id;

  return jsonb_build_object('ok', true, 'status', 'void', 'charged', false, 'sandbox', true);
end;
$$;

create or replace function public.mark_referral_reward_paid(p_reward uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reward public.referral_rewards%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to mark a reward paid';
  end if;
  select * into reward from public.referral_rewards where id = p_reward;
  if reward.id is null then
    raise exception 'Reward not found';
  end if;
  if not public.has_org_role(reward.org_id, array['agency_owner', 'agency_staff']) then
    raise exception 'not allowed';
  end if;
  if reward.sandbox is not true then
    raise exception 'live payouts are disabled';
  end if;
  if reward.status <> 'approved' then
    raise exception 'Approve the ledger entry first';
  end if;

  update public.referral_rewards
  set status = 'paid', paid_at = now(), updated_at = now(), sandbox = true
  where id = reward.id;
  update public.referrals
  set status = 'rewarded', updated_at = now()
  where id = reward.referral_id and status <> 'void';

  return jsonb_build_object('ok', true, 'status', 'paid', 'charged', false, 'sandbox', true);
end;
$$;

create or replace function public.save_referral_program_settings(p_org uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hold_days int;
  rtype text;
  credit bigint;
  pct numeric;
  months int;
  cash bigint;
  tiers jsonb;
  org_type text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to edit the referral programme';
  end if;
  select o.org_type into org_type from public.organizations o where o.id = p_org;
  if org_type is distinct from 'agency' then
    raise exception 'Programme settings belong on the agency workspace';
  end if;
  if not exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid() and m.org_id = p_org and m.role = 'agency_owner'
  ) then
    raise exception 'not allowed';
  end if;

  hold_days := coalesce((p_patch->>'hold_days')::int, 14);
  rtype := coalesce(p_patch->>'reward_type', 'account_credit');
  credit := coalesce((p_patch->>'account_credit_cents')::bigint, 50000);
  pct := coalesce((p_patch->>'percent_off')::numeric, 10);
  months := coalesce((p_patch->>'percent_off_months')::int, 1);
  cash := coalesce((p_patch->>'cash_commission_cents')::bigint, 25000);
  tiers := p_patch->'tiers';

  if hold_days < 0 or hold_days > 365 then
    raise exception 'Hold days must be between 0 and 365';
  end if;
  if rtype not in ('account_credit', 'percent_off_months', 'cash_commission') then
    raise exception 'Unknown reward type';
  end if;
  if credit < 0 or cash < 0 or pct < 0 or pct > 100 or months < 0 or months > 24 then
    raise exception 'Check the placeholder amounts';
  end if;
  if tiers is null or jsonb_typeof(tiers) <> 'array' then
    raise exception 'Add at least one tier';
  end if;

  insert into public.referral_program_settings (
    org_id, enabled, currency, hold_days, reward_type, account_credit_cents,
    percent_off, percent_off_months, cash_commission_cents, tiers, sandbox, updated_at
  ) values (
    p_org,
    coalesce((p_patch->>'enabled')::boolean, true),
    'ZAR',
    hold_days,
    rtype,
    credit,
    pct,
    months,
    cash,
    tiers,
    true,
    now()
  )
  on conflict (org_id) do update set
    enabled = excluded.enabled,
    hold_days = excluded.hold_days,
    reward_type = excluded.reward_type,
    account_credit_cents = excluded.account_credit_cents,
    percent_off = excluded.percent_off,
    percent_off_months = excluded.percent_off_months,
    cash_commission_cents = excluded.cash_commission_cents,
    tiers = excluded.tiers,
    sandbox = true,
    updated_at = now();

  return jsonb_build_object('ok', true, 'sandbox', true, 'charged', false, 'placeholder', true);
end;
$$;

alter table public.referral_program_settings enable row level security;
alter table public.referral_program_settings force row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_codes force row level security;
alter table public.referrals enable row level security;
alter table public.referrals force row level security;
alter table public.referral_rewards enable row level security;
alter table public.referral_rewards force row level security;

drop policy if exists referral_program_settings_read on public.referral_program_settings;
create policy referral_program_settings_read on public.referral_program_settings
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    or exists (
      select 1
      from public.organizations child
      where child.parent_id = referral_program_settings.org_id
        and child.id in (select public.accessible_org_ids())
    )
  );

drop policy if exists referral_codes_read on public.referral_codes;
create policy referral_codes_read on public.referral_codes
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    or user_id = auth.uid()
  );

drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists referral_rewards_read on public.referral_rewards;
create policy referral_rewards_read on public.referral_rewards
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

revoke all on public.referral_program_settings from public, anon, authenticated;
revoke all on public.referral_codes from public, anon, authenticated;
revoke all on public.referrals from public, anon, authenticated;
revoke all on public.referral_rewards from public, anon, authenticated;
grant select on public.referral_program_settings to authenticated;
grant select on public.referral_codes to authenticated;
grant select on public.referrals to authenticated;
grant select on public.referral_rewards to authenticated;

revoke all on function public.referral_code_key(text) from public;
revoke all on function public.generate_referral_code() from public;
revoke all on function public.referral_code_taken(text, uuid) from public;
revoke all on function public.record_referral_click(text, text, text) from public;
revoke all on function public.ensure_referral_code(uuid, text, text) from public;
revoke all on function public.attribute_referral_signup(text, uuid, text) from public;
revoke all on function public.attribute_referral_first_payment(uuid, timestamptz) from public;
revoke all on function public.referral_after_billing_event() from public;
revoke all on function public.approve_referral_reward(uuid) from public;
revoke all on function public.void_referral_reward(uuid) from public;
revoke all on function public.mark_referral_reward_paid(uuid) from public;
revoke all on function public.save_referral_program_settings(uuid, jsonb) from public;

grant execute on function public.record_referral_click(text, text, text) to anon, authenticated;
grant execute on function public.ensure_referral_code(uuid, text, text) to authenticated;
grant execute on function public.attribute_referral_signup(text, uuid, text) to authenticated;
grant execute on function public.approve_referral_reward(uuid) to authenticated;
grant execute on function public.void_referral_reward(uuid) to authenticated;
grant execute on function public.mark_referral_reward_paid(uuid) to authenticated;
grant execute on function public.save_referral_program_settings(uuid, jsonb) to authenticated;

do $referral_service$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.record_referral_click(text, text, text) to service_role;
    grant execute on function public.attribute_referral_first_payment(uuid, timestamptz) to service_role;
  end if;
end
$referral_service$;

do $referral_suspend$
begin
  if to_regprocedure('public.reject_if_workspace_suspended()') is null then
    return;
  end if;
  drop trigger if exists reject_suspended_write on public.referral_codes;
  drop trigger if exists reject_suspended_write on public.referrals;
  drop trigger if exists reject_suspended_write on public.referral_rewards;
  drop trigger if exists reject_suspended_write on public.referral_program_settings;
  create trigger reject_suspended_write
    before insert or update or delete on public.referral_codes
    for each row execute function public.reject_if_workspace_suspended();
  create trigger reject_suspended_write
    before insert or update or delete on public.referrals
    for each row execute function public.reject_if_workspace_suspended();
  create trigger reject_suspended_write
    before insert or update or delete on public.referral_rewards
    for each row execute function public.reject_if_workspace_suspended();
  create trigger reject_suspended_write
    before insert or update or delete on public.referral_program_settings
    for each row execute function public.reject_if_workspace_suspended();
end
$referral_suspend$;

insert into public.referral_program_settings (org_id)
select id from public.organizations
where slug = 'ai-autotech' and org_type = 'agency'
on conflict (org_id) do nothing;
