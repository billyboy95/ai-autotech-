-- Services catalogue, service quotes, AIOS membership, and PayFast payment records.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- Service prices are Billy's confirmed ZAR amounts, excluding VAT. From-prices are the quote starting amount.
-- Membership prices match the live site and exclude VAT.
-- This file does not call PayFast and does not send email or WhatsApp.
-- Do not apply this file to production until Billy says yes.

create table if not exists public.service_packages (
  code text primary key,
  name text not null,
  kind text not null check (kind in ('website', 'app', 'marketing', 'addon')),
  summary text not null,
  scope text not null check (cardinality(string_to_array(scope, E'\n')) = 4),
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  billing text not null check (billing in ('once_off', 'month')),
  price_from boolean not null default false,
  support_cents integer check (support_cents is null or support_cents > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.service_packages (
  code, name, kind, summary, scope, price_cents, billing, price_from, support_cents, sort_order
)
values
  (
    'website_starter',
    'Website Starter',
    'website',
    'Small brochure site. R4,500 once-off, excluding VAT.',
    E'One-page or small brochure site\nMobile layout, contact form, and basic SEO\nHandover notes for hosting, domain, and SSL\nOne round of revisions',
    450000,
    'once_off',
    false,
    null,
    1
  ),
  (
    'website_business',
    'Website Business',
    'website',
    'Multi-page business site. R8,950 once-off, excluding VAT.',
    E'Multi-page site for home, services, about, and contact\nLead form wired into the CRM\nMobile layout, basic SEO, and an analytics hookup\nTwo rounds of revisions',
    895000,
    'once_off',
    false,
    null,
    2
  ),
  (
    'website_premium',
    'Website Premium',
    'website',
    'Custom marketing site. Quote starts at R16,500 once-off, excluding VAT.',
    E'Custom marketing site with landing pages\nCRM lead capture, WhatsApp, and booking links\nSEO structure, a speed pass, and analytics\nQuote starts at R16,500 and scales with pages and integrations',
    1650000,
    'once_off',
    true,
    null,
    3
  ),
  (
    'app_mvp',
    'App MVP',
    'app',
    'First usable app. Build starts at R35,000, plus R750 per month support. Excluding VAT.',
    E'One core workflow and a small set of screens\nSign-in, data storage, and a simple admin view\nStaging build and a handover walkthrough\nBuild starts at R35,000. Support is R750 per month',
    3500000,
    'once_off',
    true,
    75000,
    4
  ),
  (
    'app_full',
    'App Full',
    'app',
    'Full app build. Build starts at R85,000, plus R1,500 per month support. Excluding VAT.',
    E'Multi-role app with the agreed workflows\nAdmin, reporting, and the integrations in scope\nStaging, production handover, and training\nBuild starts at R85,000. Support is R1,500 per month',
    8500000,
    'once_off',
    true,
    150000,
    5
  ),
  (
    'marketing_starter',
    'Marketing Starter',
    'marketing',
    'Monthly marketing retainer. R3,950 per month, excluding VAT.',
    E'Monthly content plan and a posting cadence\nOne campaign or offer each month\nBasic reporting on reach and enquiries\nRetainer billed monthly, excluding VAT',
    395000,
    'month',
    false,
    null,
    6
  ),
  (
    'marketing_growth',
    'Marketing Growth',
    'marketing',
    'Larger monthly marketing retainer. R7,500 per month, excluding VAT.',
    E'Content, ads creative, and a monthly offer\nLanding page updates tied to the campaign\nLead follow-up copy and a monthly report\nRetainer billed monthly, excluding VAT',
    750000,
    'month',
    false,
    null,
    7
  ),
  (
    'addon_hosting',
    'Hosting, domain and SSL',
    'addon',
    'Hosting, domain, and SSL add-on. R150 per month, excluding VAT.',
    E'Site hosting on a managed plan\nDomain renewal coordination\nSSL certificate kept current\nBilled monthly, excluding VAT',
    15000,
    'month',
    false,
    null,
    8
  )
on conflict (code) do update set
  name = excluded.name,
  kind = excluded.kind,
  summary = excluded.summary,
  scope = excluded.scope,
  price_cents = excluded.price_cents,
  billing = excluded.billing,
  price_from = excluded.price_from,
  support_cents = excluded.support_cents,
  sort_order = excluded.sort_order;

create table if not exists public.aios_membership_tiers (
  code text primary key,
  name text not null,
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  interval text not null default 'month' check (interval = 'month'),
  prices_exclude_vat boolean not null default true check (prices_exclude_vat),
  price_placeholder boolean not null default false,
  summary text not null,
  sort_order integer not null default 0
);

insert into public.aios_membership_tiers (code, name, price_cents, summary, sort_order, price_placeholder)
values
  ('platform', 'Platform', 29900, 'CRM, Lead Agent, and a small computer-time pool. R299 per month excluding VAT.', 1, false),
  ('agent_starter', 'Agent Starter', 69900, 'Agents from R699 per month excluding VAT. Starter includes 5 hours.', 2, false),
  ('agent_pro', 'Agent Pro', 149900, 'Pro agent. R1,499 per month excluding VAT. 12 hours.', 3, false),
  ('agent_always_on', 'Agent Always-On', 499900, 'Always-On agent. R4,999 per month excluding VAT. 40 active hours.', 4, false)
on conflict (code) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  summary = excluded.summary,
  prices_exclude_vat = true,
  price_placeholder = false,
  sort_order = excluded.sort_order;

create table if not exists public.service_quotes (
  id uuid primary key,
  org_id uuid references public.organizations(id) on delete cascade,
  lead_id text,
  package_code text not null references public.service_packages(code),
  contact_name text not null,
  email text not null,
  phone text not null default '',
  company text not null default '',
  message text not null default '',
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  price_placeholder boolean not null default false,
  status text not null default 'requested' check (status in ('requested', 'accepted', 'paid', 'cancelled')),
  accept_token text not null unique,
  sandbox boolean not null default true,
  accepted_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_quotes_org_idx on public.service_quotes (org_id, created_at desc);
create index if not exists service_quotes_lead_idx on public.service_quotes (lead_id);

create table if not exists public.aios_memberships (
  id uuid primary key,
  org_id uuid references public.organizations(id) on delete set null,
  email text not null,
  contact_name text not null default '',
  tier_code text not null references public.aios_membership_tiers(code),
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'suspended', 'cancelled')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  interval text not null default 'month' check (interval = 'month'),
  prices_exclude_vat boolean not null default true check (prices_exclude_vat),
  provider text not null default 'payfast' check (provider = 'payfast'),
  provider_token text not null default '',
  sandbox boolean not null default true,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aios_memberships_org_idx on public.aios_memberships (org_id, updated_at desc);
create index if not exists aios_memberships_email_idx on public.aios_memberships (lower(email));

create table if not exists public.payfast_payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('service', 'membership')),
  pf_payment_id text not null unique,
  reference_id uuid not null,
  amount_cents integer not null,
  payment_status text not null,
  source_ip text not null default '',
  signature_valid boolean not null default false,
  server_confirmed boolean not null default false,
  sandbox boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payfast_payments_reference_idx on public.payfast_payments (reference_id, created_at desc);

create table if not exists public.membership_upsell_sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  lead_id text not null default '',
  quote_id uuid not null unique references public.service_quotes(id) on delete cascade,
  status text not null default 'draft' check (status = 'draft'),
  created_at timestamptz not null default now()
);

create table if not exists public.membership_upsell_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  sequence_id uuid not null references public.membership_upsell_sequences(id) on delete cascade,
  lead_id text not null default '',
  step text not null check (step in ('day0', 'day2', 'day5')),
  channel text not null check (channel in ('email', 'whatsapp')),
  status text not null default 'draft' check (status = 'draft'),
  subject text not null default '',
  body text not null,
  dedupe_key text not null,
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now(),
  constraint membership_upsell_drafts_dedupe unique (sequence_id, dedupe_key),
  constraint membership_upsell_drafts_body_check check (length(body) <= 4000)
);

do $$
declare
  r record;
begin
  if to_regclass('public.crm_leads') is null then
    return;
  end if;
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'crm_leads'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%stage%'
  loop
    execute format('alter table public.crm_leads drop constraint %I', r.conname);
  end loop;
  alter table public.crm_leads add constraint crm_leads_stage_check check (
    stage in (
      'New',
      'Contacted',
      'Audit booked',
      'Audit done',
      'Proposal sent',
      'Won',
      'Lost',
      'Onboarding/Handover',
      'membership upsell'
    )
  );
end $$;

do $seed_stage$
begin
  if to_regclass('public.pipeline_stages') is null or to_regclass('public.pipelines') is null then
    return;
  end if;
  insert into public.pipeline_stages (org_id, pipeline_id, asset_key, name, position, is_won, is_lost)
  select
    p.org_id,
    p.id,
    'stage:sales:membership-upsell',
    'membership upsell',
    coalesce((select max(s.position) from public.pipeline_stages s where s.pipeline_id = p.id), 0) + 1,
    false,
    false
  from public.pipelines p
  join public.organizations o on o.id = p.org_id
  where o.slug in ('ai-autotech', 'aiautotech')
    and p.is_default = true
    and not exists (
      select 1 from public.pipeline_stages existing
      where existing.org_id = p.org_id
        and existing.asset_key = 'stage:sales:membership-upsell'
    );
end
$seed_stage$;

do $seed_sequence$
declare
  org uuid;
  sequence_id uuid;
begin
  if to_regclass('public.sequences') is null or to_regclass('public.message_templates') is null then
    return;
  end if;
  for org in
    select id from public.organizations where slug in ('ai-autotech', 'aiautotech')
  loop
    insert into public.message_templates (org_id, asset_key, channel, name, subject, body, active)
    values (
      org,
      'template:membership-upsell:email',
      'email',
      'Membership upsell',
      'AIOS membership after your project',
      'Hi there, it is AI AutoTech. The platform is R299 per month. Agents start from R699 per month. Prices exclude VAT. Questions: Willem@aiautotech.co.za. This note is a draft. It has not been sent.',
      false
    )
    on conflict (org_id, asset_key) do nothing;

    insert into public.sequences (org_id, asset_key, name, active)
    values (org, 'sequence:membership-upsell', 'Membership upsell', false)
    on conflict (org_id, asset_key) do update set active = false
    returning id into sequence_id;

    if sequence_id is null then
      select id into sequence_id
      from public.sequences
      where org_id = org and asset_key = 'sequence:membership-upsell';
    end if;

    insert into public.sequence_steps (org_id, sequence_id, asset_key, position, delay_hours, channel, template_asset_key)
    values
      (org, sequence_id, 'step:membership-upsell:day0', 1, 0, 'email', 'template:membership-upsell:email'),
      (org, sequence_id, 'step:membership-upsell:day2', 2, 48, 'email', 'template:membership-upsell:email'),
      (org, sequence_id, 'step:membership-upsell:day5', 3, 120, 'email', 'template:membership-upsell:email')
    on conflict (org_id, asset_key) do nothing;
  end loop;
end
$seed_sequence$;

create or replace function public.create_service_enquiry(
  p_org uuid,
  p_lead_id text,
  p_quote_id uuid,
  p_token text,
  p_package text,
  p_name text,
  p_email text,
  p_phone text,
  p_company text,
  p_message text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pack public.service_packages%rowtype;
  org uuid := p_org;
  stage_id uuid;
begin
  if p_token !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'sent', false, 'error', 'Quote token was rejected.');
  end if;
  if btrim(coalesce(p_name, '')) = '' or position('@' in coalesce(p_email, '')) = 0 then
    return jsonb_build_object('ok', false, 'sent', false, 'error', 'Name and email are required.');
  end if;
  select * into pack from public.service_packages where code = p_package and active = true;
  if pack.code is null then
    return jsonb_build_object('ok', false, 'sent', false, 'error', 'Choose a website, app, marketing, or hosting package.');
  end if;
  if org is null then
    select id into org from public.organizations where slug = 'ai-autotech' limit 1;
  end if;

  if to_regclass('public.pipeline_stages') is not null and org is not null then
    select id into stage_id
    from public.pipeline_stages
    where org_id = org and name = 'New'
    order by position
    limit 1;
  end if;

  insert into public.crm_leads (
    id, org_id, name, company, phone, email, stage, stage_id, notes, source, ord, marketing_consent, enrolled
  ) values (
    p_lead_id,
    org,
    btrim(p_name),
    btrim(coalesce(p_company, '')),
    btrim(coalesce(p_phone, '')),
    lower(btrim(p_email)),
    'New',
    stage_id,
    concat_ws(E'\n',
      'Service quote request',
      'Package: ' || pack.name || ' (' || pack.code || ')',
      'Quote starts at ' || pack.price_cents || ' cents ZAR excluding VAT.',
      pack.scope,
      'Email: ' || lower(btrim(p_email)),
      nullif(btrim(coalesce(p_message, '')), '')
    ),
    'service_enquiry',
    -floor(extract(epoch from now()))::integer,
    false,
    false
  );

  insert into public.service_quotes (
    id, org_id, lead_id, package_code, contact_name, email, phone, company, message,
    amount_cents, price_placeholder, status, accept_token, sandbox
  ) values (
    p_quote_id,
    org,
    p_lead_id,
    pack.code,
    btrim(p_name),
    lower(btrim(p_email)),
    btrim(coalesce(p_phone, '')),
    btrim(coalesce(p_company, '')),
    left(btrim(coalesce(p_message, '')), 3000),
    pack.price_cents,
    false,
    'requested',
    p_token,
    true
  );

  return jsonb_build_object(
    'ok', true,
    'sent', false,
    'charged', false,
    'quote_id', p_quote_id,
    'lead_id', p_lead_id,
    'token', p_token,
    'amount_cents', pack.price_cents,
    'price_placeholder', false
  );
end;
$$;

create or replace function public.apply_income_payment(
  p_kind text,
  p_pf_payment_id text,
  p_payment_status text,
  p_amount_cents integer,
  p_reference uuid,
  p_source_ip text,
  p_sandbox boolean,
  p_token text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
  quote public.service_quotes%rowtype;
  member public.aios_memberships%rowtype;
  sequence_id uuid;
  upsell_stage_id uuid;
  drafted boolean := false;
  payment_status text := upper(btrim(coalesce(p_payment_status, '')));
  price_line text := 'The platform is R299 per month. Agents start from R699 per month. Prices exclude VAT.';
begin
  if p_kind not in ('service', 'membership') or btrim(coalesce(p_pf_payment_id, '')) = '' then
    return jsonb_build_object('ok', false, 'sent', false, 'charged', false, 'error', 'Payment reference was rejected.');
  end if;
  if payment_status not in ('COMPLETE', 'FAILED', 'CANCELLED', 'PENDING') then
    return jsonb_build_object('ok', false, 'sent', false, 'charged', false, 'error', 'Payment status was rejected.');
  end if;

  if p_kind = 'service' then
    select * into quote from public.service_quotes where id = p_reference;
    if quote.id is null then
      return jsonb_build_object('ok', false, 'sent', false, 'charged', false, 'error', 'Quote was not found.');
    end if;
    if quote.amount_cents <> p_amount_cents then
      return jsonb_build_object('ok', false, 'sent', false, 'charged', false, 'error', 'Amount does not match the quote.');
    end if;
  else
    select * into member from public.aios_memberships where id = p_reference;
    if member.id is null then
      return jsonb_build_object('ok', false, 'sent', false, 'charged', false, 'error', 'Membership was not found.');
    end if;
    if member.amount_cents <> p_amount_cents then
      return jsonb_build_object('ok', false, 'sent', false, 'charged', false, 'error', 'Amount does not match the membership.');
    end if;
  end if;

  insert into public.payfast_payments (
    kind, pf_payment_id, reference_id, amount_cents, payment_status, source_ip,
    signature_valid, server_confirmed, sandbox, payload
  ) values (
    p_kind,
    p_pf_payment_id,
    p_reference,
    p_amount_cents,
    payment_status,
    left(coalesce(p_source_ip, ''), 80),
    true,
    true,
    coalesce(p_sandbox, true),
    coalesce(p_payload, '{}'::jsonb) - 'merchant_key' - 'passphrase' - 'signature'
  )
  on conflict (pf_payment_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('ok', true, 'duplicate', true, 'sent', false, 'queued', false, 'charged', false, 'drafted', false);
  end if;

  if p_kind = 'membership' then
    update public.aios_memberships
    set
      status = case payment_status
        when 'COMPLETE' then 'active'
        when 'FAILED' then 'past_due'
        when 'CANCELLED' then 'cancelled'
        else status
      end,
      provider_token = case when payment_status = 'COMPLETE' and btrim(coalesce(p_token, '')) <> '' then left(p_token, 200) else provider_token end,
      current_period_end = case when payment_status = 'COMPLETE' then now() + interval '1 month' else current_period_end end,
      sandbox = coalesce(p_sandbox, sandbox),
      updated_at = now()
    where id = p_reference;
  elsif payment_status = 'COMPLETE' then
    update public.service_quotes
    set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = p_reference;

    if quote.lead_id is not null and quote.lead_id <> '' and to_regclass('public.crm_leads') is not null then
      if to_regclass('public.pipeline_stages') is not null and quote.org_id is not null then
        select id into upsell_stage_id
        from public.pipeline_stages
        where org_id = quote.org_id and name = 'membership upsell'
        order by position
        limit 1;
      end if;
      update public.crm_leads
      set
        stage = 'membership upsell',
        stage_changed_at = now(),
        stage_id = coalesce(upsell_stage_id, stage_id),
        updated_at = now()
      where id = quote.lead_id;
    end if;

    insert into public.membership_upsell_sequences (org_id, lead_id, quote_id, status)
    values (quote.org_id, coalesce(quote.lead_id, ''), quote.id, 'draft')
    on conflict (quote_id) do nothing
    returning id into sequence_id;
    if sequence_id is null then
      select id into sequence_id from public.membership_upsell_sequences where quote_id = quote.id;
    end if;

    insert into public.membership_upsell_drafts (
      org_id, sequence_id, lead_id, step, channel, status, subject, body, dedupe_key, scheduled_for
    )
    select
      quote.org_id,
      sequence_id,
      coalesce(quote.lead_id, ''),
      step.step,
      'email',
      'draft',
      'AIOS membership after your project',
      concat(
        'Hi ', split_part(quote.contact_name, ' ', 1), ', it is AI AutoTech. Your ', quote.package_code, ' payment is in. ',
        price_line,
        ' Membership: https://aiautotech.co.za/membership. Questions: Willem@aiautotech.co.za. This note is a draft. It has not been sent.'
      ),
      'upsell:' || quote.id::text || ':' || step.step || ':email',
      now() + make_interval(days => step.days)
    from (values ('day0', 0), ('day2', 2), ('day5', 5)) as step(step, days)
    on conflict (sequence_id, dedupe_key) do nothing;

    if btrim(quote.phone) <> '' then
      insert into public.membership_upsell_drafts (
        org_id, sequence_id, lead_id, step, channel, status, subject, body, dedupe_key, scheduled_for
      )
      select
        quote.org_id,
        sequence_id,
        coalesce(quote.lead_id, ''),
        step.step,
        'whatsapp',
        'draft',
        '',
        concat(
          'Hi ', split_part(quote.contact_name, ' ', 1), '. ',
          price_line,
          ' https://aiautotech.co.za/membership. Willem@aiautotech.co.za. This note is a draft. It has not been sent.'
        ),
        'upsell:' || quote.id::text || ':' || step.step || ':whatsapp',
        now() + make_interval(days => step.days)
      from (values ('day0', 0), ('day2', 2), ('day5', 5)) as step(step, days)
      on conflict (sequence_id, dedupe_key) do nothing;
    end if;
    drafted := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'sent', false,
    'queued', false,
    'charged', false,
    'drafted', drafted,
    'stage', case when drafted then 'membership upsell' else '' end,
    'sandbox', coalesce(p_sandbox, true)
  );
end;
$$;

create or replace function public.start_aios_membership(
  p_id uuid,
  p_org uuid,
  p_email text,
  p_name text,
  p_tier text,
  p_sandbox boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tier public.aios_membership_tiers%rowtype;
begin
  if position('@' in coalesce(p_email, '')) = 0 then
    return jsonb_build_object('ok', false, 'sent', false, 'charged', false, 'error', 'Email is required.');
  end if;
  select * into tier from public.aios_membership_tiers where code = p_tier;
  if tier.code is null then
    return jsonb_build_object('ok', false, 'sent', false, 'charged', false, 'error', 'Choose a membership tier.');
  end if;
  if tier.prices_exclude_vat is distinct from true then
    return jsonb_build_object('ok', false, 'sent', false, 'charged', false, 'error', 'Membership prices exclude VAT.');
  end if;
  insert into public.aios_memberships (
    id, org_id, email, contact_name, tier_code, status, amount_cents, prices_exclude_vat, sandbox
  ) values (
    p_id,
    p_org,
    lower(btrim(p_email)),
    btrim(coalesce(p_name, '')),
    tier.code,
    'pending',
    tier.price_cents,
    true,
    coalesce(p_sandbox, true)
  );
  return jsonb_build_object(
    'ok', true,
    'sent', false,
    'charged', false,
    'membership_id', p_id,
    'amount_cents', tier.price_cents,
    'status', 'pending',
    'prices_exclude_vat', true,
    'sandbox', coalesce(p_sandbox, true)
  );
end;
$$;

revoke all on function public.create_service_enquiry(uuid, text, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.apply_income_payment(text, text, text, integer, uuid, text, boolean, text, jsonb) from public, anon, authenticated;
revoke all on function public.start_aios_membership(uuid, uuid, text, text, text, boolean) from public, anon, authenticated;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.create_service_enquiry(uuid, text, uuid, text, text, text, text, text, text, text) to service_role;
    grant execute on function public.apply_income_payment(text, text, text, integer, uuid, text, boolean, text, jsonb) to service_role;
    grant execute on function public.start_aios_membership(uuid, uuid, text, text, text, boolean) to service_role;
    grant select, insert, update, delete on
      public.service_packages,
      public.service_quotes,
      public.aios_membership_tiers,
      public.aios_memberships,
      public.payfast_payments,
      public.membership_upsell_sequences,
      public.membership_upsell_drafts
    to service_role;
  end if;
end
$grants$;

alter table public.service_packages enable row level security;
alter table public.service_quotes enable row level security;
alter table public.aios_membership_tiers enable row level security;
alter table public.aios_memberships enable row level security;
alter table public.payfast_payments enable row level security;
alter table public.membership_upsell_sequences enable row level security;
alter table public.membership_upsell_drafts enable row level security;

alter table public.service_packages force row level security;
alter table public.service_quotes force row level security;
alter table public.aios_membership_tiers force row level security;
alter table public.aios_memberships force row level security;
alter table public.payfast_payments force row level security;
alter table public.membership_upsell_sequences force row level security;
alter table public.membership_upsell_drafts force row level security;

drop policy if exists service_packages_read on public.service_packages;
create policy service_packages_read on public.service_packages
  for select to authenticated
  using (true);

drop policy if exists aios_membership_tiers_read on public.aios_membership_tiers;
create policy aios_membership_tiers_read on public.aios_membership_tiers
  for select to authenticated
  using (true);

drop policy if exists service_quotes_read on public.service_quotes;
create policy service_quotes_read on public.service_quotes
  for select to authenticated
  using (
    org_id is not null
    and org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

drop policy if exists aios_memberships_read on public.aios_memberships;
create policy aios_memberships_read on public.aios_memberships
  for select to authenticated
  using (
    org_id is not null
    and org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff', 'client_admin'])
  );

drop policy if exists payfast_payments_read on public.payfast_payments;
create policy payfast_payments_read on public.payfast_payments
  for select to authenticated
  using (
    exists (
      select 1
      from public.service_quotes quote
      where quote.id = payfast_payments.reference_id
        and quote.org_id in (select public.accessible_org_ids())
        and public.has_org_role(quote.org_id, array['agency_owner', 'agency_staff'])
    )
    or exists (
      select 1
      from public.aios_memberships member
      where member.id = payfast_payments.reference_id
        and member.org_id in (select public.accessible_org_ids())
        and public.has_org_role(member.org_id, array['agency_owner', 'agency_staff', 'client_admin'])
    )
  );

drop policy if exists membership_upsell_sequences_read on public.membership_upsell_sequences;
create policy membership_upsell_sequences_read on public.membership_upsell_sequences
  for select to authenticated
  using (
    org_id is not null
    and org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

drop policy if exists membership_upsell_drafts_read on public.membership_upsell_drafts;
create policy membership_upsell_drafts_read on public.membership_upsell_drafts
  for select to authenticated
  using (
    org_id is not null
    and org_id in (select public.accessible_org_ids())
    and public.has_org_role(org_id, array['agency_owner', 'agency_staff'])
  );

revoke all on public.service_packages from anon, authenticated;
revoke all on public.service_quotes from anon, authenticated;
revoke all on public.aios_membership_tiers from anon, authenticated;
revoke all on public.aios_memberships from anon, authenticated;
revoke all on public.payfast_payments from anon, authenticated;
revoke all on public.membership_upsell_sequences from anon, authenticated;
revoke all on public.membership_upsell_drafts from anon, authenticated;

grant select on public.service_packages to authenticated;
grant select on public.aios_membership_tiers to authenticated;
grant select on public.service_quotes to authenticated;
grant select on public.aios_memberships to authenticated;
grant select (
  id, kind, pf_payment_id, reference_id, amount_cents, payment_status, sandbox, created_at
) on public.payfast_payments to authenticated;
grant select on public.membership_upsell_sequences to authenticated;
grant select on public.membership_upsell_drafts to authenticated;
