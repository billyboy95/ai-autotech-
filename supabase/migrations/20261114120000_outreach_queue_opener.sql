-- Queue a broker opener into crm_outbox as draft, and cancel stale queued marketing rows.
-- Additive. Does not send. Does not set organizations.sending_enabled.
-- Does not call Resend, SMTP, WhatsApp, or SMS.
-- flushOutbox delivers only status queued and approved. This file inserts draft.
-- approved is delivered when sending is on, so it is not used.
-- Stage outreach_queued means the opener is a draft. It is not Sent.

do $need$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.crm_outreach_prospects') is null
     or to_regclass('public.crm_outbox') is null
     or to_regclass('public.contact_consents') is null
     or to_regclass('public.suppressions') is null
     or to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.attach_org_tenancy(regclass)') is null then
    raise exception 'outreach queue opener needs the outreach funnel and phase 2a access';
  end if;
end
$need$;

do $orgcols$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'org_id'
  ) then
    perform public.attach_org_tenancy('public.crm_outbox'::regclass);
  end if;
  if to_regclass('public.crm_suppressions') is not null and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_suppressions' and column_name = 'org_id'
  ) then
    perform public.attach_org_tenancy('public.crm_suppressions'::regclass);
  end if;
end
$orgcols$;

alter table public.crm_outbox add column if not exists purpose text not null default 'marketing';
alter table public.crm_outbox add column if not exists message_category text not null default '';
alter table public.crm_outbox add column if not exists prospect_id text;

do $purpose_check$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_outbox'::regclass and conname = 'crm_outbox_purpose_check'
  ) then
    alter table public.crm_outbox
      add constraint crm_outbox_purpose_check
      check (purpose in ('marketing', 'service', 'transactional', 'consent_request'));
  end if;
end
$purpose_check$;

-- Keep every status the app already allows, including draft (not delivered).
do $outbox_status$
declare
  constraint_name text;
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
  loop
    execute format('alter table public.crm_outbox drop constraint %I', constraint_name);
  end loop;
  alter table public.crm_outbox
    add constraint crm_outbox_status_check
    check (status in (
      'draft', 'queued', 'approved', 'sent', 'failed', 'cancelled', 'blocked', 'blocked_consent', 'held'
    ));
end
$outbox_status$;

alter table public.crm_outreach_prospects add column if not exists queued_at timestamptz;

alter table public.crm_outreach_prospects drop constraint if exists crm_outreach_prospects_stage_check;
alter table public.crm_outreach_prospects
  add constraint crm_outreach_prospects_stage_check
  check (stage in (
    'not_contacted', 'outreach_queued', 'sent', 'replied', 'booked_call1', 'showed', 'call2', 'closed', 'lost'
  ));

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
    if new.do_not_contact and new.stage in ('sent', 'outreach_queued') and (tg_op = 'INSERT' or old.stage = 'not_contacted') then
      raise exception 'prospect is marked do-not-contact; it cannot be queued or moved to sent';
    end if;
    new.stage_changed_at := now();
    if new.stage = 'outreach_queued' then new.queued_at := coalesce(new.queued_at, now()); end if;
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

-- Drafts stay undeliverable until the workspace sending switch is on AND marketing consent is on file.
-- This trigger does not turn sending on and does not call a provider.
create or replace function public.crm_outbox_broker_opener_guard()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  sending boolean;
  consent_ok boolean;
begin
  if new.template_key is distinct from 'broker_free_audit_opener' then
    return new;
  end if;
  if new.channel is distinct from 'email' then
    raise exception 'broker opener is an email draft only';
  end if;
  if new.sent_at is not null then
    raise exception 'broker opener is not sent from this path';
  end if;
  if coalesce(new.provider, '') not in ('', 'outbox') then
    raise exception 'broker opener does not call a provider';
  end if;
  if new.status in ('queued', 'approved', 'sent') then
    select org.sending_enabled into sending from public.organizations org where org.id = new.org_id;
    if coalesce(sending, false) is not true then
      raise exception 'broker opener stays draft while sending is off';
    end if;
    select exists (
      select 1
      from public.contact_consents consent
      where consent.org_id = new.org_id
        and lower(consent.address) = lower(new.to_address)
        and consent.channel = 'email'
        and consent.purpose = 'marketing'
        and consent.withdrawn_at is null
        and consent.status <> 'opted_out'
        and (consent.status = 'opted_in' or consent.basis = 'existing_customer')
    ) into consent_ok;
    if not coalesce(consent_ok, false) then
      raise exception 'broker opener needs recorded marketing consent before it can leave draft';
    end if;
  elsif new.status not in ('draft', 'blocked_consent', 'cancelled', 'held', 'failed') then
    raise exception 'broker opener status is not allowed';
  end if;
  return new;
end
$fn$;

drop trigger if exists crm_outbox_broker_opener_guard on public.crm_outbox;
create trigger crm_outbox_broker_opener_guard
  before insert or update on public.crm_outbox
  for each row execute function public.crm_outbox_broker_opener_guard();

create unique index if not exists crm_outbox_broker_opener_once
  on public.crm_outbox (org_id, prospect_id)
  where template_key = 'broker_free_audit_opener'
    and prospect_id is not null
    and status in ('draft', 'blocked_consent', 'held');

create or replace function public.queue_outreach_openers(p_org uuid, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_row public.crm_outreach_prospects%rowtype;
  v_email text;
  v_name text;
  v_first text;
  v_business text;
  v_hook text;
  v_body text;
  v_subject text;
  v_purpose text;
  v_error text;
  v_outbox text;
  v_results jsonb := '[]'::jsonb;
  v_drafted integer := 0;
  v_blocked integer := 0;
  v_skipped integer := 0;
  v_sending boolean;
  v_suppressed boolean;
  v_opted_out boolean;
  v_opted_in boolean;
  v_existing boolean;
begin
  if auth.uid() is null or not public.has_org_role(p_org, array['agency_owner']) then
    raise exception 'not allowed';
  end if;
  select org.sending_enabled into v_sending from public.organizations org where org.id = p_org;
  if p_ids is null or cardinality(p_ids) = 0 then
    return jsonb_build_object(
      'ok', true, 'sent', false, 'queued', 0, 'approved', 0,
      'drafted', 0, 'blocked', 0, 'skipped', 0,
      'sending_enabled', coalesce(v_sending, false), 'results', v_results
    );
  end if;
  if cardinality(p_ids) > 25 then
    return jsonb_build_object(
      'ok', false, 'sent', false, 'queued', 0, 'approved', 0,
      'drafted', 0, 'blocked', 0, 'skipped', 0, 'error', 'too-many',
      'sending_enabled', coalesce(v_sending, false), 'results', v_results
    );
  end if;

  foreach v_id in array p_ids loop
    select * into v_row from public.crm_outreach_prospects where id = v_id and org_id = p_org;
    if not found then
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'skipped', 'reason', 'not-found', 'sent', false));
      continue;
    end if;
    if v_row.do_not_contact then
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'skipped', 'reason', 'dnc', 'sent', false));
      continue;
    end if;
    v_email := lower(btrim(v_row.email));
    if position('@' in v_email) = 0 then
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'skipped', 'reason', 'no-email', 'sent', false));
      continue;
    end if;
    if v_row.stage not in ('not_contacted', 'outreach_queued') then
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'skipped', 'reason', 'stage', 'sent', false));
      continue;
    end if;
    if exists (
      select 1 from public.crm_outbox existing
      where existing.org_id = p_org
        and existing.prospect_id = v_id::text
        and existing.template_key = 'broker_free_audit_opener'
        and existing.status in ('draft', 'blocked_consent', 'held', 'queued', 'approved', 'sent')
    ) then
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'skipped', 'reason', 'duplicate', 'sent', false));
      continue;
    end if;

    v_suppressed := exists (
      select 1 from public.suppressions stop
      where stop.org_id = p_org and stop.channel = 'email' and lower(stop.address) = v_email
    );
    if not v_suppressed and to_regclass('public.crm_suppressions') is not null then
      v_suppressed := exists (
        select 1 from public.crm_suppressions stop
        where lower(stop.address) = v_email
          and (stop.channel = '' or stop.channel = 'email')
          and (stop.org_id is null or stop.org_id = p_org)
      );
    end if;
    v_opted_out := exists (
      select 1 from public.contact_consents consent
      where consent.org_id = p_org
        and lower(consent.address) = v_email
        and consent.purpose = 'marketing'
        and consent.status = 'opted_out'
        and consent.withdrawn_at is null
    );
    if v_suppressed or v_opted_out then
      v_blocked := v_blocked + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'id', v_id, 'status', 'blocked_consent', 'reason', case when v_opted_out then 'opted_out' else 'suppressed' end, 'sent', false
      ));
      continue;
    end if;

    v_opted_in := exists (
      select 1 from public.contact_consents consent
      where consent.org_id = p_org
        and consent.channel = 'email'
        and lower(consent.address) = v_email
        and consent.purpose = 'marketing'
        and consent.status = 'opted_in'
        and consent.withdrawn_at is null
    );
    v_existing := exists (
      select 1 from public.contact_consents consent
      where consent.org_id = p_org
        and consent.channel = 'email'
        and lower(consent.address) = v_email
        and consent.purpose = 'marketing'
        and consent.basis = 'existing_customer'
        and consent.status <> 'opted_out'
        and consent.withdrawn_at is null
    );
    v_name := left(regexp_replace(btrim(coalesce(v_row.contact_name, '')), '\s+', ' ', 'g'), 80);
    v_first := nullif(split_part(v_name, ' ', 1), '');
    if v_first is null then v_first := 'there'; end if;
    v_business := btrim(v_row.business);
    v_hook := left(regexp_replace(btrim(coalesce(v_row.hook, '')), '\s+', ' ', 'g'), 200);
    v_body := 'Hi ' || v_first || E',\n\nBilly at AI AutoTech. I am writing to ' || v_business || '.'
      || case when v_hook = '' then '' else ' A line from your own site: ' || v_hook end
      || E'\n\nThis is not insurance advice. I am not recommending a policy, a product, or cover.\n\nIf it is useful, I can give '
      || v_business
      || E' a free 20-minute look at how new enquiries get a reply. Reply YES and I will send times. Reply STOP and I will not write again.\n\nBilly\nAI AutoTech Pty Ltd';
    v_subject := 'Free reply audit for ' || v_business || ' — not insurance advice';
    if v_opted_in or v_existing then
      v_purpose := 'marketing';
      v_error := '';
    else
      v_purpose := 'consent_request';
      v_error := 'POPIA: no marketing opt-in on file. Draft only. Not sent.';
    end if;
    v_outbox := 'opener_' || replace(gen_random_uuid()::text, '-', '');
    begin
      insert into public.crm_outbox (
        id, prospect_id, template_key, channel, to_address, subject, body, status,
        scheduled_for, sent_at, provider, provider_id, error, wa_link, org_id, purpose, message_category
      ) values (
        v_outbox, v_id::text, 'broker_free_audit_opener', 'email', v_email, v_subject, v_body, 'draft',
        now(), null, 'outbox', '', v_error, '', p_org, v_purpose, 'marketing'
      );
    exception
      when unique_violation then
        v_skipped := v_skipped + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object('id', v_id, 'status', 'skipped', 'reason', 'duplicate', 'sent', false));
        continue;
    end;
    update public.crm_outreach_prospects
    set stage = 'outreach_queued',
        notes = left(btrim(case
          when notes like '%Opener draft saved. Not sent.%' then notes
          else notes || E'\nOpener draft saved. Not sent.'
        end), 4000)
    where id = v_id and org_id = p_org and stage = 'not_contacted';
    v_drafted := v_drafted + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_id, 'status', 'draft', 'outbox_id', v_outbox, 'purpose', v_purpose, 'sent', false
    ));
  end loop;

  select org.sending_enabled into v_sending from public.organizations org where org.id = p_org;
  return jsonb_build_object(
    'ok', true,
    'sent', false,
    'queued', 0,
    'approved', 0,
    'drafted', v_drafted,
    'blocked', v_blocked,
    'skipped', v_skipped,
    'sending_enabled', coalesce(v_sending, false),
    'results', v_results
  );
end
$fn$;

create or replace function public.preview_stale_marketing_outbox(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
  v_rows jsonb;
  v_sending boolean;
begin
  if auth.uid() is null or not public.has_org_role(p_org, array['agency_owner']) then
    raise exception 'not allowed';
  end if;
  select org.sending_enabled into v_sending from public.organizations org where org.id = p_org;
  select count(*)::int into v_count
  from public.crm_outbox box
  where box.org_id = p_org
    and box.status = 'queued'
    and (
      lower(btrim(coalesce(box.purpose, ''))) = 'marketing'
      or lower(btrim(coalesce(box.message_category, ''))) = 'marketing'
    );
  select coalesce(jsonb_agg(row_to_json(listed)::jsonb), '[]'::jsonb) into v_rows
  from (
    select box.id, box.to_address, box.subject, box.created_at, box.purpose, box.message_category, box.status
    from public.crm_outbox box
    where box.org_id = p_org
      and box.status = 'queued'
      and (
        lower(btrim(coalesce(box.purpose, ''))) = 'marketing'
        or lower(btrim(coalesce(box.message_category, ''))) = 'marketing'
      )
    order by box.created_at
    limit 50
  ) listed;
  return jsonb_build_object(
    'ok', true,
    'sent', false,
    'dry_run', true,
    'changed', false,
    'cancelled', 0,
    'count', v_count,
    'sending_enabled', coalesce(v_sending, false),
    'rows', v_rows
  );
end
$fn$;

create or replace function public.cancel_stale_marketing_outbox(p_org uuid, p_confirm boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ids text[];
  v_cancelled integer := 0;
  v_sending boolean;
begin
  if auth.uid() is null or not public.has_org_role(p_org, array['agency_owner']) then
    raise exception 'not allowed';
  end if;
  select org.sending_enabled into v_sending from public.organizations org where org.id = p_org;
  if p_confirm is not true then
    return jsonb_build_object(
      'ok', true, 'sent', false, 'dry_run', true, 'changed', false, 'cancelled', 0, 'queued', 0, 'approved', 0,
      'sending_enabled', coalesce(v_sending, false)
    );
  end if;
  select coalesce(array_agg(box.id), array[]::text[]) into v_ids
  from public.crm_outbox box
  where box.org_id = p_org
    and box.status = 'queued'
    and (
      lower(btrim(coalesce(box.purpose, ''))) = 'marketing'
      or lower(btrim(coalesce(box.message_category, ''))) = 'marketing'
    );
  if cardinality(v_ids) > 0 then
    update public.crm_outbox box
    set status = 'cancelled',
        error = left(
          case
            when btrim(coalesce(box.error, '')) = '' then 'Cancelled from the outreach desk before sending was enabled. Not sent.'
            else box.error || ' Cancelled from the outreach desk before sending was enabled. Not sent.'
          end,
          1000
        )
    where box.id = any (v_ids)
      and box.org_id = p_org
      and box.status = 'queued';
    get diagnostics v_cancelled = row_count;
  end if;
  select org.sending_enabled into v_sending from public.organizations org where org.id = p_org;
  return jsonb_build_object(
    'ok', true,
    'sent', false,
    'dry_run', false,
    'changed', v_cancelled > 0,
    'cancelled', v_cancelled,
    'queued', 0,
    'approved', 0,
    'sending_enabled', coalesce(v_sending, false)
  );
end
$fn$;

revoke all on function public.crm_outbox_broker_opener_guard() from public, anon, authenticated;
revoke all on function public.queue_outreach_openers(uuid, uuid[]) from public, anon;
revoke all on function public.preview_stale_marketing_outbox(uuid) from public, anon;
revoke all on function public.cancel_stale_marketing_outbox(uuid, boolean) from public, anon;
grant execute on function public.queue_outreach_openers(uuid, uuid[]) to authenticated;
grant execute on function public.preview_stale_marketing_outbox(uuid) to authenticated;
grant execute on function public.cancel_stale_marketing_outbox(uuid, boolean) to authenticated;
