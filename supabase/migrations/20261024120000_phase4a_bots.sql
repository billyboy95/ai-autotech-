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
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint bot_templates_catalogue_only check (
    not (payload ? 'contacts')
    and not (payload ? 'messages')
    and not (payload ? 'secrets')
    and not (payload ? 'credentials')
  )
);

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
    if quoted is null or quoted <= rec.max_bot or quoted >= rec.separate_total then
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

revoke all on function public.bot_bundle_quoted_price(integer, numeric, integer) from public, anon;
revoke all on function public.assert_bot_bundle_discounts() from public, anon;
revoke all on function public.upsert_sandbox_bot_line(uuid, text, text, jsonb, integer) from public, anon;
revoke all on function public.start_bot_sandbox_trial(uuid, text, text) from public, anon;
revoke all on function public.apply_bot_template(uuid, text) from public, anon;
revoke all on function public.record_bot_outbox_draft(uuid, text, text, text, text, text) from public, anon;

grant execute on function public.start_bot_sandbox_trial(uuid, text, text) to authenticated;
grant execute on function public.apply_bot_template(uuid, text) to authenticated;
grant execute on function public.record_bot_outbox_draft(uuid, text, text, text, text, text) to authenticated;

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
  end if;
end
$service_grants$;

-- Placeholder prices, to be confirmed by Billy.
do $seed$
declare
  sales_payload jsonb;
  marketing_payload jsonb;
  full_payload jsonb;
  hours jsonb := '{"timezone":"Africa/Johannesburg","start":"08:00","end":"17:00","days":[1,2,3,4,5]}'::jsonb;
begin
  insert into public.bot_catalog (
    slug, name, category, description, monthly_price_cents, currency, price_placeholder,
    capabilities, default_config, engine, active
  ) values
    (
      'inbound-lead', 'Inbound Lead', 'sales',
      'Assigns a new lead and saves an AI reply draft. Nothing is sent.',
      150000, 'ZAR', true,
      '["assign-lead","ai-draft","workflow"]'::jsonb,
      jsonb_build_object('tone', 'warm and plain', 'workingHours', hours, 'pipeline', 'pipeline:bot:sales-team', 'stage', 'stage:bot:sales-team:new', 'channel', 'whatsapp'),
      'ai_reply', true
    ),
    (
      'outbound-sales', 'Outbound Sales', 'sales',
      'Drafts outreach after consent and suppression checks. Nothing is sent.',
      200000, 'ZAR', true,
      '["outbox-draft","consent-check"]'::jsonb,
      jsonb_build_object('tone', 'direct', 'workingHours', hours, 'pipeline', 'pipeline:bot:sales-team', 'stage', 'stage:bot:sales-team:contacted', 'channel', 'whatsapp'),
      'outbox_draft', true
    ),
    (
      'onboarding', 'Onboarding', 'sales',
      'Creates onboarding tasks and a booking-link draft. Nothing is sent.',
      100000, 'ZAR', true,
      '["task","calendar-link","workflow"]'::jsonb,
      jsonb_build_object('tone', 'helpful', 'workingHours', hours, 'pipeline', 'pipeline:bot:sales-team', 'stage', 'stage:bot:sales-team:won', 'channel', 'email'),
      'calendar', true
    ),
    (
      'ads', 'Ads', 'marketing',
      'Drafts ad copy only. Nothing is published.',
      180000, 'ZAR', true,
      '["ad-copy-draft"]'::jsonb,
      jsonb_build_object('tone', 'clear', 'workingHours', hours, 'pipeline', 'pipeline:bot:marketing-team', 'stage', 'stage:bot:marketing-team:draft', 'channel', 'ads'),
      'outbox_draft', true
    ),
    (
      'social-posting', 'Social Media Posting', 'marketing',
      'Drafts social posts only. Nothing is published.',
      120000, 'ZAR', true,
      '["social-post-draft"]'::jsonb,
      jsonb_build_object('tone', 'friendly', 'workingHours', hours, 'pipeline', 'pipeline:bot:marketing-team', 'stage', 'stage:bot:marketing-team:idea', 'channel', 'social'),
      'workflows', true
    )
  on conflict (slug) do update set
    name = excluded.name,
    category = excluded.category,
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
      'sales-team', 'Sales Team',
      'Inbound Lead, Outbound Sales, and Onboarding as one team. Placeholder price, to be confirmed by Billy.',
      360000, 20, 'ZAR', true
    ),
    (
      'marketing-team', 'Marketing Team',
      'Ads and Social Media Posting as one team. Placeholder price, to be confirmed by Billy.',
      240000, 20, 'ZAR', true
    ),
    (
      'full-business', 'Full Business',
      'Sales Team and Marketing Team together. Placeholder price, to be confirmed by Billy.',
      600000, 20, 'ZAR', true
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
      ('sales-team', 'inbound-lead', 1),
      ('sales-team', 'outbound-sales', 2),
      ('sales-team', 'onboarding', 3),
      ('marketing-team', 'ads', 1),
      ('marketing-team', 'social-posting', 2),
      ('full-business', 'inbound-lead', 1),
      ('full-business', 'outbound-sales', 2),
      ('full-business', 'onboarding', 3),
      ('full-business', 'ads', 4),
      ('full-business', 'social-posting', 5)
  ) as item(bundle_slug, bot_slug, position) on item.bundle_slug = b.slug
  on conflict (bundle_id, bot_slug) do nothing;

  sales_payload := jsonb_build_object(
    'version', 1,
    'bots', jsonb_build_array(
      jsonb_build_object('slug', 'inbound-lead', 'config', jsonb_build_object('tone', 'warm and plain', 'workingHours', hours, 'pipeline', 'pipeline:bot:sales-team', 'stage', 'stage:bot:sales-team:new', 'channel', 'whatsapp')),
      jsonb_build_object('slug', 'outbound-sales', 'config', jsonb_build_object('tone', 'direct', 'workingHours', hours, 'pipeline', 'pipeline:bot:sales-team', 'stage', 'stage:bot:sales-team:contacted', 'channel', 'whatsapp')),
      jsonb_build_object('slug', 'onboarding', 'config', jsonb_build_object('tone', 'helpful', 'workingHours', hours, 'pipeline', 'pipeline:bot:sales-team', 'stage', 'stage:bot:sales-team:won', 'channel', 'email'))
    ),
    'pipelines', jsonb_build_array(jsonb_build_object(
      'asset_key', 'pipeline:bot:sales-team',
      'name', 'Sales Team',
      'is_default', false,
      'stages', jsonb_build_array(
        jsonb_build_object('asset_key', 'stage:bot:sales-team:new', 'name', 'New', 'position', 1, 'is_won', false, 'is_lost', false),
        jsonb_build_object('asset_key', 'stage:bot:sales-team:contacted', 'name', 'Contacted', 'position', 2, 'is_won', false, 'is_lost', false),
        jsonb_build_object('asset_key', 'stage:bot:sales-team:qualified', 'name', 'Qualified', 'position', 3, 'is_won', false, 'is_lost', false),
        jsonb_build_object('asset_key', 'stage:bot:sales-team:proposal', 'name', 'Proposal', 'position', 4, 'is_won', false, 'is_lost', false),
        jsonb_build_object('asset_key', 'stage:bot:sales-team:won', 'name', 'Won', 'position', 5, 'is_won', true, 'is_lost', false),
        jsonb_build_object('asset_key', 'stage:bot:sales-team:lost', 'name', 'Lost', 'position', 6, 'is_won', false, 'is_lost', true)
      )
    )),
    'workflows', jsonb_build_array(
      jsonb_build_object(
        'asset_key', 'workflow:bot:inbound-assign',
        'name', 'Assign inbound lead',
        'trigger_type', 'lead.created',
        'trigger', '{}'::jsonb,
        'steps', jsonb_build_array(jsonb_build_object('id', 'assign', 'kind', 'create_task', 'title', 'Assign the inbound lead'))
      ),
      jsonb_build_object(
        'asset_key', 'workflow:bot:onboarding-tasks',
        'name', 'Onboarding tasks',
        'trigger_type', 'lead.stage_changed',
        'trigger', '{}'::jsonb,
        'steps', jsonb_build_array(jsonb_build_object('id', 'welcome', 'kind', 'create_task', 'title', 'Create the onboarding tasks'))
      )
    )
  );

  marketing_payload := jsonb_build_object(
    'version', 1,
    'bots', jsonb_build_array(
      jsonb_build_object('slug', 'ads', 'config', jsonb_build_object('tone', 'clear', 'workingHours', hours, 'pipeline', 'pipeline:bot:marketing-team', 'stage', 'stage:bot:marketing-team:draft', 'channel', 'ads')),
      jsonb_build_object('slug', 'social-posting', 'config', jsonb_build_object('tone', 'friendly', 'workingHours', hours, 'pipeline', 'pipeline:bot:marketing-team', 'stage', 'stage:bot:marketing-team:idea', 'channel', 'social'))
    ),
    'pipelines', jsonb_build_array(jsonb_build_object(
      'asset_key', 'pipeline:bot:marketing-team',
      'name', 'Marketing Team',
      'is_default', false,
      'stages', jsonb_build_array(
        jsonb_build_object('asset_key', 'stage:bot:marketing-team:idea', 'name', 'Idea', 'position', 1, 'is_won', false, 'is_lost', false),
        jsonb_build_object('asset_key', 'stage:bot:marketing-team:draft', 'name', 'Draft', 'position', 2, 'is_won', false, 'is_lost', false),
        jsonb_build_object('asset_key', 'stage:bot:marketing-team:review', 'name', 'Review', 'position', 3, 'is_won', false, 'is_lost', false),
        jsonb_build_object('asset_key', 'stage:bot:marketing-team:scheduled', 'name', 'Scheduled', 'position', 4, 'is_won', false, 'is_lost', false)
      )
    )),
    'workflows', jsonb_build_array(
      jsonb_build_object(
        'asset_key', 'workflow:bot:ads-draft',
        'name', 'Draft ad copy',
        'trigger_type', 'schedule.cron',
        'trigger', '{}'::jsonb,
        'steps', jsonb_build_array(jsonb_build_object('id', 'ad', 'kind', 'create_task', 'title', 'Draft the ad copy'))
      ),
      jsonb_build_object(
        'asset_key', 'workflow:bot:social-draft',
        'name', 'Draft social post',
        'trigger_type', 'schedule.cron',
        'trigger', '{}'::jsonb,
        'steps', jsonb_build_array(jsonb_build_object('id', 'post', 'kind', 'create_task', 'title', 'Draft the social post'))
      )
    )
  );

  full_payload := jsonb_build_object(
    'version', 1,
    'bots', (sales_payload->'bots') || (marketing_payload->'bots'),
    'pipelines', (sales_payload->'pipelines') || (marketing_payload->'pipelines'),
    'workflows', (sales_payload->'workflows') || (marketing_payload->'workflows')
  );

  insert into public.bot_templates (slug, name, description, bundle_slug, payload)
  values
    (
      'sales-team', 'Sales Team',
      'One click: inbound, outbound, and onboarding bots, the sales pipeline, and task workflows. Sending stays off.',
      'sales-team', sales_payload
    ),
    (
      'marketing-team', 'Marketing Team',
      'One click: ads and social bots, the marketing pipeline, and draft workflows. Sending stays off.',
      'marketing-team', marketing_payload
    ),
    (
      'full-business', 'Full Business',
      'One click: every store bot, both pipelines, and the task workflows. Sending stays off.',
      'full-business', full_payload
    )
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    bundle_slug = excluded.bundle_slug,
    payload = excluded.payload;
end
$seed$;
