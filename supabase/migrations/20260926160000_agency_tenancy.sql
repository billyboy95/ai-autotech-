-- Agency / client workspaces for AI AutoTech Pty Ltd.
-- Additive only: new tables, new columns, new policies. No data is deleted.
-- Existing company CRM rows are moved into the AI AutoTech agency workspace.
-- EASTC (East Sea Technocentric Varsity, Kempton Park) is seeded as the first client workspace.
--
-- Safe to re-run. Tables that already exist (including classic Command Centre tables
-- from schema.sql, and any phase-1 tables created earlier) only gain org_id + RLS.

do $ext$
begin
  create extension if not exists pgcrypto;
exception
  when others then
    null;
end
$ext$;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end
$roles$;

do $auth$
begin
  create schema if not exists auth;
  if to_regclass('auth.users') is null then
    create table auth.users (
      id uuid primary key,
      email text,
      created_at timestamptz not null default now()
    );
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  end if;
end
$auth$;

grant usage on schema public to authenticated, anon;
do $grant_uid$
begin
  grant execute on function auth.uid() to authenticated, anon;
exception
  when others then
    null;
end
$grant_uid$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  slug text unique,
  status text not null default 'active'
);

alter table organizations add column if not exists org_type text not null default 'client';
alter table organizations drop constraint if exists organizations_org_type_check;
alter table organizations add constraint organizations_org_type_check check (org_type in ('agency', 'client'));
alter table organizations add column if not exists parent_id uuid references organizations(id) on delete restrict;
alter table organizations add column if not exists legal_name text;
alter table organizations add column if not exists location text;
alter table organizations add column if not exists industry text;
alter table organizations add column if not exists logo_url text;
alter table organizations add column if not exists primary_color text not null default '#0B1F3A';
alter table organizations add column if not exists accent_color text not null default '#2563EB';
alter table organizations add column if not exists domain text;
alter table organizations add column if not exists form_key text;
alter table organizations add column if not exists settings jsonb not null default '{}'::jsonb;
alter table organizations add column if not exists owner_id uuid;

create unique index if not exists organizations_form_key_key on organizations (form_key) where form_key is not null;
create index if not exists organizations_parent_id_idx on organizations (parent_id);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('agency_owner', 'agency_staff', 'client_admin', 'client_user')),
  unique (user_id, org_id)
);

create index if not exists memberships_user_id_idx on memberships (user_id);
create index if not exists memberships_org_id_idx on memberships (org_id);

-- Workspace catalogue used to clone a client from a template. Names are prefixed so they
-- do not collide with the phase-1 pipeline engine if that work uses unprefixed tables.
create table if not exists workspace_pipelines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists workspace_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  pipeline_id uuid not null references workspace_pipelines(id) on delete cascade,
  name text not null,
  position integer not null,
  is_won boolean not null default false,
  is_lost boolean not null default false
);

create table if not exists workspace_deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  pipeline_id uuid references workspace_pipelines(id) on delete set null,
  stage_id uuid references workspace_pipeline_stages(id) on delete set null,
  title text not null,
  amount_cents integer not null default 0,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  created_at timestamptz not null default now()
);

create table if not exists workspace_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  channel text not null default 'whatsapp',
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists workspace_sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  sequence_id uuid not null references workspace_sequences(id) on delete cascade,
  position integer not null,
  delay_hours integer not null default 24,
  channel text not null default 'whatsapp',
  template_name text not null default ''
);

create table if not exists workspace_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  channel text not null default 'whatsapp',
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  body text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists workspace_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists workspace_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  due_on date,
  created_at timestamptz not null default now()
);

create or replace function public.accessible_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.org_id
  from memberships m
  where m.user_id = auth.uid()
  union
  select child.id
  from organizations child
  join memberships m on m.org_id = child.parent_id
  where m.user_id = auth.uid()
    and m.role in ('agency_owner', 'agency_staff')
    and child.org_type = 'client'
$$;

create or replace function public.can_manage_members(target_org uuid, new_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when new_role in ('agency_owner', 'agency_staff') then exists (
      select 1 from memberships m
      where m.user_id = auth.uid()
        and m.role = 'agency_owner'
        and m.org_id = target_org
    )
    when new_role in ('client_admin', 'client_user') then exists (
      select 1 from memberships m
      where m.user_id = auth.uid()
        and (
          (m.role = 'client_admin' and m.org_id = target_org)
          or (
            m.role in ('agency_owner', 'agency_staff')
            and (
              m.org_id = target_org
              or m.org_id = (select parent_id from organizations where id = target_org)
            )
          )
        )
    )
    else false
  end
$$;

revoke all on function public.accessible_org_ids() from public;
revoke all on function public.can_manage_members(uuid, text) from public;
grant execute on function public.accessible_org_ids() to authenticated;
grant execute on function public.can_manage_members(uuid, text) to authenticated;

create or replace function public.attach_org_tenancy(target regclass)
returns void
language plpgsql
as $$
declare
  relname text;
begin
  if target is null then
    return;
  end if;
  relname := split_part(target::text, '.', 2);
  execute format(
    'alter table %s add column if not exists org_id uuid references public.organizations(id) on delete cascade',
    target
  );
  execute format('create index if not exists %I on %s (org_id)', relname || '_org_id_idx', target);
  execute format('alter table %s enable row level security', target);
  execute format('alter table %s force row level security', target);
  execute format('drop policy if exists org_isolation on %s', target);
  execute format(
    'create policy org_isolation on %s for all to authenticated using (org_id in (select public.accessible_org_ids())) with check (org_id in (select public.accessible_org_ids()))',
    target
  );
  execute format('grant select, insert, update, delete on %s to authenticated', target);
end;
$$;

-- Company CRM (live product) plus intake tables.
select public.attach_org_tenancy(to_regclass('public.crm_leads'));
select public.attach_org_tenancy(to_regclass('public.crm_clients'));
select public.attach_org_tenancy(to_regclass('public.crm_jobs'));
select public.attach_org_tenancy(to_regclass('public.crm_invoices'));
select public.attach_org_tenancy(to_regclass('public.crm_audit_leads'));
select public.attach_org_tenancy(to_regclass('public.crm_contact_leads'));

-- Classic Command Centre tables, when schema.sql has been applied.
select public.attach_org_tenancy(to_regclass('public.companies'));
select public.attach_org_tenancy(to_regclass('public.contacts'));
select public.attach_org_tenancy(to_regclass('public.leads'));
select public.attach_org_tenancy(to_regclass('public.clients'));
select public.attach_org_tenancy(to_regclass('public.projects'));
select public.attach_org_tenancy(to_regclass('public.tasks'));
select public.attach_org_tenancy(to_regclass('public.proposals'));
select public.attach_org_tenancy(to_regclass('public.proposal_items'));
select public.attach_org_tenancy(to_regclass('public.invoices'));
select public.attach_org_tenancy(to_regclass('public.invoice_items'));
select public.attach_org_tenancy(to_regclass('public.payments'));
select public.attach_org_tenancy(to_regclass('public.documents'));
select public.attach_org_tenancy(to_regclass('public.support_tickets'));
select public.attach_org_tenancy(to_regclass('public.ticket_comments'));
select public.attach_org_tenancy(to_regclass('public.agents'));
select public.attach_org_tenancy(to_regclass('public.agent_tasks'));
select public.attach_org_tenancy(to_regclass('public.activity_logs'));
select public.attach_org_tenancy(to_regclass('public.appointments'));
select public.attach_org_tenancy(to_regclass('public.services'));
select public.attach_org_tenancy(to_regclass('public.service_packages'));
select public.attach_org_tenancy(to_regclass('public.settings'));

-- Workspace catalogue.
select public.attach_org_tenancy('public.workspace_pipelines'::regclass);
select public.attach_org_tenancy('public.workspace_pipeline_stages'::regclass);
select public.attach_org_tenancy('public.workspace_deals'::regclass);
select public.attach_org_tenancy('public.workspace_templates'::regclass);
select public.attach_org_tenancy('public.workspace_sequences'::regclass);
select public.attach_org_tenancy('public.workspace_sequence_steps'::regclass);
select public.attach_org_tenancy('public.workspace_messages'::regclass);
select public.attach_org_tenancy('public.workspace_campaigns'::regclass);
select public.attach_org_tenancy('public.workspace_tasks'::regclass);

-- Replace broad "any admin sees every tenant" policies from schema.sql when present.
do $drop$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'admins manage organizations',
        'admins manage memberships',
        'admins manage subscriptions',
        'tenant companies',
        'tenant contacts',
        'tenant lead read',
        'tenant lead update',
        'tenant clients',
        'tenant projects',
        'tenant tasks',
        'tenant proposals',
        'tenant proposal items',
        'tenant invoices',
        'tenant invoice items',
        'tenant payments',
        'tenant documents',
        'tenant tickets',
        'tenant ticket comments',
        'tenant agents',
        'tenant agent tasks',
        'tenant appointments',
        'internal companies',
        'internal contacts',
        'internal lead read',
        'internal lead update',
        'internal clients',
        'internal projects',
        'internal tasks',
        'internal proposals',
        'internal proposal items',
        'internal invoices',
        'internal invoice items',
        'internal payments',
        'internal documents',
        'internal tickets',
        'internal ticket comments',
        'internal agents',
        'internal agent tasks',
        'internal appointments'
      )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end
$drop$;

alter table organizations enable row level security;
alter table organizations force row level security;
alter table memberships enable row level security;
alter table memberships force row level security;

drop policy if exists org_read on organizations;
create policy org_read on organizations
  for select to authenticated
  using (id in (select public.accessible_org_ids()));

drop policy if exists org_insert_client on organizations;
create policy org_insert_client on organizations
  for insert to authenticated
  with check (
    org_type = 'client'
    and parent_id in (
      select m.org_id from memberships m
      where m.user_id = auth.uid()
        and m.role in ('agency_owner', 'agency_staff')
    )
  );

drop policy if exists org_update on organizations;
create policy org_update on organizations
  for update to authenticated
  using (id in (select public.accessible_org_ids()))
  with check (id in (select public.accessible_org_ids()));

drop policy if exists membership_read on memberships;
create policy membership_read on memberships
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists membership_insert on memberships;
create policy membership_insert on memberships
  for insert to authenticated
  with check (public.can_manage_members(org_id, role));

drop policy if exists membership_update on memberships;
create policy membership_update on memberships
  for update to authenticated
  using (public.can_manage_members(org_id, role))
  with check (public.can_manage_members(org_id, role));

drop policy if exists membership_delete on memberships;
create policy membership_delete on memberships
  for delete to authenticated
  using (public.can_manage_members(org_id, role));

grant select, update on organizations to authenticated;
grant insert on organizations to authenticated;
grant select, insert, update, delete on memberships to authenticated;

-- Parent agency. Existing slug wins so a row created earlier is reused.
insert into organizations (
  id, name, slug, status, org_type, legal_name, location, industry,
  primary_color, accent_color, domain, form_key, settings
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'AI AutoTech Pty Ltd',
  'ai-autotech',
  'active',
  'agency',
  'AI AutoTech Pty Ltd',
  'South Africa',
  'AI automation',
  '#0B1F3A',
  '#2563EB',
  'aiautotech.co.za',
  'ai-autotech',
  jsonb_build_object(
    'channels', jsonb_build_object(
      'whatsapp', jsonb_build_object('phoneNumberId', '', 'displayPhone', ''),
      'email', jsonb_build_object('fromAddress', '', 'provider', ''),
      'sms', jsonb_build_object('senderId', '')
    )
  )
)
on conflict (slug) do update set
  name = excluded.name,
  org_type = 'agency',
  legal_name = excluded.legal_name,
  location = excluded.location,
  industry = excluded.industry,
  primary_color = excluded.primary_color,
  accent_color = excluded.accent_color,
  domain = excluded.domain,
  form_key = coalesce(organizations.form_key, excluded.form_key),
  settings = case
    when organizations.settings = '{}'::jsonb then excluded.settings
    else organizations.settings
  end,
  updated_at = now();

insert into organizations (
  id, name, slug, status, org_type, parent_id, legal_name, location, industry,
  primary_color, accent_color, domain, form_key, settings
)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'EASTC',
  'eastc',
  'active',
  'client',
  (select id from organizations where slug = 'ai-autotech'),
  'East Sea Technocentric Varsity',
  'Kempton Park, South Africa',
  'Education',
  '#0F3D4C',
  '#C4A35A',
  'eastech.co.za',
  'eastc',
  jsonb_build_object(
    'channels', jsonb_build_object(
      'whatsapp', jsonb_build_object('phoneNumberId', '', 'displayPhone', ''),
      'email', jsonb_build_object('fromAddress', '', 'provider', ''),
      'sms', jsonb_build_object('senderId', '')
    )
  )
)
on conflict (slug) do update set
  name = excluded.name,
  org_type = 'client',
  parent_id = excluded.parent_id,
  legal_name = excluded.legal_name,
  location = excluded.location,
  industry = excluded.industry,
  primary_color = excluded.primary_color,
  accent_color = excluded.accent_color,
  domain = excluded.domain,
  form_key = coalesce(organizations.form_key, excluded.form_key),
  updated_at = now();

-- Move every existing business row that has no workspace yet into the agency.
do $backfill$
declare
  agency uuid;
  rel text;
begin
  select id into agency from organizations where slug = 'ai-autotech';
  if agency is null then
    return;
  end if;
  foreach rel in array array[
    'crm_leads', 'crm_clients', 'crm_jobs', 'crm_invoices', 'crm_audit_leads', 'crm_contact_leads',
    'companies', 'contacts', 'leads', 'clients', 'projects', 'tasks', 'proposals', 'proposal_items',
    'invoices', 'invoice_items', 'payments', 'documents', 'support_tickets', 'ticket_comments',
    'agents', 'agent_tasks', 'activity_logs', 'appointments', 'services', 'service_packages', 'settings'
  ]
  loop
    if to_regclass('public.' || rel) is null then
      continue;
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = rel and column_name = 'organization_id'
    ) then
      execute format(
        'update public.%I set org_id = organization_id where org_id is null and organization_id is not null',
        rel
      );
    end if;
    execute format('update public.%I set org_id = $1 where org_id is null', rel) using agency;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = rel and column_name = 'organization_id'
    ) then
      execute format(
        'update public.%I set organization_id = org_id where organization_id is null and org_id is not null',
        rel
      );
    end if;
  end loop;
end
$backfill$;

-- Agency sales pipeline (matches the company CRM stages) and EASTC enrolment pipeline.
insert into workspace_pipelines (org_id, name, is_default)
select o.id, 'Sales', true
from organizations o
where o.slug = 'ai-autotech'
  and not exists (
    select 1 from workspace_pipelines p where p.org_id = o.id and p.name = 'Sales'
  );

insert into workspace_pipeline_stages (org_id, pipeline_id, name, position, is_won, is_lost)
select p.org_id, p.id, stage.name, stage.position, stage.is_won, stage.is_lost
from workspace_pipelines p
join organizations o on o.id = p.org_id and o.slug = 'ai-autotech'
join (
  values
    ('New', 1, false, false),
    ('Talking', 2, false, false),
    ('Quoted', 3, false, false),
    ('Won', 4, true, false),
    ('Lost', 5, false, true)
) as stage(name, position, is_won, is_lost) on true
where p.name = 'Sales'
  and not exists (
    select 1 from workspace_pipeline_stages s
    where s.pipeline_id = p.id and s.name = stage.name
  );

insert into workspace_templates (org_id, name, channel, body)
select o.id, t.name, t.channel, t.body
from organizations o
join (
  values
    ('First reply', 'whatsapp', 'Hi {{name}}, this is AI AutoTech. Thanks for reaching out — when is a good time for a short call?'),
    ('Next-day follow-up', 'whatsapp', 'Hi {{name}}, just checking you saw my note yesterday. Happy to map the first automation for {{company}}.')
) as t(name, channel, body) on true
where o.slug = 'ai-autotech'
  and not exists (
    select 1 from workspace_templates existing
    where existing.org_id = o.id and existing.name = t.name
  );

insert into workspace_sequences (org_id, name)
select o.id, 'New lead follow-up'
from organizations o
where o.slug = 'ai-autotech'
  and not exists (
    select 1 from workspace_sequences s where s.org_id = o.id and s.name = 'New lead follow-up'
  );

insert into workspace_sequence_steps (org_id, sequence_id, position, delay_hours, channel, template_name)
select s.org_id, s.id, step.position, step.delay_hours, step.channel, step.template_name
from workspace_sequences s
join organizations o on o.id = s.org_id and o.slug = 'ai-autotech'
join (
  values
    (1, 0, 'whatsapp', 'First reply'),
    (2, 24, 'whatsapp', 'Next-day follow-up')
) as step(position, delay_hours, channel, template_name) on true
where s.name = 'New lead follow-up'
  and not exists (
    select 1 from workspace_sequence_steps existing
    where existing.sequence_id = s.id and existing.position = step.position
  );

insert into workspace_pipelines (org_id, name, is_default)
select o.id, 'Enrolment', true
from organizations o
where o.slug = 'eastc'
  and not exists (
    select 1 from workspace_pipelines p where p.org_id = o.id and p.name = 'Enrolment'
  );

insert into workspace_pipeline_stages (org_id, pipeline_id, name, position, is_won, is_lost)
select p.org_id, p.id, stage.name, stage.position, stage.is_won, stage.is_lost
from workspace_pipelines p
join organizations o on o.id = p.org_id and o.slug = 'eastc'
join (
  values
    ('Enquiry', 1, false, false),
    ('Contacted', 2, false, false),
    ('Campus visit booked', 3, false, false),
    ('Application', 4, false, false),
    ('Enrolled', 5, true, false),
    ('Lost', 6, false, true)
) as stage(name, position, is_won, is_lost) on true
where p.name = 'Enrolment'
  and not exists (
    select 1 from workspace_pipeline_stages s
    where s.pipeline_id = p.id and s.name = stage.name
  );

insert into workspace_templates (org_id, name, channel, body)
select o.id, t.name, t.channel, t.body
from organizations o
join (
  values
    ('Enquiry received', 'whatsapp', 'Hi {{name}}, EASTC in Kempton Park received your enquiry. A student advisor will contact you shortly.'),
    ('Campus visit', 'whatsapp', 'Hi {{name}}, would you like to book a campus visit at EASTC, Kempton Park? Reply with a day that suits you.'),
    ('Application nudge', 'email', 'Hi {{name}}, your EASTC application is still open. Reply to this email if you want help finishing it.')
) as t(name, channel, body) on true
where o.slug = 'eastc'
  and not exists (
    select 1 from workspace_templates existing
    where existing.org_id = o.id and existing.name = t.name
  );

insert into workspace_sequences (org_id, name)
select o.id, 'Enquiry follow-up'
from organizations o
where o.slug = 'eastc'
  and not exists (
    select 1 from workspace_sequences s where s.org_id = o.id and s.name = 'Enquiry follow-up'
  );

insert into workspace_sequence_steps (org_id, sequence_id, position, delay_hours, channel, template_name)
select s.org_id, s.id, step.position, step.delay_hours, step.channel, step.template_name
from workspace_sequences s
join organizations o on o.id = s.org_id and o.slug = 'eastc'
join (
  values
    (1, 0, 'whatsapp', 'Enquiry received'),
    (2, 24, 'whatsapp', 'Campus visit'),
    (3, 72, 'email', 'Application nudge')
) as step(position, delay_hours, channel, template_name) on true
where s.name = 'Enquiry follow-up'
  and not exists (
    select 1 from workspace_sequence_steps existing
    where existing.sequence_id = s.id and existing.position = step.position
  );
