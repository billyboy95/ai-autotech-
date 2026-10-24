-- Sandbox test-chat links for a personalised AI employee.
-- Additive. Do not apply this file to production until Billy approves the migration.
-- This file does not send WhatsApp, email, or SMS, and it does not take payment.
-- sending_enabled is not changed. charged is not introduced here.
-- bot_try_links stores a SHA-256 token hash only. The raw token is not stored.
-- RLS is deny-all. The service-role server route is the only access path.
-- purge_bot_try_messages deletes chat text older than 30 days (POPIA retention).

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.org_bots') is null then
    raise exception 'bot try links need organisations and org_bots; apply phase 4a first';
  end if;
  if to_regclass('public.calendars') is null then
    raise exception 'bot try links need calendars; apply phase 3b first';
  end if;
end
$need$;

alter table public.calendars add column if not exists sandbox boolean not null default false;

comment on column public.calendars.sandbox is
  'True for the per-workspace TEST calendar used by the sandbox try chat. Real booking calendars stay false.';

create unique index if not exists calendars_one_test_sandbox_idx
  on public.calendars (org_id)
  where sandbox and lower(btrim(name)) = 'test';

create table if not exists public.bot_try_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  org_bot_id uuid not null references public.org_bots(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_messages integer not null default 50,
  used_messages integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bot_try_links_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint bot_try_links_max_messages_check check (max_messages between 1 and 500),
  constraint bot_try_links_used_messages_check check (used_messages >= 0 and used_messages <= max_messages)
);

create unique index if not exists bot_try_links_token_hash_idx
  on public.bot_try_links (token_hash);
create index if not exists bot_try_links_org_bot_idx
  on public.bot_try_links (org_id, org_bot_id, created_at desc);

create table if not exists public.bot_try_messages (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.bot_try_links(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists bot_try_messages_link_idx
  on public.bot_try_messages (link_id, created_at);
create index if not exists bot_try_messages_created_idx
  on public.bot_try_messages (created_at);

alter table public.bot_try_links enable row level security;
alter table public.bot_try_links force row level security;
alter table public.bot_try_messages enable row level security;
alter table public.bot_try_messages force row level security;

-- Deny-all: no policies. Authenticated and anon have no grants.
revoke all on table public.bot_try_links from public, anon, authenticated;
revoke all on table public.bot_try_messages from public, anon, authenticated;

create or replace function public.purge_bot_try_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.bot_try_messages
  where created_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.purge_bot_try_messages() is
  'POPIA retention. Deletes try-chat messages older than 30 days. Does not send and does not charge.';

revoke all on function public.purge_bot_try_messages() from public, anon, authenticated;

do $service_grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.bot_try_links to service_role;
    grant select, insert, update, delete on public.bot_try_messages to service_role;
    grant execute on function public.purge_bot_try_messages() to service_role;
  end if;
end
$service_grant$;
