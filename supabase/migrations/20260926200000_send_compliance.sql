-- Marketing consent, opt-out suppressions, and per-send cost.
-- Additive. Does not delete rows. Rows are keyed by id, and suppressions by address,
-- so a later org_id column can be filtered with one extra predicate.
-- Run after supabase/migrations/20260926183000_outbound_channels.sql.

alter table crm_leads add column if not exists marketing_consent boolean not null default false;
alter table crm_prospects add column if not exists marketing_consent boolean not null default false;

alter table crm_outbox add column if not exists message_category text not null default '';
alter table crm_outbox add column if not exists cost_usd numeric;
alter table crm_outbox add column if not exists cost_zar numeric;
alter table crm_outbox add column if not exists cost_category text not null default '';

do $$
declare constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'crm_outbox'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
      and pg_get_constraintdef(con.oid) ilike '%queued%'
  loop
    execute format('alter table crm_outbox drop constraint %I', constraint_name);
  end loop;
end $$;

alter table crm_outbox
  drop constraint if exists crm_outbox_status_check;

alter table crm_outbox
  add constraint crm_outbox_status_check
  check (status in ('queued', 'approved', 'sent', 'failed', 'cancelled', 'blocked'));

create table if not exists crm_suppressions (
  id text primary key,
  address text not null,
  channel text not null default '',
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists crm_suppressions_address_idx on crm_suppressions (address);

alter table crm_suppressions enable row level security;
revoke all on table crm_suppressions from anon, authenticated;
