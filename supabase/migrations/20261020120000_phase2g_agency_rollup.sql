-- Phase 2g: agency rollup and white-label host lookup.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Sandbox billing is unchanged. This file does not call a payment provider.
-- agency_rollup(agency_id, from, to) is security definer. The caller must be
-- an agency_owner or agency_staff of that agency. A client_admin is denied.
-- workspace_period_metrics uses the same numbers for one workspace.
-- resolve_custom_domain returns public brand fields only.
-- Until a domain is attached in Vercel, /d/<host>/login sets the test host cookie.

create or replace function public.period_metrics_for_org(p_org uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_org is null or p_from is null or p_to is null or p_from >= p_to then
    raise exception 'invalid period';
  end if;

  with days as (
    select series.day::date as day
    from generate_series(
      (p_from at time zone 'Africa/Johannesburg')::date::timestamp,
      ((p_to at time zone 'Africa/Johannesburg')::date - 1)::timestamp,
      interval '1 day'
    ) as series(day)
  ),
  day_window as (
    select day from days order by day desc limit 31
  ),
  spark as (
    select coalesce(
      jsonb_agg(cnt order by day),
      '[]'::jsonb
    ) as series
    from (
      select windowed.day,
        (
          select count(*)
          from public.crm_leads lead
          where lead.org_id = p_org
            and lead.created_at >= p_from
            and lead.created_at < p_to
            and (lead.created_at at time zone 'Africa/Johannesburg')::date = windowed.day
        ) as cnt
      from (select day from day_window order by day) as windowed
    ) counted
  ),
  inbound as (
    select
      message.conversation_id,
      message.created_at,
      (
        select min(reply.created_at)
        from public.messages reply
        where reply.conversation_id = message.conversation_id
          and reply.org_id = message.org_id
          and reply.direction = 'out'
          and reply.created_at >= message.created_at
          and reply.status not in ('blocked_consent', 'cancelled', 'failed')
      ) as reply_at
    from public.messages message
    where message.org_id = p_org
      and message.direction = 'in'
      and message.created_at >= p_from
      and message.created_at < p_to
  ),
  response_stats as (
    select
      percentile_cont(0.5) within group (order by extract(epoch from (reply_at - created_at))) as median_seconds,
      count(*) filter (
        where (reply_at is null or reply_at > created_at + interval '2 hours')
          and created_at + interval '2 hours' <= p_to
      ) as unanswered_over_2h
    from inbound
  ),
  channel_counts as (
    select coalesce(
      jsonb_object_agg(channel, n),
      '{}'::jsonb
    ) as counts
    from (
      select message.channel, count(*) as n
      from public.messages message
      where message.org_id = p_org
        and message.created_at >= p_from
        and message.created_at < p_to
      group by message.channel
    ) grouped
  ),
  usage as (
    select
      coalesce(sum(cost_cents) filter (where meter in ('sms', 'wa_marketing', 'wa_utility', 'wa_service')), 0) as cost_cents,
      coalesce(sum(unit_price_cents * quantity) filter (where meter in ('sms', 'wa_marketing', 'wa_utility', 'wa_service')), 0) as billed_cents
    from public.usage_ledger
    where org_id = p_org
      and occurred_at >= p_from
      and occurred_at < p_to
  ),
  consent as (
    select
      count(*) filter (
        where status = 'opted_out'
          and coalesce(withdrawn_at, captured_at) >= p_from
          and coalesce(withdrawn_at, captured_at) < p_to
      ) as opted_out,
      count(*) filter (
        where (captured_at >= p_from and captured_at < p_to)
          or (
            status = 'opted_out'
            and coalesce(withdrawn_at, captured_at) >= p_from
            and coalesce(withdrawn_at, captured_at) < p_to
          )
      ) as decisions
    from public.contact_consents
    where org_id = p_org
  )
  select jsonb_build_object(
    'new_leads', (
      select count(*) from public.crm_leads lead
      where lead.org_id = p_org and lead.created_at >= p_from and lead.created_at < p_to
    ),
    'median_first_response_seconds', (select median_seconds from response_stats),
    'open_pipeline_zar', coalesce((
      select sum(lead.value_zar)
      from public.crm_leads lead
      where lead.org_id = p_org
        and lead.created_at < p_to
        and lead.stage not in ('Lost', 'Won', 'Onboarding/Handover')
    ), 0),
    'won_zar', coalesce((
      select sum(lead.value_zar)
      from public.crm_leads lead
      where lead.org_id = p_org
        and lead.stage in ('Won', 'Onboarding/Handover')
        and coalesce(lead.won_at, lead.stage_changed_at, lead.created_at) >= p_from
        and coalesce(lead.won_at, lead.stage_changed_at, lead.created_at) < p_to
    ), 0),
    'messages_by_channel', (
      select jsonb_build_object(
        'whatsapp', coalesce((counts ->> 'whatsapp')::int, 0),
        'sms', coalesce((counts ->> 'sms')::int, 0),
        'email', coalesce((counts ->> 'email')::int, 0),
        'facebook', coalesce((counts ->> 'facebook')::int, 0),
        'instagram', coalesce((counts ->> 'instagram')::int, 0)
      )
      from channel_counts
    ),
    'wa_sms_cost_cents', (select cost_cents from usage),
    'wa_sms_billed_cents', (select billed_cents from usage),
    'opt_out_rate', (
      select case when decisions = 0 then 0 else round(opted_out::numeric / decisions, 4) end from consent
    ),
    'opted_out', (select opted_out from consent),
    'consent_decisions', (select decisions from consent),
    'blocked_consent_count',
      (
        select count(*) from public.messages message
        where message.org_id = p_org
          and message.status = 'blocked_consent'
          and message.created_at >= p_from
          and message.created_at < p_to
      )
      + (
        select count(*) from public.crm_outbox box
        where box.org_id = p_org
          and box.status = 'blocked_consent'
          and box.created_at >= p_from
          and box.created_at < p_to
          and not exists (
            select 1 from public.messages message
            where message.org_id = p_org and message.outbox_id = box.id
          )
      ),
    'failed_workflow_runs', (
      select count(*) from public.workflow_runs run
      where run.org_id = p_org
        and run.status = 'failed'
        and run.updated_at >= p_from
        and run.updated_at < p_to
    ),
    'outbox_held', (
      select count(*) from public.crm_outbox box
      where box.org_id = p_org and box.status = 'held'
    ),
    'subscription_status', (
      select sub.status from public.org_subscriptions sub where sub.org_id = p_org
    ),
    'unanswered_over_2h', (select unanswered_over_2h from response_stats),
    'failed_messages', (
      select count(*) from public.messages message
      where message.org_id = p_org
        and message.status = 'failed'
        and message.created_at >= p_from
        and message.created_at < p_to
    ),
    'sparkline', (select series from spark)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.period_metrics_for_org(uuid, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.workspace_period_metrics(org_id uuid, from_ts timestamptz, to_ts timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or org_id is null or org_id not in (select public.accessible_org_ids()) then
    raise exception 'workspace access required' using errcode = '42501';
  end if;
  return public.period_metrics_for_org(org_id, from_ts, to_ts);
end;
$$;

create or replace function public.agency_rollup(agency_id uuid, from_ts timestamptz, to_ts timestamptz)
returns table (
  org_id uuid,
  slug text,
  name text,
  custom_domain text,
  primary_color text,
  metrics jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or agency_id is null
    or not exists (
      select 1 from public.organizations org
      where org.id = agency_id and org.org_type = 'agency'
    )
    or not exists (
      select 1 from public.memberships member
      where member.user_id = auth.uid()
        and member.org_id = agency_id
        and member.role in ('agency_owner', 'agency_staff')
    )
  then
    raise exception 'agency membership required' using errcode = '42501';
  end if;

  return query
  select
    child.id,
    child.slug,
    child.name,
    child.custom_domain,
    child.primary_color,
    public.period_metrics_for_org(child.id, from_ts, to_ts)
  from public.organizations child
  where child.parent_id = agency_id
    and child.org_type = 'client'
    and (
      exists (
        select 1 from public.memberships member
        where member.user_id = auth.uid()
          and member.org_id = agency_id
          and member.role = 'agency_owner'
      )
      or exists (
        select 1 from public.memberships member
        where member.user_id = auth.uid()
          and member.org_id = agency_id
          and member.role = 'agency_staff'
          and (
            not exists (select 1 from public.member_org_access access where access.member_id = member.id)
            or exists (
              select 1 from public.member_org_access access
              where access.member_id = member.id and access.org_id = child.id
            )
          )
      )
    )
  order by child.name;
end;
$$;

revoke all on function public.workspace_period_metrics(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.agency_rollup(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.workspace_period_metrics(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.agency_rollup(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.resolve_custom_domain(p_host text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  host text := lower(btrim(coalesce(p_host, '')));
  matched public.organizations%rowtype;
begin
  host := regexp_replace(host, ':\d+$', '');
  host := regexp_replace(host, '\.$', '');
  if host = '' or host ~ '[^a-z0-9.-]' or length(host) > 253 or host like '.%' or host like '%..%' then
    return null;
  end if;

  select * into matched
  from public.organizations
  where custom_domain = host
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'slug', matched.slug,
    'name', matched.name,
    'org_type', matched.org_type,
    'sender_name', matched.sender_name,
    'logo_url', coalesce(matched.logo_url, ''),
    'primary_color', matched.primary_color,
    'accent_color', matched.accent_color,
    'branding', matched.branding,
    'custom_domain', matched.custom_domain
  );
end;
$$;

revoke all on function public.resolve_custom_domain(text) from public;
grant execute on function public.resolve_custom_domain(text) to anon, authenticated;
