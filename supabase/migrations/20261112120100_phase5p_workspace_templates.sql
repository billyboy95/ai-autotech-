-- Phase 5p: workspace templates (snapshot v2) and duplicate-with-swap.
-- Additive. Does not delete rows. Does not send. Does not charge.
-- sending_enabled stays false. Message templates, sequences, and workflows copied
-- by duplicate_workspace are stored inactive. AI replies stay draft_only and off.
-- Do not apply this file to production from an agent. Paste it once in the SQL editor
-- after 20261112120000_phase5p_sales_funnel.sql (that file follows step 36),
-- only when Billy says yes. Do not use supabase db push.

do $need$
begin
  if to_regclass('public.snapshots') is null
     or to_regclass('public.workflows') is null
     or to_regprocedure('public.snapshot_apply_payload(uuid, jsonb, boolean)') is null
     or to_regprocedure('public.snapshot_payload_issues(jsonb)') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.accessible_org_ids()') is null then
    raise exception 'workspace templates need snapshots, workflows, and agency roles';
  end if;
  if to_regclass('public.calendars') is null or to_regclass('public.booking_links') is null then
    raise exception 'workspace templates need calendars; apply 20261022120000_phase3b_calendars.sql first';
  end if;
  if to_regclass('public.ai_reply_settings') is null then
    raise exception 'workspace templates need AI reply settings; apply 20261021120000_phase3a_conversation_ai.sql first';
  end if;
  if to_regclass('public.org_bots') is null or to_regclass('public.bot_catalog') is null then
    raise exception 'workspace templates need the bot catalogue; apply 20261024120000_phase4a_bots.sql first';
  end if;
end
$need$;

alter table public.calendars add column if not exists asset_key text not null default '';
alter table public.calendar_event_types add column if not exists asset_key text not null default '';
alter table public.booking_links add column if not exists asset_key text not null default '';

create unique index if not exists calendars_org_asset_key_idx
  on public.calendars (org_id, asset_key) where asset_key <> '';
create unique index if not exists calendar_event_types_org_asset_key_idx
  on public.calendar_event_types (org_id, asset_key) where asset_key <> '';
create unique index if not exists booking_links_org_asset_key_idx
  on public.booking_links (org_id, asset_key) where asset_key <> '';

create table if not exists public.workspace_tags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  asset_key text not null,
  name text not null,
  color text not null default '#0B1F3A',
  created_at timestamptz not null default now(),
  unique (org_id, asset_key)
);

create table if not exists public.client_website_configs (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_website_configs_object check (jsonb_typeof(config) = 'object')
);

create table if not exists public.ai_knowledge_bases (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_bases_array check (jsonb_typeof(entries) = 'array')
);

create table if not exists public.workspace_agent_teams (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  template_slug text not null default '',
  agents text[] not null default '{}'::text[],
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_duplicates (
  id uuid primary key default gen_random_uuid(),
  agency_org_id uuid not null references public.organizations(id) on delete cascade,
  idempotency_key text not null,
  source_kind text not null check (source_kind in ('snapshot', 'workspace')),
  source_id uuid not null,
  target_org_id uuid not null references public.organizations(id) on delete cascade,
  swap jsonb not null,
  created_at timestamptz not null default now(),
  unique (agency_org_id, idempotency_key)
);

create index if not exists workspace_duplicates_target_idx on public.workspace_duplicates (target_org_id);

create or replace function public.snapshot_walk_zoned(doc jsonb, forbidden text[], issues text[], public_zone boolean)
returns text[]
language plpgsql
stable
as $$
declare
  key text;
  child jsonb;
  raw text;
  scrubbed text;
  next_zone boolean;
begin
  if doc is null or jsonb_typeof(doc) = 'null' then
    return issues;
  end if;
  if jsonb_typeof(doc) = 'object' then
    for key, child in select entry.key, entry.value from jsonb_each(doc) as entry
    loop
      next_zone := public_zone or lower(key) in ('website', 'ai_knowledge');
      if lower(key) = any (forbidden) then
        if not (public_zone and lower(key) in ('email', 'phone')) then
          issues := array_append(issues, key);
        end if;
      end if;
      if (lower(key) = 'asset_key' or lower(key) like '%\_asset_key' escape '\')
         and jsonb_typeof(child) = 'string' then
        raw := child #>> '{}';
        if raw ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
          issues := array_append(issues, 'email_address');
        end if;
        if raw ~* '(sk_live_|whsec_|api[_-]?key[[:space:]]*[:=]|bearer[[:space:]]+[a-z0-9]|secret[[:space:]]*[:=])' then
          issues := array_append(issues, 'secret_value');
        end if;
      else
        issues := public.snapshot_walk_zoned(child, forbidden, issues, next_zone);
      end if;
    end loop;
  elsif jsonb_typeof(doc) = 'array' then
    for child in select entry.value from jsonb_array_elements(doc) as entry
    loop
      issues := public.snapshot_walk_zoned(child, forbidden, issues, public_zone);
    end loop;
  elsif jsonb_typeof(doc) = 'string' then
    raw := doc #>> '{}';
    if not public_zone and raw ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
      issues := array_append(issues, 'email_address');
    end if;
    if raw ~* '(sk_live_|whsec_|api[_-]?key[[:space:]]*[:=]|bearer[[:space:]]+[a-z0-9]|secret[[:space:]]*[:=])' then
      issues := array_append(issues, 'secret_value');
    end if;
    scrubbed := regexp_replace(
      raw,
      '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
      '',
      'g'
    );
    if not public_zone
       and raw !~ '^(pipeline|stage|template|sequence|step|field|workflow|campaign):[A-Za-z0-9_.:-]+$'
       and scrubbed ~ '[[:digit:]]{10,}' then
      issues := array_append(issues, 'phone_number');
    end if;
  end if;
  return issues;
end;
$$;

create or replace function public.snapshot_walk(doc jsonb, forbidden text[], issues text[])
returns text[]
language plpgsql
stable
as $$
begin
  return public.snapshot_walk_zoned(doc, forbidden, issues, false);
end;
$$;

create or replace function public.snapshot_swap_text(raw text, swap jsonb)
returns text
language plpgsql
immutable
as $$
declare
  result text := coalesce(raw, '');
  key text;
  val text;
begin
  if swap is null or jsonb_typeof(swap) <> 'object' then
    return result;
  end if;
  for key, val in
    select entry.key, entry.value #>> '{}'
    from jsonb_each(swap) as entry
    where jsonb_typeof(entry.value) = 'string'
  loop
    result := replace(result, '{{business.' || key || '}}', coalesce(val, ''));
  end loop;
  return result;
end;
$$;

create or replace function public.snapshot_swap_json(doc jsonb, swap jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  key text;
  child jsonb;
  result jsonb := '{}'::jsonb;
  built jsonb := '[]'::jsonb;
  element jsonb;
begin
  if doc is null or jsonb_typeof(doc) = 'null' then
    return 'null'::jsonb;
  end if;
  if jsonb_typeof(doc) = 'string' then
    return to_jsonb(public.snapshot_swap_text(doc #>> '{}', swap));
  elsif jsonb_typeof(doc) = 'array' then
    for element in select entry.value from jsonb_array_elements(doc) as entry
    loop
      built := built || jsonb_build_array(public.snapshot_swap_json(element, swap));
    end loop;
    return built;
  elsif jsonb_typeof(doc) = 'object' then
    for key, child in select entry.key, entry.value from jsonb_each(doc) as entry
    loop
      result := result || jsonb_build_object(key, public.snapshot_swap_json(child, swap));
    end loop;
    return result;
  end if;
  return doc;
end;
$$;

create or replace function public.snapshot_prepare_duplicate(p_payload jsonb, p_swap jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  swap jsonb := coalesce(p_swap, '{}'::jsonb);
  services jsonb;
  text_value text;
  doc jsonb;
  item jsonb;
  templates jsonb := '[]'::jsonb;
  sequences jsonb := '[]'::jsonb;
  flows jsonb := '[]'::jsonb;
begin
  if btrim(coalesce(swap->>'services_text', '')) = '' then
    if jsonb_typeof(swap->'services') = 'array' and jsonb_array_length(swap->'services') > 0 then
      services := swap->'services';
    else
      services := coalesce(p_payload #> '{website,services}', '[]'::jsonb);
    end if;
    select string_agg(btrim(coalesce(row->>'name', '') || ' ' || coalesce(row->>'price_label', '')), '; ')
    into text_value
    from jsonb_array_elements(coalesce(services, '[]'::jsonb)) as row;
    swap := swap || jsonb_build_object('services_text', coalesce(text_value, ''));
  end if;

  doc := public.snapshot_swap_json(coalesce(p_payload, '{}'::jsonb), swap);

  if jsonb_typeof(doc->'website') = 'object' then
    doc := jsonb_set(
      doc,
      '{website}',
      (doc->'website') || jsonb_build_object(
        'business_name', coalesce(swap->>'name', ''),
        'colours', jsonb_build_object(
          'primary', coalesce(swap->>'primary_colour', '#0B1F3A'),
          'accent', coalesce(swap->>'accent_colour', '#2563EB')
        ),
        'logo_url', coalesce(swap->>'logo_url', ''),
        'phone', coalesce(swap->>'phone', ''),
        'email', coalesce(swap->>'email', ''),
        'address', coalesce(swap->>'address', ''),
        'hours', coalesce(swap->>'hours', ''),
        'booking_url', coalesce(swap->>'booking_url', '')
      ),
      true
    );
    if jsonb_typeof(swap->'services') = 'array' and jsonb_array_length(swap->'services') > 0 then
      doc := jsonb_set(doc, '{website,services}', swap->'services', true);
    end if;
  end if;

  for item in select entry.value from jsonb_array_elements(coalesce(doc->'message_templates', '[]'::jsonb)) as entry
  loop
    templates := templates || jsonb_build_array(item || jsonb_build_object('active', false));
  end loop;
  doc := jsonb_set(doc, '{message_templates}', templates, true);

  for item in select entry.value from jsonb_array_elements(coalesce(doc->'sequences', '[]'::jsonb)) as entry
  loop
    sequences := sequences || jsonb_build_array(item || jsonb_build_object('active', false));
  end loop;
  doc := jsonb_set(doc, '{sequences}', sequences, true);

  for item in select entry.value from jsonb_array_elements(coalesce(doc->'workflows', '[]'::jsonb)) as entry
  loop
    flows := flows || jsonb_build_array(item || jsonb_build_object('active', false));
  end loop;
  doc := jsonb_set(doc, '{workflows}', flows, true);

  if jsonb_typeof(doc->'ai_reply') = 'object' then
    doc := jsonb_set(
      doc,
      '{ai_reply}',
      (doc->'ai_reply') || jsonb_build_object('enabled', false, 'mode', 'draft_only', 'require_human_before_send', true),
      true
    );
  end if;
  if jsonb_typeof(doc->'agent_team') = 'object' then
    doc := jsonb_set(
      doc,
      '{agent_team}',
      (doc->'agent_team') || jsonb_build_object('sandbox', true, 'charged', false),
      true
    );
  end if;

  return doc;
end;
$$;

create or replace function public.snapshot_apply_v2_extras(p_org uuid, p_payload jsonb, p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  event_item jsonb;
  weekly jsonb;
  booking jsonb;
  cal_id uuid;
  evt_id uuid;
  slug_base text;
  suffix text;
  chosen text;
  n integer;
  tone text;
  prompt text;
  team_slug text;
  agents text[];
begin
  for item in select entry.value from jsonb_array_elements(coalesce(p_payload->'tags', '[]'::jsonb)) as entry
  loop
    if coalesce(item->>'asset_key', '') = '' then
      continue;
    end if;
    insert into public.workspace_tags (org_id, asset_key, name, color)
    values (
      p_org,
      item->>'asset_key',
      coalesce(item->>'name', 'Tag'),
      coalesce(nullif(item->>'color', ''), '#0B1F3A')
    )
    on conflict (org_id, asset_key) do update
      set name = excluded.name,
          color = excluded.color;
  end loop;

  for item in select entry.value from jsonb_array_elements(coalesce(p_payload->'calendars', '[]'::jsonb)) as entry
  loop
    if coalesce(item->>'asset_key', '') = '' then
      continue;
    end if;
    insert into public.calendars (org_id, asset_key, name, timezone, description, active)
    values (
      p_org,
      item->>'asset_key',
      coalesce(nullif(item->>'name', ''), 'Calendar'),
      coalesce(nullif(item->>'timezone', ''), 'Africa/Johannesburg'),
      coalesce(item->>'description', ''),
      coalesce((item->>'active')::boolean, true)
    )
    on conflict (org_id, asset_key) where asset_key <> '' do update
      set name = excluded.name,
          timezone = excluded.timezone,
          description = excluded.description,
          active = excluded.active,
          updated_at = now()
    returning id into cal_id;

    if cal_id is null then
      select id into cal_id from public.calendars
      where org_id = p_org and asset_key = item->>'asset_key';
    end if;

    delete from public.calendar_availability
    where calendar_availability.calendar_id = cal_id and kind = 'weekly';

    for weekly in select entry.value from jsonb_array_elements(coalesce(item->'weekly', '[]'::jsonb)) as entry
    loop
      insert into public.calendar_availability (org_id, calendar_id, kind, weekday, start_minute, end_minute, available)
      values (
        p_org,
        cal_id,
        'weekly',
        (weekly->>'weekday')::smallint,
        (weekly->>'start_minute')::smallint,
        (weekly->>'end_minute')::smallint,
        true
      );
    end loop;

    for event_item in select entry.value from jsonb_array_elements(coalesce(item->'event_types', '[]'::jsonb)) as entry
    loop
      if coalesce(event_item->>'asset_key', '') = '' then
        continue;
      end if;
      insert into public.calendar_event_types (
        org_id, calendar_id, asset_key, name, duration_minutes,
        buffer_before_minutes, buffer_after_minutes, location_mode, location_detail, active
      ) values (
        p_org,
        cal_id,
        event_item->>'asset_key',
        coalesce(nullif(event_item->>'name', ''), 'Booking'),
        coalesce((event_item->>'duration_minutes')::integer, 30),
        coalesce((event_item->>'buffer_before_minutes')::integer, 0),
        coalesce((event_item->>'buffer_after_minutes')::integer, 0),
        coalesce(nullif(event_item->>'location_mode', ''), 'phone'),
        coalesce(event_item->>'location_detail', ''),
        true
      )
      on conflict (org_id, asset_key) where asset_key <> '' do update
        set name = excluded.name,
            duration_minutes = excluded.duration_minutes,
            location_mode = excluded.location_mode,
            location_detail = excluded.location_detail,
            updated_at = now()
      returning id into evt_id;

      if evt_id is null then
        select id into evt_id from public.calendar_event_types
        where org_id = p_org and asset_key = event_item->>'asset_key';
      end if;

      booking := coalesce(event_item->'booking', '{}'::jsonb);
      if coalesce(booking->>'asset_key', '') = '' then
        continue;
      end if;
      if exists (
        select 1 from public.booking_links
        where org_id = p_org and asset_key = booking->>'asset_key'
      ) then
        update public.booking_links
        set active = coalesce((booking->>'active')::boolean, true),
            consent_text = coalesce(booking->>'consent_text', '')
        where org_id = p_org and asset_key = booking->>'asset_key';
      else
        slug_base := lower(regexp_replace(coalesce(nullif(p_slug, ''), 'book'), '[^a-z0-9]+', '-', 'g'));
        suffix := lower(regexp_replace(coalesce(nullif(booking->>'slug_suffix', ''), 'book'), '[^a-z0-9]+', '-', 'g'));
        slug_base := btrim(slug_base, '-');
        suffix := btrim(suffix, '-');
        chosen := btrim(slug_base || '-' || suffix, '-');
        if chosen = '' then
          chosen := 'booking';
        end if;
        n := 2;
        while exists (select 1 from public.booking_links existing where existing.slug = chosen) loop
          chosen := btrim(slug_base || '-' || suffix, '-') || '-' || n::text;
          n := n + 1;
          if n > 50 then
            raise exception 'Choose a different booking slug';
          end if;
        end loop;
        insert into public.booking_links (org_id, event_type_id, asset_key, slug, active, consent_text)
        values (
          p_org,
          evt_id,
          booking->>'asset_key',
          chosen,
          coalesce((booking->>'active')::boolean, true),
          coalesce(booking->>'consent_text', '')
        );
      end if;
    end loop;
  end loop;

  if jsonb_typeof(p_payload->'ai_reply') = 'object' then
    tone := coalesce(p_payload #>> '{ai_reply,tone}', '');
    prompt := coalesce(p_payload #>> '{ai_reply,system_prompt}', '');
    insert into public.ai_reply_settings (
      org_id, enabled, mode, tone, system_prompt, max_auto_per_hour, require_human_before_send
    ) values (
      p_org,
      false,
      'draft_only',
      tone,
      prompt,
      least(coalesce((p_payload #>> '{ai_reply,max_auto_per_hour}')::integer, 0), 20),
      true
    )
    on conflict (org_id) do update
      set enabled = false,
          mode = 'draft_only',
          tone = excluded.tone,
          system_prompt = excluded.system_prompt,
          max_auto_per_hour = excluded.max_auto_per_hour,
          require_human_before_send = true,
          updated_at = now();
  end if;

  if jsonb_typeof(p_payload->'ai_knowledge') = 'object' then
    insert into public.ai_knowledge_bases (org_id, entries)
    values (p_org, coalesce(p_payload #> '{ai_knowledge,entries}', '[]'::jsonb))
    on conflict (org_id) do update
      set entries = excluded.entries,
          updated_at = now();
  end if;

  if jsonb_typeof(p_payload->'agent_team') = 'object' then
    team_slug := coalesce(p_payload #>> '{agent_team,template_slug}', '');
    select coalesce(array_agg(entry.value), '{}'::text[])
    into agents
    from jsonb_array_elements_text(coalesce(p_payload #> '{agent_team,agents}', '[]'::jsonb)) as entry(value);
    insert into public.workspace_agent_teams (org_id, template_slug, agents, sandbox, charged)
    values (p_org, team_slug, coalesce(agents, '{}'::text[]), true, false)
    on conflict (org_id) do update
      set template_slug = excluded.template_slug,
          agents = excluded.agents,
          sandbox = true,
          charged = false,
          updated_at = now();

    insert into public.org_bots (org_id, bot_slug, bundle_slug, status, config, sandbox, trial_ends_at)
    select p_org, agent, nullif(team_slug, ''), 'trial', '{}'::jsonb, true, now() + interval '14 days'
    from unnest(coalesce(agents, '{}'::text[])) as agent
    where exists (select 1 from public.bot_catalog catalog where catalog.slug = agent)
    on conflict (org_id, bot_slug) do update
      set sandbox = true,
          status = 'trial',
          updated_at = now();
  end if;

  if jsonb_typeof(p_payload->'website') = 'object' then
    insert into public.client_website_configs (org_id, config)
    values (p_org, p_payload->'website')
    on conflict (org_id) do update
      set config = excluded.config,
          updated_at = now();
  end if;
end;
$$;

create or replace function public.snapshot_export_v2(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base jsonb;
  tags jsonb;
  calendars jsonb := '[]'::jsonb;
  cal record;
  stages jsonb;
  events jsonb;
  weekly jsonb;
  ai jsonb;
  knowledge jsonb;
  team jsonb;
  site jsonb;
  org_slug text;
  result jsonb;
  issues text[];
  shell jsonb := jsonb_build_object(
    'business_name', '{{business.name}}',
    'colours', jsonb_build_object('primary', '{{business.primary_colour}}', 'accent', '{{business.accent_colour}}'),
    'logo_url', '{{business.logo_url}}',
    'phone', '{{business.phone}}',
    'email', '{{business.email}}',
    'address', '{{business.address}}',
    'hours', '{{business.hours}}',
    'services', '[]'::jsonb,
    'booking_url', '{{business.booking_url}}'
  );
begin
  if auth.uid() is null or p_org_id not in (select public.accessible_org_ids()) then
    raise exception 'not allowed';
  end if;

  base := public.snapshot_export(p_org_id);
  select slug into org_slug from public.organizations where id = p_org_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_key', tag.asset_key,
    'name', tag.name,
    'color', tag.color
  ) order by tag.asset_key), '[]'::jsonb)
  into tags
  from public.workspace_tags tag
  where tag.org_id = p_org_id;

  for cal in
    select * from public.calendars
    where org_id = p_org_id and asset_key <> ''
    order by asset_key
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'weekday', row.weekday,
      'start_minute', row.start_minute,
      'end_minute', row.end_minute
    ) order by row.weekday), '[]'::jsonb)
    into weekly
    from public.calendar_availability row
    where row.calendar_id = cal.id and row.kind = 'weekly';

    select coalesce(jsonb_agg(jsonb_build_object(
      'asset_key', event.asset_key,
      'name', event.name,
      'duration_minutes', event.duration_minutes,
      'buffer_before_minutes', event.buffer_before_minutes,
      'buffer_after_minutes', event.buffer_after_minutes,
      'location_mode', event.location_mode,
      'location_detail', event.location_detail,
      'booking', jsonb_build_object(
        'asset_key', link.asset_key,
        'slug_suffix', regexp_replace(link.slug, '^' || org_slug || '-', ''),
        'active', link.active,
        'consent_text', link.consent_text
      )
    ) order by event.asset_key), '[]'::jsonb)
    into events
    from public.calendar_event_types event
    left join public.booking_links link on link.event_type_id = event.id
    where event.calendar_id = cal.id and event.asset_key <> '';

    calendars := calendars || jsonb_build_array(jsonb_build_object(
      'asset_key', cal.asset_key,
      'name', cal.name,
      'timezone', cal.timezone,
      'description', cal.description,
      'active', cal.active,
      'weekly', weekly,
      'event_types', events
    ));
  end loop;

  select jsonb_build_object(
    'enabled', false,
    'mode', 'draft_only',
    'tone', coalesce(settings.tone, ''),
    'system_prompt', coalesce(settings.system_prompt, ''),
    'max_auto_per_hour', least(coalesce(settings.max_auto_per_hour, 0), 20),
    'require_human_before_send', true
  )
  into ai
  from public.ai_reply_settings settings
  where settings.org_id = p_org_id;
  if ai is null then
    ai := jsonb_build_object(
      'enabled', false,
      'mode', 'draft_only',
      'tone', '',
      'system_prompt', '',
      'max_auto_per_hour', 0,
      'require_human_before_send', true
    );
  end if;

  select jsonb_build_object('entries', bases.entries)
  into knowledge
  from public.ai_knowledge_bases bases
  where bases.org_id = p_org_id;
  if knowledge is null then
    knowledge := jsonb_build_object('entries', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'template_slug', teams.template_slug,
    'sandbox', true,
    'charged', false,
    'agents', to_jsonb(teams.agents)
  )
  into team
  from public.workspace_agent_teams teams
  where teams.org_id = p_org_id;
  if team is null then
    team := jsonb_build_object('template_slug', '', 'sandbox', true, 'charged', false, 'agents', '[]'::jsonb);
  end if;

  select configs.config into site from public.client_website_configs configs where configs.org_id = p_org_id;
  if site is null then
    site := shell;
  end if;

  result := base || jsonb_build_object(
    'version', 2,
    'tags', tags,
    'calendars', calendars,
    'ai_reply', ai,
    'ai_knowledge', knowledge,
    'agent_team', team,
    'website', site
  );
  issues := public.snapshot_payload_issues(result);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'snapshot export refused private data';
  end if;
  return result;
end;
$$;

create or replace function public.duplicate_workspace(
  p_source_kind text,
  p_source_id uuid,
  p_swap jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  parent uuid;
  prior public.workspace_duplicates%rowtype;
  snap public.snapshots%rowtype;
  payload jsonb;
  prepared jsonb;
  issues text[];
  clean jsonb;
  chosen_slug text;
  base text;
  n integer := 2;
  new_id uuid;
  enabled boolean;
  primary_colour text;
  accent_colour text;
  industry text;
  sender text;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;
  if p_source_kind not in ('snapshot', 'workspace') then
    raise exception 'Pick a template or a workspace';
  end if;
  if coalesce(p_idempotency_key, '') !~ '^[a-z0-9][a-z0-9_.:-]{7,120}$' then
    raise exception 'idempotency key is invalid';
  end if;

  select o.id into parent
  from public.organizations o
  join public.memberships m on m.org_id = o.id
  where m.user_id = auth.uid()
    and m.role in ('agency_owner', 'agency_staff')
    and o.org_type = 'agency'
  order by (o.slug = 'ai-autotech') desc, o.created_at
  limit 1;
  if parent is null then
    raise exception 'not allowed';
  end if;

  select * into prior
  from public.workspace_duplicates
  where agency_org_id = parent and idempotency_key = p_idempotency_key;
  if found then
    if prior.swap is distinct from p_swap
       or prior.source_kind is distinct from p_source_kind
       or prior.source_id is distinct from p_source_id then
      raise exception 'idempotency key already used';
    end if;
    select sending_enabled into enabled from public.organizations where id = prior.target_org_id;
    if enabled is distinct from false then
      raise exception 'sending must stay off';
    end if;
    return jsonb_build_object(
      'org_id', prior.target_org_id,
      'slug', (select slug from public.organizations where id = prior.target_org_id),
      'sending_enabled', false,
      'idempotent', true,
      'created', false,
      'source_kind', prior.source_kind,
      'source_id', prior.source_id
    );
  end if;

  if length(btrim(coalesce(p_swap->>'name', ''))) < 2 then
    raise exception 'Give the business a name';
  end if;
  if p_swap::text ~* '(sk_live_|whsec_|api[_-]?key[[:space:]]*[:=]|bearer[[:space:]]+[a-z0-9]|secret[[:space:]]*[:=]|javascript:|data:)' then
    raise exception 'That value looks like a key';
  end if;
  if coalesce(p_swap->>'email', '') <> ''
     and p_swap->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'The email address is not usable';
  end if;
  if coalesce(p_swap->>'phone', '') <> ''
     and p_swap->>'phone' !~ '^[0-9+().[:space:]-]{6,24}$' then
    raise exception 'The phone number is not usable';
  end if;
  if coalesce(p_swap->>'logo_url', '') <> '' and p_swap->>'logo_url' !~* '^https?://' then
    raise exception 'The logo URL must start with http:// or https://';
  end if;
  if coalesce(p_swap->>'booking_url', '') <> ''
     and p_swap->>'booking_url' !~* '^https?://'
     and p_swap->>'booking_url' !~ '^/book/' then
    raise exception 'The booking URL is not usable';
  end if;

  primary_colour := case when coalesce(p_swap->>'primary_colour', '') ~ '^#[0-9A-Fa-f]{6}$' then p_swap->>'primary_colour' else '#0B1F3A' end;
  accent_colour := case when coalesce(p_swap->>'accent_colour', '') ~ '^#[0-9A-Fa-f]{6}$' then p_swap->>'accent_colour' else '#2563EB' end;
  base := lower(btrim(coalesce(nullif(btrim(coalesce(p_swap->>'slug', '')), ''), p_swap->>'name')));
  base := btrim(regexp_replace(base, '[^a-z0-9]+', '-', 'g'), '-');
  base := left(base, 48);
  if base = '' then
    raise exception 'Give the workspace a slug';
  end if;
  clean := jsonb_build_object(
    'name', btrim(p_swap->>'name'),
    'slug', base,
    'primary_colour', primary_colour,
    'accent_colour', accent_colour,
    'logo_url', coalesce(p_swap->>'logo_url', ''),
    'phone', coalesce(p_swap->>'phone', ''),
    'email', coalesce(p_swap->>'email', ''),
    'address', coalesce(p_swap->>'address', ''),
    'hours', coalesce(p_swap->>'hours', ''),
    'booking_url', coalesce(p_swap->>'booking_url', ''),
    'services_text', coalesce(p_swap->>'services_text', ''),
    'services', case when jsonb_typeof(p_swap->'services') = 'array' then p_swap->'services' else '[]'::jsonb end
  );

  if p_source_kind = 'snapshot' then
    select * into snap from public.snapshots where id = p_source_id;
    if snap.id is null then
      raise exception 'snapshot not found';
    end if;
    if not public.has_org_role(snap.org_id, array['agency_owner', 'agency_staff']) then
      raise exception 'not allowed';
    end if;
    payload := snap.payload;
    industry := case
      when snap.name ilike '%restaurant%' or snap.name ilike '%burger%' then 'Restaurant'
      when snap.name ilike '%education%' then 'Education'
      else ''
    end;
  else
    if p_source_id not in (select public.accessible_org_ids()) then
      raise exception 'not allowed';
    end if;
    payload := public.snapshot_export_v2(p_source_id);
    industry := '';
  end if;

  prepared := public.snapshot_prepare_duplicate(payload, clean);
  issues := public.snapshot_payload_issues(prepared);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'snapshot payload contains private data';
  end if;

  chosen_slug := base;
  while exists (
    select 1 from public.organizations taken
    where taken.slug = chosen_slug or taken.form_key = chosen_slug
  ) loop
    chosen_slug := base || '-' || n::text;
    n := n + 1;
    if n > 50 then
      raise exception 'Choose a different slug';
    end if;
  end loop;

  sender := btrim(p_swap->>'name');
  insert into public.organizations (
    name, slug, status, org_type, parent_id, legal_name, industry, logo_url,
    primary_color, accent_color, form_key, sending_enabled, sender_name, plan_key, branding, settings
  ) values (
    sender,
    chosen_slug,
    'active',
    'client',
    parent,
    sender,
    industry,
    coalesce(p_swap->>'logo_url', ''),
    primary_colour,
    accent_colour,
    chosen_slug,
    false,
    sender,
    'starter',
    jsonb_build_object('logoUrl', coalesce(p_swap->>'logo_url', ''), 'primaryColor', primary_colour, 'accentColor', accent_colour),
    jsonb_build_object(
      'channels', jsonb_build_object(
        'whatsapp', jsonb_build_object('phoneNumberId', '', 'displayPhone', ''),
        'email', jsonb_build_object('fromAddress', '', 'provider', ''),
        'sms', jsonb_build_object('senderId', '')
      )
    )
  )
  returning id, sending_enabled into new_id, enabled;

  if enabled is distinct from false then
    raise exception 'sending must stay off';
  end if;

  perform public.snapshot_apply_payload(new_id, prepared, true);
  perform public.snapshot_apply_v2_extras(new_id, prepared, chosen_slug);

  select sending_enabled into enabled from public.organizations where id = new_id;
  if enabled is distinct from false then
    raise exception 'sending must stay off';
  end if;

  insert into public.workspace_duplicates (
    agency_org_id, idempotency_key, source_kind, source_id, target_org_id, swap
  ) values (
    parent, p_idempotency_key, p_source_kind, p_source_id, new_id, p_swap
  );

  return jsonb_build_object(
    'org_id', new_id,
    'slug', chosen_slug,
    'sending_enabled', false,
    'idempotent', false,
    'created', true,
    'source_kind', p_source_kind,
    'source_id', p_source_id,
    'plan_key', 'starter'
  );
end;
$$;

revoke all on function public.snapshot_walk_zoned(jsonb, text[], text[], boolean) from public, anon, authenticated;
revoke all on function public.snapshot_swap_text(text, jsonb) from public, anon, authenticated;
revoke all on function public.snapshot_swap_json(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.snapshot_prepare_duplicate(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.snapshot_apply_v2_extras(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.snapshot_export_v2(uuid) from public, anon;
revoke all on function public.duplicate_workspace(text, uuid, jsonb, text) from public, anon;

grant execute on function public.snapshot_export_v2(uuid) to authenticated;
grant execute on function public.duplicate_workspace(text, uuid, jsonb, text) to authenticated;

alter table public.workspace_tags enable row level security;
alter table public.workspace_tags force row level security;
alter table public.client_website_configs enable row level security;
alter table public.client_website_configs force row level security;
alter table public.ai_knowledge_bases enable row level security;
alter table public.ai_knowledge_bases force row level security;
alter table public.workspace_agent_teams enable row level security;
alter table public.workspace_agent_teams force row level security;
alter table public.workspace_duplicates enable row level security;
alter table public.workspace_duplicates force row level security;

drop policy if exists workspace_tags_read on public.workspace_tags;
create policy workspace_tags_read on public.workspace_tags
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists workspace_tags_write on public.workspace_tags;
create policy workspace_tags_write on public.workspace_tags
  for all to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists client_website_configs_read on public.client_website_configs;
create policy client_website_configs_read on public.client_website_configs
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists client_website_configs_write on public.client_website_configs;
create policy client_website_configs_write on public.client_website_configs
  for all to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists ai_knowledge_bases_read on public.ai_knowledge_bases;
create policy ai_knowledge_bases_read on public.ai_knowledge_bases
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists ai_knowledge_bases_write on public.ai_knowledge_bases;
create policy ai_knowledge_bases_write on public.ai_knowledge_bases
  for all to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists workspace_agent_teams_read on public.workspace_agent_teams;
create policy workspace_agent_teams_read on public.workspace_agent_teams
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists workspace_agent_teams_write on public.workspace_agent_teams;
create policy workspace_agent_teams_write on public.workspace_agent_teams
  for all to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists workspace_duplicates_read on public.workspace_duplicates;
create policy workspace_duplicates_read on public.workspace_duplicates
  for select to authenticated
  using (public.has_org_role(agency_org_id, array['agency_owner', 'agency_staff']));

revoke all on public.workspace_tags from public, anon;
revoke all on public.client_website_configs from public, anon;
revoke all on public.ai_knowledge_bases from public, anon;
revoke all on public.workspace_agent_teams from public, anon;
revoke all on public.workspace_duplicates from public, anon;
grant select, insert, update, delete on public.workspace_tags to authenticated;
grant select, insert, update, delete on public.client_website_configs to authenticated;
grant select, insert, update, delete on public.ai_knowledge_bases to authenticated;
grant select, insert, update, delete on public.workspace_agent_teams to authenticated;
grant select on public.workspace_duplicates to authenticated;

-- crm_message_templates.key clashes with the plpgsql variable in snapshot_write_template
-- once org scope adds org_id. Qualify the variable so duplicate can store drafts.
create or replace function public.snapshot_write_template(p_org uuid, item jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  asset text := item->>'asset_key';
  doc jsonb;
  sum text;
  existing message_templates%rowtype;
  result text;
  crm_edited boolean := false;
begin
  if asset is null or btrim(asset) = '' then
    raise exception 'template asset_key required';
  end if;
  if item->>'channel' not in ('whatsapp', 'email', 'sms') then
    raise exception 'template channel is invalid';
  end if;
  doc := public.snapshot_template_doc(
    asset,
    item->>'channel',
    item->>'name',
    coalesce(item->>'subject', ''),
    coalesce(item->>'body', ''),
    coalesce((item->>'active')::boolean, true)
  );
  sum := public.snapshot_checksum(doc);
  if to_regclass('public.crm_message_templates') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'crm_message_templates' and column_name = 'org_id'
     ) then
    select checksum is distinct from source_checksum into crm_edited
    from crm_message_templates
    where org_id = p_org and asset_key = asset
    limit 1;
  end if;
  select * into existing from message_templates where org_id = p_org and asset_key = asset;
  if not found then
    insert into message_templates (org_id, asset_key, channel, name, subject, body, active, source_checksum)
    values (
      p_org,
      asset,
      item->>'channel',
      item->>'name',
      coalesce(item->>'subject', ''),
      coalesce(item->>'body', ''),
      coalesce((item->>'active')::boolean, true),
      sum
    );
    result := 'created';
  elsif (not p_force) and (existing.checksum is distinct from existing.source_checksum or coalesce(crm_edited, false)) then
    result := 'skipped_client_edit';
  elsif existing.checksum = sum then
    result := 'unchanged';
  else
    update message_templates
    set channel = item->>'channel',
        name = item->>'name',
        subject = coalesce(item->>'subject', ''),
        body = coalesce(item->>'body', ''),
        active = coalesce((item->>'active')::boolean, true),
        source_checksum = sum,
        updated_at = now()
    where id = existing.id;
    result := 'updated';
  end if;
  return jsonb_build_object('asset_key', asset, 'kind', 'message_template', 'result', result);
end;
$$;

revoke all on function public.snapshot_write_template(uuid, jsonb, boolean) from public, anon, authenticated;

-- SEED_TEMPLATES

do $seed$
declare
  agency uuid;
  restaurant_payload jsonb := $restaurant${"version":2,"pipelines":[{"asset_key":"pipeline:restaurant","name":"Restaurant","is_default":true,"stages":[{"asset_key":"stage:restaurant:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:restaurant:held","name":"Booking held","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:restaurant:seated","name":"Seated","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:restaurant:review","name":"Review asked","position":4,"is_won":false,"is_lost":false},{"asset_key":"stage:restaurant:regular","name":"Regular","position":5,"is_won":true,"is_lost":false},{"asset_key":"stage:restaurant:lost","name":"Lost","position":6,"is_won":false,"is_lost":true}]}],"message_templates":[{"asset_key":"template:restaurant:booking-whatsapp","channel":"whatsapp","name":"Booking confirmation","subject":"","body":"Hi {{firstName}}, {{business.name}} is holding a table. Address: {{business.address}}. Hours: {{business.hours}}. This is a draft and is not sent.","active":false},{"asset_key":"template:restaurant:booking-email","channel":"email","name":"Booking confirmation","subject":"Table at {{business.name}}","body":"Hi {{firstName}}, {{business.name}} is holding a table at {{business.address}}. This is a draft and is not sent.","active":false},{"asset_key":"template:restaurant:booking-sms","channel":"sms","name":"Booking confirmation","subject":"","body":"{{business.name}} is holding a table. This is a draft and is not sent.","active":false},{"asset_key":"template:restaurant:review-whatsapp","channel":"whatsapp","name":"Review request","subject":"","body":"Hi {{firstName}}, how was {{business.name}}? This review request is a draft and is not sent.","active":false},{"asset_key":"template:restaurant:winback-email","channel":"email","name":"Win-back","subject":"We miss you at {{business.name}}","body":"Hi {{firstName}}, {{business.name}} would like to see you again. Hours: {{business.hours}}. This is a draft and is not sent.","active":false},{"asset_key":"template:restaurant:winback-sms","channel":"sms","name":"Win-back","subject":"","body":"{{business.name}} win-back note. This is a draft and is not sent.","active":false}],"sequences":[{"asset_key":"sequence:restaurant:booking","name":"Booking confirmation","active":false,"steps":[{"asset_key":"step:restaurant:booking:whatsapp","position":1,"delay_hours":0,"channel":"whatsapp","template_asset_key":"template:restaurant:booking-whatsapp"},{"asset_key":"step:restaurant:booking:email","position":2,"delay_hours":0,"channel":"email","template_asset_key":"template:restaurant:booking-email"},{"asset_key":"step:restaurant:booking:sms","position":3,"delay_hours":0,"channel":"sms","template_asset_key":"template:restaurant:booking-sms"}]},{"asset_key":"sequence:restaurant:review","name":"Review request","active":false,"steps":[{"asset_key":"step:restaurant:review:whatsapp","position":1,"delay_hours":24,"channel":"whatsapp","template_asset_key":"template:restaurant:review-whatsapp"}]},{"asset_key":"sequence:restaurant:winback","name":"Win-back","active":false,"steps":[{"asset_key":"step:restaurant:winback:email","position":1,"delay_hours":168,"channel":"email","template_asset_key":"template:restaurant:winback-email"},{"asset_key":"step:restaurant:winback:sms","position":2,"delay_hours":168,"channel":"sms","template_asset_key":"template:restaurant:winback-sms"}]}],"custom_fields":[{"asset_key":"field:restaurant:party","entity":"lead","field_key":"party_size","label":"Party size","field_type":"text","options":[],"required":false,"position":1},{"asset_key":"field:restaurant:seating","entity":"lead","field_key":"seating","label":"Seating","field_type":"text","options":[],"required":false,"position":2},{"asset_key":"field:restaurant:favourite","entity":"lead","field_key":"favourite_order","label":"Favourite order","field_type":"text","options":[],"required":false,"position":3}],"workflows":[{"asset_key":"workflow:restaurant:booking-confirmation","name":"Booking confirmation","active":false,"trigger_type":"appointment.booked","trigger":{},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"Draft a booking confirmation for {{business.name}}. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:restaurant:review-request","name":"Review request","active":false,"trigger_type":"lead.stage_changed","trigger":{},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"Draft a review request for {{business.name}}. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:restaurant:win-back","name":"Win-back","active":false,"trigger_type":"message.no_reply","trigger":{"after_hours":168},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"Draft a win-back note for {{business.name}}. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]}],"tags":[{"asset_key":"tag:restaurant:walk-in","name":"Walk-in","color":"#0B1F3A"},{"asset_key":"tag:restaurant:booking","name":"Booking","color":"#2563EB"},{"asset_key":"tag:restaurant:no-show","name":"No-show","color":"#B45309"},{"asset_key":"tag:restaurant:regular","name":"Regular","color":"#0F766E"},{"asset_key":"tag:restaurant:review","name":"Review","color":"#7C3AED"}],"calendars":[{"asset_key":"calendar:restaurant:tables","name":"Table bookings","timezone":"Africa/Johannesburg","description":"Covers for {{business.name}}.","active":true,"weekly":[{"weekday":0,"start_minute":660,"end_minute":1260},{"weekday":1,"start_minute":660,"end_minute":1260},{"weekday":2,"start_minute":660,"end_minute":1260},{"weekday":3,"start_minute":660,"end_minute":1260},{"weekday":4,"start_minute":660,"end_minute":1260},{"weekday":5,"start_minute":660,"end_minute":1260},{"weekday":6,"start_minute":660,"end_minute":1260}],"event_types":[{"asset_key":"event:restaurant:table","name":"Table booking","duration_minutes":90,"buffer_before_minutes":0,"buffer_after_minutes":0,"location_mode":"in_person","location_detail":"{{business.address}}","booking":{"asset_key":"booking:restaurant:table","slug_suffix":"table","active":true,"consent_text":"I agree that {{business.name}} may store my name and phone number to hold this table. Nothing is sent automatically."}}]}],"ai_reply":{"enabled":false,"mode":"draft_only","tone":"Warm and short.","system_prompt":"Draft replies for {{business.name}}, a restaurant. Hours: {{business.hours}}. Address: {{business.address}}. Use the menu in the knowledge base. Do not invent prices. Do not send.","max_auto_per_hour":0,"require_human_before_send":true},"ai_knowledge":{"entries":[{"asset_key":"kb:restaurant:hours","title":"Hours","body":"{{business.name}} is open {{business.hours}}."},{"asset_key":"kb:restaurant:menu","title":"Menu","body":"{{business.services_text}}"},{"asset_key":"kb:restaurant:find-us","title":"Find us","body":"{{business.name}} is at {{business.address}}. Phone {{business.phone}}. Mail {{business.email}}."}]},"agent_team":{"template_slug":"restaurant-food","sandbox":true,"charged":false,"agents":["receptionist","reminder-drafts","review-replies","social-posting","offer-manager"]},"website":{"business_name":"{{business.name}}","colours":{"primary":"{{business.primary_colour}}","accent":"{{business.accent_colour}}"},"logo_url":"{{business.logo_url}}","phone":"{{business.phone}}","email":"{{business.email}}","address":"{{business.address}}","hours":"{{business.hours}}","services":[{"name":"Classic burger","price_label":"R89"},{"name":"Cheese burger","price_label":"R99"},{"name":"Chips","price_label":"R35"},{"name":"Milkshake","price_label":"R45"}],"booking_url":"{{business.booking_url}}"}}$restaurant$::jsonb;
  agency_extras jsonb := $extras${"version":2,"tags":[{"asset_key":"tag:agency:new-lead","name":"New lead","color":"#0B1F3A"},{"asset_key":"tag:agency:audit","name":"Audit","color":"#2563EB"},{"asset_key":"tag:agency:proposal","name":"Proposal","color":"#0F766E"}],"calendars":[{"asset_key":"calendar:agency:audit","name":"Audit calls","timezone":"Africa/Johannesburg","description":"Short audit calls for {{business.name}}.","active":true,"weekly":[{"weekday":1,"start_minute":480,"end_minute":1020},{"weekday":2,"start_minute":480,"end_minute":1020},{"weekday":3,"start_minute":480,"end_minute":1020},{"weekday":4,"start_minute":480,"end_minute":1020},{"weekday":5,"start_minute":480,"end_minute":1020}],"event_types":[{"asset_key":"event:agency:audit","name":"Audit call","duration_minutes":20,"buffer_before_minutes":0,"buffer_after_minutes":0,"location_mode":"phone","location_detail":"Phone call","booking":{"asset_key":"booking:agency:audit","slug_suffix":"audit","active":true,"consent_text":"I agree that {{business.name}} may store my name and phone number for this audit call. Nothing is sent automatically."}}]}],"ai_reply":{"enabled":false,"mode":"draft_only","tone":"Warm and short.","system_prompt":"Draft replies for {{business.name}}. Hours: {{business.hours}}. Address: {{business.address}}. Do not invent prices. Do not send.","max_auto_per_hour":0,"require_human_before_send":true},"ai_knowledge":{"entries":[{"asset_key":"kb:agency:hours","title":"Hours","body":"{{business.name}} is open {{business.hours}}."},{"asset_key":"kb:agency:services","title":"Services","body":"{{business.services_text}}"},{"asset_key":"kb:agency:find-us","title":"Find us","body":"{{business.name}} is at {{business.address}}. Phone {{business.phone}}."}]},"agent_team":{"template_slug":"ai-automation-agency","sandbox":true,"charged":false,"agents":["inbound-lead","outbound-sales","proposal-writer","onboarding","ads","social-posting","support-replies","blog-drafts"]},"website":{"business_name":"{{business.name}}","colours":{"primary":"{{business.primary_colour}}","accent":"{{business.accent_colour}}"},"logo_url":"{{business.logo_url}}","phone":"{{business.phone}}","email":"{{business.email}}","address":"{{business.address}}","hours":"{{business.hours}}","services":[{"name":"Free audit","price_label":"Quote"},{"name":"CRM setup","price_label":"Quote"},{"name":"Lead follow-up","price_label":"Quote"}],"booking_url":"{{business.booking_url}}"}}$extras$::jsonb;
  agency_drafts jsonb := $drafts$[{"asset_key":"workflow:agency:new-lead-draft","name":"New lead draft","active":false,"trigger_type":"lead.created","trigger":{},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"A new lead arrived for {{business.name}}. This note is a draft. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:agency:audit-booked-draft","name":"Audit booked draft","active":false,"trigger_type":"appointment.booked","trigger":{},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"An audit was booked for {{business.name}}. This note is a draft. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:agency:no-reply-draft","name":"No reply draft","active":false,"trigger_type":"message.no_reply","trigger":{"after_hours":24},"steps":[{"id":"note","title":"Draft only","action":{"kind":"notify_user","text":"No reply yet for {{business.name}}. This note is a draft. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]}]$drafts$::jsonb;
  current jsonb;
  kept jsonb;
  issues text[];
begin
  select id into agency from public.organizations where slug = 'ai-autotech';
  if agency is null then
    raise notice 'ai-autotech organisation is missing; template seeds skipped';
    return;
  end if;

  issues := public.snapshot_payload_issues(restaurant_payload);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'restaurant template contains private data: %', issues;
  end if;

  insert into public.snapshots (id, org_id, name, description, payload)
  values (
    'a2c00000-0000-4000-8000-000000000003',
    agency,
    'Restaurant / burger joint',
    'Table bookings, a menu, draft follow-ups, and a sandbox restaurant team. Applying it does not send anything.',
    restaurant_payload
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    payload = excluded.payload,
    updated_at = now();

  select payload into current from public.snapshots where id = 'a2c00000-0000-4000-8000-000000000001';
  if current is null then
    return;
  end if;

  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into kept
  from jsonb_array_elements(coalesce(current->'workflows', '[]'::jsonb)) as item
  where coalesce(item->>'asset_key', '') not in (
    'workflow:agency:new-lead-draft',
    'workflow:agency:audit-booked-draft',
    'workflow:agency:no-reply-draft'
  );

  current := current || agency_extras;
  current := jsonb_set(current, '{workflows}', kept || agency_drafts, true);
  issues := public.snapshot_payload_issues(current);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'agency template contains private data: %', issues;
  end if;

  update public.snapshots
  set payload = current,
      description = 'AI AutoTech sales pipeline, follow-up sequences, message templates, and draft workflows. Applying it does not send anything.',
      updated_at = now()
  where id = 'a2c00000-0000-4000-8000-000000000001';
end
$seed$;
