-- Phase 5i: one-click East Rand sandbox campaign seed.
-- Additive. No rows are deleted. No new prospect table is created.
-- The seed calls save_campaign_csv_import from phase 5f.
-- Campaign status stays draft. queued_count and sent_count stay 0. charged stays false.
-- Send now and go live call refuse_campaign_csv_send. Nothing is queued.
-- The ops readiness checklist is read-only in the app. This file stores no secrets.
-- Leave EAST_RAND_CAMPAIGN_SEED_ENABLED unset until this file is applied.
-- Leave AI_REPLY_CRON_ENABLED unset. Do not turn sending on. Do not schedule a cron.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.campaign_csv_imports') is null
     or to_regclass('public.campaign_csv_prospects') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.save_campaign_csv_import(uuid, text, jsonb)') is null
     or to_regprocedure('public.refuse_campaign_csv_send(uuid, text)') is null then
    raise exception 'phase 5i needs phase 5f; apply 20261102120000_phase5f_campaign_csv_channels.sql before this file';
  end if;
end
$need$;

create or replace function public.seed_east_rand_sandbox_campaign(p_org uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.campaign_csv_imports%rowtype;
  saved jsonb;
  sending boolean;
  already boolean := false;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if to_regprocedure('public.save_campaign_csv_import(uuid, text, jsonb)') is null then
    raise exception 'apply step 27 before the East Rand sandbox seed';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows required';
  end if;

  select * into existing
  from public.campaign_csv_imports i
  where i.org_id = p_org
    and i.campaign_name = 'East Rand sandbox (draft)'
    and i.rows = p_rows
    and i.sandbox
    and i.status = 'sandbox'
    and i.campaign_status = 'draft'
    and i.charged = false
    and i.queued_count = 0
    and i.sent_count = 0
  order by i.created_at desc
  limit 1;
  already := found;

  select o.sending_enabled into sending
  from public.organizations o
  where o.id = p_org;

  if already then
    return jsonb_build_object(
      'id', existing.id,
      'status', 'sandbox',
      'campaign_status', 'draft',
      'campaign_name', existing.campaign_name,
      'imported', existing.imported_count,
      'skipped', existing.skipped_count,
      'recipient_count', existing.recipient_count,
      'would_receive', existing.would_receive,
      'blocked', existing.blocked_count,
      'consent_breakdown', existing.consent_breakdown,
      'estimated_cost_cents', existing.estimated_cost_cents,
      'report', existing.report,
      'sandbox', true,
      'charged', false,
      'queued', 0,
      'sent', 0,
      'sending_enabled', coalesce(sending, false),
      'label', 'sandbox',
      'seed', 'east_rand',
      'reused', true
    );
  end if;

  saved := public.save_campaign_csv_import(p_org, 'East Rand sandbox (draft)', p_rows);

  if coalesce(saved->>'campaign_status', '') <> 'draft'
     or coalesce(saved->>'status', '') <> 'sandbox'
     or coalesce(saved->>'campaign_name', '') <> 'East Rand sandbox (draft)'
     or coalesce((saved->>'sandbox')::boolean, false) is distinct from true
     or coalesce((saved->>'charged')::boolean, true)
     or coalesce((saved->>'queued')::int, 1) <> 0
     or coalesce((saved->>'sent')::int, 1) <> 0 then
    raise exception 'sandbox seed refused';
  end if;

  return saved || jsonb_build_object(
    'label', 'sandbox',
    'seed', 'east_rand',
    'reused', false
  );
end;
$$;

create or replace function public.refuse_east_rand_seed_send(p_org uuid, p_intent text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if to_regprocedure('public.refuse_campaign_csv_send(uuid, text)') is null then
    raise exception 'apply step 27 before the East Rand sandbox seed';
  end if;

  result := public.refuse_campaign_csv_send(p_org, p_intent);

  if coalesce((result->>'refused')::boolean, false) is distinct from true
     or coalesce((result->>'queued')::int, 1) <> 0
     or coalesce((result->>'sent')::int, 1) <> 0
     or coalesce((result->>'charged')::boolean, true) then
    raise exception 'seed send refused';
  end if;

  return result || jsonb_build_object(
    'label', 'sandbox',
    'seed', 'east_rand'
  );
end;
$$;

revoke all on function public.seed_east_rand_sandbox_campaign(uuid, jsonb) from public, anon;
revoke all on function public.refuse_east_rand_seed_send(uuid, text) from public, anon;
grant execute on function public.seed_east_rand_sandbox_campaign(uuid, jsonb) to authenticated;
grant execute on function public.refuse_east_rand_seed_send(uuid, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.seed_east_rand_sandbox_campaign(uuid, jsonb) to service_role;
    grant execute on function public.refuse_east_rand_seed_send(uuid, text) to service_role;
  end if;
end
$service_grants$;

comment on function public.seed_east_rand_sandbox_campaign(uuid, jsonb) is
  'Dry-loads the East Rand sandbox fixture through save_campaign_csv_import. Status stays draft. queued and sent stay 0. charged stays false. Label is sandbox. Does not turn sending on.';
comment on function public.refuse_east_rand_seed_send(uuid, text) is
  'Refuses send now and go live for the East Rand sandbox seed by calling refuse_campaign_csv_send. Writes nothing and does not turn sending on.';
