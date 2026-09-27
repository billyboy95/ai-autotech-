-- Phase 2e: unified inbox.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Conversations and messages are org-scoped. Realtime publication is added
-- only when supabase_realtime already exists. RLS, including assigned_only,
-- is what keeps one workspace from receiving another workspace's rows.
-- Free-form WhatsApp outside the 24-hour window is rejected in the database
-- as well as in the app. Nothing in this file delivers a message.

do $need$
begin
  if to_regclass('public.crm_contacts') is null or to_regclass('public.channel_connections') is null then
    raise exception 'phase 2e needs phase 2b tables; apply 20261015140000_phase2b_channels_popia.sql first';
  end if;
  if to_regprocedure('public.record_workflow_event(uuid,text,text,text,jsonb,text)') is null then
    raise exception 'phase 2e needs the workflow engine; apply 20261017120000_phase2d_workflows.sql first';
  end if;
end
$need$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'facebook', 'instagram')),
  channel_connection_id uuid references public.channel_connections(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  assigned_user_id uuid,
  last_message_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  wa_window_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_inbox_idx
  on public.conversations (org_id, status, last_message_at desc);
create index if not exists conversations_assignee_idx
  on public.conversations (org_id, assigned_user_id);
create index if not exists conversations_contact_channel_idx
  on public.conversations (org_id, contact_id, channel);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'facebook', 'instagram')),
  body text not null default '',
  media jsonb not null default '{}'::jsonb,
  template_id uuid,
  provider_message_id text not null default '',
  status text not null default 'received' check (status in (
    'received', 'queued', 'held', 'sent', 'failed', 'blocked_consent', 'cancelled'
  )),
  wa_category text not null default '' check (wa_category in ('', 'marketing', 'utility', 'authentication', 'service')),
  cost_cents bigint not null default 0,
  sent_by_user_id uuid,
  outbox_id text,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);
create index if not exists messages_org_created_idx
  on public.messages (org_id, created_at desc);
create unique index if not exists messages_provider_message_idx
  on public.messages (org_id, provider_message_id)
  where provider_message_id <> '';
create index if not exists messages_wa_service_month_idx
  on public.messages (org_id, created_at)
  where channel = 'whatsapp' and direction = 'out' and wa_category = 'service';

create table if not exists public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  body text not null,
  author_user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists conversation_notes_conversation_idx
  on public.conversation_notes (conversation_id, created_at);

do $templates$
begin
  if to_regclass('public.message_templates') is null then
    return;
  end if;
  alter table public.message_templates add column if not exists wa_template_name text not null default '';
  alter table public.message_templates add column if not exists wa_category text not null default '';
  alter table public.message_templates add column if not exists wa_language text not null default 'en';
  alter table public.message_templates add column if not exists wa_status text not null default 'draft';
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.message_templates'::regclass
      and conname = 'message_templates_wa_category_check'
  ) then
    alter table public.message_templates
      add constraint message_templates_wa_category_check
      check (wa_category in ('', 'marketing', 'utility', 'authentication', 'service'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.message_templates'::regclass
      and conname = 'message_templates_wa_status_check'
  ) then
    alter table public.message_templates
      add constraint message_templates_wa_status_check
      check (wa_status in ('draft', 'pending', 'approved', 'rejected'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_template_id_fkey'
  ) then
    alter table public.messages
      add constraint messages_template_id_fkey
      foreign key (template_id) references public.message_templates(id) on delete set null;
  end if;
end
$templates$;

select public.attach_org_tenancy('public.conversations'::regclass);
select public.attach_org_tenancy('public.messages'::regclass);
select public.attach_org_tenancy('public.conversation_notes'::regclass);

-- client_user with assigned_only sees only conversations assigned to them.
-- Agency members and client admins see the whole workspace. Other orgs stay hidden.
create or replace function public.inbox_assigned_visible(p_org uuid, p_assigned uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_org in (select public.accessible_org_ids())
    and not exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.org_id = p_org
        and m.role = 'client_user'
        and m.assigned_only
        and p_assigned is distinct from auth.uid()
    );
$$;

revoke all on function public.inbox_assigned_visible(uuid, uuid) from public, anon;
grant execute on function public.inbox_assigned_visible(uuid, uuid) to authenticated;

drop policy if exists org_isolation on public.conversations;
drop policy if exists conversations_visible on public.conversations;
create policy conversations_visible on public.conversations
  for all to authenticated
  using (public.inbox_assigned_visible(org_id, assigned_user_id))
  with check (public.inbox_assigned_visible(org_id, assigned_user_id));

-- Visibility follows the conversation. A message or note is readable only when
-- the parent conversation is readable, so assigned_only and org isolation apply once.
drop policy if exists org_isolation on public.messages;
drop policy if exists messages_visible on public.messages;
create policy messages_visible on public.messages
  for all to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.org_id = messages.org_id
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.org_id = messages.org_id
    )
  );

drop policy if exists org_isolation on public.conversation_notes;
drop policy if exists conversation_notes_visible on public.conversation_notes;
create policy conversation_notes_visible on public.conversation_notes
  for all to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_notes.conversation_id and c.org_id = conversation_notes.org_id
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_notes.conversation_id and c.org_id = conversation_notes.org_id
    )
  );

revoke all on public.conversations from public, anon;
revoke all on public.messages from public, anon;
revoke all on public.conversation_notes from public, anon;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.conversation_notes to authenticated;

create or replace function public.inbox_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.inbox_touch_updated_at();

-- Free-form WhatsApp is blocked once the 24-hour customer-care window has closed.
-- An approved template is the only outbound that may pass after that.
create or replace function public.messages_enforce_whatsapp_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  window_open boolean;
  template_status text;
begin
  if new.channel <> 'whatsapp' or new.direction <> 'out' then
    return new;
  end if;
  if new.status in ('blocked_consent', 'cancelled', 'failed') then
    return new;
  end if;

  select c.wa_window_expires_at is not null and c.wa_window_expires_at > now()
  into window_open
  from public.conversations c
  where c.id = new.conversation_id
    and c.org_id = new.org_id;

  if new.template_id is null then
    if coalesce(window_open, false) then
      return new;
    end if;
    raise exception 'use template';
  end if;

  if to_regclass('public.message_templates') is null then
    raise exception 'use template';
  end if;

  select wa_status into template_status
  from public.message_templates
  where id = new.template_id
    and org_id = new.org_id;

  if template_status is distinct from 'approved' then
    raise exception 'use template';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_whatsapp_window on public.messages;
create trigger messages_whatsapp_window
  before insert or update on public.messages
  for each row execute function public.messages_enforce_whatsapp_window();

-- Monthly free service messages for one WhatsApp number. 1000 from 1 Oct 2026.
-- Callers outside the workspace get zero. Workers (no auth.uid) pass the org id.
create or replace function public.wa_service_sends_this_month(p_org uuid, p_connection uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  total integer;
begin
  if p_connection is null then
    return 0;
  end if;
  if auth.uid() is not null and p_org not in (select public.accessible_org_ids()) then
    return 0;
  end if;
  select count(*)::integer into total
  from public.messages m
  join public.conversations c on c.id = m.conversation_id and c.org_id = m.org_id
  where m.org_id = p_org
    and c.channel_connection_id = p_connection
    and m.channel = 'whatsapp'
    and m.direction = 'out'
    and m.wa_category = 'service'
    and m.status in ('queued', 'held', 'sent')
    and m.created_at >= (
      date_trunc('month', now() at time zone 'Africa/Johannesburg')
      at time zone 'Africa/Johannesburg'
    );
  return coalesce(total, 0);
end;
$$;

revoke all on function public.wa_service_sends_this_month(uuid, uuid) from public, anon;
grant execute on function public.wa_service_sends_this_month(uuid, uuid) to authenticated;

do $service_grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.wa_service_sends_this_month(uuid, uuid) to service_role;
  end if;
end
$service_grant$;

alter table public.conversations replica identity full;
alter table public.messages replica identity full;
alter table public.conversation_notes replica identity full;

do $pub$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime' and c.relname = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime' and c.relname = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime' and c.relname = 'conversation_notes'
  ) then
    alter publication supabase_realtime add table public.conversation_notes;
  end if;
end
$pub$;
