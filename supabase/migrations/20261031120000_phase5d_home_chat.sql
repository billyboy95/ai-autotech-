-- Phase 5d: home assistant drafts.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Follow-ups and tasks are stored as drafts. A follow-up is copied to crm_outbox
-- only when that table already allows status draft and the lead row exists.
-- Nothing is queued or sent. No provider is called.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5d needs phase 2a access; apply 20260926200000_phase2a_access.sql before this file';
  end if;
end
$need$;

create table if not exists public.home_chat_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('follow_up', 'task')),
  status text not null default 'draft' check (status = 'draft'),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null default '' check (char_length(body) <= 2000),
  lead_ref text not null default '' check (char_length(lead_ref) <= 80),
  lead_name text not null default '' check (char_length(lead_name) <= 120),
  channel text not null default '' check (channel in ('whatsapp', 'email', 'sms', '')),
  sandbox boolean not null default true check (sandbox),
  charged boolean not null default false check (charged = false),
  created_at timestamptz not null default now(),
  constraint home_chat_drafts_follow_up_body check (
    kind <> 'follow_up' or (char_length(btrim(body)) > 0 and channel in ('whatsapp', 'email', 'sms'))
  )
);

create index if not exists home_chat_drafts_org_idx
  on public.home_chat_drafts (org_id, created_at desc);

alter table public.home_chat_drafts enable row level security;
alter table public.home_chat_drafts force row level security;

drop policy if exists home_chat_drafts_read on public.home_chat_drafts;
create policy home_chat_drafts_read on public.home_chat_drafts
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists home_chat_drafts_insert on public.home_chat_drafts;
create policy home_chat_drafts_insert on public.home_chat_drafts
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

revoke all on table public.home_chat_drafts from public, anon;
grant select, insert on table public.home_chat_drafts to authenticated;

create or replace function public.save_home_chat_draft(
  p_org uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_lead_ref text,
  p_lead_name text,
  p_channel text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_id uuid;
  v_channel text;
  v_title text;
  v_body text;
  v_lead_ref text;
  v_lead_name text;
  found_id text;
  outbox_id text;
  has_lead_org boolean;
  has_outbox_org boolean;
  draft_allowed boolean;
  sending boolean;
begin
  if auth.uid() is not null
     and not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if p_kind not in ('follow_up', 'task') then
    raise exception 'draft kind only';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  v_body := coalesce(p_body, '');
  v_lead_ref := btrim(coalesce(p_lead_ref, ''));
  v_lead_name := btrim(coalesce(p_lead_name, ''));

  if char_length(v_title) < 1 or char_length(v_title) > 160
     or char_length(v_body) > 2000
     or char_length(v_lead_ref) > 80
     or char_length(v_lead_name) > 120 then
    raise exception 'draft is too long';
  end if;

  if p_kind = 'follow_up' and btrim(v_body) = '' then
    raise exception 'draft body required';
  end if;

  v_channel := case
    when p_kind = 'task' then ''
    when p_channel in ('whatsapp', 'email', 'sms') then p_channel
    else 'whatsapp'
  end;

  insert into public.home_chat_drafts (
    org_id, kind, status, title, body, lead_ref, lead_name, channel, sandbox, charged
  ) values (
    p_org, p_kind, 'draft', v_title, v_body, v_lead_ref, v_lead_name, v_channel, true, false
  )
  returning id into draft_id;

  if p_kind = 'follow_up'
     and v_lead_ref <> ''
     and to_regclass('public.crm_leads') is not null
     and to_regclass('public.crm_outbox') is not null then
    select exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and rel.relname = 'crm_outbox'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ilike '%status%'
        and pg_get_constraintdef(con.oid) ilike '%''draft''%'
    ) into draft_allowed;

    if draft_allowed then
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'crm_leads' and column_name = 'org_id'
      ) into has_lead_org;
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'org_id'
      ) into has_outbox_org;

      if has_lead_org then
        execute 'select id from public.crm_leads where id = $1 and (org_id is null or org_id = $2)'
          into found_id using v_lead_ref, p_org;
      else
        execute 'select id from public.crm_leads where id = $1'
          into found_id using v_lead_ref;
      end if;

      if found_id is not null then
        outbox_id := 'chatdraft_' || replace(gen_random_uuid()::text, '-', '');
        begin
          if has_outbox_org then
            insert into public.crm_outbox (id, lead_id, channel, body, status, org_id)
            values (outbox_id, v_lead_ref, v_channel, v_body, 'draft', p_org);
          else
            insert into public.crm_outbox (id, lead_id, channel, body, status)
            values (outbox_id, v_lead_ref, v_channel, v_body, 'draft');
          end if;
        exception
          when check_violation or foreign_key_violation or not_null_violation then
            outbox_id := null;
        end;
      end if;
    end if;
  end if;

  select o.sending_enabled into sending from public.organizations o where o.id = p_org;

  return jsonb_build_object(
    'id', draft_id,
    'kind', p_kind,
    'status', 'draft',
    'sandbox', true,
    'charged', false,
    'sent', false,
    'queued', false,
    'outbox_id', outbox_id,
    'outbox_status', case when outbox_id is null then null else 'draft' end,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.save_home_chat_draft(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_home_chat_draft(uuid, text, text, text, text, text, text) to authenticated;

do $service_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert on table public.home_chat_drafts to service_role;
    grant execute on function public.save_home_chat_draft(uuid, text, text, text, text, text, text) to service_role;
  end if;
end
$service_grants$;

comment on table public.home_chat_drafts is
  'Sandbox drafts from the command-centre home assistant. Status stays draft. Nothing is sent.';
