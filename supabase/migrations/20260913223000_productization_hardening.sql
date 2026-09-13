alter table documents add column if not exists file_name text;
alter table documents add column if not exists mime_type text;
alter table documents add column if not exists file_size_bytes bigint;
alter table documents add column if not exists bucket_name text not null default 'documents';
alter table documents add column if not exists record_type text;
alter table documents add column if not exists record_id text;
alter table documents add column if not exists version_number integer not null default 1;

alter table subscriptions add column if not exists plan_code text;
alter table subscriptions add column if not exists stripe_price_id text;
alter table subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table subscriptions add column if not exists last_invoice_status text;

create table if not exists billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid references organizations(id) on delete cascade,
  stripe_event_id text not null unique,
  event_type text not null,
  status text not null default 'processing',
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz
);

alter table billing_webhook_events enable row level security;

create policy "members read billing webhook events" on billing_webhook_events
  for select using (organization_id in (select current_organization_ids()));
create policy "admins manage billing webhook events" on billing_webhook_events
  for all using (is_admin()) with check (is_admin());

create unique index if not exists documents_record_lookup_idx on documents(organization_id, record_type, record_id, version_number);
create index if not exists billing_webhook_events_org_idx on billing_webhook_events(organization_id, event_type);

drop policy if exists "members upload documents" on storage.objects;
drop policy if exists "members read documents" on storage.objects;
drop policy if exists "members delete documents" on storage.objects;

create policy "members upload documents" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = 'org'
    and split_part(name, '/', 2)::uuid in (select current_organization_ids())
  );

create policy "members read documents" on storage.objects
  for select using (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = 'org'
    and split_part(name, '/', 2)::uuid in (select current_organization_ids())
  );

create policy "members delete documents" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = 'org'
    and split_part(name, '/', 2)::uuid in (select current_organization_ids())
  );
