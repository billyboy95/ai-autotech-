-- Phase 3c: reputation reviews.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- There is no cron in this file. Review requests are drafts only.
-- A draft is written to crm_outbox only after marketing consent is stored.
-- The outbox status is draft. Flush delivers queued and approved only.
-- A trigger refuses queued, approved, and sent on template_key review_request.
--
-- Workflow hook is deferred. events.type and workflows.trigger_type do not
-- include a review trigger. review.received is deferred so seeded workflow
-- rows stay valid. This file does not record a workflow event and does not alter
-- those checks.
--
-- No Google, Facebook, or other paid review API is called.

do $need$
begin
  if to_regclass('public.organizations') is null or to_regclass('public.memberships') is null then
    raise exception 'phase 3c needs agency tenancy; apply 20260926160000_agency_tenancy.sql and phase 2a first';
  end if;
  if to_regclass('public.crm_contacts') is null
     or to_regclass('public.contact_consents') is null
     or to_regclass('public.suppressions') is null then
    raise exception 'phase 3c needs POPIA contacts; apply 20261015140000_phase2b_channels_popia.sql first';
  end if;
  if to_regclass('public.crm_outbox') is null then
    raise exception 'phase 3c needs crm_outbox; apply crm_automation and outbound_channels first';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null
     or to_regprocedure('public.accessible_org_ids()') is null then
    raise exception 'phase 3c needs phase 2a roles';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'org_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'purpose'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'contact_id'
  ) then
    raise exception 'phase 3c needs org-scoped outbox columns; apply org_scope_phase1_tables and phase 2b first';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crm_outbox' and column_name = 'lead_id' and is_nullable = 'NO'
  ) then
    raise exception 'phase 3c needs nullable crm_outbox.lead_id; apply outbound_channels first';
  end if;
end
$need$;

-- draft is not delivered. Unknown statuses are coerced to queued by the app loader,
-- so this value has to stay in the check and in that loader.
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
      'queued', 'approved', 'sent', 'failed', 'cancelled', 'blocked', 'blocked_consent', 'held', 'draft'
    ));
end
$outbox_status$;

create or replace function public.review_request_outbox_stays_draft()
returns trigger
language plpgsql
as $$
begin
  if new.template_key is distinct from 'review_request' then
    return new;
  end if;
  if new.status not in ('draft', 'cancelled', 'failed') or new.sent_at is not null then
    raise exception 'review request drafts are not sent';
  end if;
  if tg_op = 'UPDATE' and new.status = 'cancelled' and to_regclass('public.review_requests') is not null then
    update public.review_requests
    set status = 'cancelled', updated_at = now()
    where outbox_id = new.id and status = 'draft';
  end if;
  return new;
end;
$$;

drop trigger if exists review_request_outbox_stays_draft on public.crm_outbox;
create trigger review_request_outbox_stays_draft
  before insert or update on public.crm_outbox
  for each row execute function public.review_request_outbox_stays_draft();

create table if not exists public.review_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('email', 'sms')),
  subject text not null default '',
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_templates_name_check check (length(btrim(name)) > 0),
  constraint review_templates_body_check check (length(btrim(body)) > 0)
);

create index if not exists review_templates_org_idx on public.review_templates (org_id, active);

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  lead_id text,
  channel text not null check (channel in ('email', 'sms')),
  to_address text not null,
  subject text not null default '',
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'cancelled')),
  public_token text not null,
  consent_accepted boolean not null,
  consent_text text not null,
  consent_at timestamptz not null,
  outbox_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_requests_consent_check check (
    consent_accepted and length(btrim(consent_text)) >= 12 and consent_at is not null
  ),
  constraint review_requests_token_check check (public_token ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create unique index if not exists review_requests_token_idx on public.review_requests (public_token);
create index if not exists review_requests_org_idx on public.review_requests (org_id, created_at desc);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  source text not null default 'manual' check (source in ('public', 'manual', 'google', 'facebook')),
  public_token text not null default ('rvw' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)),
  reviewer_name text not null default '',
  review_request_id uuid references public.review_requests(id) on delete set null,
  responded_at timestamptz,
  response_note text not null default '',
  created_at timestamptz not null default now(),
  constraint reviews_comment_check check (length(comment) <= 500),
  constraint reviews_name_check check (length(reviewer_name) <= 80),
  constraint reviews_note_check check (length(response_note) <= 500),
  constraint reviews_token_check check (public_token ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create unique index if not exists reviews_token_idx on public.reviews (public_token);
create index if not exists reviews_org_created_idx on public.reviews (org_id, created_at desc);
create index if not exists reviews_org_rating_idx on public.reviews (org_id, rating);

create or replace function public.review_aggregate(p_org uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'count', count(*),
    'average', case when count(*) = 0 then null else round(avg(rating)::numeric, 1) end
  )
  from public.reviews
  where org_id = p_org
$$;

create or replace function public.public_review_catalog(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := lower(btrim(coalesce(p_key, '')));
  v_org_id uuid;
  v_org public.organizations%rowtype;
  v_count integer;
  v_average numeric;
  v_recent jsonb;
begin
  if v_key = '' or v_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return jsonb_build_object('kind', 'missing');
  end if;

  select id into v_org_id from public.organizations where slug = v_key;
  if v_org_id is null then
    select org_id into v_org_id from public.review_requests where public_token = v_key;
  end if;
  if v_org_id is null then
    select org_id into v_org_id from public.reviews where public_token = v_key;
  end if;
  if v_org_id is null then
    return jsonb_build_object('kind', 'missing');
  end if;

  select * into v_org from public.organizations where id = v_org_id;
  if not found or lower(coalesce(v_org.status, '')) = 'suspended' then
    return jsonb_build_object('kind', 'missing');
  end if;

  select count(*)::int,
         case when count(*) = 0 then null else round(avg(rating)::numeric, 1) end
    into v_count, v_average
  from public.reviews
  where org_id = v_org.id
    and source in ('public', 'google', 'facebook');

  select coalesce(jsonb_agg(jsonb_build_object(
    'rating', rating,
    'comment', comment,
    'name', reviewer_name,
    'source', source,
    'createdAt', created_at
  ) order by created_at desc), '[]'::jsonb)
    into v_recent
  from (
    select rating, comment, reviewer_name, source, created_at
    from public.reviews
    where org_id = v_org.id
      and source in ('public', 'google', 'facebook')
    order by created_at desc
    limit 8
  ) item;

  return jsonb_build_object(
    'kind', 'org',
    'orgName', v_org.name,
    'orgSlug', v_org.slug,
    'senderName', coalesce(nullif(v_org.sender_name, ''), v_org.name),
    'count', v_count,
    'average', v_average,
    'recent', v_recent
  );
end;
$$;

-- Stores the review only. Does not write crm_outbox and does not record a workflow event.
create or replace function public.submit_public_review(
  p_key text,
  p_rating integer,
  p_name text,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(btrim(coalesce(p_key, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_comment text := btrim(coalesce(p_comment, ''));
  v_org_id uuid;
  v_org public.organizations%rowtype;
  v_request uuid;
  v_review uuid;
  v_token text;
begin
  if v_key = '' or v_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'review page is not active';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating required';
  end if;
  if length(v_name) > 80 then
    raise exception 'name too long';
  end if;
  if length(v_comment) > 500 then
    raise exception 'comment too long';
  end if;

  select id into v_org_id from public.organizations where slug = v_key;
  if v_org_id is null then
    select id, org_id into v_request, v_org_id
    from public.review_requests
    where public_token = v_key;
  end if;
  if v_org_id is null then
    select org_id into v_org_id from public.reviews where public_token = v_key;
  end if;
  if v_org_id is null then
    raise exception 'review page is not active';
  end if;

  select * into v_org from public.organizations where id = v_org_id;
  if not found or lower(coalesce(v_org.status, '')) = 'suspended' then
    raise exception 'review page is not active';
  end if;

  v_token := 'rvw' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
  insert into public.reviews (
    org_id, rating, comment, source, public_token, reviewer_name, review_request_id
  ) values (
    v_org.id, p_rating, v_comment, 'public', v_token, v_name, v_request
  ) returning id into v_review;

  return jsonb_build_object(
    'ok', true,
    'review_id', v_review,
    'public_token', v_token,
    'org_slug', v_org.slug,
    'rating', p_rating
  );
end;
$$;

-- Writes a held-style draft. Status is draft, never queued. Consent is stored first.
create or replace function public.create_review_request_draft(
  p_org uuid,
  p_channel text,
  p_address text,
  p_name text,
  p_subject text,
  p_body text,
  p_consent boolean,
  p_consent_text text,
  p_contact_id uuid default null,
  p_lead_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel text := lower(btrim(coalesce(p_channel, '')));
  v_address text := btrim(coalesce(p_address, ''));
  v_name text := btrim(coalesce(p_name, ''));
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_consent text := btrim(coalesce(p_consent_text, ''));
  v_org public.organizations%rowtype;
  v_contact uuid;
  v_lead text;
  v_status text;
  v_sender text;
  v_token text;
  v_link text;
  v_request uuid;
  v_outbox text;
begin
  if not public.has_org_role(p_org, array['agency_owner', 'agency_staff', 'client_admin']) then
    raise exception 'not allowed';
  end if;
  if p_consent is not true or length(v_consent) < 12 then
    raise exception 'consent required';
  end if;
  if v_channel not in ('email', 'sms') then
    raise exception 'channel invalid';
  end if;

  select * into v_org from public.organizations where id = p_org;
  if not found or lower(coalesce(v_org.status, '')) = 'suspended' then
    raise exception 'workspace is suspended';
  end if;

  if v_channel = 'email' then
    v_address := lower(v_address);
    if v_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'email invalid';
    end if;
  else
    v_address := regexp_replace(v_address, '\s+', '', 'g');
    if v_address ~ '^0[0-9]{9}$' then
      v_address := '+27' || substring(v_address from 2);
    elsif v_address ~ '^27[0-9]{9}$' then
      v_address := '+' || v_address;
    end if;
    if v_address !~ '^\+[0-9]{8,15}$' then
      raise exception 'phone invalid';
    end if;
  end if;

  if p_contact_id is not null then
    select id into v_contact
    from public.crm_contacts
    where id = p_contact_id and org_id = p_org and erased_at is null;
    if v_contact is null then
      raise exception 'contact is outside this workspace';
    end if;
  end if;

  v_lead := nullif(btrim(coalesce(p_lead_id, '')), '');
  if v_lead is not null and not exists (
    select 1 from public.crm_leads lead where lead.id = v_lead and lead.org_id = p_org
  ) then
    v_lead := null;
  end if;

  if exists (
    select 1 from public.suppressions entry
    where entry.org_id = p_org
      and entry.channel = v_channel
      and lower(entry.address) = lower(v_address)
  ) then
    raise exception 'suppressed';
  end if;

  select entry.status into v_status
  from public.contact_consents entry
  where entry.org_id = p_org
    and entry.channel = v_channel
    and entry.purpose = 'marketing'
    and lower(entry.address) = lower(v_address)
  order by entry.captured_at desc
  limit 1;
  if v_status = 'opted_out' then
    raise exception 'consent refused';
  end if;

  v_sender := coalesce(nullif(v_org.sender_name, ''), v_org.name, 'This workspace');
  v_token := 'rvw' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
  v_link := '/r/' || v_token;
  if v_body = '' then
    raise exception 'message required';
  end if;
  v_body := replace(v_body, '{{link}}', v_link);
  v_body := replace(v_body, '{{name}}', coalesce(nullif(v_name, ''), 'there'));
  v_body := replace(v_body, '{{sender}}', v_sender);
  if position(v_link in v_body) = 0 then
    v_body := v_body || E'\n' || v_link;
  end if;
  if v_channel = 'email' then
    if v_subject = '' then
      v_subject := 'How did we do?';
    end if;
    if v_body not like '%To opt out%' then
      v_body := v_body || E'\n\n' || v_sender || '. To opt out, use the unsubscribe link (/unsubscribe) or reply STOP.';
    end if;
  elsif v_body not like '%reply STOP to opt out%' then
    v_body := v_body || E'\n' || v_sender || ': reply STOP to opt out';
  end if;
  if length(v_subject) > 200 or length(v_body) > 4000 then
    raise exception 'message too long';
  end if;

  insert into public.contact_consents (
    org_id, contact_id, channel, purpose, status, basis, address, source, evidence, captured_at
  ) values (
    p_org,
    v_contact,
    v_channel,
    'marketing',
    'opted_in',
    'consent',
    v_address,
    'review_request',
    jsonb_build_object('consent_text', v_consent, 'public_token', v_token),
    now()
  );

  v_outbox := 'rreq_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
  insert into public.review_requests (
    org_id, contact_id, lead_id, channel, to_address, subject, body, status,
    public_token, consent_accepted, consent_text, consent_at, outbox_id
  ) values (
    p_org, v_contact, v_lead, v_channel, v_address, v_subject, v_body, 'draft',
    v_token, true, v_consent, now(), v_outbox
  ) returning id into v_request;

  insert into public.crm_outbox (
    id, org_id, lead_id, contact_id, template_key, channel, to_address, subject, body,
    status, purpose, provider, provider_id, error, message_category, scheduled_for
  ) values (
    v_outbox,
    p_org,
    v_lead,
    v_contact,
    'review_request',
    v_channel,
    v_address,
    v_subject,
    v_body,
    'draft',
    'marketing',
    'outbox',
    v_outbox,
    'Review request draft. Nothing was sent.',
    'marketing',
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request,
    'outbox_id', v_outbox,
    'public_token', v_token,
    'status', 'draft',
    'sent', false
  );
end;
$$;

revoke all on function public.public_review_catalog(text) from public, anon, authenticated;
revoke all on function public.submit_public_review(text, integer, text, text) from public, anon, authenticated;
revoke all on function public.create_review_request_draft(uuid, text, text, text, text, text, boolean, text, uuid, text) from public, anon;
revoke all on function public.review_aggregate(uuid) from public, anon;

do $service_grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.public_review_catalog(text) to service_role;
    grant execute on function public.submit_public_review(text, integer, text, text) to service_role;
    grant execute on function public.create_review_request_draft(uuid, text, text, text, text, text, boolean, text, uuid, text) to service_role;
    grant select, insert, update, delete on public.review_templates to service_role;
    grant select, insert, update, delete on public.review_requests to service_role;
    grant select, insert, update, delete on public.reviews to service_role;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.create_review_request_draft(uuid, text, text, text, text, text, boolean, text, uuid, text) to authenticated;
    grant execute on function public.review_aggregate(uuid) to authenticated;
  end if;
end
$service_grant$;

alter table public.review_templates enable row level security;
alter table public.review_templates force row level security;
alter table public.review_requests enable row level security;
alter table public.review_requests force row level security;
alter table public.reviews enable row level security;
alter table public.reviews force row level security;

drop policy if exists review_templates_read on public.review_templates;
create policy review_templates_read on public.review_templates
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists review_templates_insert on public.review_templates;
create policy review_templates_insert on public.review_templates
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists review_templates_update on public.review_templates;
create policy review_templates_update on public.review_templates
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists review_templates_delete on public.review_templates;
create policy review_templates_delete on public.review_templates
  for delete to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists review_requests_read on public.review_requests;
create policy review_requests_read on public.review_requests
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews
  for select to authenticated
  using (org_id in (select public.accessible_org_ids()));

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert to authenticated
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews
  for update to authenticated
  using (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']))
  with check (public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin']));

revoke all on public.review_templates from public, anon;
revoke all on public.review_requests from public, anon;
revoke all on public.reviews from public, anon;
grant select, insert, update, delete on public.review_templates to authenticated;
grant select on public.review_requests to authenticated;
grant select, insert, update on public.reviews to authenticated;
