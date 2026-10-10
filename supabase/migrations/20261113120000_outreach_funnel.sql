-- Outreach funnel: personal B2B outreach tracked from first email to close (2-call close).
-- Additive only. Creates one new table, one trigger function and RLS policies.
-- Nothing in this file sends a message, touches crm_outbox or changes an existing table.
-- Stages: not_contacted > sent > replied > booked_call1 > showed > call2 > closed (lost is a side exit).
-- do_not_contact is a hard POPIA stop: a flagged prospect can never be moved to 'sent' again.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'outreach funnel needs phase 2a access; apply 20260926200000_phase2a_access.sql before this file';
  end if;
end
$need$;

create table if not exists public.crm_outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign text not null default 'brokers-gauteng',
  niche text not null default 'short-term insurance broker',
  business text not null,
  fsp_number text not null default '',
  area text not null default '',
  website text not null default '',
  email text not null default '',
  phone text not null default '',
  contact_name text not null default '',
  contact_title text not null default '',
  source_url text not null default '',
  hook text not null default '',
  video_url text not null default '',
  priority text not null default 'B',
  channel text not null default 'email',
  stage text not null default 'not_contacted',
  do_not_contact boolean not null default false,
  dnc_reason text not null default '',
  dnc_at timestamptz,
  sent_at timestamptz,
  replied_at timestamptz,
  booked_call1_at timestamptz,
  showed_at timestamptz,
  call2_at timestamptz,
  closed_at timestamptz,
  lost_at timestamptz,
  stage_changed_at timestamptz not null default now(),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_outreach_prospects_stage_check
    check (stage in ('not_contacted', 'sent', 'replied', 'booked_call1', 'showed', 'call2', 'closed', 'lost')),
  constraint crm_outreach_prospects_priority_check check (priority in ('A', 'B', 'C')),
  constraint crm_outreach_prospects_channel_check check (channel in ('email', 'phone', 'dm', 'warm', 'form')),
  constraint crm_outreach_prospects_business_check check (length(btrim(business)) between 1 and 200),
  constraint crm_outreach_prospects_notes_check check (length(notes) <= 4000),
  constraint crm_outreach_prospects_hook_check check (length(hook) <= 600),
  constraint crm_outreach_prospects_unique unique (org_id, campaign, business)
);

create index if not exists crm_outreach_prospects_org_stage_idx
  on public.crm_outreach_prospects (org_id, campaign, stage);
create index if not exists crm_outreach_prospects_email_idx
  on public.crm_outreach_prospects (org_id, lower(email)) where email <> '';

-- Stamps the stage timestamps, enforces do-not-contact and keeps updated_at fresh.
create or replace function public.crm_outreach_prospects_stamp()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.do_not_contact and not old.do_not_contact then
    new.dnc_at := coalesce(new.dnc_at, now());
  elsif tg_op = 'INSERT' and new.do_not_contact then
    new.dnc_at := coalesce(new.dnc_at, now());
  end if;
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    if new.do_not_contact and new.stage = 'sent' and (tg_op = 'INSERT' or old.stage = 'not_contacted') then
      raise exception 'prospect is marked do-not-contact; it cannot be moved to sent';
    end if;
    new.stage_changed_at := now();
    if new.stage = 'sent' then new.sent_at := coalesce(new.sent_at, now()); end if;
    if new.stage = 'replied' then new.replied_at := coalesce(new.replied_at, now()); end if;
    if new.stage = 'booked_call1' then new.booked_call1_at := coalesce(new.booked_call1_at, now()); end if;
    if new.stage = 'showed' then new.showed_at := coalesce(new.showed_at, now()); end if;
    if new.stage = 'call2' then new.call2_at := coalesce(new.call2_at, now()); end if;
    if new.stage = 'closed' then new.closed_at := coalesce(new.closed_at, now()); end if;
    if new.stage = 'lost' then new.lost_at := coalesce(new.lost_at, now()); end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists crm_outreach_prospects_stamp on public.crm_outreach_prospects;
create trigger crm_outreach_prospects_stamp
  before insert or update on public.crm_outreach_prospects
  for each row execute function public.crm_outreach_prospects_stamp();

alter table public.crm_outreach_prospects enable row level security;

drop policy if exists crm_outreach_prospects_read on public.crm_outreach_prospects;
create policy crm_outreach_prospects_read on public.crm_outreach_prospects
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists crm_outreach_prospects_insert on public.crm_outreach_prospects;
create policy crm_outreach_prospects_insert on public.crm_outreach_prospects
  for insert to authenticated
  with check (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists crm_outreach_prospects_update on public.crm_outreach_prospects;
create policy crm_outreach_prospects_update on public.crm_outreach_prospects
  for update to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  )
  with check (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

revoke all on table public.crm_outreach_prospects from public, anon;
grant select, insert, update on table public.crm_outreach_prospects to authenticated;
revoke all on function public.crm_outreach_prospects_stamp() from public, anon, authenticated;

do $service_grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.crm_outreach_prospects to service_role;
  end if;
end
$service_grant$;
