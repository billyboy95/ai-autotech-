-- Phase 4a: Bot Store.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Placeholder prices are to be confirmed by Billy. price_placeholder stays true.
-- Trials and buys are sandbox ledger lines. charged stays false.
-- This file does not call PayFast, Paystack, or Yoco, and it does not send.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.org_subscriptions') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.reject_if_workspace_suspended()') is null then
    raise exception 'phase 4a needs phase 2f billing; apply 20261019120000_phase2f_billing.sql first';
  end if;
  if to_regclass('public.pipelines') is null or to_regclass('public.pipeline_stages') is null then
    raise exception 'phase 4a needs phase 2c pipelines; apply 20261016120000_phase2c_snapshots.sql first';
  end if;
  if to_regclass('public.workflows') is null then
    raise exception 'phase 4a needs phase 2d workflows; apply 20261017120000_phase2d_workflows.sql first';
  end if;
end
$need$;

create table if not exists public.bot_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('sales', 'marketing', 'support', 'ops')),
  department text not null default 'sales' check (department in (
    'sales', 'marketing', 'branding', 'admin', 'operations', 'customer-service',
    'booking', 'finance', 'hr', 'onboarding', 'reputation', 'social', 'ads',
    'content', 'ecommerce', 'it-support'
  )),
  description text not null default '',
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  price_placeholder boolean not null default true,
  capabilities jsonb not null default '[]'::jsonb,
  default_config jsonb not null default '{}'::jsonb,
  engine text not null check (engine in ('workflows', 'ai_reply', 'outbox_draft', 'calendar')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_bundles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  bundle_price_cents integer,
  discount_percent numeric(5,2),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  price_placeholder boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint bot_bundles_price_present check (
    bundle_price_cents is not null or discount_percent is not null
  ),
  constraint bot_bundles_price_positive check (
    bundle_price_cents is null or bundle_price_cents > 0
  ),
  constraint bot_bundles_discount_range check (
    discount_percent is null or (discount_percent > 0 and discount_percent < 100)
  )
);

create table if not exists public.bot_bundle_items (
  bundle_id uuid not null references public.bot_bundles(id) on delete cascade,
  bot_slug text not null references public.bot_catalog(slug),
  position integer not null default 0,
  primary key (bundle_id, bot_slug)
);

create table if not exists public.org_bots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  bot_slug text not null references public.bot_catalog(slug),
  bundle_slug text references public.bot_bundles(slug),
  status text not null default 'trial' check (status in ('trial', 'active', 'paused', 'cancelled')),
  config jsonb not null default '{}'::jsonb,
  trial_ends_at timestamptz,
  subscription_id uuid references public.org_subscriptions(id) on delete set null,
  sandbox boolean not null default true check (sandbox),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, bot_slug)
);

create index if not exists org_bots_org_idx on public.org_bots (org_id, status);

create table if not exists public.org_bot_billing_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  org_bot_id uuid references public.org_bots(id) on delete cascade,
  subscription_id uuid references public.org_subscriptions(id) on delete set null,
  bot_slug text not null references public.bot_catalog(slug),
  bundle_slug text references public.bot_bundles(slug),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  interval text not null default 'month' check (interval = 'month'),
  status text not null default 'trial' check (status in ('trial', 'active', 'paused', 'cancelled')),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  price_placeholder boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, bot_slug)
);

create index if not exists org_bot_billing_lines_org_idx on public.org_bot_billing_lines (org_id, status);

create table if not exists public.bot_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  org_bot_id uuid references public.org_bots(id) on delete cascade,
  bot_slug text not null,
  kind text not null,
  status text not null,
  summary text not null default '',
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint bot_runs_drafts_only check (
    coalesce(output->>'outbox_status', '') not in ('queued', 'sent')
    and coalesce(output->>'status', '') not in ('queued', 'sent')
  )
);

create index if not exists bot_runs_org_created_idx on public.bot_runs (org_id, created_at desc);

create table if not exists public.bot_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  bundle_slug text references public.bot_bundles(slug),
  industry text,
  department text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint bot_templates_catalogue_only check (
    not (payload ? 'contacts')
    and not (payload ? 'messages')
    and not (payload ? 'secrets')
    and not (payload ? 'credentials')
  )
);

alter table public.bot_catalog add column if not exists department text;
alter table public.bot_templates add column if not exists industry text;
alter table public.bot_templates add column if not exists department text;

create or replace function public.bot_bundle_quoted_price(
  p_bundle_price integer,
  p_discount numeric,
  p_separate integer
) returns integer
language sql
immutable
as $$
  select case
    when p_bundle_price is not null then p_bundle_price
    when p_discount is not null and p_separate is not null then
      round(p_separate * (100 - p_discount) / 100.0)::integer
    else null
  end;
$$;

create or replace view public.bot_bundle_savings as
select
  b.id,
  b.slug,
  b.name,
  count(c.slug)::integer as bot_count,
  coalesce(sum(c.monthly_price_cents), 0)::integer as separate_total_cents,
  coalesce(max(c.monthly_price_cents), 0)::integer as max_bot_cents,
  public.bot_bundle_quoted_price(
    b.bundle_price_cents,
    b.discount_percent,
    coalesce(sum(c.monthly_price_cents), 0)::integer
  ) as bundle_price_cents,
  case
    when coalesce(sum(c.monthly_price_cents), 0) = 0 then 0
    else round((
      coalesce(sum(c.monthly_price_cents), 0)
      - public.bot_bundle_quoted_price(
        b.bundle_price_cents,
        b.discount_percent,
        coalesce(sum(c.monthly_price_cents), 0)::integer
      )
    ) * 100.0 / sum(c.monthly_price_cents))::integer
  end as saving_percent
from public.bot_bundles b
left join public.bot_bundle_items i on i.bundle_id = b.id
left join public.bot_catalog c on c.slug = i.bot_slug
group by b.id, b.slug, b.name, b.bundle_price_cents, b.discount_percent;

-- A bundle is a group discount: more than the dearest bot, less than buying each bot alone.
create or replace function public.assert_bot_bundle_discounts()
returns trigger
language plpgsql
as $$
declare
  rec record;
  quoted integer;
begin
  for rec in
    select
      b.slug,
      b.bundle_price_cents,
      b.discount_percent,
      count(c.slug)::integer as bot_count,
      coalesce(sum(c.monthly_price_cents), 0)::integer as separate_total,
      coalesce(max(c.monthly_price_cents), 0)::integer as max_bot
    from public.bot_bundles b
    left join public.bot_bundle_items i on i.bundle_id = b.id
    left join public.bot_catalog c on c.slug = i.bot_slug
    group by b.id
  loop
    if rec.separate_total = 0 then
      continue;
    end if;
    quoted := public.bot_bundle_quoted_price(rec.bundle_price_cents, rec.discount_percent, rec.separate_total);
    if rec.bot_count < 3 then
      if quoted is null or quoted <> rec.separate_total then
        raise exception 'bundle discount rule: % has no team discount until 3 agents', rec.slug
          using errcode = '23514';
      end if;
      if rec.bot_count > 1 and quoted <= rec.max_bot then
        raise exception 'bundle discount rule: % total must be greater than the most expensive bot', rec.slug
          using errcode = '23514';
      end if;
    elsif quoted is null or quoted <= rec.max_bot or quoted >= rec.separate_total then
      raise exception 'bundle discount rule: % total must be greater than the most expensive bot and less than the sum of its bots', rec.slug
        using errcode = '23514';
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists bot_bundle_items_discount on public.bot_bundle_items;
create trigger bot_bundle_items_discount
  after insert or update or delete on public.bot_bundle_items
  for each statement execute function public.assert_bot_bundle_discounts();

drop trigger if exists bot_bundles_discount on public.bot_bundles;
create trigger bot_bundles_discount
  after update on public.bot_bundles
  for each statement execute function public.assert_bot_bundle_discounts();

drop trigger if exists bot_catalog_price_discount on public.bot_catalog;
create trigger bot_catalog_price_discount
  after update of monthly_price_cents on public.bot_catalog
  for each statement execute function public.assert_bot_bundle_discounts();

-- Draft is the only new outbox status. Existing statuses stay valid. No rows are removed.
do $outbox$
declare
  constraint_name text;
begin
  if to_regclass('public.crm_outbox') is null then
    return;
  end if;
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'crm_outbox'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.crm_outbox drop constraint %I', constraint_name);
  end loop;
  alter table public.crm_outbox
    add constraint crm_outbox_status_check
    check (status in (
      'draft', 'queued', 'approved', 'sent', 'failed', 'cancelled', 'blocked', 'blocked_consent', 'held'
    ));
end
$outbox$;

alter table public.bot_catalog enable row level security;
alter table public.bot_catalog force row level security;
alter table public.bot_bundles enable row level security;
alter table public.bot_bundles force row level security;
alter table public.bot_bundle_items enable row level security;
alter table public.bot_bundle_items force row level security;
alter table public.bot_templates enable row level security;
alter table public.bot_templates force row level security;
alter table public.org_bots enable row level security;
alter table public.org_bots force row level security;
alter table public.org_bot_billing_lines enable row level security;
alter table public.org_bot_billing_lines force row level security;
alter table public.bot_runs enable row level security;
alter table public.bot_runs force row level security;

drop policy if exists bot_catalog_read on public.bot_catalog;
create policy bot_catalog_read on public.bot_catalog
  for select to authenticated
  using (true);

drop policy if exists bot_catalog_insert on public.bot_catalog;
create policy bot_catalog_insert on public.bot_catalog
  for insert to authenticated
  with check (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_catalog_update on public.bot_catalog;
create policy bot_catalog_update on public.bot_catalog
  for update to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_catalog_delete on public.bot_catalog;
create policy bot_catalog_delete on public.bot_catalog
  for delete to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_bundles_read on public.bot_bundles;
create policy bot_bundles_read on public.bot_bundles
  for select to authenticated
  using (true);

drop policy if exists bot_bundles_insert on public.bot_bundles;
create policy bot_bundles_insert on public.bot_bundles
  for insert to authenticated
  with check (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_bundles_update on public.bot_bundles;
create policy bot_bundles_update on public.bot_bundles
  for update to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_bundles_delete on public.bot_bundles;
create policy bot_bundles_delete on public.bot_bundles
  for delete to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_bundle_items_read on public.bot_bundle_items;
create policy bot_bundle_items_read on public.bot_bundle_items
  for select to authenticated
  using (true);

drop policy if exists bot_bundle_items_insert on public.bot_bundle_items;
create policy bot_bundle_items_insert on public.bot_bundle_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_bundle_items_update on public.bot_bundle_items;
create policy bot_bundle_items_update on public.bot_bundle_items
  for update to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_bundle_items_delete on public.bot_bundle_items;
create policy bot_bundle_items_delete on public.bot_bundle_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_templates_read on public.bot_templates;
create policy bot_templates_read on public.bot_templates
  for select to authenticated
  using (true);

drop policy if exists bot_templates_insert on public.bot_templates;
create policy bot_templates_insert on public.bot_templates
  for insert to authenticated
  with check (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_templates_update on public.bot_templates;
create policy bot_templates_update on public.bot_templates
  for update to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists bot_templates_delete on public.bot_templates;
create policy bot_templates_delete on public.bot_templates
  for delete to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.role = 'agency_owner'
    )
  );

drop policy if exists org_bots_read on public.org_bots;
create policy org_bots_read on public.org_bots
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists org_bots_insert on public.org_bots;
create policy org_bots_insert on public.org_bots
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists org_bots_update on public.org_bots;
create policy org_bots_update on public.org_bots
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists org_bots_delete on public.org_bots;
create policy org_bots_delete on public.org_bots
  for delete to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists org_bot_billing_lines_read on public.org_bot_billing_lines;
create policy org_bot_billing_lines_read on public.org_bot_billing_lines
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists org_bot_billing_lines_insert on public.org_bot_billing_lines;
create policy org_bot_billing_lines_insert on public.org_bot_billing_lines
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists org_bot_billing_lines_update on public.org_bot_billing_lines;
create policy org_bot_billing_lines_update on public.org_bot_billing_lines
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists org_bot_billing_lines_delete on public.org_bot_billing_lines;
create policy org_bot_billing_lines_delete on public.org_bot_billing_lines
  for delete to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists bot_runs_read on public.bot_runs;
create policy bot_runs_read on public.bot_runs
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists bot_runs_insert on public.bot_runs;
create policy bot_runs_insert on public.bot_runs
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists bot_runs_update on public.bot_runs;
create policy bot_runs_update on public.bot_runs
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists bot_runs_delete on public.bot_runs;
create policy bot_runs_delete on public.bot_runs
  for delete to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop trigger if exists reject_suspended_write on public.org_bots;
create trigger reject_suspended_write
  before insert or update or delete on public.org_bots
  for each row execute function public.reject_if_workspace_suspended();

drop trigger if exists reject_suspended_write on public.org_bot_billing_lines;
create trigger reject_suspended_write
  before insert or update or delete on public.org_bot_billing_lines
  for each row execute function public.reject_if_workspace_suspended();

drop trigger if exists reject_suspended_write on public.bot_runs;
create trigger reject_suspended_write
  before insert or update or delete on public.bot_runs
  for each row execute function public.reject_if_workspace_suspended();

create or replace function public.upsert_sandbox_bot_line(
  p_org uuid,
  p_bot_slug text,
  p_bundle_slug text,
  p_config jsonb,
  p_amount integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  bot_id uuid;
  sub_id uuid;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'amount required';
  end if;
  select id into sub_id from public.org_subscriptions where org_id = p_org;
  insert into public.org_bots (
    org_id, bot_slug, bundle_slug, status, config, trial_ends_at, subscription_id, sandbox
  ) values (
    p_org,
    p_bot_slug,
    p_bundle_slug,
    'trial',
    coalesce(p_config, '{}'::jsonb),
    now() + interval '14 days',
    sub_id,
    true
  )
  on conflict (org_id, bot_slug) do update set
    config = excluded.config,
    bundle_slug = coalesce(public.org_bots.bundle_slug, excluded.bundle_slug),
    updated_at = now()
  returning id into bot_id;

  insert into public.org_bot_billing_lines (
    org_id, org_bot_id, subscription_id, bot_slug, bundle_slug,
    amount_cents, currency, interval, status, sandbox, charged, price_placeholder
  ) values (
    p_org, bot_id, sub_id, p_bot_slug, p_bundle_slug,
    p_amount, 'ZAR', 'month', 'trial', true, false, true
  )
  on conflict (org_id, bot_slug) do update set
    amount_cents = case
      when public.org_bot_billing_lines.status = 'trial' then excluded.amount_cents
      else public.org_bot_billing_lines.amount_cents
    end,
    org_bot_id = excluded.org_bot_id,
    updated_at = now();

  return bot_id;
end;
$$;

create or replace function public.start_bot_sandbox_trial(
  p_org uuid,
  p_bot_slug text,
  p_bundle_slug text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  separate_total integer;
  bundle_price integer;
  running integer := 0;
  share integer;
  idx integer := 0;
  total integer := 0;
  created integer := 0;
  solo_price integer;
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if p_bundle_slug is not null and p_bundle_slug <> '' then
    select s.separate_total_cents, s.bundle_price_cents
      into separate_total, bundle_price
    from public.bot_bundle_savings s
    where s.slug = p_bundle_slug;
    if bundle_price is null or separate_total is null or separate_total = 0 then
      raise exception 'unknown bundle';
    end if;
    select count(*) into total
    from public.bot_bundle_items i
    join public.bot_bundles b on b.id = i.bundle_id
    where b.slug = p_bundle_slug;
    for rec in
      select c.slug, c.monthly_price_cents, c.default_config
      from public.bot_bundle_items i
      join public.bot_bundles b on b.id = i.bundle_id
      join public.bot_catalog c on c.slug = i.bot_slug
      where b.slug = p_bundle_slug
      order by c.slug
    loop
      idx := idx + 1;
      if idx < total then
        share := floor(bundle_price::numeric * rec.monthly_price_cents / separate_total)::integer;
        running := running + share;
      else
        share := bundle_price - running;
      end if;
      perform public.upsert_sandbox_bot_line(p_org, rec.slug, p_bundle_slug, rec.default_config, share);
      created := created + 1;
    end loop;
  else
    select c.monthly_price_cents into solo_price
    from public.bot_catalog c
    where c.slug = p_bot_slug and c.active;
    if solo_price is null then
      raise exception 'unknown bot';
    end if;
    perform public.upsert_sandbox_bot_line(
      p_org,
      p_bot_slug,
      null,
      (select default_config from public.bot_catalog where slug = p_bot_slug),
      solo_price
    );
    created := 1;
  end if;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'ok', true,
    'sandbox', true,
    'charged', false,
    'bots', created,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

create or replace function public.apply_bot_template(p_org uuid, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl public.bot_templates%rowtype;
  bot jsonb;
  pipe jsonb;
  stage jsonb;
  flow jsonb;
  pipeline_id uuid;
  slugs text[] := array[]::text[];
  prices integer[] := array[]::integer[];
  configs jsonb := '{}'::jsonb;
  v_slug text;
  price integer;
  separate_total integer := 0;
  bundle_price integer;
  running integer := 0;
  share integer;
  idx integer;
  bot_count integer;
  stage_count integer;
  workflow_count integer;
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  select * into tpl from public.bot_templates where slug = p_slug;
  if tpl.id is null then
    raise exception 'unknown bot template';
  end if;

  for bot in select value from jsonb_array_elements(coalesce(tpl.payload->'bots', '[]'::jsonb))
  loop
    v_slug := bot->>'slug';
    select c.monthly_price_cents into price from public.bot_catalog c where c.slug = v_slug;
    if price is null then
      raise exception 'unknown bot %', v_slug;
    end if;
    slugs := array_append(slugs, v_slug);
    prices := array_append(prices, price);
    separate_total := separate_total + price;
    configs := configs || jsonb_build_object(v_slug, coalesce(bot->'config', '{}'::jsonb));
  end loop;

  bot_count := cardinality(slugs);
  if bot_count = 0 then
    raise exception 'template has no bots';
  end if;

  select s.bundle_price_cents into bundle_price
  from public.bot_bundle_savings s
  where s.slug = tpl.bundle_slug;
  if bundle_price is null then
    bundle_price := separate_total;
  end if;

  for idx in 1..bot_count loop
    if idx < bot_count then
      share := floor(bundle_price::numeric * prices[idx] / separate_total)::integer;
      running := running + share;
    else
      share := bundle_price - running;
    end if;
    perform public.upsert_sandbox_bot_line(
      p_org,
      slugs[idx],
      tpl.bundle_slug,
      configs -> (slugs[idx]),
      share
    );
  end loop;

  for pipe in select value from jsonb_array_elements(coalesce(tpl.payload->'pipelines', '[]'::jsonb))
  loop
    insert into public.pipelines (org_id, asset_key, name, is_default)
    values (
      p_org,
      pipe->>'asset_key',
      pipe->>'name',
      coalesce((pipe->>'is_default')::boolean, false)
    )
    on conflict (org_id, asset_key) do update set
      name = excluded.name,
      updated_at = now()
    returning id into pipeline_id;

    for stage in select value from jsonb_array_elements(coalesce(pipe->'stages', '[]'::jsonb))
    loop
      insert into public.pipeline_stages (
        org_id, pipeline_id, asset_key, name, position, is_won, is_lost
      ) values (
        p_org,
        pipeline_id,
        stage->>'asset_key',
        stage->>'name',
        coalesce((stage->>'position')::integer, 1),
        coalesce((stage->>'is_won')::boolean, false),
        coalesce((stage->>'is_lost')::boolean, false)
      )
      on conflict (org_id, asset_key) do update set
        name = excluded.name,
        position = excluded.position,
        is_won = excluded.is_won,
        is_lost = excluded.is_lost,
        pipeline_id = excluded.pipeline_id,
        updated_at = now();
    end loop;
  end loop;

  for flow in select value from jsonb_array_elements(coalesce(tpl.payload->'workflows', '[]'::jsonb))
  loop
    insert into public.workflows (
      org_id, asset_key, name, active, trigger_type, trigger, definition
    ) values (
      p_org,
      flow->>'asset_key',
      flow->>'name',
      false,
      flow->>'trigger_type',
      coalesce(flow->'trigger', '{}'::jsonb),
      jsonb_build_object('steps', coalesce(flow->'steps', '[]'::jsonb))
    )
    on conflict (org_id, asset_key) do update set
      name = excluded.name,
      definition = excluded.definition,
      active = false,
      updated_at = now();
  end loop;

  select count(*)::integer into stage_count
  from public.pipeline_stages
  where org_id = p_org and asset_key like 'stage:bot:%';

  select count(*)::integer into workflow_count
  from public.workflows
  where org_id = p_org and asset_key like 'workflow:bot:%';

  select o.sending_enabled into sending
  from public.organizations o
  where o.id = p_org;

  return jsonb_build_object(
    'ok', true,
    'sandbox', true,
    'charged', false,
    'sending_enabled', coalesce(sending, false),
    'template', p_slug,
    'bots', bot_count,
    'stage_count', stage_count,
    'workflow_count', workflow_count,
    'copied_contacts', false,
    'copied_messages', false,
    'copied_secrets', false
  );
end;
$$;

-- Bot output is a draft row. This function cannot queue or send.
create or replace function public.record_bot_outbox_draft(
  p_org uuid,
  p_bot_slug text,
  p_summary text,
  p_body text,
  p_channel text,
  p_lead_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bot_id uuid;
  has_lead boolean;
  has_org boolean;
  outbox_id text;
  v_channel text;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;
  if coalesce(p_body, '') = '' then
    raise exception 'draft body required';
  end if;

  v_channel := case
    when p_channel in ('whatsapp', 'email', 'sms') then p_channel
    else 'whatsapp'
  end;

  select id into bot_id
  from public.org_bots
  where org_id = p_org and bot_slug = p_bot_slug;

  if to_regclass('public.crm_outbox') is not null then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'lead_id'
    ) into has_lead;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'org_id'
    ) into has_org;
    outbox_id := 'botdraft_' || replace(gen_random_uuid()::text, '-', '');
    if has_lead and coalesce(p_lead_id, '') = '' then
      outbox_id := null;
    elsif has_lead and has_org then
      insert into public.crm_outbox (id, lead_id, channel, body, status, org_id)
      values (outbox_id, p_lead_id, v_channel, p_body, 'draft', p_org);
    elsif has_lead then
      insert into public.crm_outbox (id, lead_id, channel, body, status)
      values (outbox_id, p_lead_id, v_channel, p_body, 'draft');
    elsif has_org then
      insert into public.crm_outbox (id, org_id, channel, body, status)
      values (outbox_id, p_org, v_channel, p_body, 'draft');
    else
      insert into public.crm_outbox (id, channel, body, status)
      values (outbox_id, v_channel, p_body, 'draft');
    end if;
  end if;

  insert into public.bot_runs (org_id, org_bot_id, bot_slug, kind, status, summary, output)
  values (
    p_org,
    bot_id,
    p_bot_slug,
    'outbox_draft',
    'drafted',
    coalesce(p_summary, 'Draft only. Nothing was sent.'),
    jsonb_build_object(
      'kind', 'draft',
      'outbox_status', 'draft',
      'outbox_id', outbox_id,
      'channel', v_channel
    )
  );

  return jsonb_build_object(
    'ok', true,
    'outbox_status', 'draft',
    'outbox_id', outbox_id,
    'sandbox', true,
    'charged', false,
    'queued', false,
    'sent', false
  );
end;
$$;

create or replace function public.start_recommended_sandbox_team(
  p_org uuid,
  p_slugs text[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_price integer;
  v_config jsonb;
  prices integer[] := array[]::integer[];
  configs jsonb[] := array[]::jsonb[];
  ordered text[] := array[]::text[];
  separate_total integer := 0;
  max_price integer := 0;
  bundle_price integer;
  running integer := 0;
  share integer;
  idx integer;
  n integer;
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if p_slugs is null or cardinality(p_slugs) < 1 or cardinality(p_slugs) > 8 then
    raise exception 'team required';
  end if;

  for v_slug in
    select distinct u.slug
    from unnest(p_slugs) as u(slug)
    where u.slug is not null and u.slug <> ''
    order by u.slug
  loop
    select c.monthly_price_cents, c.default_config into v_price, v_config
    from public.bot_catalog c
    where c.slug = v_slug and c.active;
    if v_price is null then
      raise exception 'unknown bot';
    end if;
    ordered := array_append(ordered, v_slug);
    prices := array_append(prices, v_price);
    configs := array_append(configs, v_config);
    separate_total := separate_total + v_price;
    if v_price > max_price then
      max_price := v_price;
    end if;
  end loop;

  n := cardinality(ordered);
  if n < 1 then
    raise exception 'team required';
  end if;

  if n < 3 then
    bundle_price := separate_total;
  else
    bundle_price := separate_total - round(separate_total * public.team_discount_percent(n) / 100.0)::integer;
    if bundle_price <= max_price or bundle_price >= separate_total then
      raise exception 'bundle discount rule';
    end if;
  end if;

  for idx in 1..n loop
    if idx < n then
      share := floor(bundle_price::numeric * prices[idx] / separate_total)::integer;
      running := running + share;
    else
      share := bundle_price - running;
    end if;
    perform public.upsert_sandbox_bot_line(p_org, ordered[idx], null, configs[idx], share);
  end loop;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'ok', true,
    'sandbox', true,
    'charged', false,
    'bots', n,
    'amount_cents', bundle_price,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

-- Public team links. The token is the only lookup key. Existing audit rows are left in place.
do $audit_token$
begin
  if to_regclass('public.crm_audit_leads') is not null then
    alter table public.crm_audit_leads add column if not exists share_token text;
    create unique index if not exists crm_audit_leads_share_token_idx on public.crm_audit_leads (share_token);
  end if;
end
$audit_token$;

revoke all on function public.bot_bundle_quoted_price(integer, numeric, integer) from public, anon;
revoke all on function public.assert_bot_bundle_discounts() from public, anon;
revoke all on function public.upsert_sandbox_bot_line(uuid, text, text, jsonb, integer) from public, anon;
revoke all on function public.start_bot_sandbox_trial(uuid, text, text) from public, anon;
revoke all on function public.apply_bot_template(uuid, text) from public, anon;
revoke all on function public.record_bot_outbox_draft(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.start_recommended_sandbox_team(uuid, text[]) from public, anon;

grant execute on function public.start_bot_sandbox_trial(uuid, text, text) to authenticated;
grant execute on function public.apply_bot_template(uuid, text) to authenticated;
grant execute on function public.record_bot_outbox_draft(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.start_recommended_sandbox_team(uuid, text[]) to authenticated;

revoke all on public.bot_catalog from public, anon;
revoke all on public.bot_bundles from public, anon;
revoke all on public.bot_bundle_items from public, anon;
revoke all on public.bot_templates from public, anon;
revoke all on public.org_bots from public, anon;
revoke all on public.org_bot_billing_lines from public, anon;
revoke all on public.bot_runs from public, anon;
revoke all on public.bot_bundle_savings from public, anon;

grant select, insert, update, delete on public.bot_catalog to authenticated;
grant select, insert, update, delete on public.bot_bundles to authenticated;
grant select, insert, update, delete on public.bot_bundle_items to authenticated;
grant select, insert, update, delete on public.bot_templates to authenticated;
grant select, insert, update, delete on public.org_bots to authenticated;
grant select, insert, update, delete on public.org_bot_billing_lines to authenticated;
grant select, insert, update, delete on public.bot_runs to authenticated;
grant select on public.bot_bundle_savings to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.bot_catalog to service_role;
    grant select, insert, update, delete on public.bot_bundles to service_role;
    grant select, insert, update, delete on public.bot_bundle_items to service_role;
    grant select, insert, update, delete on public.bot_templates to service_role;
    grant select, insert, update, delete on public.org_bots to service_role;
    grant select, insert, update, delete on public.org_bot_billing_lines to service_role;
    grant select, insert, update, delete on public.bot_runs to service_role;
    grant select on public.bot_bundle_savings to service_role;
    grant execute on function public.start_bot_sandbox_trial(uuid, text, text) to service_role;
    grant execute on function public.apply_bot_template(uuid, text) to service_role;
    grant execute on function public.record_bot_outbox_draft(uuid, text, text, text, text, text) to service_role;
    grant execute on function public.start_recommended_sandbox_team(uuid, text[]) to service_role;
  end if;
end
$service_grants$;

-- Price sheet. Numbers are seeded from src/lib/pricing/price-sheet.ts. All rows stay placeholders.
create table if not exists public.pricing_sheet (
  key text primary key,
  amount_cents integer,
  quantity numeric,
  percent numeric,
  price_placeholder boolean not null default true,
  note text not null default ''
);

alter table public.pricing_sheet enable row level security;
drop policy if exists pricing_sheet_read on public.pricing_sheet;
create policy pricing_sheet_read on public.pricing_sheet
  for select to authenticated
  using (true);

revoke all on public.pricing_sheet from public, anon;
grant select on public.pricing_sheet to authenticated;

create or replace function public.team_discount_percent(p_count integer)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce((
    select percent
    from public.pricing_sheet
    where key = case
      when p_count >= 10 then 'discount_10'
      when p_count >= 5 then 'discount_5'
      when p_count >= 3 then 'discount_3'
      else ''
    end
  ), 0);
$$;

revoke all on function public.team_discount_percent(integer) from public, anon;
grant execute on function public.team_discount_percent(integer) to authenticated;

-- Placeholder prices, to be confirmed by Billy.
-- Seed is generated from src/lib/pricing/price-sheet.ts. Agents and bots are the same catalogue.
do $seed$
begin
  insert into public.pricing_sheet (key, amount_cents, quantity, percent, price_placeholder, note)
  values
    ('platform_fee', 29900, 2, null, true, 'Platform fee. CRM, Lead Agent, and the hour pool.'),
    ('tier_starter', 69900, 5, null, true, 'Starter agent.'),
    ('tier_pro', 149900, 12, null, true, 'Pro agent.'),
    ('tier_always_on', 499900, 40, null, true, 'Always-On agent. 24/7, active hours capped.'),
    ('discount_3', null, 3, 10, true, 'Team discount from 3 agents.'),
    ('discount_5', null, 5, 15, true, 'Team discount from 5 agents.'),
    ('discount_10', null, 10, 20, true, 'Team discount from 10 agents.'),
    ('topup_10h', 79900, 10, null, true, 'Computer-time top-up.'),
    ('premium_model_multiplier', null, 2.5, null, true, 'Premium models use hours faster, or bring your own key.'),
    ('send_markup', null, null, 0, true, 'Per-send markup on WhatsApp, SMS, and email.'),
    ('setup_fee', 0, null, null, true, 'Once-off setup fee. Per template in the price sheet.')
  on conflict (key) do update set
    amount_cents = excluded.amount_cents,
    quantity = excluded.quantity,
    percent = excluded.percent,
    price_placeholder = true,
    note = excluded.note;

  insert into public.bot_catalog (
    slug, name, category, department, description, monthly_price_cents, currency, price_placeholder,
    capabilities, default_config, engine, active
  ) values
    (
      $q$inbound-lead$q$, $q$Inbound Lead$q$, $q$sales$q$, $q$sales$q$,
      $q$Assigns a new lead and saves an AI reply draft. Nothing is sent.$q$,
      149900, 'ZAR', true,
      $q$["assign-lead","ai-draft","workflow"]$q$::jsonb,
      $q${"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$outbound-sales$q$, $q$Outbound Sales$q$, $q$sales$q$, $q$sales$q$,
      $q$Drafts outreach after consent and suppression checks. Nothing is sent.$q$,
      149900, 'ZAR', true,
      $q$["outbox-draft","consent-check"]$q$::jsonb,
      $q${"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:contacted","channel":"whatsapp"}$q$::jsonb,
      $q$outbox_draft$q$, true
    ),
    (
      $q$proposal-writer$q$, $q$Proposal Writer$q$, $q$sales$q$, $q$sales$q$,
      $q$Drafts a proposal note for the open deal. Nothing is sent.$q$,
      149900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:proposal","channel":"email"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$campaign-planner$q$, $q$Campaign Planner$q$, $q$marketing$q$, $q$marketing$q$,
      $q$Plans a campaign and saves a task. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task","workflow"]$q$::jsonb,
      $q${"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$email-nurture$q$, $q$Email Nurture$q$, $q$marketing$q$, $q$marketing$q$,
      $q$Drafts a nurture email after consent checks. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["outbox-draft","consent-check"]$q$::jsonb,
      $q${"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:draft","channel":"email"}$q$::jsonb,
      $q$outbox_draft$q$, true
    ),
    (
      $q$offer-manager$q$, $q$Offer Manager$q$, $q$marketing$q$, $q$marketing$q$,
      $q$Drafts an offer for the current campaign. Nothing is published.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:review","channel":"email"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$brand-voice$q$, $q$Brand Voice$q$, $q$marketing$q$, $q$branding$q$,
      $q$Drafts lines in the brand voice. Nothing is published.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"on brand","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:branding","stage":"stage:bot:branding:new","channel":"social"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$visual-brief$q$, $q$Visual Brief$q$, $q$marketing$q$, $q$branding$q$,
      $q$Writes a visual brief as a task. Nothing is published.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"precise","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:branding","stage":"stage:bot:branding:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$brand-guidelines$q$, $q$Brand Guidelines$q$, $q$marketing$q$, $q$branding$q$,
      $q$Keeps a guidelines checklist as a task. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:branding","stage":"stage:bot:branding:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$inbox-clerk$q$, $q$Inbox Clerk$q$, $q$ops$q$, $q$admin$q$,
      $q$Sorts the inbox into a task list. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:admin","stage":"stage:bot:admin:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$document-admin$q$, $q$Document Admin$q$, $q$ops$q$, $q$admin$q$,
      $q$Tracks missing documents as tasks. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"careful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:admin","stage":"stage:bot:admin:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$calendar-admin$q$, $q$Calendar Admin$q$, $q$ops$q$, $q$admin$q$,
      $q$Drafts a scheduling note and a task. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task","calendar-link"]$q$::jsonb,
      $q${"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:admin","stage":"stage:bot:admin:new","channel":"email"}$q$::jsonb,
      $q$calendar$q$, true
    ),
    (
      $q$ops-coordinator$q$, $q$Operations Coordinator$q$, $q$ops$q$, $q$operations$q$,
      $q$Opens an operations task for the next handoff. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task","workflow"]$q$::jsonb,
      $q${"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:operations","stage":"stage:bot:operations:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$vendor-followup$q$, $q$Vendor Follow-up$q$, $q$ops$q$, $q$operations$q$,
      $q$Drafts a vendor follow-up after consent checks. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["outbox-draft","consent-check"]$q$::jsonb,
      $q${"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:operations","stage":"stage:bot:operations:new","channel":"email"}$q$::jsonb,
      $q$outbox_draft$q$, true
    ),
    (
      $q$sop-keeper$q$, $q$SOP Keeper$q$, $q$ops$q$, $q$operations$q$,
      $q$Turns a repeat job into a checklist task. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:operations","stage":"stage:bot:operations:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$support-replies$q$, $q$Support Replies$q$, $q$support$q$, $q$customer-service$q$,
      $q$Drafts a support reply. Nothing is sent.$q$,
      499900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"calm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:customer-service","stage":"stage:bot:customer-service:new","channel":"whatsapp"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$complaint-handler$q$, $q$Complaint Handler$q$, $q$support$q$, $q$customer-service$q$,
      $q$Drafts a complaint reply and a task for a person. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft","task"]$q$::jsonb,
      $q${"tone":"careful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:customer-service","stage":"stage:bot:customer-service:new","channel":"email"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$faq-drafts$q$, $q$FAQ Drafts$q$, $q$support$q$, $q$customer-service$q$,
      $q$Drafts an answer from the usual questions. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:customer-service","stage":"stage:bot:customer-service:new","channel":"email"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$receptionist$q$, $q$Receptionist$q$, $q$support$q$, $q$booking$q$,
      $q$Drafts a booking reply and a front-desk task. Nothing is sent.$q$,
      499900, 'ZAR', true,
      $q$["calendar-link","task","ai-draft"]$q$::jsonb,
      $q${"tone":"warm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}$q$::jsonb,
      $q$calendar$q$, true
    ),
    (
      $q$reminder-drafts$q$, $q$Reminder Drafts$q$, $q$support$q$, $q$booking$q$,
      $q$Drafts an appointment reminder after consent checks. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["outbox-draft","consent-check","calendar-link"]$q$::jsonb,
      $q${"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}$q$::jsonb,
      $q$outbox_draft$q$, true
    ),
    (
      $q$waitlist$q$, $q$Waitlist$q$, $q$support$q$, $q$booking$q$,
      $q$Keeps a waitlist task when the diary is full. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$invoice-drafts$q$, $q$Invoice Drafts$q$, $q$ops$q$, $q$finance$q$,
      $q$Drafts an invoice note as a task. Nothing is charged and nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"formal","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:finance","stage":"stage:bot:finance:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$bookkeeping-notes$q$, $q$Bookkeeping Notes$q$, $q$ops$q$, $q$finance$q$,
      $q$Files a bookkeeping task for the month. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"precise","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:finance","stage":"stage:bot:finance:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$payment-chase$q$, $q$Payment Chase$q$, $q$ops$q$, $q$finance$q$,
      $q$Drafts a payment reminder after consent checks. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["outbox-draft","consent-check"]$q$::jsonb,
      $q${"tone":"polite","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:finance","stage":"stage:bot:finance:new","channel":"email"}$q$::jsonb,
      $q$outbox_draft$q$, true
    ),
    (
      $q$recruiter-screen$q$, $q$Recruiter Screen$q$, $q$ops$q$, $q$hr$q$,
      $q$Drafts a screening note and a task. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft","task"]$q$::jsonb,
      $q${"tone":"neutral","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:hr","stage":"stage:bot:hr:new","channel":"email"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$interview-scheduler$q$, $q$Interview Scheduler$q$, $q$ops$q$, $q$hr$q$,
      $q$Drafts an interview time and a booking link. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["calendar-link","task"]$q$::jsonb,
      $q${"tone":"warm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:hr","stage":"stage:bot:hr:new","channel":"email"}$q$::jsonb,
      $q$calendar$q$, true
    ),
    (
      $q$people-onboarding$q$, $q$People Onboarding$q$, $q$ops$q$, $q$hr$q$,
      $q$Creates a new-hire checklist task. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:hr","stage":"stage:bot:hr:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$onboarding$q$, $q$Onboarding$q$, $q$sales$q$, $q$onboarding$q$,
      $q$Creates onboarding tasks and a booking-link draft. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task","calendar-link","workflow"]$q$::jsonb,
      $q${"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:won","channel":"email"}$q$::jsonb,
      $q$calendar$q$, true
    ),
    (
      $q$kickoff-tasks$q$, $q$Kickoff Tasks$q$, $q$sales$q$, $q$onboarding$q$,
      $q$Opens the kickoff task list for a new client. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task","workflow"]$q$::jsonb,
      $q${"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:onboarding","stage":"stage:bot:onboarding:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$handover-checklist$q$, $q$Handover Checklist$q$, $q$sales$q$, $q$onboarding$q$,
      $q$Writes the handover checklist as a task. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:onboarding","stage":"stage:bot:onboarding:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$review-requests$q$, $q$Review Requests$q$, $q$support$q$, $q$reputation$q$,
      $q$Drafts a review request after consent checks. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["outbox-draft","consent-check"]$q$::jsonb,
      $q${"tone":"grateful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"whatsapp"}$q$::jsonb,
      $q$outbox_draft$q$, true
    ),
    (
      $q$review-replies$q$, $q$Review Replies$q$, $q$support$q$, $q$reputation$q$,
      $q$Drafts a reply to a public review. Nothing is posted.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"grateful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"social"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$rating-watch$q$, $q$Rating Watch$q$, $q$support$q$, $q$reputation$q$,
      $q$Opens a task when a rating needs a person. Nothing is posted.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"calm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$social-posting$q$, $q$Social Media Posting$q$, $q$marketing$q$, $q$social$q$,
      $q$Drafts social posts only. Nothing is published.$q$,
      69900, 'ZAR', true,
      $q$["social-post-draft"]$q$::jsonb,
      $q${"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"social"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$community-replies$q$, $q$Community Replies$q$, $q$marketing$q$, $q$social$q$,
      $q$Drafts a reply to a comment. Nothing is published.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$content-calendar$q$, $q$Content Calendar$q$, $q$marketing$q$, $q$social$q$,
      $q$Files the week's posts as tasks. Nothing is published.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"bright","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$ads$q$, $q$Ads$q$, $q$marketing$q$, $q$ads$q$,
      $q$Drafts ad copy only. Nothing is published.$q$,
      149900, 'ZAR', true,
      $q$["ad-copy-draft"]$q$::jsonb,
      $q${"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:draft","channel":"ads"}$q$::jsonb,
      $q$outbox_draft$q$, true
    ),
    (
      $q$search-copy$q$, $q$Search Copy$q$, $q$marketing$q$, $q$ads$q$,
      $q$Drafts search ad lines. Nothing is published.$q$,
      149900, 'ZAR', true,
      $q$["ad-copy-draft"]$q$::jsonb,
      $q${"tone":"tight","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:ads","stage":"stage:bot:ads:new","channel":"ads"}$q$::jsonb,
      $q$outbox_draft$q$, true
    ),
    (
      $q$retargeting-copy$q$, $q$Retargeting Copy$q$, $q$marketing$q$, $q$ads$q$,
      $q$Drafts retargeting copy. Nothing is published.$q$,
      149900, 'ZAR', true,
      $q$["ad-copy-draft"]$q$::jsonb,
      $q${"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:ads","stage":"stage:bot:ads:new","channel":"ads"}$q$::jsonb,
      $q$outbox_draft$q$, true
    ),
    (
      $q$blog-drafts$q$, $q$Blog Drafts$q$, $q$marketing$q$, $q$content$q$,
      $q$Drafts a short article. Nothing is published.$q$,
      149900, 'ZAR', true,
      $q$["content-draft"]$q$::jsonb,
      $q${"tone":"useful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$newsletter-drafts$q$, $q$Newsletter Drafts$q$, $q$marketing$q$, $q$content$q$,
      $q$Drafts a newsletter after consent checks. Nothing is sent.$q$,
      149900, 'ZAR', true,
      $q$["outbox-draft","consent-check"]$q$::jsonb,
      $q${"tone":"warm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}$q$::jsonb,
      $q$outbox_draft$q$, true
    ),
    (
      $q$case-study$q$, $q$Case Study$q$, $q$marketing$q$, $q$content$q$,
      $q$Drafts a case study outline as a task. Nothing is published.$q$,
      149900, 'ZAR', true,
      $q$["task","content-draft"]$q$::jsonb,
      $q${"tone":"specific","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$order-status$q$, $q$Order Status$q$, $q$ops$q$, $q$ecommerce$q$,
      $q$Drafts an order update. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:ecommerce","stage":"stage:bot:ecommerce:new","channel":"email"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$fulfilment-tasks$q$, $q$Fulfilment Tasks$q$, $q$ops$q$, $q$ecommerce$q$,
      $q$Opens a fulfilment task for an order. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:ecommerce","stage":"stage:bot:ecommerce:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$returns-drafts$q$, $q$Returns Drafts$q$, $q$ops$q$, $q$ecommerce$q$,
      $q$Drafts a returns reply. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"fair","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:ecommerce","stage":"stage:bot:ecommerce:new","channel":"email"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$ticket-triage$q$, $q$Ticket Triage$q$, $q$support$q$, $q$it-support$q$,
      $q$Turns a support note into a task. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"calm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:it-support","stage":"stage:bot:it-support:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$password-help$q$, $q$Password Help$q$, $q$support$q$, $q$it-support$q$,
      $q$Drafts password-reset steps. Nothing is sent and no secret is stored.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:it-support","stage":"stage:bot:it-support:new","channel":"email"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$status-notes$q$, $q$Status Notes$q$, $q$support$q$, $q$it-support$q$,
      $q$Writes an internal status task. Nothing is sent.$q$,
      69900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:it-support","stage":"stage:bot:it-support:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$scriptwriter$q$, $q$Scriptwriter$q$, $q$marketing$q$, $q$content$q$,
      $q$Drafts a script. Nothing is published.$q$,
      149900, 'ZAR', true,
      $q$["content-draft"]$q$::jsonb,
      $q${"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$video-editor-brief$q$, $q$Video Editor Brief$q$, $q$marketing$q$, $q$content$q$,
      $q$Writes an editor brief as a task. Nothing is published.$q$,
      149900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"precise","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$thumbnail-brief$q$, $q$Thumbnail Brief$q$, $q$marketing$q$, $q$content$q$,
      $q$Writes a thumbnail and design brief as a task. Nothing is published.$q$,
      149900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"visual","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$seo-titles$q$, $q$SEO Titles$q$, $q$marketing$q$, $q$content$q$,
      $q$Drafts titles and search lines. Nothing is published.$q$,
      149900, 'ZAR', true,
      $q$["content-draft"]$q$::jsonb,
      $q${"tone":"tight","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$scheduler-poster$q$, $q$Scheduler$q$, $q$marketing$q$, $q$social$q$,
      $q$Files a posting slot and a draft. Nothing is published.$q$,
      69900, 'ZAR', true,
      $q$["social-post-draft","task"]$q$::jsonb,
      $q${"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}$q$::jsonb,
      $q$workflows$q$, true
    ),
    (
      $q$community-manager$q$, $q$Community Manager$q$, $q$marketing$q$, $q$social$q$,
      $q$Drafts a community reply. Nothing is published.$q$,
      69900, 'ZAR', true,
      $q$["ai-draft"]$q$::jsonb,
      $q${"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}$q$::jsonb,
      $q$ai_reply$q$, true
    ),
    (
      $q$content-analytics$q$, $q$Content Analytics$q$, $q$marketing$q$, $q$content$q$,
      $q$Writes a performance note as a task. Nothing is sent.$q$,
      149900, 'ZAR', true,
      $q$["task"]$q$::jsonb,
      $q${"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}$q$::jsonb,
      $q$workflows$q$, true
    )
  on conflict (slug) do update set
    name = excluded.name,
    category = excluded.category,
    department = excluded.department,
    description = excluded.description,
    monthly_price_cents = excluded.monthly_price_cents,
    currency = excluded.currency,
    price_placeholder = true,
    capabilities = excluded.capabilities,
    default_config = excluded.default_config,
    engine = excluded.engine,
    active = excluded.active;

  insert into public.bot_bundles (slug, name, description, bundle_price_cents, discount_percent, currency, price_placeholder)
  values
    (
      $q$sales-team$q$, $q$Sales Team$q$,
      $q$Inbound Lead, Outbound Sales, and Onboarding as one team. Placeholder price, to be confirmed by Billy.$q$,
      332730, 10, 'ZAR', true
    ),
    (
      $q$marketing-team$q$, $q$Marketing Team$q$,
      $q$Ads and Social Media Posting as one team. Placeholder price, to be confirmed by Billy.$q$,
      219800, null, 'ZAR', true
    ),
    (
      $q$admin-team$q$, $q$Admin Team$q$,
      $q$Inbox, documents, and calendar admin as one team. Placeholder price, to be confirmed by Billy.$q$,
      188730, 10, 'ZAR', true
    ),
    (
      $q$operations-team$q$, $q$Operations Team$q$,
      $q$Coordination, vendors, and SOPs as one team. Placeholder price, to be confirmed by Billy.$q$,
      188730, 10, 'ZAR', true
    ),
    (
      $q$full-business$q$, $q$Full Business$q$,
      $q$Sales and marketing agents together. Placeholder price, to be confirmed by Billy.$q$,
      501075, 15, 'ZAR', true
    ),
    (
      $q$healthcare-clinic$q$, $q$Healthcare / clinic$q$,
      $q$Reception, reminders, patient admin, reviews, operations, and billing. Not a sales team. Placeholder price, to be confirmed by Billy.$q$,
      721990, 15, 'ZAR', true
    ),
    (
      $q$fashion-brand$q$, $q$Clothing / fashion$q$,
      $q$Branding, sales, marketing, social, ads, fulfilment, and customer service. Placeholder price, to be confirmed by Billy.$q$,
      917405, 15, 'ZAR', true
    ),
    (
      $q$restaurant-food$q$, $q$Restaurant / food$q$,
      $q$Reception, reminders, reviews, social, and offers. Placeholder price, to be confirmed by Billy.$q$,
      662575, 15, 'ZAR', true
    ),
    (
      $q$real-estate$q$, $q$Real estate$q$,
      $q$Inbound, outbound, proposals, reminders, and reviews. Placeholder price, to be confirmed by Billy.$q$,
      501075, 15, 'ZAR', true
    ),
    (
      $q$education-school$q$, $q$Education / school$q$,
      $q$Admissions desk, documents, reminders, onboarding, and reviews. Uses the Education admissions stages. Placeholder price, to be confirmed by Billy.$q$,
      662575, 15, 'ZAR', true
    ),
    (
      $q$beauty-salon$q$, $q$Beauty / salon / spa$q$,
      $q$Reception, reminders, reviews, social, and brand voice. Placeholder price, to be confirmed by Billy.$q$,
      662575, 15, 'ZAR', true
    ),
    (
      $q$fitness-gym$q$, $q$Fitness / gym$q$,
      $q$Leads, reception, reminders, social, and reviews. Placeholder price, to be confirmed by Billy.$q$,
      730575, 15, 'ZAR', true
    ),
    (
      $q$legal-services$q$, $q$Legal / professional services$q$,
      $q$Intake, documents, diary, invoices, and onboarding. Placeholder price, to be confirmed by Billy.$q$,
      365075, 15, 'ZAR', true
    ),
    (
      $q$trades-home$q$, $q$Trades / home services$q$,
      $q$Leads, reception, reminders, invoices, and reviews. Placeholder price, to be confirmed by Billy.$q$,
      730575, 15, 'ZAR', true
    ),
    (
      $q$automotive$q$, $q$Automotive$q$,
      $q$Leads, reception, reminders, reviews, and invoices. Placeholder price, to be confirmed by Billy.$q$,
      730575, 15, 'ZAR', true
    ),
    (
      $q$ecommerce-store$q$, $q$Ecommerce store$q$,
      $q$Orders, fulfilment, returns, support, ads, and social. Placeholder price, to be confirmed by Billy.$q$,
      789990, 15, 'ZAR', true
    ),
    (
      $q$agency-consulting$q$, $q$Agency / consulting$q$,
      $q$Inbound, outbound, proposals, onboarding, invoices, and content. Placeholder price, to be confirmed by Billy.$q$,
      628490, 15, 'ZAR', true
    ),
    (
      $q$faceless-youtube$q$, $q$Faceless YouTube$q$,
      $q$Scripts, edit briefs, thumbnails, titles, scheduling, and analytics. Placeholder price, to be confirmed by Billy.$q$,
      696490, 15, 'ZAR', true
    ),
    (
      $q$facebook-community$q$, $q$Facebook page / community$q$,
      $q$Community, scheduling, scripts, titles, analytics, and a content calendar. Placeholder price, to be confirmed by Billy.$q$,
      560490, 15, 'ZAR', true
    ),
    (
      $q$tiktok-reels$q$, $q$TikTok / Reels$q$,
      $q$Scripts, edit briefs, thumbnails, scheduling, and community replies. Placeholder price, to be confirmed by Billy.$q$,
      501075, 15, 'ZAR', true
    ),
    (
      $q$podcast$q$, $q$Podcast$q$,
      $q$Scripts, titles, scheduling, community, and analytics. Placeholder price, to be confirmed by Billy.$q$,
      501075, 15, 'ZAR', true
    ),
    (
      $q$personal-brand$q$, $q$Personal brand$q$,
      $q$Scripts, brand voice, scheduling, community, and titles. Placeholder price, to be confirmed by Billy.$q$,
      433075, 15, 'ZAR', true
    ),
    (
      $q$ai-automation-agency$q$, $q$AI agency / automation agency$q$,
      $q$The AI AutoTech shape: inbound, outbound, proposals, onboarding, ads, social, support, and content. Placeholder price, to be confirmed by Billy.$q$,
      1180820, 15, 'ZAR', true
    )
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    bundle_price_cents = excluded.bundle_price_cents,
    discount_percent = excluded.discount_percent,
    price_placeholder = true;

  insert into public.bot_bundle_items (bundle_id, bot_slug, position)
  select b.id, item.bot_slug, item.position
  from public.bot_bundles b
  join (
    values
      ($q$sales-team$q$, $q$inbound-lead$q$, 1),
      ($q$sales-team$q$, $q$outbound-sales$q$, 2),
      ($q$sales-team$q$, $q$onboarding$q$, 3),
      ($q$marketing-team$q$, $q$ads$q$, 1),
      ($q$marketing-team$q$, $q$social-posting$q$, 2),
      ($q$admin-team$q$, $q$inbox-clerk$q$, 1),
      ($q$admin-team$q$, $q$document-admin$q$, 2),
      ($q$admin-team$q$, $q$calendar-admin$q$, 3),
      ($q$operations-team$q$, $q$ops-coordinator$q$, 1),
      ($q$operations-team$q$, $q$vendor-followup$q$, 2),
      ($q$operations-team$q$, $q$sop-keeper$q$, 3),
      ($q$full-business$q$, $q$inbound-lead$q$, 1),
      ($q$full-business$q$, $q$outbound-sales$q$, 2),
      ($q$full-business$q$, $q$onboarding$q$, 3),
      ($q$full-business$q$, $q$ads$q$, 4),
      ($q$full-business$q$, $q$social-posting$q$, 5),
      ($q$healthcare-clinic$q$, $q$receptionist$q$, 1),
      ($q$healthcare-clinic$q$, $q$reminder-drafts$q$, 2),
      ($q$healthcare-clinic$q$, $q$document-admin$q$, 3),
      ($q$healthcare-clinic$q$, $q$review-requests$q$, 4),
      ($q$healthcare-clinic$q$, $q$ops-coordinator$q$, 5),
      ($q$healthcare-clinic$q$, $q$invoice-drafts$q$, 6),
      ($q$fashion-brand$q$, $q$brand-voice$q$, 1),
      ($q$fashion-brand$q$, $q$inbound-lead$q$, 2),
      ($q$fashion-brand$q$, $q$campaign-planner$q$, 3),
      ($q$fashion-brand$q$, $q$social-posting$q$, 4),
      ($q$fashion-brand$q$, $q$ads$q$, 5),
      ($q$fashion-brand$q$, $q$order-status$q$, 6),
      ($q$fashion-brand$q$, $q$support-replies$q$, 7),
      ($q$restaurant-food$q$, $q$receptionist$q$, 1),
      ($q$restaurant-food$q$, $q$reminder-drafts$q$, 2),
      ($q$restaurant-food$q$, $q$review-replies$q$, 3),
      ($q$restaurant-food$q$, $q$social-posting$q$, 4),
      ($q$restaurant-food$q$, $q$offer-manager$q$, 5),
      ($q$real-estate$q$, $q$inbound-lead$q$, 1),
      ($q$real-estate$q$, $q$outbound-sales$q$, 2),
      ($q$real-estate$q$, $q$proposal-writer$q$, 3),
      ($q$real-estate$q$, $q$reminder-drafts$q$, 4),
      ($q$real-estate$q$, $q$review-requests$q$, 5),
      ($q$education-school$q$, $q$receptionist$q$, 1),
      ($q$education-school$q$, $q$document-admin$q$, 2),
      ($q$education-school$q$, $q$reminder-drafts$q$, 3),
      ($q$education-school$q$, $q$onboarding$q$, 4),
      ($q$education-school$q$, $q$review-requests$q$, 5),
      ($q$beauty-salon$q$, $q$receptionist$q$, 1),
      ($q$beauty-salon$q$, $q$reminder-drafts$q$, 2),
      ($q$beauty-salon$q$, $q$review-requests$q$, 3),
      ($q$beauty-salon$q$, $q$social-posting$q$, 4),
      ($q$beauty-salon$q$, $q$brand-voice$q$, 5),
      ($q$fitness-gym$q$, $q$inbound-lead$q$, 1),
      ($q$fitness-gym$q$, $q$receptionist$q$, 2),
      ($q$fitness-gym$q$, $q$reminder-drafts$q$, 3),
      ($q$fitness-gym$q$, $q$social-posting$q$, 4),
      ($q$fitness-gym$q$, $q$review-requests$q$, 5),
      ($q$legal-services$q$, $q$inbound-lead$q$, 1),
      ($q$legal-services$q$, $q$document-admin$q$, 2),
      ($q$legal-services$q$, $q$calendar-admin$q$, 3),
      ($q$legal-services$q$, $q$invoice-drafts$q$, 4),
      ($q$legal-services$q$, $q$onboarding$q$, 5),
      ($q$trades-home$q$, $q$inbound-lead$q$, 1),
      ($q$trades-home$q$, $q$receptionist$q$, 2),
      ($q$trades-home$q$, $q$reminder-drafts$q$, 3),
      ($q$trades-home$q$, $q$invoice-drafts$q$, 4),
      ($q$trades-home$q$, $q$review-requests$q$, 5),
      ($q$automotive$q$, $q$inbound-lead$q$, 1),
      ($q$automotive$q$, $q$receptionist$q$, 2),
      ($q$automotive$q$, $q$reminder-drafts$q$, 3),
      ($q$automotive$q$, $q$review-requests$q$, 4),
      ($q$automotive$q$, $q$invoice-drafts$q$, 5),
      ($q$ecommerce-store$q$, $q$order-status$q$, 1),
      ($q$ecommerce-store$q$, $q$fulfilment-tasks$q$, 2),
      ($q$ecommerce-store$q$, $q$returns-drafts$q$, 3),
      ($q$ecommerce-store$q$, $q$support-replies$q$, 4),
      ($q$ecommerce-store$q$, $q$ads$q$, 5),
      ($q$ecommerce-store$q$, $q$social-posting$q$, 6),
      ($q$agency-consulting$q$, $q$inbound-lead$q$, 1),
      ($q$agency-consulting$q$, $q$outbound-sales$q$, 2),
      ($q$agency-consulting$q$, $q$proposal-writer$q$, 3),
      ($q$agency-consulting$q$, $q$onboarding$q$, 4),
      ($q$agency-consulting$q$, $q$invoice-drafts$q$, 5),
      ($q$agency-consulting$q$, $q$blog-drafts$q$, 6),
      ($q$faceless-youtube$q$, $q$scriptwriter$q$, 1),
      ($q$faceless-youtube$q$, $q$video-editor-brief$q$, 2),
      ($q$faceless-youtube$q$, $q$thumbnail-brief$q$, 3),
      ($q$faceless-youtube$q$, $q$seo-titles$q$, 4),
      ($q$faceless-youtube$q$, $q$scheduler-poster$q$, 5),
      ($q$faceless-youtube$q$, $q$content-analytics$q$, 6),
      ($q$facebook-community$q$, $q$community-manager$q$, 1),
      ($q$facebook-community$q$, $q$scheduler-poster$q$, 2),
      ($q$facebook-community$q$, $q$scriptwriter$q$, 3),
      ($q$facebook-community$q$, $q$seo-titles$q$, 4),
      ($q$facebook-community$q$, $q$content-analytics$q$, 5),
      ($q$facebook-community$q$, $q$content-calendar$q$, 6),
      ($q$tiktok-reels$q$, $q$scriptwriter$q$, 1),
      ($q$tiktok-reels$q$, $q$video-editor-brief$q$, 2),
      ($q$tiktok-reels$q$, $q$thumbnail-brief$q$, 3),
      ($q$tiktok-reels$q$, $q$scheduler-poster$q$, 4),
      ($q$tiktok-reels$q$, $q$community-manager$q$, 5),
      ($q$podcast$q$, $q$scriptwriter$q$, 1),
      ($q$podcast$q$, $q$seo-titles$q$, 2),
      ($q$podcast$q$, $q$scheduler-poster$q$, 3),
      ($q$podcast$q$, $q$community-manager$q$, 4),
      ($q$podcast$q$, $q$content-analytics$q$, 5),
      ($q$personal-brand$q$, $q$scriptwriter$q$, 1),
      ($q$personal-brand$q$, $q$brand-voice$q$, 2),
      ($q$personal-brand$q$, $q$scheduler-poster$q$, 3),
      ($q$personal-brand$q$, $q$community-manager$q$, 4),
      ($q$personal-brand$q$, $q$seo-titles$q$, 5),
      ($q$ai-automation-agency$q$, $q$inbound-lead$q$, 1),
      ($q$ai-automation-agency$q$, $q$outbound-sales$q$, 2),
      ($q$ai-automation-agency$q$, $q$proposal-writer$q$, 3),
      ($q$ai-automation-agency$q$, $q$onboarding$q$, 4),
      ($q$ai-automation-agency$q$, $q$ads$q$, 5),
      ($q$ai-automation-agency$q$, $q$social-posting$q$, 6),
      ($q$ai-automation-agency$q$, $q$support-replies$q$, 7),
      ($q$ai-automation-agency$q$, $q$blog-drafts$q$, 8)
  ) as item(bundle_slug, bot_slug, position) on item.bundle_slug = b.slug
  on conflict (bundle_id, bot_slug) do nothing;

  insert into public.bot_templates (slug, name, description, bundle_slug, industry, department, payload)
  values
    (
      $q$sales-team$q$, $q$Sales Team$q$,
      $q$One click: inbound, outbound, and onboarding agents, the sales pipeline, and task workflows. Sending stays off.$q$,
      $q$sales-team$q$,
      null,
      $q$sales$q$,
      $q${"version":1,"bots":[{"slug":"inbound-lead","config":{"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}},{"slug":"outbound-sales","config":{"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:contacted","channel":"whatsapp"}},{"slug":"onboarding","config":{"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:won","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:sales-team","name":"Sales Team","is_default":false,"stages":[{"asset_key":"stage:bot:sales-team:new","name":"New","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:sales-team:contacted","name":"Contacted","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:sales-team:qualified","name":"Qualified","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:sales-team:proposal","name":"Proposal","position":4,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:sales-team:won","name":"Won","position":5,"is_won":true,"is_lost":false},{"asset_key":"stage:bot:sales-team:lost","name":"Lost","position":6,"is_won":false,"is_lost":true}]}],"workflows":[{"asset_key":"workflow:bot:inbound-assign","name":"Assign inbound lead","trigger_type":"lead.created","trigger":{},"steps":[{"id":"assign","kind":"create_task","title":"Assign the inbound lead"}]},{"asset_key":"workflow:bot:onboarding-tasks","name":"Onboarding tasks","trigger_type":"lead.stage_changed","trigger":{},"steps":[{"id":"welcome","kind":"create_task","title":"Create the onboarding tasks"}]}]}$q$::jsonb
    ),
    (
      $q$marketing-team$q$, $q$Marketing Team$q$,
      $q$One click: ads and social agents, the marketing pipeline, and draft workflows. Sending stays off.$q$,
      $q$marketing-team$q$,
      null,
      $q$marketing$q$,
      $q${"version":1,"bots":[{"slug":"ads","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:draft","channel":"ads"}},{"slug":"social-posting","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"social"}}],"pipelines":[{"asset_key":"pipeline:bot:marketing-team","name":"Marketing Team","is_default":false,"stages":[{"asset_key":"stage:bot:marketing-team:idea","name":"Idea","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:marketing-team:draft","name":"Draft","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:marketing-team:review","name":"Review","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:marketing-team:scheduled","name":"Scheduled","position":4,"is_won":false,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:ads-draft","name":"Draft ad copy","trigger_type":"schedule.cron","trigger":{},"steps":[{"id":"ad","kind":"create_task","title":"Draft the ad copy"}]},{"asset_key":"workflow:bot:social-draft","name":"Draft social post","trigger_type":"schedule.cron","trigger":{},"steps":[{"id":"post","kind":"create_task","title":"Draft the social post"}]}]}$q$::jsonb
    ),
    (
      $q$admin-team$q$, $q$Admin Team$q$,
      $q$One click: inbox, documents, and calendar agents. Sending stays off.$q$,
      $q$admin-team$q$,
      null,
      $q$admin$q$,
      $q${"version":1,"bots":[{"slug":"inbox-clerk","config":{"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:admin","stage":"stage:bot:admin:new","channel":"email"}},{"slug":"document-admin","config":{"tone":"careful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:admin","stage":"stage:bot:admin:new","channel":"email"}},{"slug":"calendar-admin","config":{"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:admin","stage":"stage:bot:admin:new","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:admin","name":"Admin","is_default":false,"stages":[{"asset_key":"stage:bot:admin:new","name":"New","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:admin:doing","name":"In progress","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:admin:done","name":"Done","position":3,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:admin-file","name":"File the admin item","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"File the admin item"}]}]}$q$::jsonb
    ),
    (
      $q$operations-team$q$, $q$Operations Team$q$,
      $q$One click: coordination, vendor, and SOP agents. Sending stays off.$q$,
      $q$operations-team$q$,
      null,
      $q$operations$q$,
      $q${"version":1,"bots":[{"slug":"ops-coordinator","config":{"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:operations","stage":"stage:bot:operations:new","channel":"email"}},{"slug":"vendor-followup","config":{"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:operations","stage":"stage:bot:operations:new","channel":"email"}},{"slug":"sop-keeper","config":{"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:operations","stage":"stage:bot:operations:new","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:operations","name":"Operations","is_default":false,"stages":[{"asset_key":"stage:bot:operations:logged","name":"Logged","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:operations:doing","name":"In progress","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:operations:done","name":"Done","position":3,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:ops-task","name":"Open the operations task","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Open the operations task"}]}]}$q$::jsonb
    ),
    (
      $q$full-business$q$, $q$Full Business$q$,
      $q$One click: the sales and marketing agents, both pipelines, and the task workflows. Sending stays off.$q$,
      $q$full-business$q$,
      null,
      null,
      $q${"version":1,"bots":[{"slug":"inbound-lead","config":{"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}},{"slug":"outbound-sales","config":{"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:contacted","channel":"whatsapp"}},{"slug":"onboarding","config":{"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:won","channel":"email"}},{"slug":"ads","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:draft","channel":"ads"}},{"slug":"social-posting","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"social"}}],"pipelines":[{"asset_key":"pipeline:bot:sales-team","name":"Sales Team","is_default":false,"stages":[{"asset_key":"stage:bot:sales-team:new","name":"New","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:sales-team:contacted","name":"Contacted","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:sales-team:qualified","name":"Qualified","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:sales-team:proposal","name":"Proposal","position":4,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:sales-team:won","name":"Won","position":5,"is_won":true,"is_lost":false},{"asset_key":"stage:bot:sales-team:lost","name":"Lost","position":6,"is_won":false,"is_lost":true}]},{"asset_key":"pipeline:bot:marketing-team","name":"Marketing Team","is_default":false,"stages":[{"asset_key":"stage:bot:marketing-team:idea","name":"Idea","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:marketing-team:draft","name":"Draft","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:marketing-team:review","name":"Review","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:marketing-team:scheduled","name":"Scheduled","position":4,"is_won":false,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:inbound-assign","name":"Assign inbound lead","trigger_type":"lead.created","trigger":{},"steps":[{"id":"assign","kind":"create_task","title":"Assign the inbound lead"}]},{"asset_key":"workflow:bot:onboarding-tasks","name":"Onboarding tasks","trigger_type":"lead.stage_changed","trigger":{},"steps":[{"id":"welcome","kind":"create_task","title":"Create the onboarding tasks"}]},{"asset_key":"workflow:bot:ads-draft","name":"Draft ad copy","trigger_type":"schedule.cron","trigger":{},"steps":[{"id":"ad","kind":"create_task","title":"Draft the ad copy"}]},{"asset_key":"workflow:bot:social-draft","name":"Draft social post","trigger_type":"schedule.cron","trigger":{},"steps":[{"id":"post","kind":"create_task","title":"Draft the social post"}]}]}$q$::jsonb
    ),
    (
      $q$healthcare-clinic$q$, $q$Healthcare / clinic$q$,
      $q$Reception, patient admin, reminders, reviews, operations, and billing. Sending stays off.$q$,
      $q$healthcare-clinic$q$,
      $q$healthcare$q$,
      null,
      $q${"version":1,"bots":[{"slug":"receptionist","config":{"tone":"warm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"reminder-drafts","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"document-admin","config":{"tone":"careful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:admin","stage":"stage:bot:admin:new","channel":"email"}},{"slug":"review-requests","config":{"tone":"grateful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"whatsapp"}},{"slug":"ops-coordinator","config":{"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:operations","stage":"stage:bot:operations:new","channel":"email"}},{"slug":"invoice-drafts","config":{"tone":"formal","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:finance","stage":"stage:bot:finance:new","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:healthcare-clinic","name":"Clinic","is_default":false,"stages":[{"asset_key":"stage:bot:healthcare-clinic:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:healthcare-clinic:booked","name":"Booked","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:healthcare-clinic:seen","name":"Seen","position":3,"is_won":true,"is_lost":false},{"asset_key":"stage:bot:healthcare-clinic:follow-up","name":"Follow-up","position":4,"is_won":false,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:healthcare-clinic","name":"Prepare the clinic follow-up","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Prepare the clinic follow-up"}]}]}$q$::jsonb
    ),
    (
      $q$fashion-brand$q$, $q$Clothing / fashion$q$,
      $q$Brand, sales, marketing, social, ads, fulfilment, and service. Sending stays off.$q$,
      $q$fashion-brand$q$,
      $q$fashion$q$,
      null,
      $q${"version":1,"bots":[{"slug":"brand-voice","config":{"tone":"on brand","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:branding","stage":"stage:bot:branding:new","channel":"social"}},{"slug":"inbound-lead","config":{"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}},{"slug":"campaign-planner","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"email"}},{"slug":"social-posting","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"social"}},{"slug":"ads","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:draft","channel":"ads"}},{"slug":"order-status","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:ecommerce","stage":"stage:bot:ecommerce:new","channel":"email"}},{"slug":"support-replies","config":{"tone":"calm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:customer-service","stage":"stage:bot:customer-service:new","channel":"whatsapp"}}],"pipelines":[{"asset_key":"pipeline:bot:fashion-brand","name":"Fashion","is_default":false,"stages":[{"asset_key":"stage:bot:fashion-brand:lead","name":"Lead","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:fashion-brand:styled","name":"Styled","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:fashion-brand:ordered","name":"Ordered","position":3,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:fashion-brand","name":"Draft the fashion follow-up","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Draft the fashion follow-up"}]}]}$q$::jsonb
    ),
    (
      $q$restaurant-food$q$, $q$Restaurant / food$q$,
      $q$Bookings, reminders, reviews, social, and offers. Sending stays off.$q$,
      $q$restaurant-food$q$,
      $q$restaurant$q$,
      null,
      $q${"version":1,"bots":[{"slug":"receptionist","config":{"tone":"warm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"reminder-drafts","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"review-replies","config":{"tone":"grateful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"social"}},{"slug":"social-posting","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"social"}},{"slug":"offer-manager","config":{"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:review","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:restaurant-food","name":"Restaurant","is_default":false,"stages":[{"asset_key":"stage:bot:restaurant-food:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:restaurant-food:booked","name":"Booked","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:restaurant-food:seated","name":"Seated","position":3,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:restaurant-food","name":"Confirm the booking draft","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Confirm the booking draft"}]}]}$q$::jsonb
    ),
    (
      $q$real-estate$q$, $q$Real estate$q$,
      $q$Leads, viewings, proposals, and reviews. Sending stays off.$q$,
      $q$real-estate$q$,
      $q$real-estate$q$,
      null,
      $q${"version":1,"bots":[{"slug":"inbound-lead","config":{"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}},{"slug":"outbound-sales","config":{"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:contacted","channel":"whatsapp"}},{"slug":"proposal-writer","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:proposal","channel":"email"}},{"slug":"reminder-drafts","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"review-requests","config":{"tone":"grateful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"whatsapp"}}],"pipelines":[{"asset_key":"pipeline:bot:real-estate","name":"Property","is_default":false,"stages":[{"asset_key":"stage:bot:real-estate:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:real-estate:viewing","name":"Viewing","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:real-estate:offer","name":"Offer","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:real-estate:won","name":"Won","position":4,"is_won":true,"is_lost":false},{"asset_key":"stage:bot:real-estate:lost","name":"Lost","position":5,"is_won":false,"is_lost":true}]}],"workflows":[{"asset_key":"workflow:bot:real-estate","name":"Book the viewing task","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Book the viewing task"}]}]}$q$::jsonb
    ),
    (
      $q$education-school$q$, $q$Education / school$q$,
      $q$Admissions stages from the Education snapshot, plus the school agents. Sending stays off.$q$,
      $q$education-school$q$,
      $q$education$q$,
      null,
      $q${"version":1,"bots":[{"slug":"receptionist","config":{"tone":"warm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"document-admin","config":{"tone":"careful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:admin","stage":"stage:bot:admin:new","channel":"email"}},{"slug":"reminder-drafts","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"onboarding","config":{"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:won","channel":"email"}},{"slug":"review-requests","config":{"tone":"grateful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"whatsapp"}}],"pipelines":[{"asset_key":"pipeline:admissions","name":"Admissions","is_default":false,"stages":[{"asset_key":"stage:admissions:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:admissions:application-started","name":"Application Started","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:admissions:docs-submitted","name":"Docs Submitted","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:admissions:accepted","name":"Accepted","position":4,"is_won":false,"is_lost":false},{"asset_key":"stage:admissions:registered","name":"Registered","position":5,"is_won":true,"is_lost":false},{"asset_key":"stage:admissions:lost","name":"Lost","position":6,"is_won":false,"is_lost":true}]}],"workflows":[{"asset_key":"workflow:bot:education-school","name":"Follow the admissions enquiry","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Follow the admissions enquiry"}]}]}$q$::jsonb
    ),
    (
      $q$beauty-salon$q$, $q$Beauty / salon / spa$q$,
      $q$Diary, reminders, reviews, and social. Sending stays off.$q$,
      $q$beauty-salon$q$,
      $q$beauty$q$,
      null,
      $q${"version":1,"bots":[{"slug":"receptionist","config":{"tone":"warm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"reminder-drafts","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"review-requests","config":{"tone":"grateful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"whatsapp"}},{"slug":"social-posting","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"social"}},{"slug":"brand-voice","config":{"tone":"on brand","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:branding","stage":"stage:bot:branding:new","channel":"social"}}],"pipelines":[{"asset_key":"pipeline:bot:beauty-salon","name":"Salon","is_default":false,"stages":[{"asset_key":"stage:bot:beauty-salon:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:beauty-salon:booked","name":"Booked","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:beauty-salon:visited","name":"Visited","position":3,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:beauty-salon","name":"Hold the appointment draft","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Hold the appointment draft"}]}]}$q$::jsonb
    ),
    (
      $q$fitness-gym$q$, $q$Fitness / gym$q$,
      $q$Trials, memberships, reminders, and social. Sending stays off.$q$,
      $q$fitness-gym$q$,
      $q$fitness$q$,
      null,
      $q${"version":1,"bots":[{"slug":"inbound-lead","config":{"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}},{"slug":"receptionist","config":{"tone":"warm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"reminder-drafts","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"social-posting","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"social"}},{"slug":"review-requests","config":{"tone":"grateful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"whatsapp"}}],"pipelines":[{"asset_key":"pipeline:bot:fitness-gym","name":"Gym","is_default":false,"stages":[{"asset_key":"stage:bot:fitness-gym:trial","name":"Trial","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:fitness-gym:joined","name":"Joined","position":2,"is_won":true,"is_lost":false},{"asset_key":"stage:bot:fitness-gym:lost","name":"Lost","position":3,"is_won":false,"is_lost":true}]}],"workflows":[{"asset_key":"workflow:bot:fitness-gym","name":"Follow the trial booking","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Follow the trial booking"}]}]}$q$::jsonb
    ),
    (
      $q$legal-services$q$, $q$Legal / professional services$q$,
      $q$Intake, documents, diary, and invoices. Sending stays off.$q$,
      $q$legal-services$q$,
      $q$legal$q$,
      null,
      $q${"version":1,"bots":[{"slug":"inbound-lead","config":{"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}},{"slug":"document-admin","config":{"tone":"careful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:admin","stage":"stage:bot:admin:new","channel":"email"}},{"slug":"calendar-admin","config":{"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:admin","stage":"stage:bot:admin:new","channel":"email"}},{"slug":"invoice-drafts","config":{"tone":"formal","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:finance","stage":"stage:bot:finance:new","channel":"email"}},{"slug":"onboarding","config":{"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:won","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:legal-services","name":"Matter","is_default":false,"stages":[{"asset_key":"stage:bot:legal-services:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:legal-services:consult","name":"Consult","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:legal-services:engaged","name":"Engaged","position":3,"is_won":true,"is_lost":false},{"asset_key":"stage:bot:legal-services:closed","name":"Closed","position":4,"is_won":false,"is_lost":true}]}],"workflows":[{"asset_key":"workflow:bot:legal-services","name":"Open the matter task","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Open the matter task"}]}]}$q$::jsonb
    ),
    (
      $q$trades-home$q$, $q$Trades / home services$q$,
      $q$Jobs, visits, invoices, and reviews. Sending stays off.$q$,
      $q$trades-home$q$,
      $q$trades$q$,
      null,
      $q${"version":1,"bots":[{"slug":"inbound-lead","config":{"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}},{"slug":"receptionist","config":{"tone":"warm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"reminder-drafts","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"invoice-drafts","config":{"tone":"formal","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:finance","stage":"stage:bot:finance:new","channel":"email"}},{"slug":"review-requests","config":{"tone":"grateful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"whatsapp"}}],"pipelines":[{"asset_key":"pipeline:bot:trades-home","name":"Job","is_default":false,"stages":[{"asset_key":"stage:bot:trades-home:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:trades-home:quoted","name":"Quoted","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:trades-home:booked","name":"Booked","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:trades-home:done","name":"Done","position":4,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:trades-home","name":"Schedule the site visit","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Schedule the site visit"}]}]}$q$::jsonb
    ),
    (
      $q$automotive$q$, $q$Automotive$q$,
      $q$Enquiries, bookings, reviews, and invoices. Sending stays off.$q$,
      $q$automotive$q$,
      $q$automotive$q$,
      null,
      $q${"version":1,"bots":[{"slug":"inbound-lead","config":{"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}},{"slug":"receptionist","config":{"tone":"warm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"reminder-drafts","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:booking","stage":"stage:bot:booking:new","channel":"whatsapp"}},{"slug":"review-requests","config":{"tone":"grateful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:reputation","stage":"stage:bot:reputation:new","channel":"whatsapp"}},{"slug":"invoice-drafts","config":{"tone":"formal","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:finance","stage":"stage:bot:finance:new","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:automotive","name":"Workshop","is_default":false,"stages":[{"asset_key":"stage:bot:automotive:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:automotive:booked","name":"Booked","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:automotive:done","name":"Done","position":3,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:automotive","name":"Confirm the workshop booking","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Confirm the workshop booking"}]}]}$q$::jsonb
    ),
    (
      $q$ecommerce-store$q$, $q$Ecommerce store$q$,
      $q$Orders, fulfilment, returns, and marketing drafts. Sending stays off.$q$,
      $q$ecommerce-store$q$,
      $q$ecommerce$q$,
      null,
      $q${"version":1,"bots":[{"slug":"order-status","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:ecommerce","stage":"stage:bot:ecommerce:new","channel":"email"}},{"slug":"fulfilment-tasks","config":{"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:ecommerce","stage":"stage:bot:ecommerce:new","channel":"email"}},{"slug":"returns-drafts","config":{"tone":"fair","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:ecommerce","stage":"stage:bot:ecommerce:new","channel":"email"}},{"slug":"support-replies","config":{"tone":"calm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:customer-service","stage":"stage:bot:customer-service:new","channel":"whatsapp"}},{"slug":"ads","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:draft","channel":"ads"}},{"slug":"social-posting","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"social"}}],"pipelines":[{"asset_key":"pipeline:bot:ecommerce-store","name":"Order","is_default":false,"stages":[{"asset_key":"stage:bot:ecommerce-store:new","name":"New","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:ecommerce-store:packed","name":"Packed","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:ecommerce-store:fulfilled","name":"Fulfilled","position":3,"is_won":true,"is_lost":false},{"asset_key":"stage:bot:ecommerce-store:returned","name":"Returned","position":4,"is_won":false,"is_lost":true}]}],"workflows":[{"asset_key":"workflow:bot:ecommerce-store","name":"Open the fulfilment task","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Open the fulfilment task"}]}]}$q$::jsonb
    ),
    (
      $q$agency-consulting$q$, $q$Agency / consulting$q$,
      $q$Pipeline, proposals, onboarding, and content. Sending stays off.$q$,
      $q$agency-consulting$q$,
      $q$agency$q$,
      null,
      $q${"version":1,"bots":[{"slug":"inbound-lead","config":{"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}},{"slug":"outbound-sales","config":{"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:contacted","channel":"whatsapp"}},{"slug":"proposal-writer","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:proposal","channel":"email"}},{"slug":"onboarding","config":{"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:won","channel":"email"}},{"slug":"invoice-drafts","config":{"tone":"formal","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:finance","stage":"stage:bot:finance:new","channel":"email"}},{"slug":"blog-drafts","config":{"tone":"useful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:agency-consulting","name":"Engagement","is_default":false,"stages":[{"asset_key":"stage:bot:agency-consulting:lead","name":"Lead","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:agency-consulting:proposal","name":"Proposal","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:agency-consulting:won","name":"Won","position":3,"is_won":true,"is_lost":false},{"asset_key":"stage:bot:agency-consulting:lost","name":"Lost","position":4,"is_won":false,"is_lost":true}]}],"workflows":[{"asset_key":"workflow:bot:agency-consulting","name":"Draft the engagement task","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Draft the engagement task"}]}]}$q$::jsonb
    ),
    (
      $q$faceless-youtube$q$, $q$Faceless YouTube$q$,
      $q$Script, edit, thumbnail, titles, scheduler, and analytics. Sending stays off.$q$,
      $q$faceless-youtube$q$,
      $q$youtube$q$,
      null,
      $q${"version":1,"bots":[{"slug":"scriptwriter","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"video-editor-brief","config":{"tone":"precise","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"thumbnail-brief","config":{"tone":"visual","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"seo-titles","config":{"tone":"tight","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"scheduler-poster","config":{"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}},{"slug":"content-analytics","config":{"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:faceless-youtube","name":"Video","is_default":false,"stages":[{"asset_key":"stage:bot:faceless-youtube:idea","name":"Idea","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:faceless-youtube:script","name":"Script","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:faceless-youtube:edit","name":"Edit","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:faceless-youtube:scheduled","name":"Scheduled","position":4,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:faceless-youtube","name":"Draft the next video task","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Draft the next video task"}]}]}$q$::jsonb
    ),
    (
      $q$facebook-community$q$, $q$Facebook page / community$q$,
      $q$Community, posts, and a content calendar. Sending stays off.$q$,
      $q$facebook-community$q$,
      $q$facebook$q$,
      null,
      $q${"version":1,"bots":[{"slug":"community-manager","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}},{"slug":"scheduler-poster","config":{"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}},{"slug":"scriptwriter","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"seo-titles","config":{"tone":"tight","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"content-analytics","config":{"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"content-calendar","config":{"tone":"bright","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}}],"pipelines":[{"asset_key":"pipeline:bot:facebook-community","name":"Community","is_default":false,"stages":[{"asset_key":"stage:bot:facebook-community:idea","name":"Idea","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:facebook-community:draft","name":"Draft","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:facebook-community:scheduled","name":"Scheduled","position":3,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:facebook-community","name":"Draft the community post","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Draft the community post"}]}]}$q$::jsonb
    ),
    (
      $q$tiktok-reels$q$, $q$TikTok / Reels$q$,
      $q$Short scripts, edits, and posting drafts. Sending stays off.$q$,
      $q$tiktok-reels$q$,
      $q$tiktok$q$,
      null,
      $q${"version":1,"bots":[{"slug":"scriptwriter","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"video-editor-brief","config":{"tone":"precise","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"thumbnail-brief","config":{"tone":"visual","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"scheduler-poster","config":{"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}},{"slug":"community-manager","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}}],"pipelines":[{"asset_key":"pipeline:bot:tiktok-reels","name":"Short","is_default":false,"stages":[{"asset_key":"stage:bot:tiktok-reels:idea","name":"Idea","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:tiktok-reels:cut","name":"Cut","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:tiktok-reels:scheduled","name":"Scheduled","position":3,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:tiktok-reels","name":"Draft the short video task","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Draft the short video task"}]}]}$q$::jsonb
    ),
    (
      $q$podcast$q$, $q$Podcast$q$,
      $q$Episode scripts, titles, and posting drafts. Sending stays off.$q$,
      $q$podcast$q$,
      $q$podcast$q$,
      null,
      $q${"version":1,"bots":[{"slug":"scriptwriter","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"seo-titles","config":{"tone":"tight","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"scheduler-poster","config":{"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}},{"slug":"community-manager","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}},{"slug":"content-analytics","config":{"tone":"plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:podcast","name":"Episode","is_default":false,"stages":[{"asset_key":"stage:bot:podcast:idea","name":"Idea","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:podcast:recorded","name":"Recorded","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:podcast:scheduled","name":"Scheduled","position":3,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:podcast","name":"Draft the episode task","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Draft the episode task"}]}]}$q$::jsonb
    ),
    (
      $q$personal-brand$q$, $q$Personal brand$q$,
      $q$Founder scripts, voice, and posting drafts. Sending stays off.$q$,
      $q$personal-brand$q$,
      $q$personal-brand$q$,
      null,
      $q${"version":1,"bots":[{"slug":"scriptwriter","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}},{"slug":"brand-voice","config":{"tone":"on brand","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:branding","stage":"stage:bot:branding:new","channel":"social"}},{"slug":"scheduler-poster","config":{"tone":"brief","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}},{"slug":"community-manager","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:social","stage":"stage:bot:social:new","channel":"social"}},{"slug":"seo-titles","config":{"tone":"tight","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:personal-brand","name":"Founder","is_default":false,"stages":[{"asset_key":"stage:bot:personal-brand:idea","name":"Idea","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:personal-brand:draft","name":"Draft","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:personal-brand:scheduled","name":"Scheduled","position":3,"is_won":true,"is_lost":false}]}],"workflows":[{"asset_key":"workflow:bot:personal-brand","name":"Draft the founder post","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Draft the founder post"}]}]}$q$::jsonb
    ),
    (
      $q$ai-automation-agency$q$, $q$AI agency / automation agency$q$,
      $q$The same shape as AI AutoTech: pipeline, proposals, onboarding, ads, social, support, and content. Sending stays off.$q$,
      $q$ai-automation-agency$q$,
      $q$ai-agency$q$,
      null,
      $q${"version":1,"bots":[{"slug":"inbound-lead","config":{"tone":"warm and plain","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:new","channel":"whatsapp"}},{"slug":"outbound-sales","config":{"tone":"direct","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:contacted","channel":"whatsapp"}},{"slug":"proposal-writer","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:proposal","channel":"email"}},{"slug":"onboarding","config":{"tone":"helpful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:sales-team","stage":"stage:bot:sales-team:won","channel":"email"}},{"slug":"ads","config":{"tone":"clear","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:draft","channel":"ads"}},{"slug":"social-posting","config":{"tone":"friendly","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:marketing-team","stage":"stage:bot:marketing-team:idea","channel":"social"}},{"slug":"support-replies","config":{"tone":"calm","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:customer-service","stage":"stage:bot:customer-service:new","channel":"whatsapp"}},{"slug":"blog-drafts","config":{"tone":"useful","workingHours":{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]},"pipeline":"pipeline:bot:content","stage":"stage:bot:content:new","channel":"email"}}],"pipelines":[{"asset_key":"pipeline:bot:ai-automation-agency","name":"Client","is_default":false,"stages":[{"asset_key":"stage:bot:ai-automation-agency:lead","name":"Lead","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:ai-automation-agency:proposal","name":"Proposal","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:bot:ai-automation-agency:won","name":"Won","position":3,"is_won":true,"is_lost":false},{"asset_key":"stage:bot:ai-automation-agency:lost","name":"Lost","position":4,"is_won":false,"is_lost":true}]}],"workflows":[{"asset_key":"workflow:bot:ai-automation-agency","name":"Open the client task","trigger_type":"lead.created","trigger":{},"steps":[{"id":"task","kind":"create_task","title":"Open the client task"}]}]}$q$::jsonb
    )
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    bundle_slug = excluded.bundle_slug,
    industry = excluded.industry,
    department = excluded.department,
    payload = excluded.payload;
end
$seed$;
