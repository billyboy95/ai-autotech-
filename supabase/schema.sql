create extension if not exists "pgcrypto";

create type user_role as enum ('Super Admin', 'Admin', 'Staff', 'Contractor', 'Client');
create type lead_status as enum ('New Lead', 'Qualified', 'Discovery Booked', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Onboarding');
create type project_stage as enum ('Discovery', 'Planning', 'Design', 'Build', 'Testing', 'Review', 'Launch', 'Support');
create type proposal_status as enum ('Draft', 'Sent', 'Viewed', 'Accepted', 'Rejected');
create type invoice_status as enum ('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled');
create type ticket_status as enum ('Open', 'In Progress', 'Waiting On Client', 'Resolved', 'Closed');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null,
  role user_role not null default 'Client',
  avatar_url text,
  owner_id uuid references auth.users(id),
  created_by uuid references auth.users(id)
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  name text not null,
  industry text,
  website text,
  status text not null default 'Active'
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  company_id uuid references companies(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  role_title text,
  status text not null default 'Active'
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  full_name text not null,
  company_name text not null,
  email text not null,
  phone text,
  business_type text,
  service_interest text,
  message text,
  source_page text,
  lead_source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  lead_status lead_status not null default 'New Lead',
  notes text
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  company_id uuid references companies(id) on delete cascade,
  status text not null default 'Active',
  onboarding_stage text
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  client_id uuid references clients(id) on delete cascade,
  name text not null,
  stage project_stage not null default 'Discovery',
  progress integer not null default 0 check (progress between 0 and 100),
  deadline date,
  internal_notes text,
  client_visible_update text
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  status text not null default 'Open',
  due_date date,
  deliverable boolean not null default false
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  client_id uuid references clients(id) on delete cascade,
  title text not null,
  status proposal_status not null default 'Draft',
  total numeric(12,2) not null default 0
);

create table proposal_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  proposal_id uuid references proposals(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  client_id uuid references clients(id) on delete cascade,
  invoice_number text not null unique,
  status invoice_status not null default 'Draft',
  due_date date,
  total numeric(12,2) not null default 0
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  invoice_id uuid references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  invoice_id uuid references invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  paid_at timestamptz,
  method text,
  status text not null default 'Pending'
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  client_id uuid references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  storage_path text not null,
  client_visible boolean not null default false,
  status text not null default 'Active'
);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  client_id uuid references clients(id) on delete cascade,
  title text not null,
  priority text not null default 'Medium',
  status ticket_status not null default 'Open',
  client_visible_update text
);

create table ticket_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ticket_id uuid references support_tickets(id) on delete cascade,
  created_by uuid references auth.users(id),
  body text not null,
  client_visible boolean not null default false
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  name text not null,
  agent_type text not null,
  status text not null default 'Running',
  performance_score integer not null default 0 check (performance_score between 0 and 100),
  connected_tools text[] not null default '{}'
);

create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  agent_id uuid references agents(id) on delete cascade,
  title text not null,
  status text not null default 'Queued',
  last_activity timestamptz
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  lead_id uuid references leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  starts_at timestamptz not null,
  status text not null default 'Booked'
);

create table services (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  description text,
  status text not null default 'Active'
);

create table service_packages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  service_id uuid references services(id) on delete cascade,
  name text not null,
  price numeric(12,2),
  status text not null default 'Active'
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key text not null unique,
  value jsonb not null default '{}',
  created_by uuid references auth.users(id)
);

create or replace function is_internal()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('Super Admin', 'Admin', 'Staff', 'Contractor')
  );
$$;

create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('Super Admin', 'Admin')
  );
$$;

alter table profiles enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table leads enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table proposals enable row level security;
alter table proposal_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;
alter table documents enable row level security;
alter table support_tickets enable row level security;
alter table ticket_comments enable row level security;
alter table agents enable row level security;
alter table agent_tasks enable row level security;
alter table activity_logs enable row level security;
alter table notifications enable row level security;
alter table appointments enable row level security;
alter table services enable row level security;
alter table service_packages enable row level security;
alter table settings enable row level security;

create policy "profiles read own or admin" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles admin write" on profiles for all using (is_admin()) with check (is_admin());

create policy "public lead insert" on leads for insert with check (true);
create policy "internal lead read" on leads for select using (is_internal());
create policy "internal lead update" on leads for update using (is_internal()) with check (is_internal());

create policy "internal companies" on companies for all using (is_internal()) with check (is_internal());
create policy "internal contacts" on contacts for all using (is_internal()) with check (is_internal());
create policy "internal clients" on clients for all using (is_internal()) with check (is_internal());
create policy "internal projects" on projects for all using (is_internal()) with check (is_internal());
create policy "internal tasks" on tasks for all using (is_internal()) with check (is_internal());
create policy "internal proposals" on proposals for all using (is_internal()) with check (is_internal());
create policy "internal proposal items" on proposal_items for all using (is_internal()) with check (is_internal());
create policy "internal invoices" on invoices for all using (is_internal()) with check (is_internal());
create policy "internal invoice items" on invoice_items for all using (is_internal()) with check (is_internal());
create policy "internal payments" on payments for all using (is_internal()) with check (is_internal());
create policy "internal documents" on documents for all using (is_internal()) with check (is_internal());
create policy "internal tickets" on support_tickets for all using (is_internal()) with check (is_internal());
create policy "internal ticket comments" on ticket_comments for all using (is_internal()) with check (is_internal());
create policy "internal agents" on agents for all using (is_internal()) with check (is_internal());
create policy "internal agent tasks" on agent_tasks for all using (is_internal()) with check (is_internal());
create policy "internal activity logs" on activity_logs for select using (is_internal());
create policy "insert activity logs" on activity_logs for insert with check (auth.uid() = actor_id or is_internal());
create policy "own notifications" on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "internal appointments" on appointments for all using (is_internal()) with check (is_internal());
create policy "public services read" on services for select using (status = 'Active');
create policy "admin services write" on services for all using (is_admin()) with check (is_admin());
create policy "public service packages read" on service_packages for select using (status = 'Active');
create policy "admin service packages write" on service_packages for all using (is_admin()) with check (is_admin());
create policy "admin settings" on settings for all using (is_admin()) with check (is_admin());

-- SaaS tenancy, subscriptions, storage, and module boundaries.
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  slug text unique,
  status text not null default 'Active',
  owner_id uuid references auth.users(id)
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null default 'Client',
  unique (organization_id, user_id)
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  unique (organization_id)
);

alter table profiles add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table companies add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table contacts add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table leads add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table clients add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table projects add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table tasks add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table proposals add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table proposal_items add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table invoices add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table invoice_items add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table payments add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table documents add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table support_tickets add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table ticket_comments add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table agents add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table agent_tasks add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table activity_logs add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table notifications add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table appointments add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table services add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table service_packages add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table settings add column if not exists organization_id uuid references organizations(id) on delete cascade;

create or replace function current_organization_ids()
returns setof uuid
language sql
stable
as $$
  select organization_id
  from organization_members
  where user_id = auth.uid()
$$;

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table subscriptions enable row level security;

create policy "members read organizations" on organizations
  for select using (id in (select current_organization_ids()));
create policy "admins manage organizations" on organizations
  for all using (is_admin()) with check (is_admin());

create policy "members read memberships" on organization_members
  for select using (organization_id in (select current_organization_ids()));
create policy "admins manage memberships" on organization_members
  for all using (is_admin()) with check (is_admin());

create policy "members read subscriptions" on subscriptions
  for select using (organization_id in (select current_organization_ids()));
create policy "admins manage subscriptions" on subscriptions
  for all using (is_admin()) with check (is_admin());

create index if not exists companies_organization_id_idx on companies(organization_id);
create index if not exists leads_organization_id_idx on leads(organization_id);
create index if not exists clients_organization_id_idx on clients(organization_id);
create index if not exists projects_organization_id_idx on projects(organization_id);
create index if not exists proposals_organization_id_idx on proposals(organization_id);
create index if not exists invoices_organization_id_idx on invoices(organization_id);
create index if not exists support_tickets_organization_id_idx on support_tickets(organization_id);
create index if not exists documents_organization_id_idx on documents(organization_id);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "members upload documents" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and split_part(name, '/', 1)::uuid in (select current_organization_ids())
  );

create policy "members read documents" on storage.objects
  for select using (
    bucket_id = 'documents'
    and split_part(name, '/', 1)::uuid in (select current_organization_ids())
  );

create or replace function can_access_organization(row_organization_id uuid)
returns boolean
language sql
stable
as $$
  select is_admin()
    or row_organization_id in (select current_organization_ids())
$$;

drop policy if exists "internal companies" on companies;
drop policy if exists "internal contacts" on contacts;
drop policy if exists "public lead insert" on leads;
drop policy if exists "internal lead read" on leads;
drop policy if exists "internal lead update" on leads;
drop policy if exists "internal clients" on clients;
drop policy if exists "internal projects" on projects;
drop policy if exists "internal tasks" on tasks;
drop policy if exists "internal proposals" on proposals;
drop policy if exists "internal proposal items" on proposal_items;
drop policy if exists "internal invoices" on invoices;
drop policy if exists "internal invoice items" on invoice_items;
drop policy if exists "internal payments" on payments;
drop policy if exists "internal documents" on documents;
drop policy if exists "internal tickets" on support_tickets;
drop policy if exists "internal ticket comments" on ticket_comments;
drop policy if exists "internal agents" on agents;
drop policy if exists "internal agent tasks" on agent_tasks;
drop policy if exists "internal appointments" on appointments;

create policy "tenant companies" on companies for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant contacts" on contacts for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "public lead insert" on leads for insert
  with check (organization_id is null or can_access_organization(organization_id));
create policy "tenant lead read" on leads for select
  using (can_access_organization(organization_id));
create policy "tenant lead update" on leads for update
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant clients" on clients for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant projects" on projects for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant tasks" on tasks for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant proposals" on proposals for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant proposal items" on proposal_items for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant invoices" on invoices for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant invoice items" on invoice_items for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant payments" on payments for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant documents" on documents for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant tickets" on support_tickets for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant ticket comments" on ticket_comments for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant agents" on agents for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant agent tasks" on agent_tasks for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
create policy "tenant appointments" on appointments for all
  using (can_access_organization(organization_id)) with check (can_access_organization(organization_id));
