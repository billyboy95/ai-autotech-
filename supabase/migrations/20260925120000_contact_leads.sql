-- Website contact form leads (aiautotech.co.za contact section -> POST /api/public/contact).
-- Source of truth for contact enquiries; each real row is mirrored into crm_leads (crm_lead_id) so it
-- shows in the CRM Leads list/pipeline. Test rows: status = 'test' (mirror deleted).
create table if not exists crm_contact_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'won', 'lost', 'test', 'spam')),
  source text not null default 'website_contact',
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  company text not null default '',
  message text not null default '',
  page text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_term text not null default '',
  utm_content text not null default '',
  referrer text not null default '',
  user_agent text not null default '',
  crm_lead_id text
);

create index if not exists crm_contact_leads_created_at_idx on crm_contact_leads (created_at desc);

alter table crm_contact_leads enable row level security;
revoke all on table crm_contact_leads from anon, authenticated;
