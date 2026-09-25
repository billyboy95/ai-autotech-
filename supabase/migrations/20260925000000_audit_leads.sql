-- Event / QR AI business audit leads (aiautotech.co.za/connect -> /audit).
create table if not exists crm_audit_leads (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  created_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'booked', 'won', 'lost', 'test', 'spam')),
  first_name text not null default '',
  last_name text not null default '',
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  role text not null default '',
  website text not null default '',
  industry text not null default '',
  answers jsonb not null default '{}'::jsonb,
  score jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  recommended_agents jsonb not null default '[]'::jsonb,
  source text not null default '',
  campaign text not null default '',
  event text not null default '',
  qr_source text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_term text not null default '',
  utm_content text not null default '',
  referrer text not null default '',
  user_agent text not null default '',
  consent boolean not null default false,
  consent_text text not null default '',
  crm_lead_id text
);

create index if not exists crm_audit_leads_created_at_idx on crm_audit_leads (created_at desc);
create index if not exists crm_audit_leads_campaign_idx on crm_audit_leads (campaign);

alter table crm_audit_leads enable row level security;
revoke all on table crm_audit_leads from anon, authenticated;
