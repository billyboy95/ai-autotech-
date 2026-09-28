-- Phase 5h: sandbox Zentrix Online workspace pack.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- This file does not apply the pack. After it is on the database, an agency
-- owner or staff member uses Apply Zentrix pack to Zentrix Online in the app.
-- The pack stores three Shopify store stubs on the existing Zentrix client.
-- It does not create a second organisation. It does not call Shopify.
-- No Admin API key and no client secret is stored. No provider login flow runs.
-- Contacts, messages, secrets, and outbox rows are not copied.
-- Publish, send, and go live are refused. Nothing is charged. No ad is bought.
-- Leave ZENTRIX_WORKSPACE_PACK_ENABLED unset until this file is applied.
-- Leave AI_REPLY_CRON_ENABLED unset. Do not turn sending on.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.accessible_org_ids()') is null then
    raise exception 'phase 5h needs phase 2a; apply 20260926200000_phase2a_access.sql before this file';
  end if;
end
$need$;

create table if not exists public.zentrix_store_stubs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  store_key text not null check (store_key in ('pets', 'kitchens', 'auto')),
  label text not null,
  handle text not null,
  storefront_url text not null,
  intended_public_host text not null default '',
  priority boolean not null,
  purpose text not null check (purpose in ('priority', 'qa_reference')),
  ad_target boolean not null,
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  secret_stored boolean not null default false check (secret_stored = false),
  provider_keys_present boolean not null default false check (provider_keys_present = false),
  published boolean not null default false check (published = false),
  queued_count integer not null default 0 check (queued_count = 0),
  sent_count integer not null default 0 check (sent_count = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zentrix_store_stubs_org_key unique (org_id, store_key),
  constraint zentrix_store_stubs_handle unique (handle),
  constraint zentrix_store_stubs_catalogue check (
    (
      store_key = 'pets'
      and label = 'Pets'
      and handle = 'w1y2f0-rk'
      and storefront_url = 'https://w1y2f0-rk.myshopify.com'
      and intended_public_host = 'pets.zentrixonline.co.za'
      and priority
      and purpose = 'priority'
      and ad_target
    )
    or (
      store_key = 'kitchens'
      and label = 'Kitchens'
      and handle = 'desj1r-ic'
      and storefront_url = 'https://desj1r-ic.myshopify.com'
      and intended_public_host = 'kitchens.zentrixonline.co.za'
      and priority
      and purpose = 'priority'
      and ad_target
    )
    or (
      store_key = 'auto'
      and label = 'Auto'
      and handle = '80ce1e-p8'
      and storefront_url = 'https://80ce1e-p8.myshopify.com'
      and intended_public_host = ''
      and not priority
      and purpose = 'qa_reference'
      and not ad_target
    )
  )
);

create index if not exists zentrix_store_stubs_org_idx
  on public.zentrix_store_stubs (org_id, store_key);

alter table public.zentrix_store_stubs enable row level security;
alter table public.zentrix_store_stubs force row level security;

drop policy if exists zentrix_store_stubs_read on public.zentrix_store_stubs;
create policy zentrix_store_stubs_read on public.zentrix_store_stubs
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

revoke all on table public.zentrix_store_stubs from public, anon, authenticated;
grant select on table public.zentrix_store_stubs to authenticated;

create or replace function public.zentrix_pack_private_rows()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rel text;
  total bigint := 0;
  part bigint;
begin
  foreach rel in array array[
    'crm_leads',
    'crm_contacts',
    'crm_prospects',
    'crm_outbox',
    'crm_lead_activity',
    'workspace_messages',
    'messages',
    'conversations',
    'invitations',
    'workspace_shopify_orders',
    'workspace_shopify_customers',
    'workspace_shopify_checkouts'
  ]
  loop
    if to_regclass('public.' || rel) is not null then
      execute format('select count(*) from public.%I', rel) into part;
      total := total + coalesce(part, 0);
    end if;
  end loop;
  if to_regclass('private.channel_secrets') is not null then
    execute 'select count(*) from private.channel_secrets' into part;
    total := total + coalesce(part, 0);
  end if;
  return total;
end;
$$;

create or replace function public.apply_zentrix_workspace_pack()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  zentrix_seed uuid := 'b1000000-0000-4000-8000-000000000010';
  target uuid;
  by_slug uuid;
  by_id uuid;
  sending boolean;
  before_private bigint;
  after_private bigint;
  before_orgs bigint;
  shopify_before bigint;
  shopify_after bigint;
  stores jsonb;
  meta jsonb;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;

  select id into by_slug
  from organizations
  where slug = 'zentrix'
    and org_type = 'client';

  select id into by_id
  from organizations
  where id = zentrix_seed;

  if by_slug is not null and by_id is not null and by_slug is distinct from by_id then
    raise exception 'Zentrix slug and seed id point at different organisations';
  end if;

  target := coalesce(by_slug, by_id);
  if target is null then
    raise exception 'Zentrix client workspace was not found';
  end if;

  if not exists (
    select 1
    from organizations child
    join organizations parent on parent.id = child.parent_id
    where child.id = target
      and child.slug = 'zentrix'
      and child.org_type = 'client'
      and parent.slug = 'ai-autotech'
  ) then
    raise exception 'Zentrix client workspace was not found';
  end if;

  if not public.has_org_role(target, array['agency_owner', 'agency_staff']) then
    raise exception 'not allowed';
  end if;

  select sending_enabled into sending from organizations where id = target;
  if sending is distinct from false then
    raise exception 'sending must stay off';
  end if;

  before_private := public.zentrix_pack_private_rows();
  select count(*) into before_orgs from organizations;

  shopify_before := null;
  if to_regclass('public.workspace_shopify_stores') is not null then
    execute 'select count(*) from public.workspace_shopify_stores' into shopify_before;
    execute $domains$
      update public.workspace_shopify_stores
      set myshopify_domain = case niche
        when 'Pets' then 'w1y2f0-rk.myshopify.com'
        when 'Kitchens' then 'desj1r-ic.myshopify.com'
        when 'Auto' then '80ce1e-p8.myshopify.com'
        else myshopify_domain
      end
      where org_id = $1
        and niche in ('Pets', 'Kitchens', 'Auto')
    $domains$ using target;
    execute 'select count(*) from public.workspace_shopify_stores' into shopify_after;
    if shopify_after is distinct from shopify_before then
      raise exception 'zentrix pack must not add or remove shopify catalogue rows';
    end if;
  end if;

  insert into public.zentrix_store_stubs (
    org_id, store_key, label, handle, storefront_url, intended_public_host,
    priority, purpose, ad_target, sandbox, charged, secret_stored, provider_keys_present,
    published, queued_count, sent_count, updated_at
  ) values
    (
      target, 'pets', 'Pets', 'w1y2f0-rk', 'https://w1y2f0-rk.myshopify.com', 'pets.zentrixonline.co.za',
      true, 'priority', true, true, false, false, false, false, 0, 0, now()
    ),
    (
      target, 'kitchens', 'Kitchens', 'desj1r-ic', 'https://desj1r-ic.myshopify.com', 'kitchens.zentrixonline.co.za',
      true, 'priority', true, true, false, false, false, false, 0, 0, now()
    ),
    (
      target, 'auto', 'Auto', '80ce1e-p8', 'https://80ce1e-p8.myshopify.com', '',
      false, 'qa_reference', false, true, false, false, false, false, 0, 0, now()
    )
  on conflict (org_id, store_key) do update
  set label = excluded.label,
      handle = excluded.handle,
      storefront_url = excluded.storefront_url,
      intended_public_host = excluded.intended_public_host,
      priority = excluded.priority,
      purpose = excluded.purpose,
      ad_target = excluded.ad_target,
      sandbox = true,
      charged = false,
      secret_stored = false,
      provider_keys_present = false,
      published = false,
      queued_count = 0,
      sent_count = 0,
      updated_at = now();

  select sending_enabled into sending from organizations where id = target;
  if sending is distinct from false then
    raise exception 'sending must stay off';
  end if;

  after_private := public.zentrix_pack_private_rows();
  if after_private is distinct from before_private then
    raise exception 'zentrix pack must not copy contacts, messages, or secrets';
  end if;
  if (select count(*) from organizations) is distinct from before_orgs then
    raise exception 'zentrix pack must not create a workspace';
  end if;
  if (select count(*) from organizations where slug = 'zentrix') is distinct from 1 then
    raise exception 'zentrix pack must not create a workspace';
  end if;
  if (select count(*) from public.zentrix_store_stubs where org_id = target) is distinct from 3 then
    raise exception 'zentrix pack must store exactly three stubs';
  end if;
  if exists (
    select 1
    from public.zentrix_store_stubs stub
    where stub.org_id = target
      and (
        stub.sandbox is distinct from true
        or stub.charged is distinct from false
        or stub.secret_stored is distinct from false
        or stub.provider_keys_present is distinct from false
        or stub.published is distinct from false
        or stub.queued_count is distinct from 0
        or stub.sent_count is distinct from 0
      )
  ) then
    raise exception 'zentrix pack stubs must stay sandbox';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'store_key', stub.store_key,
    'label', stub.label,
    'handle', stub.handle,
    'storefront_url', stub.storefront_url,
    'intended_public_host', stub.intended_public_host,
    'priority', stub.priority,
    'purpose', stub.purpose,
    'ad_target', stub.ad_target,
    'sandbox', stub.sandbox,
    'charged', stub.charged,
    'secret_stored', stub.secret_stored,
    'provider_keys_present', stub.provider_keys_present,
    'published', stub.published,
    'queued', stub.queued_count,
    'sent', stub.sent_count
  ) order by case stub.store_key when 'pets' then 1 when 'kitchens' then 2 else 3 end), '[]'::jsonb)
  into stores
  from public.zentrix_store_stubs stub
  where stub.org_id = target;

  meta := jsonb_build_object(
    'slug', 'zentrix',
    'org_id', target,
    'sending_enabled', false,
    'sandbox', true,
    'charged', false,
    'secret_stored', false,
    'provider_keys_present', false,
    'stores', stores
  );

  insert into org_activity (org_id, actor_id, action, entity, entity_id, meta, acting_as_agency)
  values (target, auth.uid(), 'zentrix.pack_applied', 'zentrix_store_stub', target::text, meta, true);

  if to_regclass('public.activity_logs') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'activity_logs' and column_name = 'org_id'
    ) then
      insert into activity_logs (actor_id, entity_type, entity_id, action, metadata, org_id)
      values (auth.uid(), 'zentrix_store_stub', target, 'zentrix.pack_applied', meta, target);
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'activity_logs' and column_name = 'organization_id'
    ) then
      insert into activity_logs (actor_id, entity_type, entity_id, action, metadata, organization_id)
      values (auth.uid(), 'zentrix_store_stub', target, 'zentrix.pack_applied', meta, target);
    else
      insert into activity_logs (actor_id, entity_type, entity_id, action, metadata)
      values (auth.uid(), 'zentrix_store_stub', target, 'zentrix.pack_applied', meta);
    end if;
  end if;

  return jsonb_build_object(
    'org_id', target,
    'slug', 'zentrix',
    'sending_enabled', false,
    'sandbox', true,
    'charged', false,
    'secret_stored', false,
    'provider_keys_present', false,
    'published', false,
    'queued', 0,
    'sent', 0,
    'stores', stores
  );
end;
$$;

create or replace function public.refuse_zentrix_outbound(p_org uuid, p_intent text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sending boolean;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;
  if not public.has_org_role(p_org, array['agency_owner', 'agency_staff']) then
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
    'ad_spend', false,
    'sandbox', true,
    'charged', false,
    'secret_stored', false,
    'provider_keys_present', false,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.zentrix_pack_private_rows() from public, anon, authenticated;
revoke all on function public.apply_zentrix_workspace_pack() from public, anon;
revoke all on function public.refuse_zentrix_outbound(uuid, text) from public, anon;
grant execute on function public.apply_zentrix_workspace_pack() to authenticated;
grant execute on function public.refuse_zentrix_outbound(uuid, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on table public.zentrix_store_stubs to service_role;
    grant execute on function public.apply_zentrix_workspace_pack() to service_role;
    grant execute on function public.refuse_zentrix_outbound(uuid, text) to service_role;
  end if;
end
$service_grants$;

comment on table public.zentrix_store_stubs is
  'Sandbox Shopify store stubs for Zentrix Online. Pets and Kitchens are priority. Auto is QA / reference and is not an ad target. sandbox stays true. charged stays false. No provider key is stored. Nothing is published.';
comment on function public.apply_zentrix_workspace_pack() is
  'Upserts the three Zentrix Online store stubs onto the existing client workspace. Does not create an organisation, does not call Shopify, and does not turn sending on.';
comment on function public.refuse_zentrix_outbound(uuid, text) is
  'Refuses publish, send, go live, and ad spend for the Zentrix pack. Writes nothing and does not turn sending on.';
