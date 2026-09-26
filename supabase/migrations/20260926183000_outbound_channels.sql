-- Outbound SMS, social queue, tracked clicks, and prospect campaigns.
-- Additive. Does not delete leads. Run after 20260926160000_crm_automation.sql.

alter table crm_leads add column if not exists utm_source text not null default '';

alter table crm_outbox add column if not exists prospect_id text;
alter table crm_outbox alter column lead_id drop not null;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'crm_outbox'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%channel%'
  loop
    execute format('alter table crm_outbox drop constraint %I', constraint_name);
  end loop;
end $$;

alter table crm_outbox
  add constraint crm_outbox_channel_check check (channel in ('whatsapp', 'email', 'sms'));

create table if not exists crm_social_posts (
  id text primary key,
  platform text not null check (platform in ('facebook', 'instagram', 'linkedin')),
  body text not null default '',
  media_url text not null default '',
  link_url text not null default '',
  scheduled_for timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'approved', 'published', 'failed', 'cancelled')),
  utm_source text not null default '',
  utm_campaign text not null default '',
  copy_text text not null default '',
  provider text not null default '',
  provider_id text not null default '',
  error text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists crm_social_posts_schedule_idx on crm_social_posts (status, scheduled_for);

create table if not exists crm_social_clicks (
  id text primary key,
  post_id text,
  utm_source text not null default '',
  utm_campaign text not null default '',
  utm_medium text not null default '',
  destination text not null default '',
  lead_id text,
  created_at timestamptz not null default now()
);

create index if not exists crm_social_clicks_campaign_idx on crm_social_clicks (utm_campaign, created_at);

create table if not exists crm_campaigns (
  id text primary key,
  name text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'paused')),
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists crm_prospects (
  id text primary key,
  campaign_id text not null,
  name text not null default '',
  business text not null default '',
  niche text not null default '',
  website text not null default '',
  phone text not null default '',
  email text not null default '',
  opening_line text not null default '',
  status text not null default 'in_sequence' check (status in ('queued', 'in_sequence', 'replied', 'booked', 'stopped')),
  step_index integer not null default 0,
  lead_id text,
  touches jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_prospects_campaign_idx on crm_prospects (campaign_id, created_at);
create index if not exists crm_prospects_email_idx on crm_prospects (email);

alter table crm_social_posts enable row level security;
alter table crm_social_clicks enable row level security;
alter table crm_campaigns enable row level security;
alter table crm_prospects enable row level security;

revoke all on table crm_social_posts from anon, authenticated;
revoke all on table crm_social_clicks from anon, authenticated;
revoke all on table crm_campaigns from anon, authenticated;
revoke all on table crm_prospects from anon, authenticated;
