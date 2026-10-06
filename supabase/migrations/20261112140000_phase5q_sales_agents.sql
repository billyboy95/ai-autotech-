-- Phase 5q: sales and onboarding agent drafts.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Drafts stay in the approval queue. Approving queues crm_outbox and does not send.
-- Leave SALES_AGENTS_ENABLED unset until this file is applied.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('public.accessible_org_ids()') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'phase 5q needs phase 2a access';
  end if;
  if to_regclass('public.crm_notifications') is null
     or to_regprocedure('public.record_owner_notification(uuid, text, text, text, text, text, text)') is null then
    raise exception 'phase 5q needs phase 5p sales funnel';
  end if;
  if to_regclass('public.crm_outbox') is null then
    raise exception 'phase 5q needs crm_outbox';
  end if;
  if to_regclass('public.crm_audit_leads') is null then
    raise exception 'phase 5q needs crm_audit_leads';
  end if;
end
$need$;

do $kind$
declare constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'crm_notifications'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.crm_notifications drop constraint %I', constraint_name);
  end loop;
end
$kind$;

alter table public.crm_notifications
  add constraint crm_notifications_kind_check
  check (kind in ('audit', 'contact', 'booking', 'workflow', 'reply', 'approval', 'stalled', 'summary'));

create or replace function public.record_owner_notification(
  p_org uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_href text,
  p_lead_id text,
  p_dedupe_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  note_id uuid;
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := left(coalesce(p_body, ''), 2000);
  v_href text := btrim(coalesce(p_href, ''));
  v_lead text := left(btrim(coalesce(p_lead_id, '')), 80);
  v_key text := left(btrim(coalesce(p_dedupe_key, '')), 180);
begin
  if auth.uid() is null then
    if current_setting('request.jwt.claim.role', true) = 'authenticated' then
      raise exception 'not allowed';
    end if;
  elsif not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations org where org.id = p_org) then
    raise exception 'workspace required';
  end if;
  if v_kind not in ('audit', 'contact', 'booking', 'workflow', 'reply', 'approval', 'stalled', 'summary') then
    raise exception 'notification kind';
  end if;
  if length(v_title) < 1 or length(v_title) > 160 then
    raise exception 'notification title';
  end if;
  if v_key = '' then
    raise exception 'notification key';
  end if;
  if v_href <> '' and v_href !~ '^/command-centre/' then
    raise exception 'notification href';
  end if;

  insert into public.crm_notifications (org_id, kind, title, body, href, lead_id, dedupe_key)
  values (p_org, v_kind, v_title, v_body, v_href, v_lead, v_key)
  on conflict (org_id, dedupe_key) do nothing
  returning id into note_id;

  if note_id is null then
    select id into note_id
    from public.crm_notifications
    where org_id = p_org and dedupe_key = v_key;
  end if;

  return jsonb_build_object('ok', true, 'id', note_id, 'sent', false);
end;
$$;

create table if not exists public.crm_sales_sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  audit_lead_id uuid references public.crm_audit_leads(id) on delete cascade,
  lead_id text not null default '',
  trigger text not null check (trigger in ('audit_arrived', 'report_approved')),
  status text not null default 'active' check (status in ('active', 'stopped', 'completed')),
  stop_reason text not null default '' check (stop_reason in ('', 'booking', 'reply', 'opt_out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_sales_sequences_audit_unique unique (org_id, audit_lead_id)
);

create table if not exists public.crm_sales_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sequence_id uuid references public.crm_sales_sequences(id) on delete cascade,
  lead_id text not null default '',
  kind text not null check (kind in ('follow_up', 'reminder', 'welcome')),
  step text not null check (step in ('day0', 'day2', 'day5', 'reminder_24h', 'reminder_1h', 'welcome')),
  channel text not null check (channel in ('whatsapp', 'email', 'sms')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'skipped')),
  skip_reason text not null default '',
  subject text not null default '',
  body text not null default '',
  scheduled_for timestamptz not null default now(),
  dedupe_key text not null,
  to_address text not null default '',
  purpose text not null default 'marketing' check (purpose in ('marketing', 'service')),
  outbox_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_sales_drafts_dedupe_unique unique (org_id, dedupe_key),
  constraint crm_sales_drafts_body_check check (length(body) <= 4000),
  constraint crm_sales_drafts_skip_check check (length(skip_reason) <= 300),
  constraint crm_sales_drafts_key_check check (length(btrim(dedupe_key)) between 1 and 180)
);

create index if not exists crm_sales_drafts_org_idx
  on public.crm_sales_drafts (org_id, status, scheduled_for);

create table if not exists public.crm_client_onboarding (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id text not null default '',
  trigger text not null check (trigger in ('deal_won', 'invoice_paid')),
  source_key text not null,
  status text not null default 'open' check (status = 'open'),
  created_at timestamptz not null default now(),
  constraint crm_client_onboarding_source_unique unique (org_id, source_key),
  constraint crm_client_onboarding_source_check check (length(btrim(source_key)) between 1 and 180)
);

create table if not exists public.crm_client_onboarding_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  checklist_id uuid not null references public.crm_client_onboarding(id) on delete cascade,
  item_key text not null,
  title text not null,
  href text not null default '',
  detail text not null default '',
  done boolean not null default false,
  ord integer not null default 0,
  constraint crm_client_onboarding_items_unique unique (checklist_id, item_key)
);

alter table public.crm_sales_sequences enable row level security;
alter table public.crm_sales_sequences force row level security;
alter table public.crm_sales_drafts enable row level security;
alter table public.crm_sales_drafts force row level security;
alter table public.crm_client_onboarding enable row level security;
alter table public.crm_client_onboarding force row level security;
alter table public.crm_client_onboarding_items enable row level security;
alter table public.crm_client_onboarding_items force row level security;

drop policy if exists crm_sales_sequences_read on public.crm_sales_sequences;
create policy crm_sales_sequences_read on public.crm_sales_sequences
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists crm_sales_drafts_read on public.crm_sales_drafts;
create policy crm_sales_drafts_read on public.crm_sales_drafts
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists crm_client_onboarding_read on public.crm_client_onboarding;
create policy crm_client_onboarding_read on public.crm_client_onboarding
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists crm_client_onboarding_items_read on public.crm_client_onboarding_items;
create policy crm_client_onboarding_items_read on public.crm_client_onboarding_items
  for select to authenticated
  using (
    org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

revoke all on table public.crm_sales_sequences from public, anon;
revoke all on table public.crm_sales_drafts from public, anon;
revoke all on table public.crm_client_onboarding from public, anon;
revoke all on table public.crm_client_onboarding_items from public, anon;
grant select on table public.crm_sales_sequences to authenticated;
grant select on table public.crm_sales_drafts to authenticated;
grant select on table public.crm_client_onboarding to authenticated;
grant select on table public.crm_client_onboarding_items to authenticated;

create or replace function public.save_sales_agent_batch(p_org uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq jsonb := p_payload->'sequence';
  v_drafts jsonb := coalesce(p_payload->'drafts', '[]'::jsonb);
  v_notices jsonb := coalesce(p_payload->'notices', '[]'::jsonb);
  v_onboarding jsonb := p_payload->'onboarding';
  v_seq_id uuid;
  v_check_id uuid;
  v_stop text := '';
  v_cancel boolean := coalesce((p_payload->>'cancelPending')::boolean, false);
  item jsonb;
  note jsonb;
  step_item jsonb;
  v_status text;
  v_kind text;
  v_step text;
  v_channel text;
  v_key text;
  v_check uuid;
  v_ord integer := 0;
  stored_drafts integer := 0;
  sending boolean := false;
begin
  if auth.uid() is null then
    if current_setting('request.jwt.claim.role', true) = 'authenticated' then
      raise exception 'not allowed';
    end if;
  else
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.organizations org where org.id = p_org) then
    raise exception 'workspace required';
  end if;
  select org.sending_enabled into sending from public.organizations org where org.id = p_org;
  if jsonb_typeof(v_drafts) <> 'array' or jsonb_typeof(v_notices) <> 'array' then
    raise exception 'sales batch';
  end if;

  if v_seq is not null and jsonb_typeof(v_seq) = 'object' and nullif(v_seq->>'auditLeadId', '') is not null then
    if not exists (
      select 1 from public.crm_audit_leads lead
      where lead.id = (v_seq->>'auditLeadId')::uuid and lead.org_id = p_org
    ) then
      raise exception 'audit lead required';
    end if;
    v_stop := case when coalesce(v_seq->>'stopReason', '') in ('booking', 'reply', 'opt_out') then v_seq->>'stopReason' else '' end;
    insert into public.crm_sales_sequences (org_id, audit_lead_id, lead_id, trigger, status, stop_reason)
    values (
      p_org,
      (v_seq->>'auditLeadId')::uuid,
      left(btrim(coalesce(v_seq->>'leadId', '')), 80),
      case when v_seq->>'trigger' = 'report_approved' then 'report_approved' else 'audit_arrived' end,
      case when v_stop = '' then 'active' else 'stopped' end,
      v_stop
    )
    on conflict (org_id, audit_lead_id)
    do update set
      trigger = excluded.trigger,
      status = excluded.status,
      stop_reason = excluded.stop_reason,
      lead_id = excluded.lead_id,
      updated_at = now()
    returning id into v_seq_id;
  end if;

  for item in select value from jsonb_array_elements(v_drafts)
  loop
    v_kind := case when item->>'kind' in ('follow_up', 'reminder', 'welcome') then item->>'kind' else '' end;
    v_step := case
      when item->>'step' in ('day0', 'day2', 'day5', 'reminder_24h', 'reminder_1h', 'welcome') then item->>'step'
      else ''
    end;
    v_channel := case when item->>'channel' in ('whatsapp', 'email', 'sms') then item->>'channel' else '' end;
    v_key := left(btrim(coalesce(item->>'dedupeKey', '')), 180);
    v_status := case when item->>'status' = 'skipped' then 'skipped' else 'draft' end;
    if v_kind = '' or v_step = '' or v_channel = '' or v_key = '' then
      continue;
    end if;
    if v_status = 'draft' and length(btrim(coalesce(item->>'body', ''))) < 1 then
      continue;
    end if;
    insert into public.crm_sales_drafts (
      org_id, sequence_id, lead_id, kind, step, channel, status, skip_reason, subject, body,
      scheduled_for, dedupe_key, to_address, purpose
    ) values (
      p_org,
      case when v_kind = 'follow_up' then v_seq_id else null end,
      left(btrim(coalesce(item->>'leadId', '')), 80),
      v_kind,
      v_step,
      v_channel,
      v_status,
      left(coalesce(item->>'skipReason', ''), 300),
      left(coalesce(item->>'subject', ''), 160),
      left(coalesce(item->>'body', ''), 4000),
      coalesce(nullif(item->>'scheduledFor', '')::timestamptz, now()),
      v_key,
      left(coalesce(item->>'toAddress', ''), 200),
      case when item->>'purpose' = 'service' then 'service' else 'marketing' end
    )
    on conflict (org_id, dedupe_key) do update set
      body = excluded.body,
      subject = excluded.subject,
      updated_at = now()
    where public.crm_sales_drafts.status = 'draft'
      and public.crm_sales_drafts.skip_reason = '';
    stored_drafts := stored_drafts + 1;
  end loop;

  if v_cancel and v_seq_id is not null and v_stop <> '' then
    update public.crm_sales_drafts
    set status = 'skipped',
        skip_reason = left('Stopped: ' || v_stop, 300),
        updated_at = now()
    where org_id = p_org
      and sequence_id = v_seq_id
      and kind = 'follow_up'
      and status = 'draft';

    update public.crm_outbox outbox
    set status = 'cancelled',
        error = left('Stopped: ' || v_stop, 300)
    where outbox.sent_at is null
      and outbox.status in ('queued', 'approved')
      and outbox.id in (
        select draft.outbox_id
        from public.crm_sales_drafts draft
        where draft.sequence_id = v_seq_id
          and draft.kind = 'follow_up'
          and draft.outbox_id <> ''
      );
  end if;

  for note in select value from jsonb_array_elements(v_notices)
  loop
    if coalesce(note->>'kind', '') = '' or coalesce(note->>'title', '') = '' then
      continue;
    end if;
    perform public.record_owner_notification(
      p_org,
      note->>'kind',
      note->>'title',
      coalesce(note->>'body', ''),
      coalesce(note->>'href', '/command-centre/approvals'),
      coalesce(note->>'leadId', ''),
      note->>'dedupeKey'
    );
  end loop;

  if v_onboarding is not null and jsonb_typeof(v_onboarding) = 'object' then
    insert into public.crm_client_onboarding (org_id, lead_id, trigger, source_key)
    values (
      p_org,
      left(btrim(coalesce(v_onboarding->>'leadId', '')), 80),
      case when v_onboarding->>'trigger' = 'invoice_paid' then 'invoice_paid' else 'deal_won' end,
      left(btrim(coalesce(v_onboarding->>'sourceKey', '')), 180)
    )
    on conflict (org_id, source_key) do nothing
    returning id into v_check_id;
    if v_check_id is null then
      select id into v_check_id
      from public.crm_client_onboarding
      where org_id = p_org and source_key = left(btrim(coalesce(v_onboarding->>'sourceKey', '')), 180);
    end if;
    if v_check_id is not null and jsonb_typeof(v_onboarding->'items') = 'array' then
      for step_item in select value from jsonb_array_elements(v_onboarding->'items')
      loop
        if coalesce(step_item->>'key', '') = '' then
          continue;
        end if;
        insert into public.crm_client_onboarding_items (org_id, checklist_id, item_key, title, href, detail, ord)
        values (
          p_org,
          v_check_id,
          left(step_item->>'key', 40),
          left(coalesce(step_item->>'title', ''), 120),
          left(coalesce(step_item->>'href', ''), 200),
          left(coalesce(step_item->>'detail', ''), 500),
          v_ord
        )
        on conflict (checklist_id, item_key) do nothing;
        v_ord := v_ord + 1;
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'stored', stored_drafts,
    'sent', false,
    'sending_enabled', coalesce(sending, false),
    'sequence_id', v_seq_id,
    'checklist_id', v_check_id
  );
end;
$$;

create or replace function public.decide_sales_draft(
  p_org uuid,
  p_draft uuid,
  p_action text,
  p_body text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.crm_sales_drafts%rowtype;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_body text;
  v_outbox text;
  found_lead text;
  has_org boolean;
  has_purpose boolean;
  sending boolean := false;
begin
  if auth.uid() is null or not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;

  select * into draft
  from public.crm_sales_drafts row
  where row.id = p_draft and row.org_id = p_org
  for update;

  if not found then
    raise exception 'draft required';
  end if;
  if draft.status <> 'draft' or length(btrim(draft.skip_reason)) > 0 then
    return jsonb_build_object('ok', false, 'status', draft.status, 'sent', false, 'outbox_id', '');
  end if;

  select org.sending_enabled into sending from public.organizations org where org.id = p_org;

  if v_action = 'reject' then
    update public.crm_sales_drafts
    set status = 'rejected', updated_at = now()
    where id = draft.id;
    return jsonb_build_object('ok', true, 'status', 'rejected', 'sent', false, 'outbox_id', '', 'sending_enabled', coalesce(sending, false));
  end if;

  if v_action = 'edit' then
    v_body := left(btrim(coalesce(p_body, '')), 4000);
    if v_body = '' then
      raise exception 'draft body';
    end if;
    update public.crm_sales_drafts
    set body = v_body, updated_at = now()
    where id = draft.id;
    return jsonb_build_object('ok', true, 'status', 'draft', 'sent', false, 'outbox_id', '', 'sending_enabled', coalesce(sending, false));
  end if;

  if v_action <> 'approve' then
    raise exception 'draft action';
  end if;

  v_outbox := 'salesq_' || replace(gen_random_uuid()::text, '-', '');
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_leads' and column_name = 'org_id'
  ) into has_org;
  if has_org then
    execute 'select id from public.crm_leads where id = $1 and (org_id is null or org_id = $2)'
      into found_lead using nullif(draft.lead_id, ''), p_org;
  else
    execute 'select id from public.crm_leads where id = $1'
      into found_lead using nullif(draft.lead_id, '');
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'org_id'
  ) into has_org;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'purpose'
  ) into has_purpose;

  if has_org and has_purpose then
    insert into public.crm_outbox (
      id, lead_id, template_key, channel, to_address, subject, body, status, scheduled_for, sent_at, org_id, purpose, message_category
    ) values (
      v_outbox,
      found_lead,
      'sales_agent_' || draft.step || '_' || draft.channel,
      draft.channel,
      draft.to_address,
      draft.subject,
      draft.body,
      'queued',
      draft.scheduled_for,
      null,
      p_org,
      draft.purpose,
      draft.purpose
    );
  elsif has_org then
    insert into public.crm_outbox (
      id, lead_id, template_key, channel, to_address, subject, body, status, scheduled_for, sent_at, org_id
    ) values (
      v_outbox, found_lead, 'sales_agent_' || draft.step || '_' || draft.channel,
      draft.channel, draft.to_address, draft.subject, draft.body, 'queued', draft.scheduled_for, null, p_org
    );
  else
    insert into public.crm_outbox (
      id, lead_id, template_key, channel, to_address, subject, body, status, scheduled_for, sent_at
    ) values (
      v_outbox, found_lead, 'sales_agent_' || draft.step || '_' || draft.channel,
      draft.channel, draft.to_address, draft.subject, draft.body, 'queued', draft.scheduled_for, null
    );
  end if;

  update public.crm_sales_drafts
  set status = 'approved', outbox_id = v_outbox, updated_at = now()
  where id = draft.id;

  return jsonb_build_object(
    'ok', true,
    'status', 'approved',
    'outbox_status', 'queued',
    'outbox_id', v_outbox,
    'sent', false,
    'sending_enabled', coalesce(sending, false)
  );
end;
$$;

revoke all on function public.save_sales_agent_batch(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.decide_sales_draft(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.decide_sales_draft(uuid, uuid, text, text) to authenticated;

do $service_grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.save_sales_agent_batch(uuid, jsonb) to service_role;
    grant execute on function public.decide_sales_draft(uuid, uuid, text, text) to service_role;
    grant execute on function public.record_owner_notification(uuid, text, text, text, text, text, text) to service_role;
    grant select, insert, update, delete on public.crm_sales_sequences to service_role;
    grant select, insert, update, delete on public.crm_sales_drafts to service_role;
    grant select, insert, update, delete on public.crm_client_onboarding to service_role;
    grant select, insert, update, delete on public.crm_client_onboarding_items to service_role;
  end if;
end
$service_grant$;
