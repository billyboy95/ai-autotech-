-- Phase 3a: Conversation AI drafts.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- ai_reply_settings stays disabled until an agency owner or client admin
-- turns it on. Drafts are org-scoped. A client_user with assigned_only only
-- sees drafts on conversations assigned to them. Queued or sent drafts require
-- consent_ok. A draft cannot be marked sent while sending is off.
-- This file does not call a provider and does not deliver a message.

do $need$
begin
  if to_regclass('public.conversations') is null or to_regclass('public.messages') is null then
    raise exception 'phase 3a needs the inbox; apply 20261018120000_phase2e_inbox.sql first';
  end if;
  if to_regclass('public.contact_consents') is null then
    raise exception 'phase 3a needs POPIA consent; apply 20261015140000_phase2b_channels_popia.sql first';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.inbox_assigned_visible(uuid, uuid)') is null then
    raise exception 'phase 3a needs phase 2a roles and the phase 2e inbox visibility helper';
  end if;
end
$need$;

create table if not exists public.ai_reply_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  mode text not null default 'draft_only' check (mode in ('draft_only', 'queue_outbox')),
  tone text not null default '',
  system_prompt text not null default '',
  max_auto_per_hour integer not null default 20 check (max_auto_per_hour >= 0 and max_auto_per_hour <= 500),
  channels text[] not null default array['whatsapp', 'sms', 'email', 'facebook', 'instagram']::text[],
  require_human_before_send boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_reply_settings_channels_check check (
    channels <@ array['whatsapp', 'sms', 'email', 'facebook', 'instagram']::text[]
  )
);

create table if not exists public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  inbound_message_id uuid references public.messages(id) on delete set null,
  status text not null default 'pending_review' check (status in (
    'pending_review', 'approved', 'rejected', 'queued', 'sent', 'failed'
  )),
  draft_body text not null default '',
  model_meta jsonb not null default '{}'::jsonb,
  consent_ok boolean not null default false,
  outbox_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_drafts_outbox_consent_check check (
    outbox_id is null or (consent_ok and status in ('queued', 'sent'))
  )
);

create index if not exists ai_drafts_conversation_idx
  on public.ai_drafts (conversation_id, created_at desc);
create index if not exists ai_drafts_org_status_idx
  on public.ai_drafts (org_id, status, created_at desc);
create index if not exists ai_drafts_org_created_idx
  on public.ai_drafts (org_id, created_at desc);

create or replace function public.ai_reply_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ai_reply_settings_touch on public.ai_reply_settings;
create trigger ai_reply_settings_touch
  before update on public.ai_reply_settings
  for each row execute function public.ai_reply_touch_updated_at();

-- Consent is required before a draft can be approved, queued, or sent.
-- sent is refused while the workspace sending switch is off.
create or replace function public.ai_drafts_enforce()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sending boolean;
begin
  new.updated_at := now();

  if new.conversation_id is not null and not exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id and c.org_id = new.org_id
  ) then
    raise exception 'conversation is outside this workspace';
  end if;

  if new.inbound_message_id is not null and not exists (
    select 1 from public.messages m
    where m.id = new.inbound_message_id
      and m.org_id = new.org_id
      and m.conversation_id = new.conversation_id
  ) then
    raise exception 'message is outside this workspace';
  end if;

  if new.status in ('approved', 'queued', 'sent') and new.consent_ok is not true then
    raise exception 'consent required';
  end if;

  if new.status = 'sent' then
    select o.sending_enabled into sending
    from public.organizations o
    where o.id = new.org_id;
    if coalesce(sending, false) is not true then
      raise exception 'sending is off';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ai_drafts_enforce_row on public.ai_drafts;
create trigger ai_drafts_enforce_row
  before insert or update on public.ai_drafts
  for each row execute function public.ai_drafts_enforce();

-- Drafts created in the last hour, excluding consent refusals.
-- Callers outside the workspace get zero.
create or replace function public.ai_reply_drafts_last_hour(p_org uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  total integer;
begin
  if p_org is null then
    return 0;
  end if;
  if auth.uid() is not null and p_org not in (select public.accessible_org_ids()) then
    return 0;
  end if;
  if auth.uid() is null then
    return 0;
  end if;
  select count(*)::integer into total
  from public.ai_drafts d
  where d.org_id = p_org
    and d.created_at > now() - interval '1 hour'
    and coalesce(d.model_meta->>'failure', '') <> 'consent_denied';
  return coalesce(total, 0);
end;
$$;

revoke all on function public.ai_reply_drafts_last_hour(uuid) from public, anon;
grant execute on function public.ai_reply_drafts_last_hour(uuid) to authenticated;

alter table public.ai_reply_settings enable row level security;
alter table public.ai_reply_settings force row level security;
alter table public.ai_drafts enable row level security;
alter table public.ai_drafts force row level security;

drop policy if exists ai_reply_settings_read on public.ai_reply_settings;
create policy ai_reply_settings_read on public.ai_reply_settings
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists ai_reply_settings_insert on public.ai_reply_settings;
create policy ai_reply_settings_insert on public.ai_reply_settings
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'client_admin']));

drop policy if exists ai_reply_settings_update on public.ai_reply_settings;
create policy ai_reply_settings_update on public.ai_reply_settings
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'client_admin']));

drop policy if exists ai_reply_settings_delete on public.ai_reply_settings;
create policy ai_reply_settings_delete on public.ai_reply_settings
  for delete to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'client_admin']));

drop policy if exists ai_drafts_visible on public.ai_drafts;
create policy ai_drafts_visible on public.ai_drafts
  for all to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = ai_drafts.conversation_id
        and c.org_id = ai_drafts.org_id
        and public.inbox_assigned_visible(c.org_id, c.assigned_user_id)
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = ai_drafts.conversation_id
        and c.org_id = ai_drafts.org_id
        and public.inbox_assigned_visible(c.org_id, c.assigned_user_id)
    )
  );

revoke all on public.ai_reply_settings from public, anon;
revoke all on public.ai_drafts from public, anon;
grant select, insert, update, delete on public.ai_reply_settings to authenticated;
grant select, insert, update, delete on public.ai_drafts to authenticated;
