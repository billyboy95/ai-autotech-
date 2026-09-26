-- Phase 2c: pipelines, templates, custom fields, and workspace snapshots.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Snapshot payloads store catalogue configuration only. They do not store
-- contacts, messages, channel secrets, or credentials.

alter table organizations add column if not exists plan_key text not null default '';
alter table organizations drop constraint if exists organizations_plan_key_check;
alter table organizations add constraint organizations_plan_key_check
  check (plan_key in ('', 'starter', 'growth', 'scale'));

create or replace function public.snapshot_checksum(doc jsonb)
returns text
language sql
immutable
as $$
  select md5(coalesce(doc, '{}'::jsonb)::text);
$$;

create or replace function public.snapshot_pipeline_doc(p_asset_key text, p_name text, p_is_default boolean)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('asset_key', p_asset_key, 'name', p_name, 'is_default', coalesce(p_is_default, false));
$$;

create or replace function public.snapshot_stage_doc(
  p_asset_key text,
  p_name text,
  p_position integer,
  p_is_won boolean,
  p_is_lost boolean
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'asset_key', p_asset_key,
    'name', p_name,
    'position', p_position,
    'is_won', coalesce(p_is_won, false),
    'is_lost', coalesce(p_is_lost, false)
  );
$$;

create or replace function public.snapshot_template_doc(
  p_asset_key text,
  p_channel text,
  p_name text,
  p_subject text,
  p_body text,
  p_active boolean
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'asset_key', p_asset_key,
    'channel', p_channel,
    'name', p_name,
    'subject', coalesce(p_subject, ''),
    'body', coalesce(p_body, ''),
    'active', coalesce(p_active, true)
  );
$$;

create or replace function public.snapshot_sequence_doc(p_asset_key text, p_name text, p_active boolean)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('asset_key', p_asset_key, 'name', p_name, 'active', coalesce(p_active, true));
$$;

create or replace function public.snapshot_step_doc(
  p_asset_key text,
  p_position integer,
  p_delay_hours integer,
  p_channel text,
  p_template_asset_key text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'asset_key', p_asset_key,
    'position', p_position,
    'delay_hours', p_delay_hours,
    'channel', p_channel,
    'template_asset_key', p_template_asset_key
  );
$$;

create or replace function public.snapshot_field_doc(
  p_asset_key text,
  p_entity text,
  p_field_key text,
  p_label text,
  p_field_type text,
  p_options jsonb,
  p_required boolean,
  p_position integer
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'asset_key', p_asset_key,
    'entity', p_entity,
    'field_key', p_field_key,
    'label', p_label,
    'field_type', p_field_type,
    'options', coalesce(p_options, '[]'::jsonb),
    'required', coalesce(p_required, false),
    'position', p_position
  );
$$;

create or replace function public.snapshot_touch_checksum()
returns trigger
language plpgsql
as $$
declare
  doc jsonb;
begin
  if tg_table_name = 'pipelines' then
    doc := public.snapshot_pipeline_doc(new.asset_key, new.name, new.is_default);
  elsif tg_table_name = 'pipeline_stages' then
    doc := public.snapshot_stage_doc(new.asset_key, new.name, new.position, new.is_won, new.is_lost);
  elsif tg_table_name = 'message_templates' then
    doc := public.snapshot_template_doc(new.asset_key, new.channel, new.name, new.subject, new.body, new.active);
  elsif tg_table_name = 'sequences' then
    doc := public.snapshot_sequence_doc(new.asset_key, new.name, new.active);
  elsif tg_table_name = 'sequence_steps' then
    doc := public.snapshot_step_doc(new.asset_key, new.position, new.delay_hours, new.channel, new.template_asset_key);
  elsif tg_table_name = 'custom_fields' then
    doc := public.snapshot_field_doc(new.asset_key, new.entity, new.field_key, new.label, new.field_type, new.options, new.required, new.position);
  elsif tg_table_name = 'crm_message_templates' then
    if new.asset_key is null or btrim(new.asset_key) = '' then
      new.asset_key := 'template:' || new.key;
    end if;
    doc := public.snapshot_template_doc(new.asset_key, new.channel, new.name, new.subject, new.body, new.active);
  elsif tg_table_name = 'crm_campaigns' then
    if new.asset_key is null or btrim(new.asset_key) = '' then
      new.asset_key := 'campaign:' || new.id;
    end if;
    doc := jsonb_build_object('asset_key', new.asset_key, 'name', new.name, 'status', new.status, 'steps', new.steps);
  elsif tg_table_name = 'workspace_pipelines' then
    if new.asset_key is null or btrim(new.asset_key) = '' then
      new.asset_key := 'pipeline:' || new.id::text;
    end if;
    doc := public.snapshot_pipeline_doc(new.asset_key, new.name, new.is_default);
  elsif tg_table_name = 'workspace_pipeline_stages' then
    if new.asset_key is null or btrim(new.asset_key) = '' then
      new.asset_key := 'stage:' || new.id::text;
    end if;
    doc := public.snapshot_stage_doc(new.asset_key, new.name, new.position, new.is_won, new.is_lost);
  elsif tg_table_name = 'workspace_templates' then
    if new.asset_key is null or btrim(new.asset_key) = '' then
      new.asset_key := 'template:workspace:' || new.id::text;
    end if;
    doc := jsonb_build_object('asset_key', new.asset_key, 'name', new.name, 'channel', new.channel, 'body', new.body);
  elsif tg_table_name = 'workspace_sequences' then
    if new.asset_key is null or btrim(new.asset_key) = '' then
      new.asset_key := 'sequence:' || new.id::text;
    end if;
    doc := jsonb_build_object('asset_key', new.asset_key, 'name', new.name);
  elsif tg_table_name = 'workspace_sequence_steps' then
    if new.asset_key is null or btrim(new.asset_key) = '' then
      new.asset_key := 'step:' || new.id::text;
    end if;
    doc := jsonb_build_object(
      'asset_key', new.asset_key,
      'position', new.position,
      'delay_hours', new.delay_hours,
      'channel', new.channel,
      'template_name', new.template_name
    );
  else
    return new;
  end if;

  new.checksum := public.snapshot_checksum(doc);
  if tg_op = 'INSERT' or new.source_checksum is null or btrim(new.source_checksum) = '' then
    new.source_checksum := new.checksum;
  end if;
  return new;
end;
$$;

create table if not exists pipelines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  asset_key text not null,
  name text not null,
  is_default boolean not null default false,
  checksum text not null default '',
  source_checksum text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, asset_key)
);

create table if not exists pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  asset_key text not null,
  name text not null,
  position integer not null,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  checksum text not null default '',
  source_checksum text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, asset_key)
);

create index if not exists pipeline_stages_pipeline_idx on pipeline_stages (pipeline_id, position);

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  asset_key text not null,
  channel text not null check (channel in ('whatsapp', 'email', 'sms')),
  name text not null,
  subject text not null default '',
  body text not null default '',
  active boolean not null default true,
  checksum text not null default '',
  source_checksum text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, asset_key)
);

create table if not exists sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  asset_key text not null,
  name text not null,
  active boolean not null default false,
  checksum text not null default '',
  source_checksum text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, asset_key)
);

create table if not exists sequence_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  sequence_id uuid not null references sequences(id) on delete cascade,
  asset_key text not null,
  position integer not null,
  delay_hours integer not null default 0,
  channel text not null check (channel in ('whatsapp', 'email', 'sms')),
  template_asset_key text not null,
  checksum text not null default '',
  source_checksum text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, asset_key)
);

create table if not exists custom_fields (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  asset_key text not null,
  entity text not null check (entity in ('lead', 'deal', 'company')),
  field_key text not null,
  label text not null,
  field_type text not null default 'text',
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  position integer not null default 0,
  checksum text not null default '',
  source_checksum text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, asset_key)
);

create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists snapshot_loads (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references snapshots(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  target_org_id uuid not null references organizations(id) on delete cascade,
  mode text not null check (mode in ('apply', 'push')),
  report jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (org_id = target_org_id)
);

create index if not exists snapshot_loads_snapshot_idx on snapshot_loads (snapshot_id, mode);

do $fk$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'created_from_snapshot_id'
  ) then
    alter table organizations drop constraint if exists organizations_created_from_snapshot_id_fkey;
    alter table organizations
      add constraint organizations_created_from_snapshot_id_fkey
      foreign key (created_from_snapshot_id) references snapshots(id) on delete set null;
  end if;
end
$fk$;

drop trigger if exists snapshot_checksum on pipelines;
create trigger snapshot_checksum before insert or update on pipelines
for each row execute function public.snapshot_touch_checksum();

drop trigger if exists snapshot_checksum on pipeline_stages;
create trigger snapshot_checksum before insert or update on pipeline_stages
for each row execute function public.snapshot_touch_checksum();

drop trigger if exists snapshot_checksum on message_templates;
create trigger snapshot_checksum before insert or update on message_templates
for each row execute function public.snapshot_touch_checksum();

drop trigger if exists snapshot_checksum on sequences;
create trigger snapshot_checksum before insert or update on sequences
for each row execute function public.snapshot_touch_checksum();

drop trigger if exists snapshot_checksum on sequence_steps;
create trigger snapshot_checksum before insert or update on sequence_steps
for each row execute function public.snapshot_touch_checksum();

drop trigger if exists snapshot_checksum on custom_fields;
create trigger snapshot_checksum before insert or update on custom_fields
for each row execute function public.snapshot_touch_checksum();

do $tenancy$
begin
  if to_regprocedure('public.attach_org_tenancy(regclass)') is null then
    raise exception 'attach_org_tenancy is missing; apply 20260926160000_agency_tenancy.sql first';
  end if;
end
$tenancy$;

select public.attach_org_tenancy('public.pipelines'::regclass);
select public.attach_org_tenancy('public.pipeline_stages'::regclass);
select public.attach_org_tenancy('public.message_templates'::regclass);
select public.attach_org_tenancy('public.sequences'::regclass);
select public.attach_org_tenancy('public.sequence_steps'::regclass);
select public.attach_org_tenancy('public.custom_fields'::regclass);
select public.attach_org_tenancy('public.snapshots'::regclass);
select public.attach_org_tenancy('public.snapshot_loads'::regclass);

-- asset_key on the phase 1 sequence tables. Missing tables are skipped.
do $asset_key$
declare
  rel text;
begin
  foreach rel in array array[
    'crm_message_templates',
    'crm_campaigns',
    'workspace_sequences',
    'workspace_sequence_steps',
    'workspace_templates',
    'workspace_pipelines',
    'workspace_pipeline_stages'
  ]
  loop
    if to_regclass('public.' || rel) is null then
      continue;
    end if;
    execute format('alter table public.%I add column if not exists asset_key text', rel);
    execute format('alter table public.%I add column if not exists checksum text not null default ''''', rel);
    execute format('alter table public.%I add column if not exists source_checksum text not null default ''''', rel);
    execute format('drop trigger if exists snapshot_checksum on public.%I', rel);
    execute format(
      'create trigger snapshot_checksum before insert or update on public.%I for each row execute function public.snapshot_touch_checksum()',
      rel
    );
  end loop;

  if to_regclass('public.crm_message_templates') is not null then
    update crm_message_templates set asset_key = 'template:' || key where asset_key is null or btrim(asset_key) = '';
  end if;
  if to_regclass('public.crm_campaigns') is not null then
    update crm_campaigns set asset_key = 'campaign:' || id where asset_key is null or btrim(asset_key) = '';
  end if;
  if to_regclass('public.workspace_pipelines') is not null then
    update workspace_pipelines set asset_key = 'pipeline:' || id::text where asset_key is null or btrim(asset_key) = '';
    create unique index if not exists workspace_pipelines_org_asset_idx on workspace_pipelines (org_id, asset_key);
  end if;
  if to_regclass('public.workspace_pipeline_stages') is not null then
    update workspace_pipeline_stages set asset_key = 'stage:' || id::text where asset_key is null or btrim(asset_key) = '';
    create unique index if not exists workspace_pipeline_stages_org_asset_idx on workspace_pipeline_stages (org_id, asset_key);
  end if;
  if to_regclass('public.workspace_templates') is not null then
    update workspace_templates set asset_key = 'template:workspace:' || id::text where asset_key is null or btrim(asset_key) = '';
    create unique index if not exists workspace_templates_org_asset_idx on workspace_templates (org_id, asset_key);
  end if;
  if to_regclass('public.workspace_sequences') is not null then
    update workspace_sequences set asset_key = 'sequence:' || id::text where asset_key is null or btrim(asset_key) = '';
    create unique index if not exists workspace_sequences_org_asset_idx on workspace_sequences (org_id, asset_key);
  end if;
  if to_regclass('public.workspace_sequence_steps') is not null then
    update workspace_sequence_steps set asset_key = 'step:' || id::text where asset_key is null or btrim(asset_key) = '';
    create unique index if not exists workspace_sequence_steps_org_asset_idx on workspace_sequence_steps (org_id, asset_key);
  end if;
end
$asset_key$;

insert into pipelines (org_id, asset_key, name, is_default)
select w.org_id, w.asset_key, w.name, w.is_default
from workspace_pipelines w
where w.asset_key is not null
  and not exists (
    select 1 from pipelines p where p.org_id = w.org_id and p.asset_key = w.asset_key
  );

insert into pipeline_stages (org_id, pipeline_id, asset_key, name, position, is_won, is_lost)
select s.org_id, p.id, s.asset_key, s.name, s.position, s.is_won, s.is_lost
from workspace_pipeline_stages s
join workspace_pipelines w on w.id = s.pipeline_id
join pipelines p on p.org_id = w.org_id and p.asset_key = w.asset_key
where s.asset_key is not null
  and not exists (
    select 1 from pipeline_stages existing
    where existing.org_id = s.org_id and existing.asset_key = s.asset_key
  );

do $stage_id$
begin
  if to_regclass('public.crm_leads') is null then
    return;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_leads' and column_name = 'org_id'
  ) then
    return;
  end if;
  alter table public.crm_leads add column if not exists stage_id uuid references public.pipeline_stages(id) on delete set null;
  create index if not exists crm_leads_stage_id_idx on public.crm_leads (stage_id);
  update public.crm_leads lead
  set stage_id = matched.stage_id
  from (
    select lead_row.id as lead_id, min(stage.id::text)::uuid as stage_id
    from public.crm_leads lead_row
    join public.pipeline_stages stage
      on stage.org_id = lead_row.org_id
     and stage.name = lead_row.stage
    where lead_row.stage_id is null
      and lead_row.org_id is not null
    group by lead_row.id
    having count(*) = 1
  ) matched
  where lead.id = matched.lead_id
    and lead.stage_id is null;
end
$stage_id$;

create or replace function public.snapshot_walk(doc jsonb, forbidden text[], issues text[])
returns text[]
language plpgsql
stable
as $$
declare
  key text;
  child jsonb;
  raw text;
begin
  if doc is null or jsonb_typeof(doc) = 'null' then
    return issues;
  end if;
  if jsonb_typeof(doc) = 'object' then
    for key, child in select entry.key, entry.value from jsonb_each(doc) as entry
    loop
      if lower(key) = any (forbidden) then
        issues := issues || key;
      end if;
      issues := public.snapshot_walk(child, forbidden, issues);
    end loop;
  elsif jsonb_typeof(doc) = 'array' then
    for child in select entry.value from jsonb_array_elements(doc) as entry
    loop
      issues := public.snapshot_walk(child, forbidden, issues);
    end loop;
  elsif jsonb_typeof(doc) = 'string' then
    raw := doc #>> '{}';
    if raw ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
      issues := issues || 'email_address';
    end if;
    if raw ~* '(sk_live_|whsec_|api[_-]?key[[:space:]]*[:=]|bearer[[:space:]]+[a-z0-9]|secret[[:space:]]*[:=])' then
      issues := issues || 'secret_value';
    end if;
    if raw ~ '[[:digit:]]{10,}' then
      issues := issues || 'phone_number';
    end if;
  end if;
  return issues;
end;
$$;

create or replace function public.snapshot_payload_issues(doc jsonb)
returns text[]
language sql
stable
as $$
  select public.snapshot_walk(
    doc,
    array[
      'access_token',
      'api_key',
      'channel_connections',
      'channel_secret',
      'channel_secrets',
      'contact',
      'contacts',
      'credential',
      'credentials',
      'crm_contacts',
      'crm_outbox',
      'crm_prospects',
      'email',
      'from_address',
      'inbound_events',
      'message',
      'messages',
      'outbox',
      'password',
      'phone',
      'phone_e164',
      'prospects',
      'secret',
      'secrets',
      'service_role',
      'settings',
      'to_address',
      'token',
      'tokens',
      'webhook_secret',
      'whatsapp',
      'whatsapp_e164'
    ],
    '{}'::text[]
  );
$$;

create or replace function public.snapshot_write_pipeline(p_org uuid, item jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := item->>'asset_key';
  doc jsonb;
  sum text;
  existing pipelines%rowtype;
  result text;
begin
  if key is null or btrim(key) = '' then
    raise exception 'pipeline asset_key required';
  end if;
  doc := public.snapshot_pipeline_doc(key, item->>'name', coalesce((item->>'is_default')::boolean, false));
  sum := public.snapshot_checksum(doc);
  select * into existing from pipelines where org_id = p_org and asset_key = key;
  if not found then
    insert into pipelines (org_id, asset_key, name, is_default, source_checksum)
    values (p_org, key, item->>'name', coalesce((item->>'is_default')::boolean, false), sum);
    result := 'created';
  elsif (not p_force) and existing.checksum is distinct from existing.source_checksum then
    result := 'skipped_client_edit';
  elsif existing.checksum = sum then
    result := 'unchanged';
  else
    update pipelines
    set name = item->>'name',
        is_default = coalesce((item->>'is_default')::boolean, false),
        source_checksum = sum,
        updated_at = now()
    where id = existing.id;
    result := 'updated';
  end if;
  return jsonb_build_object('asset_key', key, 'kind', 'pipeline', 'result', result);
end;
$$;

create or replace function public.snapshot_write_stage(p_org uuid, item jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := item->>'asset_key';
  pipeline_key text := item->>'pipeline_asset_key';
  pipeline uuid;
  doc jsonb;
  sum text;
  existing pipeline_stages%rowtype;
  result text;
begin
  if key is null or btrim(key) = '' then
    raise exception 'stage asset_key required';
  end if;
  select id into pipeline from pipelines where org_id = p_org and asset_key = pipeline_key;
  if pipeline is null then
    raise exception 'pipeline % is missing for stage %', pipeline_key, key;
  end if;
  doc := public.snapshot_stage_doc(
    key,
    item->>'name',
    coalesce((item->>'position')::integer, 0),
    coalesce((item->>'is_won')::boolean, false),
    coalesce((item->>'is_lost')::boolean, false)
  );
  sum := public.snapshot_checksum(doc);
  select * into existing from pipeline_stages where org_id = p_org and asset_key = key;
  if not found then
    insert into pipeline_stages (org_id, pipeline_id, asset_key, name, position, is_won, is_lost, source_checksum)
    values (
      p_org,
      pipeline,
      key,
      item->>'name',
      coalesce((item->>'position')::integer, 0),
      coalesce((item->>'is_won')::boolean, false),
      coalesce((item->>'is_lost')::boolean, false),
      sum
    );
    result := 'created';
  elsif (not p_force) and existing.checksum is distinct from existing.source_checksum then
    result := 'skipped_client_edit';
  elsif existing.checksum = sum then
    result := 'unchanged';
  else
    update pipeline_stages
    set pipeline_id = pipeline,
        name = item->>'name',
        position = coalesce((item->>'position')::integer, 0),
        is_won = coalesce((item->>'is_won')::boolean, false),
        is_lost = coalesce((item->>'is_lost')::boolean, false),
        source_checksum = sum,
        updated_at = now()
    where id = existing.id;
    result := 'updated';
  end if;
  return jsonb_build_object('asset_key', key, 'kind', 'pipeline_stage', 'result', result);
end;
$$;

create or replace function public.snapshot_write_template(p_org uuid, item jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := item->>'asset_key';
  doc jsonb;
  sum text;
  existing message_templates%rowtype;
  result text;
  crm_edited boolean := false;
begin
  if key is null or btrim(key) = '' then
    raise exception 'template asset_key required';
  end if;
  if item->>'channel' not in ('whatsapp', 'email', 'sms') then
    raise exception 'template channel is invalid';
  end if;
  doc := public.snapshot_template_doc(
    key,
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
    where org_id = p_org and asset_key = key
    limit 1;
  end if;
  select * into existing from message_templates where org_id = p_org and asset_key = key;
  if not found then
    insert into message_templates (org_id, asset_key, channel, name, subject, body, active, source_checksum)
    values (
      p_org,
      key,
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
  return jsonb_build_object('asset_key', key, 'kind', 'message_template', 'result', result);
end;
$$;

create or replace function public.snapshot_write_sequence(p_org uuid, item jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := item->>'asset_key';
  doc jsonb;
  sum text;
  existing sequences%rowtype;
  result text;
begin
  if key is null or btrim(key) = '' then
    raise exception 'sequence asset_key required';
  end if;
  doc := public.snapshot_sequence_doc(key, item->>'name', coalesce((item->>'active')::boolean, false));
  sum := public.snapshot_checksum(doc);
  select * into existing from sequences where org_id = p_org and asset_key = key;
  if not found then
    insert into sequences (org_id, asset_key, name, active, source_checksum)
    values (p_org, key, item->>'name', coalesce((item->>'active')::boolean, false), sum);
    result := 'created';
  elsif (not p_force) and existing.checksum is distinct from existing.source_checksum then
    result := 'skipped_client_edit';
  elsif existing.checksum = sum then
    result := 'unchanged';
  else
    update sequences
    set name = item->>'name',
        active = coalesce((item->>'active')::boolean, false),
        source_checksum = sum,
        updated_at = now()
    where id = existing.id;
    result := 'updated';
  end if;
  return jsonb_build_object('asset_key', key, 'kind', 'sequence', 'result', result);
end;
$$;

create or replace function public.snapshot_write_step(p_org uuid, item jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := item->>'asset_key';
  sequence_key text := item->>'sequence_asset_key';
  sequence uuid;
  doc jsonb;
  sum text;
  existing sequence_steps%rowtype;
  result text;
begin
  if key is null or btrim(key) = '' then
    raise exception 'step asset_key required';
  end if;
  select id into sequence from sequences where org_id = p_org and asset_key = sequence_key;
  if sequence is null then
    raise exception 'sequence % is missing for step %', sequence_key, key;
  end if;
  doc := public.snapshot_step_doc(
    key,
    coalesce((item->>'position')::integer, 0),
    coalesce((item->>'delay_hours')::integer, 0),
    item->>'channel',
    item->>'template_asset_key'
  );
  sum := public.snapshot_checksum(doc);
  select * into existing from sequence_steps where org_id = p_org and asset_key = key;
  if not found then
    insert into sequence_steps (org_id, sequence_id, asset_key, position, delay_hours, channel, template_asset_key, source_checksum)
    values (
      p_org,
      sequence,
      key,
      coalesce((item->>'position')::integer, 0),
      coalesce((item->>'delay_hours')::integer, 0),
      item->>'channel',
      item->>'template_asset_key',
      sum
    );
    result := 'created';
  elsif (not p_force) and existing.checksum is distinct from existing.source_checksum then
    result := 'skipped_client_edit';
  elsif existing.checksum = sum then
    result := 'unchanged';
  else
    update sequence_steps
    set sequence_id = sequence,
        position = coalesce((item->>'position')::integer, 0),
        delay_hours = coalesce((item->>'delay_hours')::integer, 0),
        channel = item->>'channel',
        template_asset_key = item->>'template_asset_key',
        source_checksum = sum,
        updated_at = now()
    where id = existing.id;
    result := 'updated';
  end if;
  return jsonb_build_object('asset_key', key, 'kind', 'sequence_step', 'result', result);
end;
$$;

create or replace function public.snapshot_write_field(p_org uuid, item jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := item->>'asset_key';
  doc jsonb;
  sum text;
  existing custom_fields%rowtype;
  result text;
  options jsonb := coalesce(item->'options', '[]'::jsonb);
begin
  if key is null or btrim(key) = '' then
    raise exception 'field asset_key required';
  end if;
  doc := public.snapshot_field_doc(
    key,
    item->>'entity',
    item->>'field_key',
    item->>'label',
    coalesce(item->>'field_type', 'text'),
    options,
    coalesce((item->>'required')::boolean, false),
    coalesce((item->>'position')::integer, 0)
  );
  sum := public.snapshot_checksum(doc);
  select * into existing from custom_fields where org_id = p_org and asset_key = key;
  if not found then
    insert into custom_fields (org_id, asset_key, entity, field_key, label, field_type, options, required, position, source_checksum)
    values (
      p_org,
      key,
      item->>'entity',
      item->>'field_key',
      item->>'label',
      coalesce(item->>'field_type', 'text'),
      options,
      coalesce((item->>'required')::boolean, false),
      coalesce((item->>'position')::integer, 0),
      sum
    );
    result := 'created';
  elsif (not p_force) and existing.checksum is distinct from existing.source_checksum then
    result := 'skipped_client_edit';
  elsif existing.checksum = sum then
    result := 'unchanged';
  else
    update custom_fields
    set entity = item->>'entity',
        field_key = item->>'field_key',
        label = item->>'label',
        field_type = coalesce(item->>'field_type', 'text'),
        options = options,
        required = coalesce((item->>'required')::boolean, false),
        position = coalesce((item->>'position')::integer, 0),
        source_checksum = sum,
        updated_at = now()
    where id = existing.id;
    result := 'updated';
  end if;
  return jsonb_build_object('asset_key', key, 'kind', 'custom_field', 'result', result);
end;
$$;

create or replace function public.snapshot_apply_payload(p_org uuid, p_payload jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  report jsonb := '[]'::jsonb;
  pipe jsonb;
  stage jsonb;
  item jsonb;
  seq jsonb;
  step jsonb;
begin
  if p_org is null or not exists (select 1 from organizations where id = p_org) then
    raise exception 'target org not found';
  end if;

  for pipe in select entry.value from jsonb_array_elements(coalesce(p_payload->'pipelines', '[]'::jsonb)) as entry
  loop
    report := report || jsonb_build_array(public.snapshot_write_pipeline(p_org, pipe, p_force));
    for stage in select entry.value from jsonb_array_elements(coalesce(pipe->'stages', '[]'::jsonb)) as entry
    loop
      report := report || jsonb_build_array(public.snapshot_write_stage(
        p_org,
        stage || jsonb_build_object('pipeline_asset_key', pipe->>'asset_key'),
        p_force
      ));
    end loop;
  end loop;

  for item in select entry.value from jsonb_array_elements(coalesce(p_payload->'message_templates', '[]'::jsonb)) as entry
  loop
    report := report || jsonb_build_array(public.snapshot_write_template(p_org, item, p_force));
  end loop;

  for seq in select entry.value from jsonb_array_elements(coalesce(p_payload->'sequences', '[]'::jsonb)) as entry
  loop
    report := report || jsonb_build_array(public.snapshot_write_sequence(p_org, seq, p_force));
    for step in select entry.value from jsonb_array_elements(coalesce(seq->'steps', '[]'::jsonb)) as entry
    loop
      report := report || jsonb_build_array(public.snapshot_write_step(
        p_org,
        step || jsonb_build_object('sequence_asset_key', seq->>'asset_key'),
        p_force
      ));
    end loop;
  end loop;

  for item in select entry.value from jsonb_array_elements(coalesce(p_payload->'custom_fields', '[]'::jsonb)) as entry
  loop
    report := report || jsonb_build_array(public.snapshot_write_field(p_org, item, p_force));
  end loop;

  return report;
end;
$$;

create or replace function public.snapshot_export(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pipelines_json jsonb := '[]'::jsonb;
  templates_json jsonb := '[]'::jsonb;
  sequences_json jsonb := '[]'::jsonb;
  fields_json jsonb := '[]'::jsonb;
  pipe pipelines%rowtype;
  seq sequences%rowtype;
  stages jsonb;
  steps jsonb;
  result jsonb;
  issues text[];
begin
  if auth.uid() is null or p_org_id not in (select public.accessible_org_ids()) then
    raise exception 'not allowed';
  end if;

  for pipe in select * from pipelines where org_id = p_org_id order by name, asset_key
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'asset_key', stage.asset_key,
      'name', stage.name,
      'position', stage.position,
      'is_won', stage.is_won,
      'is_lost', stage.is_lost
    ) order by stage.position), '[]'::jsonb)
    into stages
    from pipeline_stages stage
    where stage.pipeline_id = pipe.id;

    pipelines_json := pipelines_json || jsonb_build_array(jsonb_build_object(
      'asset_key', pipe.asset_key,
      'name', pipe.name,
      'is_default', pipe.is_default,
      'stages', stages
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_key', template.asset_key,
    'channel', template.channel,
    'name', template.name,
    'subject', template.subject,
    'body', template.body,
    'active', template.active
  ) order by template.asset_key), '[]'::jsonb)
  into templates_json
  from message_templates template
  where template.org_id = p_org_id;

  for seq in select * from sequences where org_id = p_org_id order by asset_key
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'asset_key', step.asset_key,
      'position', step.position,
      'delay_hours', step.delay_hours,
      'channel', step.channel,
      'template_asset_key', step.template_asset_key
    ) order by step.position), '[]'::jsonb)
    into steps
    from sequence_steps step
    where step.sequence_id = seq.id;

    sequences_json := sequences_json || jsonb_build_array(jsonb_build_object(
      'asset_key', seq.asset_key,
      'name', seq.name,
      'active', seq.active,
      'steps', steps
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_key', field.asset_key,
    'entity', field.entity,
    'field_key', field.field_key,
    'label', field.label,
    'field_type', field.field_type,
    'options', field.options,
    'required', field.required,
    'position', field.position
  ) order by field.position), '[]'::jsonb)
  into fields_json
  from custom_fields field
  where field.org_id = p_org_id;

  result := jsonb_build_object(
    'version', 1,
    'pipelines', pipelines_json,
    'message_templates', templates_json,
    'sequences', sequences_json,
    'custom_fields', fields_json
  );
  issues := public.snapshot_payload_issues(result);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'snapshot export refused private data';
  end if;
  return result;
end;
$$;

create or replace function public.snapshot_apply(p_snapshot_id uuid, p_target_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  snap snapshots%rowtype;
  issues text[];
  report jsonb;
begin
  if auth.uid() is null or not public.has_org_role(p_target_org, array['agency_owner', 'agency_staff']) then
    raise exception 'not allowed';
  end if;
  select * into snap from snapshots where id = p_snapshot_id;
  if snap.id is null then
    raise exception 'snapshot not found';
  end if;
  issues := public.snapshot_payload_issues(snap.payload);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'snapshot payload contains private data';
  end if;
  report := public.snapshot_apply_payload(p_target_org, snap.payload, true);
  update organizations
  set created_from_snapshot_id = p_snapshot_id
  where id = p_target_org
    and created_from_snapshot_id is null;
  insert into snapshot_loads (snapshot_id, org_id, target_org_id, mode, report)
  values (p_snapshot_id, p_target_org, p_target_org, 'apply', report);
  return report;
end;
$$;

create or replace function public.snapshot_push(p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  snap snapshots%rowtype;
  issues text[];
  target uuid;
  report jsonb;
  combined jsonb := '[]'::jsonb;
begin
  select * into snap from snapshots where id = p_snapshot_id;
  if snap.id is null then
    raise exception 'snapshot not found';
  end if;
  if auth.uid() is null or not public.has_org_role(snap.org_id, array['agency_owner', 'agency_staff']) then
    raise exception 'not allowed';
  end if;
  issues := public.snapshot_payload_issues(snap.payload);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'snapshot payload contains private data';
  end if;

  for target in
    select distinct loaded.org_id
    from (
      select target_org_id as org_id
      from snapshot_loads
      where snapshot_id = p_snapshot_id and mode = 'apply'
      union
      select id as org_id
      from organizations
      where created_from_snapshot_id = p_snapshot_id
    ) loaded
  loop
    report := public.snapshot_apply_payload(target, snap.payload, false);
    select coalesce(jsonb_agg(elem || jsonb_build_object('org_id', target)), '[]'::jsonb)
    into report
    from jsonb_array_elements(report) elem;
    insert into snapshot_loads (snapshot_id, org_id, target_org_id, mode, report)
    values (p_snapshot_id, target, target, 'push', report);
    combined := combined || report;
  end loop;

  return combined;
end;
$$;

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
  if p_plan_key not in ('starter', 'growth', 'scale') then
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

revoke all on function public.snapshot_checksum(jsonb) from public, anon, authenticated;
revoke all on function public.snapshot_pipeline_doc(text, text, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_stage_doc(text, text, integer, boolean, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_template_doc(text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_sequence_doc(text, text, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_step_doc(text, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.snapshot_field_doc(text, text, text, text, text, jsonb, boolean, integer) from public, anon, authenticated;
revoke all on function public.snapshot_touch_checksum() from public, anon, authenticated;
revoke all on function public.snapshot_walk(jsonb, text[], text[]) from public, anon, authenticated;
revoke all on function public.snapshot_payload_issues(jsonb) from public, anon, authenticated;
revoke all on function public.snapshot_write_pipeline(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_write_stage(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_write_template(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_write_sequence(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_write_step(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_write_field(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_apply_payload(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.snapshot_export(uuid) from public, anon;
revoke all on function public.snapshot_apply(uuid, uuid) from public, anon;
revoke all on function public.snapshot_push(uuid) from public, anon;
revoke all on function public.provision_client_workspace(text, text, text, text, text, text, uuid, text, text, text) from public, anon;

grant execute on function public.snapshot_export(uuid) to authenticated;
grant execute on function public.snapshot_apply(uuid, uuid) to authenticated;
grant execute on function public.snapshot_push(uuid) to authenticated;
grant execute on function public.provision_client_workspace(text, text, text, text, text, text, uuid, text, text, text) to authenticated;
grant execute on function public.snapshot_payload_issues(jsonb) to authenticated;

-- SEED_SNAPSHOTS

do $seed$
declare
  agency uuid;
  agency_payload jsonb := $snap${"version":1,"pipelines":[{"asset_key":"pipeline:sales","name":"Sales","is_default":true,"stages":[{"asset_key":"stage:sales:new","name":"New","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:sales:contacted","name":"Contacted","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:sales:audit-booked","name":"Audit booked","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:sales:audit-done","name":"Audit done","position":4,"is_won":false,"is_lost":false},{"asset_key":"stage:sales:proposal-sent","name":"Proposal sent","position":5,"is_won":false,"is_lost":false},{"asset_key":"stage:sales:won","name":"Won","position":6,"is_won":true,"is_lost":false},{"asset_key":"stage:sales:lost","name":"Lost","position":7,"is_won":false,"is_lost":true},{"asset_key":"stage:sales:handover","name":"Onboarding/Handover","position":8,"is_won":false,"is_lost":false}]}],"message_templates":[{"asset_key":"template:ack_whatsapp","channel":"whatsapp","name":"Instant acknowledgement (WhatsApp)","subject":"","body":"Hi {{firstName}}, it's Billy from AI AutoTech. Thanks for getting in touch about {{company}}. I've got your details and I'll look at where automation can take work off your team.\n\nBook a short audit here: {{bookingUrl}}\n\nIf the link is awkward, just reply and I'll send times.","active":true},{"asset_key":"template:ack_email","channel":"email","name":"Instant acknowledgement (email)","subject":"{{company}} — we have your details","body":"Hi {{firstName}},\n\nBilly here from AI AutoTech. Thanks for reaching out about {{company}}. I've received it and I'll review where an AI employee or a cleaner follow-up process would help.\n\nBook a 20-minute audit: {{bookingUrl}}\n\nIf none of those times work, reply to this email and I'll fit around you.\n\nBilly\nAI AutoTech Pty Ltd","active":true},{"asset_key":"template:nudge_day1_whatsapp","channel":"whatsapp","name":"Day 1 nudge (WhatsApp)","subject":"","body":"Hi {{firstName}}, Billy again. Just checking my note about {{company}} landed. The usual first win is WhatsApp and lead follow-up, so nothing sits unanswered.\n\nHere's the booking link: {{bookingUrl}}","active":true},{"asset_key":"template:nudge_day1_email","channel":"email","name":"Day 1 nudge (email)","subject":"Quick follow-up for {{company}}","body":"Hi {{firstName}},\n\nChecking you saw my note about {{company}}. If you want the audit, here is the link again: {{bookingUrl}}\n\nBilly\nAI AutoTech Pty Ltd","active":true},{"asset_key":"template:nudge_day3_whatsapp","channel":"whatsapp","name":"Day 3 nudge (WhatsApp)","subject":"","body":"Hi {{firstName}}, a short nudge from AI AutoTech. Teams that book the audit this week usually want the inbox and follow-up handled for them. 20 minutes with me: {{bookingUrl}}","active":true},{"asset_key":"template:nudge_day3_email","channel":"email","name":"Day 3 nudge (email)","subject":"Still worth a look for {{company}}?","body":"Hi {{firstName}},\n\nStill happy to walk through {{company}} whenever it suits you. Booking link: {{bookingUrl}}\n\nBilly\nAI AutoTech Pty Ltd","active":true},{"asset_key":"template:nudge_day7_whatsapp","channel":"whatsapp","name":"Day 7 nudge (WhatsApp)","subject":"","body":"Hi {{firstName}}, last note from me on {{company}} unless you want to pick it up. I won't keep pinging you. Reply \"later\" if the timing is off, or book here: {{bookingUrl}}","active":true},{"asset_key":"template:nudge_day7_email","channel":"email","name":"Day 7 nudge (email)","subject":"Last note on the {{company}} audit","body":"Hi {{firstName}},\n\nThis is my last follow-up on {{company}}. If you want the audit, book here: {{bookingUrl}}. If now is the wrong time, reply \"later\" and I'll leave it.\n\nBilly\nAI AutoTech Pty Ltd","active":true},{"asset_key":"template:audit_reminder_whatsapp","channel":"whatsapp","name":"Audit reminder (WhatsApp)","subject":"","body":"Hi {{firstName}}, reminder from Billy at AI AutoTech. Your audit for {{company}} is coming up{{when}}. Reply if you need to move it.","active":true},{"asset_key":"template:audit_reminder_email","channel":"email","name":"Audit reminder (email)","subject":"Reminder: {{company}} audit","body":"Hi {{firstName}},\n\nYour AI AutoTech audit for {{company}} is coming up{{when}}. Reply if you need a different time.\n\nBilly\nAI AutoTech Pty Ltd","active":true},{"asset_key":"template:proposal_followup_whatsapp","channel":"whatsapp","name":"Proposal follow-up (WhatsApp)","subject":"","body":"Hi {{firstName}}, Billy from AI AutoTech. The proposal for {{company}} has been with you for a few days. Happy to walk through the price and what we deliver. Reply here, or book: {{bookingUrl}}","active":true},{"asset_key":"template:proposal_followup_email","channel":"email","name":"Proposal follow-up (email)","subject":"Following up on the {{company}} proposal","body":"Hi {{firstName}},\n\nChecking in on the proposal for {{company}}. I can walk through the price and the handover whenever you're ready.\n\nBilly\nAI AutoTech Pty Ltd","active":true}],"sequences":[{"asset_key":"sequence:new-lead","name":"New lead follow-up","active":true,"steps":[{"asset_key":"step:new-lead:ack:whatsapp","position":1,"delay_hours":0,"channel":"whatsapp","template_asset_key":"template:ack_whatsapp"},{"asset_key":"step:new-lead:ack:email","position":2,"delay_hours":0,"channel":"email","template_asset_key":"template:ack_email"},{"asset_key":"step:new-lead:day1:whatsapp","position":3,"delay_hours":24,"channel":"whatsapp","template_asset_key":"template:nudge_day1_whatsapp"},{"asset_key":"step:new-lead:day1:email","position":4,"delay_hours":24,"channel":"email","template_asset_key":"template:nudge_day1_email"},{"asset_key":"step:new-lead:day3:whatsapp","position":5,"delay_hours":72,"channel":"whatsapp","template_asset_key":"template:nudge_day3_whatsapp"},{"asset_key":"step:new-lead:day3:email","position":6,"delay_hours":72,"channel":"email","template_asset_key":"template:nudge_day3_email"},{"asset_key":"step:new-lead:day7:whatsapp","position":7,"delay_hours":168,"channel":"whatsapp","template_asset_key":"template:nudge_day7_whatsapp"},{"asset_key":"step:new-lead:day7:email","position":8,"delay_hours":168,"channel":"email","template_asset_key":"template:nudge_day7_email"}]},{"asset_key":"sequence:audit-reminder","name":"Audit reminder","active":true,"steps":[{"asset_key":"step:audit-reminder:audit:whatsapp","position":1,"delay_hours":0,"channel":"whatsapp","template_asset_key":"template:audit_reminder_whatsapp"},{"asset_key":"step:audit-reminder:audit:email","position":2,"delay_hours":0,"channel":"email","template_asset_key":"template:audit_reminder_email"}]},{"asset_key":"sequence:proposal-followup","name":"Proposal follow-up","active":true,"steps":[{"asset_key":"step:proposal-followup:proposal:whatsapp","position":1,"delay_hours":72,"channel":"whatsapp","template_asset_key":"template:proposal_followup_whatsapp"},{"asset_key":"step:proposal-followup:proposal:email","position":2,"delay_hours":72,"channel":"email","template_asset_key":"template:proposal_followup_email"}]}],"custom_fields":[{"asset_key":"field:lead:company-size","entity":"lead","field_key":"company_size","label":"Company size","field_type":"text","options":[],"required":false,"position":1},{"asset_key":"field:lead:industry","entity":"lead","field_key":"industry","label":"Industry","field_type":"text","options":[],"required":false,"position":2},{"asset_key":"field:lead:website","entity":"lead","field_key":"website","label":"Website","field_type":"text","options":[],"required":false,"position":3}]}$snap$::jsonb;
  education_payload jsonb := $snap${"version":1,"pipelines":[{"asset_key":"pipeline:admissions","name":"Admissions","is_default":true,"stages":[{"asset_key":"stage:admissions:enquiry","name":"Enquiry","position":1,"is_won":false,"is_lost":false},{"asset_key":"stage:admissions:application-started","name":"Application Started","position":2,"is_won":false,"is_lost":false},{"asset_key":"stage:admissions:docs-submitted","name":"Docs Submitted","position":3,"is_won":false,"is_lost":false},{"asset_key":"stage:admissions:accepted","name":"Accepted","position":4,"is_won":false,"is_lost":false},{"asset_key":"stage:admissions:registered","name":"Registered","position":5,"is_won":true,"is_lost":false},{"asset_key":"stage:admissions:lost","name":"Lost","position":6,"is_won":false,"is_lost":true}]}],"message_templates":[{"asset_key":"template:admissions:enquiry","channel":"whatsapp","name":"Enquiry received","subject":"","body":"Hi {{firstName}}, thank you for your enquiry. An admissions advisor will contact you with the next step. This is a template only and is not sent automatically.","active":true},{"asset_key":"template:admissions:application","channel":"whatsapp","name":"Application started","subject":"","body":"Hi {{firstName}}, your application has been started. Reply if you want help finishing it. This template is not sent until sending is turned on.","active":true},{"asset_key":"template:admissions:docs","channel":"whatsapp","name":"Documents reminder","subject":"","body":"Hi {{firstName}}, we still need your documents before the application can move on. Reply with any questions. This template is not sent automatically.","active":true},{"asset_key":"template:admissions:accepted","channel":"whatsapp","name":"Accepted next steps","subject":"","body":"Hi {{firstName}}, your application was accepted. The next step is registration. This template is not sent automatically.","active":true}],"sequences":[{"asset_key":"sequence:admissions-follow-up","name":"Admissions follow-up","active":false,"steps":[{"asset_key":"step:admissions:enquiry","position":1,"delay_hours":0,"channel":"whatsapp","template_asset_key":"template:admissions:enquiry"},{"asset_key":"step:admissions:application","position":2,"delay_hours":24,"channel":"whatsapp","template_asset_key":"template:admissions:application"},{"asset_key":"step:admissions:docs","position":3,"delay_hours":72,"channel":"whatsapp","template_asset_key":"template:admissions:docs"},{"asset_key":"step:admissions:accepted","position":4,"delay_hours":0,"channel":"whatsapp","template_asset_key":"template:admissions:accepted"}]}],"custom_fields":[{"asset_key":"field:admissions:programme","entity":"lead","field_key":"programme","label":"Programme","field_type":"text","options":[],"required":false,"position":1},{"asset_key":"field:admissions:campus","entity":"lead","field_key":"campus","label":"Campus","field_type":"text","options":[],"required":false,"position":2},{"asset_key":"field:admissions:intake","entity":"lead","field_key":"intake_month","label":"Intake","field_type":"text","options":[],"required":false,"position":3}]}$snap$::jsonb;
  issues text[];
begin
  select id into agency from organizations where slug = 'ai-autotech';
  if agency is null then
    raise notice 'ai-autotech organisation is missing; snapshot seeds skipped';
    return;
  end if;
  issues := public.snapshot_payload_issues(agency_payload) || public.snapshot_payload_issues(education_payload);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'snapshot seed contains private data: %', issues;
  end if;

  insert into snapshots (id, org_id, name, description, payload)
  values (
    'a2c00000-0000-4000-8000-000000000001',
    agency,
    'Agency Default',
    'AI AutoTech sales pipeline, follow-up sequences, and message templates. Applying it does not send anything.',
    agency_payload
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    payload = excluded.payload,
    updated_at = now();

  insert into snapshots (id, org_id, name, description, payload)
  values (
    'a2c00000-0000-4000-8000-000000000002',
    agency,
    'Education / Admissions',
    'Enquiry through Registered or Lost. WhatsApp follow-ups are stored as templates only and are not sent.',
    education_payload
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    payload = excluded.payload,
    updated_at = now();
end
$seed$;
