-- AIOS pricing sheet. Additive. No rows are deleted. sending_enabled is not turned on.
-- Placeholder prices stay placeholder until Billy says publish. All amounts are ZAR cents and exclude VAT.
-- Numbers match src/lib/pricing/price-sheet.ts: platform R299, Starter R699 / 5h, Pro R1,499 / 12h,
-- Always-On R4,999 / 40h. Team discount is 10% / 15% / 20% at 3 / 5 / 10+ agents. Under 3 agents the discount is 0%.
-- The Lead Agent (inbound-lead) is included in the platform fee and is not billed separately.
-- Apply after step 19. Do not run this until SUPABASE_DB_URL is available. Leave AI_REPLY_CRON_ENABLED unset.
-- This file does not call PayFast, Paystack, or Yoco.

alter table public.plans add column if not exists active boolean not null default true;

update public.plans
set
  active = false,
  features = coalesce(features, '{}'::jsonb) || '{"legacy": true, "price_placeholder": true}'::jsonb,
  updated_at = now()
where code in ('starter', 'growth', 'scale');

do $seed_aios_plans$
declare
  agency uuid;
begin
  select id into agency from public.organizations where slug = 'ai-autotech';
  if agency is null then
    raise notice 'ai-autotech org missing; AIOS plans were not seeded';
    return;
  end if;
  insert into public.plans (org_id, code, name, price_cents, currency, interval, limits, features, active)
  values
    (
      agency, 'platform', 'Platform', 29900, 'ZAR', 'month',
      '{"hours":2}'::jsonb,
      '{"crm":true,"lead_agent":true,"price_placeholder":true}'::jsonb,
      true
    ),
    (
      agency, 'agent_starter', 'Agent Starter', 69900, 'ZAR', 'month',
      '{"hours":5}'::jsonb,
      '{"tier":"starter","price_placeholder":true}'::jsonb,
      true
    ),
    (
      agency, 'agent_pro', 'Agent Pro', 149900, 'ZAR', 'month',
      '{"hours":12}'::jsonb,
      '{"tier":"pro","price_placeholder":true}'::jsonb,
      true
    ),
    (
      agency, 'agent_always_on', 'Agent Always-On', 499900, 'ZAR', 'month',
      '{"hours":40}'::jsonb,
      '{"tier":"always_on","price_placeholder":true}'::jsonb,
      true
    )
  on conflict (code) do update set
    name = excluded.name,
    price_cents = excluded.price_cents,
    limits = excluded.limits,
    features = excluded.features,
    active = true,
    updated_at = now();
end
$seed_aios_plans$;

insert into public.pricing_sheet (key, amount_cents, quantity, percent, price_placeholder, note)
values
  ('platform_fee', 29900, 2, null, true, 'Platform fee. CRM, Lead Agent, and a small computer-time pool.'),
  ('tier_starter', 69900, 5, null, true, 'Starter agent.'),
  ('tier_pro', 149900, 12, null, true, 'Pro agent.'),
  ('tier_always_on', 499900, 40, null, true, 'Always-On agent. 24/7, active hours capped.'),
  ('tier_included', 0, 0, null, true, 'Lead Agent. Included in the platform fee. Not billed separately.'),
  ('discount_3', null, 3, 10, true, 'Team discount from 3 agents.'),
  ('discount_5', null, 5, 15, true, 'Team discount from 5 agents.'),
  ('discount_10', null, 10, 20, true, 'Team discount from 10 agents.'),
  ('topup_10h', 79900, 10, null, true, 'Computer-time top-up.'),
  ('premium_model_multiplier', null, 2.5, null, true, 'Premium models use the hour pool 2.5x faster. Bring your own key to skip that.'),
  ('send_markup', null, 1.5, null, true, 'WhatsApp, SMS, and email sends at 1.5x provider cost. Not part of the monthly total.'),
  ('setup_fee', 0, null, null, true, 'Once-off setup is a suggested extra. See Quick Start and Team Setup.'),
  ('setup_quick_start', 250000, null, null, true, 'Once-off Quick Start. Suggested. Not part of the monthly total.'),
  ('setup_team_setup', 499900, null, null, true, 'Once-off Team Setup. Suggested. Not part of the monthly total.')
on conflict (key) do update set
  amount_cents = excluded.amount_cents,
  quantity = excluded.quantity,
  percent = excluded.percent,
  price_placeholder = true,
  note = excluded.note;

-- Quoted price follows the agent count. A stored bundle_price_cents is a cache, not the discount.
create or replace view public.bot_bundle_savings as
select
  b.id,
  b.slug,
  b.name,
  count(c.slug)::integer as bot_count,
  coalesce(sum(c.monthly_price_cents), 0)::integer as separate_total_cents,
  coalesce(max(c.monthly_price_cents), 0)::integer as max_bot_cents,
  (
    coalesce(sum(c.monthly_price_cents), 0)
    - round(
      coalesce(sum(c.monthly_price_cents), 0) * public.team_discount_percent(count(c.slug)::integer) / 100.0
    )
  )::integer as bundle_price_cents,
  public.team_discount_percent(count(c.slug)::integer)::integer as saving_percent
from public.bot_bundles b
left join public.bot_bundle_items i on i.bundle_id = b.id
left join public.bot_catalog c on c.slug = i.bot_slug
group by b.id, b.slug, b.name;

create or replace function public.assert_bot_bundle_discounts()
returns trigger
language plpgsql
as $$
declare
  rec record;
  quoted integer;
  percent numeric;
begin
  for rec in
    select
      b.slug,
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
    percent := public.team_discount_percent(rec.bot_count);
    quoted := rec.separate_total - round(rec.separate_total * percent / 100.0)::integer;
    if rec.bot_count < 3 then
      if quoted <> rec.separate_total then
        raise exception 'bundle discount rule: % has no team discount until 3 agents', rec.slug
          using errcode = '23514';
      end if;
    elsif quoted <= rec.max_bot or quoted >= rec.separate_total then
      raise exception 'bundle discount rule: % total must be greater than the most expensive bot and less than the sum of its bots', rec.slug
        using errcode = '23514';
    end if;
  end loop;
  return null;
end;
$$;

alter table public.bot_catalog add column if not exists tier text;

update public.bot_catalog
set tier = case
  when slug = 'inbound-lead' then 'included'
  when slug = 'outbound-sales' then 'pro'
  when slug = 'onboarding' then 'starter'
  when slug = 'ads' then 'pro'
  when slug = 'social-posting' then 'starter'
  when monthly_price_cents = 499900 then 'always_on'
  when monthly_price_cents = 149900 then 'pro'
  when monthly_price_cents = 0 then 'included'
  else 'starter'
end;

update public.bot_catalog
set
  monthly_price_cents = case tier
    when 'included' then 0
    when 'pro' then 149900
    when 'always_on' then 499900
    else 69900
  end,
  price_placeholder = true;

alter table public.bot_catalog drop constraint if exists bot_catalog_tier_check;
alter table public.bot_catalog
  add constraint bot_catalog_tier_check
  check (tier in ('starter', 'pro', 'always_on', 'included'));
alter table public.bot_catalog alter column tier set not null;

update public.bot_bundles b
set
  bundle_price_cents = s.bundle_price_cents,
  discount_percent = case when s.saving_percent = 0 then null else s.saving_percent end,
  price_placeholder = true
from public.bot_bundle_savings s
where s.id = b.id;

do $check_bundles$
declare
  bad text;
begin
  select string_agg(slug, ', ') into bad
  from public.bot_bundle_savings
  where separate_total_cents > 0
    and (
      (bot_count < 3 and bundle_price_cents is distinct from separate_total_cents)
      or (
        bot_count >= 3
        and (bundle_price_cents <= max_bot_cents or bundle_price_cents >= separate_total_cents)
      )
    );
  if bad is not null then
    raise exception 'bundle discount rule failed for %', bad;
  end if;
end
$check_bundles$;

-- Agency default send cards. Markup only. This does not turn sending on.
update public.rate_cards
set markup_multiplier = 1.5
where org_id is null
  and meter in ('sms', 'wa_marketing', 'wa_utility', 'wa_service', 'email');

alter table public.organizations drop constraint if exists organizations_plan_key_check;
alter table public.organizations
  add constraint organizations_plan_key_check
  check (plan_key in ('', 'starter', 'growth', 'scale', 'platform'));

create or replace function public.provision_client_workspace(
  p_name text,
  p_slug text,
  p_logo_url text,
  p_primary_color text,
  p_accent_color text,
  p_sender_name text,
  p_snapshot_id uuid,
  p_invite_email text,
  p_plan_key text,
  p_invite_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  parent uuid;
  base text;
  chosen_slug text;
  n integer := 2;
  chosen_primary text;
  chosen_accent text;
  sender text;
  new_id uuid;
  enabled boolean;
  org_industry text;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;
  if p_plan_key not in ('starter', 'growth', 'scale', 'platform') then
    raise exception 'Choose a plan placeholder';
  end if;
  if position('@' in lower(btrim(coalesce(p_invite_email, '')))) < 2 then
    raise exception 'Enter the client admin email';
  end if;
  if coalesce(p_invite_token_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'invite token hash is invalid';
  end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Give the workspace a name';
  end if;

  select o.id into parent
  from organizations o
  join memberships m on m.org_id = o.id
  where m.user_id = auth.uid()
    and m.role in ('agency_owner', 'agency_staff')
    and o.org_type = 'agency'
  order by (o.slug = 'ai-autotech') desc, o.created_at
  limit 1;
  if parent is null then
    raise exception 'not allowed';
  end if;

  base := lower(btrim(coalesce(nullif(btrim(coalesce(p_slug, '')), ''), p_name)));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := btrim(base, '-');
  if base = '' then
    raise exception 'Give the workspace a slug';
  end if;
  chosen_slug := base;
  while exists (select 1 from organizations existing where existing.slug = chosen_slug or existing.form_key = chosen_slug) loop
    chosen_slug := base || '-' || n::text;
    n := n + 1;
    if n > 50 then
      raise exception 'Choose a different slug';
    end if;
  end loop;

  chosen_primary := case when coalesce(p_primary_color, '') ~ '^#[0-9A-Fa-f]{6}$' then p_primary_color else '#0B1F3A' end;
  chosen_accent := case when coalesce(p_accent_color, '') ~ '^#[0-9A-Fa-f]{6}$' then p_accent_color else '#2563EB' end;
  sender := coalesce(nullif(btrim(coalesce(p_sender_name, '')), ''), btrim(p_name));
  select case when snapshots.name ilike '%education%' then 'Education' else '' end
  into org_industry
  from snapshots
  where snapshots.id = p_snapshot_id;

  insert into organizations (
    name, slug, status, org_type, parent_id, legal_name, industry, logo_url,
    primary_color, accent_color, form_key, sending_enabled, sender_name, plan_key, branding, settings
  ) values (
    btrim(p_name),
    chosen_slug,
    'active',
    'client',
    parent,
    btrim(p_name),
    coalesce(org_industry, ''),
    coalesce(p_logo_url, ''),
    chosen_primary,
    chosen_accent,
    chosen_slug,
    false,
    sender,
    p_plan_key,
    jsonb_build_object('logoUrl', coalesce(p_logo_url, ''), 'primaryColor', chosen_primary, 'accentColor', chosen_accent),
    jsonb_build_object(
      'channels', jsonb_build_object(
        'whatsapp', jsonb_build_object('phoneNumberId', '', 'displayPhone', ''),
        'email', jsonb_build_object('fromAddress', '', 'provider', ''),
        'sms', jsonb_build_object('senderId', '')
      ),
      'shopify', jsonb_build_object('adminAccessToken', '', 'webhookSecret', '', 'apiVersion', '2025-01')
    )
  )
  returning id, sending_enabled into new_id, enabled;

  if enabled is distinct from false then
    raise exception 'sending must stay off';
  end if;

  perform public.snapshot_apply(p_snapshot_id, new_id);

  insert into invitations (org_id, email, role, token_hash, invited_by, expires_at)
  values (
    new_id,
    lower(btrim(p_invite_email)),
    'client_admin',
    p_invite_token_hash,
    auth.uid(),
    now() + interval '14 days'
  );

  select sending_enabled into enabled from organizations where id = new_id;
  if enabled is distinct from false then
    raise exception 'sending must stay off';
  end if;

  return jsonb_build_object(
    'org_id', new_id,
    'slug', chosen_slug,
    'snapshot_id', p_snapshot_id,
    'sending_enabled', false,
    'plan_key', p_plan_key
  );
end;
$$;
