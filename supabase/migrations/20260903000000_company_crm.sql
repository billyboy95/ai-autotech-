-- Company CRM for AI AutoTech Pty Ltd.
-- Existing public.leads / public.clients / public.invoices belong to the classic
-- Command Centre OS (different columns and enums) and are left untouched.
-- These tables match src/lib/crm-store.ts.

create table if not exists crm_leads (
  id text primary key,
  name text not null default '',
  company text not null default '',
  phone text not null default '',
  stage text not null default 'New'
    check (stage in ('New', 'Talking', 'Quoted', 'Won', 'Lost')),
  notes text not null default '',
  ord integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm_clients (
  id text primary key,
  name text not null default '',
  person text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  notes text not null default '',
  ord integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm_jobs (
  id text primary key,
  client text not null default '',
  title text not null default '',
  kind text not null default 'Other'
    check (kind in ('Website', 'WhatsApp', 'AI Employee', 'Other')),
  status text not null default 'Open'
    check (status in ('Open', 'Doing', 'Done')),
  ord integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm_invoices (
  id text primary key,
  client text not null default '',
  amount text not null default '0',
  status text not null default 'Unpaid'
    check (status in ('Unpaid', 'Paid on Yoco')),
  ord integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table crm_leads enable row level security;
alter table crm_clients enable row level security;
alter table crm_jobs enable row level security;
alter table crm_invoices enable row level security;

revoke all on table crm_leads from anon, authenticated;
revoke all on table crm_clients from anon, authenticated;
revoke all on table crm_jobs from anon, authenticated;
revoke all on table crm_invoices from anon, authenticated;

insert into crm_clients (id, name, person, phone, whatsapp, notes, ord)
values (
  'eastc',
  'EASTC Holdings',
  'CEO',
  '',
  '',
  'Existing work: eastech.co.za, foundation, institute',
  0
)
on conflict (id) do update set
  name = excluded.name,
  person = excluded.person,
  notes = excluded.notes,
  updated_at = now();

insert into crm_jobs (id, client, title, kind, status, ord)
values (
  'job-sites',
  'EASTC Holdings',
  'Campus websites',
  'Website',
  'Done',
  0
)
on conflict (id) do update set
  client = excluded.client,
  title = excluded.title,
  kind = excluded.kind,
  status = excluded.status,
  updated_at = now();
