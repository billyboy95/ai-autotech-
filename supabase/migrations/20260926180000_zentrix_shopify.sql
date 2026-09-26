-- Zentrix Online: the owner's ecommerce workspace under AI AutoTech.
-- Ten niche stores, an ecommerce pipeline, and tables for Shopify orders,
-- customers, and abandoned checkouts. Additive. No Shopify API calls.
-- Requires 20260926160000_agency_tenancy.sql.

insert into organizations (
  id, name, slug, status, org_type, parent_id, legal_name, location, industry,
  primary_color, accent_color, domain, form_key, settings
)
values (
  'b1000000-0000-4000-8000-000000000010',
  'Zentrix Online',
  'zentrix',
  'active',
  'client',
  (select id from organizations where slug = 'ai-autotech'),
  'Zentrix Online',
  'South Africa',
  'Ecommerce',
  '#111827',
  '#16A34A',
  'zentrixonline.co.za',
  'zentrix',
  jsonb_build_object(
    'channels', jsonb_build_object(
      'whatsapp', jsonb_build_object('phoneNumberId', '', 'displayPhone', ''),
      'email', jsonb_build_object('fromAddress', '', 'provider', ''),
      'sms', jsonb_build_object('senderId', '')
    ),
    'shopify', jsonb_build_object(
      'adminAccessToken', '',
      'webhookSecret', '',
      'apiVersion', '2025-01'
    )
  )
)
on conflict (slug) do update set
  name = excluded.name,
  org_type = 'client',
  parent_id = excluded.parent_id,
  legal_name = excluded.legal_name,
  location = excluded.location,
  industry = excluded.industry,
  primary_color = excluded.primary_color,
  accent_color = excluded.accent_color,
  domain = excluded.domain,
  form_key = coalesce(organizations.form_key, excluded.form_key),
  settings = organizations.settings || jsonb_build_object(
    'shopify', coalesce(organizations.settings -> 'shopify', excluded.settings -> 'shopify')
  ),
  updated_at = now();

insert into workspace_pipelines (org_id, name, is_default)
select o.id, 'Ecommerce', true
from organizations o
where o.slug = 'zentrix'
  and not exists (
    select 1 from workspace_pipelines p where p.org_id = o.id and p.name = 'Ecommerce'
  );

insert into workspace_pipeline_stages (org_id, pipeline_id, name, position, is_won, is_lost)
select p.org_id, p.id, stage.name, stage.position, stage.is_won, stage.is_lost
from workspace_pipelines p
join organizations o on o.id = p.org_id and o.slug = 'zentrix'
join (
  values
    ('Visitor/lead', 1, false, false),
    ('Subscriber', 2, false, false),
    ('Cart abandoned', 3, false, false),
    ('Customer', 4, true, false),
    ('Repeat customer', 5, true, false),
    ('Lost', 6, false, true)
) as stage(name, position, is_won, is_lost) on true
where p.name = 'Ecommerce'
  and not exists (
    select 1 from workspace_pipeline_stages s
    where s.pipeline_id = p.id and s.name = stage.name
  );

insert into workspace_templates (org_id, name, channel, body)
select o.id, t.name, t.channel, t.body
from organizations o
join (
  values
    ('Cart reminder', 'email', 'Hi {{name}}, you left something in your cart at {{store}}. It is still waiting if you want it.'),
    ('Welcome subscriber', 'email', 'Hi {{name}}, welcome to {{store}}. We will send the useful offers, not a flood.')
) as t(name, channel, body) on true
where o.slug = 'zentrix'
  and not exists (
    select 1 from workspace_templates existing
    where existing.org_id = o.id and existing.name = t.name
  );

insert into workspace_sequences (org_id, name)
select o.id, 'Abandoned cart'
from organizations o
where o.slug = 'zentrix'
  and not exists (
    select 1 from workspace_sequences s where s.org_id = o.id and s.name = 'Abandoned cart'
  );

insert into workspace_sequence_steps (org_id, sequence_id, position, delay_hours, channel, template_name)
select s.org_id, s.id, step.position, step.delay_hours, step.channel, step.template_name
from workspace_sequences s
join organizations o on o.id = s.org_id and o.slug = 'zentrix'
join (
  values
    (1, 1, 'email', 'Cart reminder'),
    (2, 24, 'email', 'Cart reminder')
) as step(position, delay_hours, channel, template_name) on true
where s.name = 'Abandoned cart'
  and not exists (
    select 1 from workspace_sequence_steps existing
    where existing.sequence_id = s.id and existing.position = step.position
  );

create table if not exists workspace_shopify_stores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  niche text not null,
  name text not null,
  myshopify_domain text not null,
  public_domain text not null,
  plan_status text not null default 'not_connected'
    check (plan_status in ('not_connected', 'credentials_saved')),
  created_at timestamptz not null default now(),
  unique (org_id, niche),
  unique (myshopify_domain)
);

create table if not exists workspace_shopify_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  store_id uuid references workspace_shopify_stores(id) on delete set null,
  shopify_id text not null,
  email text not null default '',
  total_cents integer not null default 0,
  currency text not null default 'ZAR',
  financial_status text not null default '',
  stage text not null default 'Customer',
  counts_as_revenue boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, shopify_id)
);

create table if not exists workspace_shopify_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  store_id uuid references workspace_shopify_stores(id) on delete set null,
  shopify_id text not null,
  email text not null default '',
  created_at timestamptz not null default now(),
  unique (org_id, shopify_id)
);

create table if not exists workspace_shopify_checkouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  store_id uuid references workspace_shopify_stores(id) on delete set null,
  shopify_id text not null,
  email text not null default '',
  total_cents integer not null default 0,
  currency text not null default 'ZAR',
  abandoned boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, shopify_id)
);

alter table workspace_deals add column if not exists external_key text;
do $deal_key$
begin
  alter table workspace_deals
    add constraint workspace_deals_org_external_key unique (org_id, external_key);
exception
  when duplicate_object then
    null;
end
$deal_key$;

select public.attach_org_tenancy('public.workspace_shopify_stores'::regclass);
select public.attach_org_tenancy('public.workspace_shopify_orders'::regclass);
select public.attach_org_tenancy('public.workspace_shopify_customers'::regclass);
select public.attach_org_tenancy('public.workspace_shopify_checkouts'::regclass);

insert into workspace_shopify_stores (org_id, niche, name, myshopify_domain, public_domain, plan_status)
select o.id, store.niche, store.name, store.myshopify_domain, store.public_domain, 'not_connected'
from organizations o
join (
  values
    ('Pets', 'Zentrix Pets', 'zentrix-pets.myshopify.com', 'pets.zentrixonline.co.za'),
    ('Auto', 'Zentrix Auto', 'zentrix-auto.myshopify.com', 'auto.zentrixonline.co.za'),
    ('Kitchens', 'Zentrix Kitchens', 'zentrix-kitchens.myshopify.com', 'kitchens.zentrixonline.co.za'),
    ('Camping', 'Zentrix Camping', 'zentrix-camping.myshopify.com', 'camping.zentrixonline.co.za'),
    ('Holidays', 'Zentrix Holidays', 'zentrix-holidays.myshopify.com', 'holidays.zentrixonline.co.za'),
    ('Home', 'Zentrix Home', 'zentrix-home.myshopify.com', 'home.zentrixonline.co.za'),
    ('Beauty', 'Zentrix Beauty', 'zentrix-beauty.myshopify.com', 'beauty.zentrixonline.co.za'),
    ('Baby', 'Zentrix Baby', 'zentrix-baby.myshopify.com', 'baby.zentrixonline.co.za'),
    ('Fitness', 'Zentrix Fitness', 'zentrix-fitness.myshopify.com', 'fitness.zentrixonline.co.za'),
    ('Tools', 'Zentrix Tools', 'zentrix-tools.myshopify.com', 'tools.zentrixonline.co.za')
) as store(niche, name, myshopify_domain, public_domain) on true
where o.slug = 'zentrix'
on conflict (myshopify_domain) do update set
  name = excluded.name,
  public_domain = excluded.public_domain,
  niche = excluded.niche;
