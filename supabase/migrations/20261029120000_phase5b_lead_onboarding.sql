-- Phase 5b: Lead Agent onboarding drafts.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- One sandbox draft per organisation. The trial uses start_recommended_sandbox_team.
-- A partial slug list is refused. price_placeholder stays true. charged stays false.
-- This file does not call E2B, Browserbase, PayFast, Paystack, or Yoco.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.bot_templates') is null
     or to_regclass('public.bot_bundles') is null
     or to_regclass('public.bot_bundle_items') is null
     or to_regprocedure('public.start_recommended_sandbox_team(uuid, text[])') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5b needs phase 4a bots; apply 20261024120000_phase4a_bots.sql before this file';
  end if;
end
$need$;

create table if not exists public.lead_onboarding_drafts (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  template_slug text not null,
  bot_slugs text[] not null,
  business jsonb not null default '{}'::jsonb,
  agent_answers jsonb not null default '{}'::jsonb,
  quote jsonb not null default '{}'::jsonb,
  status text not null default 'sandbox_trial' check (status = 'sandbox_trial'),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  price_placeholder boolean not null default true check (price_placeholder),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lead_onboarding_drafts enable row level security;

drop policy if exists lead_onboarding_drafts_read on public.lead_onboarding_drafts;
create policy lead_onboarding_drafts_read on public.lead_onboarding_drafts
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists lead_onboarding_drafts_insert on public.lead_onboarding_drafts;
create policy lead_onboarding_drafts_insert on public.lead_onboarding_drafts
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists lead_onboarding_drafts_update on public.lead_onboarding_drafts;
create policy lead_onboarding_drafts_update on public.lead_onboarding_drafts
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

revoke all on table public.lead_onboarding_drafts from public, anon;
grant select, insert, update on table public.lead_onboarding_drafts to authenticated;

create or replace function public.record_lead_onboarding_trial(
  p_org uuid,
  p_template_slug text,
  p_slugs text[],
  p_business jsonb,
  p_agent_answers jsonb,
  p_quote jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text[];
  given text[];
  trial jsonb;
  sending boolean;
  stored_quote jsonb;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if p_template_slug is null or p_template_slug !~ '^[a-z0-9-]{1,80}$' then
    raise exception 'unknown team';
  end if;

  if jsonb_typeof(coalesce(p_business, 'null'::jsonb)) is distinct from 'object'
     or jsonb_typeof(coalesce(p_agent_answers, 'null'::jsonb)) is distinct from 'object' then
    raise exception 'answers required';
  end if;

  if lower(coalesce(p_quote->>'charged', 'false')) = 'true'
     or lower(coalesce(p_quote->>'price_placeholder', 'true')) = 'false'
     or lower(coalesce(p_quote->>'sandbox', 'true')) = 'false' then
    raise exception 'sandbox trial only';
  end if;

  select array_agg(i.bot_slug order by i.bot_slug)
    into expected
  from public.bot_templates t
  join public.bot_bundles b on b.slug = t.bundle_slug
  join public.bot_bundle_items i on i.bundle_id = b.id
  where t.slug = p_template_slug;

  if expected is null or cardinality(expected) < 1 then
    raise exception 'unknown team';
  end if;

  select array_agg(distinct u.slug order by u.slug)
    into given
  from unnest(coalesce(p_slugs, array[]::text[])) as u(slug)
  where u.slug is not null and u.slug <> '';

  if given is distinct from expected then
    raise exception 'full team required';
  end if;

  if cardinality(given) > 8 then
    raise exception 'full team required';
  end if;

  stored_quote := coalesce(p_quote, '{}'::jsonb) || jsonb_build_object(
    'sandbox', true,
    'charged', false,
    'price_placeholder', true,
    'currency', 'ZAR',
    'prices_exclude_vat', true
  );

  insert into public.lead_onboarding_drafts (
    org_id, template_slug, bot_slugs, business, agent_answers, quote,
    status, sandbox, charged, price_placeholder, updated_at
  ) values (
    p_org, p_template_slug, given, p_business, p_agent_answers, stored_quote,
    'sandbox_trial', true, false, true, now()
  )
  on conflict (org_id) do update set
    template_slug = excluded.template_slug,
    bot_slugs = excluded.bot_slugs,
    business = excluded.business,
    agent_answers = excluded.agent_answers,
    quote = excluded.quote,
    status = 'sandbox_trial',
    sandbox = true,
    charged = false,
    price_placeholder = true,
    updated_at = now();

  trial := public.start_recommended_sandbox_team(p_org, given);

  if coalesce((trial->>'charged')::boolean, false)
     or coalesce((trial->>'sandbox')::boolean, true) is distinct from true then
    raise exception 'sandbox trial refused';
  end if;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return trial || jsonb_build_object(
    'template_slug', p_template_slug,
    'full_team', true,
    'price_placeholder', true,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.record_lead_onboarding_trial(uuid, text, text[], jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.record_lead_onboarding_trial(uuid, text, text[], jsonb, jsonb, jsonb) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on table public.lead_onboarding_drafts to service_role;
    grant execute on function public.record_lead_onboarding_trial(uuid, text, text[], jsonb, jsonb, jsonb) to service_role;
  end if;
end
$service_grants$;
