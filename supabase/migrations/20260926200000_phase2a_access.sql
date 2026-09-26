-- Phase 2a: close the legacy admin bypass, restrict agency staff, and add
-- POPIA plus the per-workspace send switch. Additive. No rows are deleted.
-- memberships.role is the live org role (agency_owner, agency_staff, client_admin, client_user).
-- org_type / parent_id stay the live names for kind / parent_org_id.

alter table organizations add column if not exists sending_enabled boolean not null default false;
alter table organizations add column if not exists timezone text not null default 'Africa/Johannesburg';
alter table organizations add column if not exists currency text not null default 'ZAR';
alter table organizations add column if not exists sender_name text not null default '';
alter table organizations add column if not exists information_officer jsonb not null default '{}'::jsonb;
alter table organizations add column if not exists branding jsonb not null default '{}'::jsonb;
alter table organizations add column if not exists custom_domain text;
alter table organizations add column if not exists created_from_snapshot_id uuid;

create unique index if not exists organizations_custom_domain_idx
  on organizations (custom_domain)
  where custom_domain is not null;

alter table memberships add column if not exists assigned_only boolean not null default false;

update organizations
set sender_name = 'AI AutoTech Pty Ltd'
where slug = 'ai-autotech' and sender_name = '';

update organizations
set
  name = 'East Sea Technocentric Varsity (EASTC)',
  legal_name = 'East Sea Technocentric Varsity',
  sender_name = 'East Sea Technocentric Varsity (EASTC)'
where slug = 'eastc' and name = 'EASTC';

create table if not exists member_org_access (
  member_id uuid not null references memberships(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, org_id)
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('agency_owner', 'agency_staff', 'client_admin', 'client_user')),
  token_hash text not null unique,
  invited_by uuid,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_org_id uuid references organizations(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists org_activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  acting_as_agency boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists contact_consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'voice')),
  purpose text not null check (purpose in ('marketing', 'service')),
  status text not null check (status in ('opted_in', 'opted_out', 'requested')),
  basis text not null check (basis in ('consent', 'existing_customer')),
  address text not null default '',
  source text not null default '',
  evidence jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists suppressions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'voice')),
  address text not null,
  reason text not null check (reason in ('stop_keyword', 'unsubscribe', 'bounce', 'manual', 'dsr_delete')),
  created_at timestamptz not null default now(),
  unique (org_id, channel, address)
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
    and (
      m.role = 'agency_owner'
      or not exists (select 1 from member_org_access a where a.member_id = m.id)
      or exists (
        select 1 from member_org_access a
        where a.member_id = m.id and a.org_id = child.id
      )
    )
$$;

create or replace function public.has_org_role(p_org uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from memberships m
    where m.user_id = auth.uid()
      and m.org_id = p_org
      and m.role = any (p_roles)
  )
  or exists (
    select 1
    from memberships m
    join organizations child on child.id = p_org and child.parent_id = m.org_id
    where m.user_id = auth.uid()
      and m.role = any (p_roles)
      and m.role in ('agency_owner', 'agency_staff')
      and child.org_type = 'client'
      and (
        m.role = 'agency_owner'
        or not exists (select 1 from member_org_access a where a.member_id = m.id)
        or exists (
          select 1 from member_org_access a
          where a.member_id = m.id and a.org_id = child.id
        )
      )
  )
$$;

-- Legacy Command Centre: is_admin() used to unlock every organisation.
-- Membership is the only path. A global Admin profile does not see other tenants.
create or replace function public.can_access_organization(row_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select row_organization_id is not null
    and row_organization_id in (select public.accessible_org_ids())
$$;

revoke all on function public.accessible_org_ids() from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
revoke all on function public.can_access_organization(uuid) from public;
grant execute on function public.accessible_org_ids() to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.can_access_organization(uuid) to authenticated;

do $drop_admin$
declare
  item record;
begin
  for item in
    select * from (values
      ('organizations', 'admins manage organizations'),
      ('organization_members', 'admins manage memberships'),
      ('subscriptions', 'admins manage subscriptions')
    ) as pol(tablename, policyname)
  loop
    if to_regclass('public.' || item.tablename) is not null then
      execute format('drop policy if exists %I on public.%I', item.policyname, item.tablename);
    end if;
  end loop;
end
$drop_admin$;

do $role_v2$
begin
  if to_regclass('public.organization_members') is not null then
    alter table organization_members add column if not exists role_v2 text;
  end if;
end
$role_v2$;

select public.attach_org_tenancy('public.member_org_access'::regclass);
select public.attach_org_tenancy('public.contact_consents'::regclass);
select public.attach_org_tenancy('public.suppressions'::regclass);
select public.attach_org_tenancy('public.org_activity'::regclass);
select public.attach_org_tenancy(to_regclass('public.crm_leads'));
select public.attach_org_tenancy(to_regclass('public.crm_clients'));
select public.attach_org_tenancy(to_regclass('public.crm_jobs'));
select public.attach_org_tenancy(to_regclass('public.crm_invoices'));
select public.attach_org_tenancy(to_regclass('public.crm_audit_leads'));
select public.attach_org_tenancy(to_regclass('public.crm_contact_leads'));

alter table invitations enable row level security;
alter table invitations force row level security;
drop policy if exists invitations_manage on invitations;
create policy invitations_manage on invitations
  for all to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));
grant select, insert, update, delete on invitations to authenticated;

alter table user_prefs enable row level security;
alter table user_prefs force row level security;
drop policy if exists user_prefs_own on user_prefs;
create policy user_prefs_own on user_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on user_prefs to authenticated;

create or replace function public.accept_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invitations%rowtype;
  actor uuid := auth.uid();
  actor_email text;
begin
  if actor is null then
    raise exception 'Sign in to accept this invitation';
  end if;
  select email into actor_email from auth.users where id = actor;
  select * into invite
  from invitations
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex')
    and accepted_at is null
    and expires_at > now();
  if invite.id is null then
    raise exception 'Invitation is invalid or expired';
  end if;
  if lower(invite.email) <> lower(coalesce(actor_email, '')) then
    raise exception 'Sign in with the invited email';
  end if;
  insert into memberships (user_id, org_id, role)
  values (actor, invite.org_id, invite.role)
  on conflict (user_id, org_id) do update set role = excluded.role;
  update invitations set accepted_at = now() where id = invite.id;
  return invite.org_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;
