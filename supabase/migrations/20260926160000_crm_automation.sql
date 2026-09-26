-- Automated CRM pipeline for AI AutoTech Pty Ltd.
-- Additive: does not delete leads. Remaps legacy crm_leads stages
-- Talking -> Contacted and Quoted -> Proposal sent.
-- Apply in the Supabase SQL editor after the earlier crm_* migrations.

alter table crm_leads add column if not exists email text not null default '';
alter table crm_leads add column if not exists whatsapp text not null default '';
alter table crm_leads add column if not exists source text not null default '';
alter table crm_leads add column if not exists qr_source text not null default '';
alter table crm_leads add column if not exists campaign text not null default '';
alter table crm_leads add column if not exists event_name text not null default '';
alter table crm_leads add column if not exists owner_name text not null default '';
alter table crm_leads add column if not exists score integer not null default 0;
alter table crm_leads add column if not exists score_reasons jsonb not null default '[]'::jsonb;
alter table crm_leads add column if not exists company_size text not null default '';
alter table crm_leads add column if not exists website text not null default '';
alter table crm_leads add column if not exists industry text not null default '';
alter table crm_leads add column if not exists answers jsonb not null default '{}'::jsonb;
alter table crm_leads add column if not exists value_zar numeric(12,2) not null default 0;
alter table crm_leads add column if not exists booked_at timestamptz;
alter table crm_leads add column if not exists audit_done_at timestamptz;
alter table crm_leads add column if not exists proposal_sent_at timestamptz;
alter table crm_leads add column if not exists stage_changed_at timestamptz not null default now();
alter table crm_leads add column if not exists sequence_step integer not null default 0;
alter table crm_leads add column if not exists lost_reason text not null default '';
alter table crm_leads add column if not exists won_at timestamptz;
alter table crm_leads add column if not exists replied_at timestamptz;
alter table crm_leads add column if not exists enrolled boolean not null default false;
alter table crm_leads add column if not exists audit_lead_id uuid;
alter table crm_leads add column if not exists contact_lead_id uuid;

update crm_leads set stage = 'Contacted' where stage = 'Talking';
update crm_leads set stage = 'Proposal sent' where stage = 'Quoted';
update crm_leads set stage_changed_at = coalesce(updated_at, created_at, now()) where stage_changed_at is null;

do $$
declare r record;
begin
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
    execute format('alter table crm_leads drop constraint %I', r.conname);
  end loop;
end $$;

alter table crm_leads add constraint crm_leads_stage_check check (
  stage in (
    'New',
    'Contacted',
    'Audit booked',
    'Audit done',
    'Proposal sent',
    'Won',
    'Lost',
    'Onboarding/Handover'
  )
);

create index if not exists crm_leads_stage_idx on crm_leads (stage);
create index if not exists crm_leads_owner_idx on crm_leads (owner_name);
create index if not exists crm_leads_score_idx on crm_leads (score desc);

create table if not exists crm_lead_activity (
  id text primary key,
  lead_id text not null references crm_leads(id) on delete cascade,
  kind text not null,
  title text not null default '',
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crm_lead_activity_lead_idx on crm_lead_activity (lead_id, created_at);

create table if not exists crm_message_templates (
  key text primary key,
  channel text not null check (channel in ('whatsapp', 'email')),
  name text not null,
  subject text not null default '',
  body text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists crm_outbox (
  id text primary key,
  lead_id text not null references crm_leads(id) on delete cascade,
  template_key text not null default '',
  channel text not null check (channel in ('whatsapp', 'email')),
  to_address text not null default '',
  subject text not null default '',
  body text not null default '',
  status text not null default 'queued' check (status in ('queued', 'approved', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  provider text not null default '',
  provider_id text not null default '',
  error text not null default '',
  wa_link text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists crm_outbox_lead_idx on crm_outbox (lead_id, scheduled_for);
create index if not exists crm_outbox_status_idx on crm_outbox (status, scheduled_for);

create table if not exists crm_automation_settings (
  id text primary key default 'default',
  default_owner text not null default 'Billy',
  strategy text not null default 'fixed' check (strategy in ('fixed', 'round_robin')),
  team text[] not null default array['Billy'],
  round_robin_index integer not null default 0,
  booking_url text not null default '',
  proposal_followup_days integer not null default 3,
  stale_grace_days integer not null default 2,
  stuck_after_days integer not null default 3,
  checklist jsonb not null default '[]'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists crm_handovers (
  id text primary key,
  lead_id text not null references crm_leads(id) on delete cascade,
  delivered_by text not null default '',
  what_sold text not null default '',
  value_zar numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists crm_onboarding_tasks (
  id text primary key,
  lead_id text not null references crm_leads(id) on delete cascade,
  handover_id text,
  title text not null,
  done boolean not null default false,
  ord integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists crm_quote_placeholders (
  id text primary key,
  lead_id text not null references crm_leads(id) on delete cascade,
  handover_id text,
  kind text not null default 'quote' check (kind in ('quote', 'invoice')),
  reference text not null,
  description text not null default '',
  amount_zar numeric(12,2) not null default 0,
  status text not null default 'Draft',
  created_at timestamptz not null default now()
);

alter table crm_lead_activity enable row level security;
alter table crm_message_templates enable row level security;
alter table crm_outbox enable row level security;
alter table crm_automation_settings enable row level security;
alter table crm_handovers enable row level security;
alter table crm_onboarding_tasks enable row level security;
alter table crm_quote_placeholders enable row level security;

revoke all on table crm_lead_activity from anon, authenticated;
revoke all on table crm_message_templates from anon, authenticated;
revoke all on table crm_outbox from anon, authenticated;
revoke all on table crm_automation_settings from anon, authenticated;
revoke all on table crm_handovers from anon, authenticated;
revoke all on table crm_onboarding_tasks from anon, authenticated;
revoke all on table crm_quote_placeholders from anon, authenticated;

insert into crm_automation_settings (
  id, default_owner, strategy, team, booking_url, proposal_followup_days, stale_grace_days, stuck_after_days, checklist, rules
) values (
  'default',
  'Billy',
  'fixed',
  array['Billy'],
  '',
  3,
  2,
  3,
  '[
    "Confirm what was sold and how we will know it worked",
    "Introduce the person who will deliver the work",
    "Collect WhatsApp, website, and inbox access",
    "Book the kickoff call",
    "Send the draft quote or invoice for acceptance"
  ]'::jsonb,
  '[
    {
      "id": "qr-billy",
      "name": "Billy''s phone QR",
      "active": true,
      "matchSource": "",
      "matchQrSource": "billy_phone_qr",
      "owner": "Billy"
    }
  ]'::jsonb
)
on conflict (id) do nothing;

insert into crm_message_templates (key, channel, name, subject, body) values
  ('ack_whatsapp', 'whatsapp', 'Instant acknowledgement (WhatsApp)', '',
   E'Hi {{firstName}}, it''s Billy from AI AutoTech. Thanks for getting in touch about {{company}}. I''ve got your details and I''ll look at where automation can take work off your team.\n\nBook a short audit here: {{bookingUrl}}\n\nIf the link is awkward, just reply and I''ll send times.'),
  ('ack_email', 'email', 'Instant acknowledgement (email)', '{{company}} — we have your details',
   E'Hi {{firstName}},\n\nBilly here from AI AutoTech. Thanks for reaching out about {{company}}. I''ve received it and I''ll review where an AI employee or a cleaner follow-up process would help.\n\nBook a 20-minute audit: {{bookingUrl}}\n\nIf none of those times work, reply to this email and I''ll fit around you.\n\nBilly\nAI AutoTech Pty Ltd'),
  ('nudge_day1_whatsapp', 'whatsapp', 'Day 1 nudge (WhatsApp)', '',
   E'Hi {{firstName}}, Billy again. Just checking my note about {{company}} landed. The usual first win is WhatsApp and lead follow-up, so nothing sits unanswered.\n\nHere''s the booking link: {{bookingUrl}}'),
  ('nudge_day1_email', 'email', 'Day 1 nudge (email)', 'Quick follow-up for {{company}}',
   E'Hi {{firstName}},\n\nChecking you saw my note about {{company}}. If you want the audit, here is the link again: {{bookingUrl}}\n\nBilly\nAI AutoTech Pty Ltd'),
  ('nudge_day3_whatsapp', 'whatsapp', 'Day 3 nudge (WhatsApp)', '',
   E'Hi {{firstName}}, a short nudge from AI AutoTech. Teams that book the audit this week usually want the inbox and follow-up handled for them. 20 minutes with me: {{bookingUrl}}'),
  ('nudge_day3_email', 'email', 'Day 3 nudge (email)', 'Still worth a look for {{company}}?',
   E'Hi {{firstName}},\n\nStill happy to walk through {{company}} whenever it suits you. Booking link: {{bookingUrl}}\n\nBilly\nAI AutoTech Pty Ltd'),
  ('nudge_day7_whatsapp', 'whatsapp', 'Day 7 nudge (WhatsApp)', '',
   E'Hi {{firstName}}, last note from me on {{company}} unless you want to pick it up. I won''t keep pinging you. Reply "later" if the timing is off, or book here: {{bookingUrl}}'),
  ('nudge_day7_email', 'email', 'Day 7 nudge (email)', 'Last note on the {{company}} audit',
   E'Hi {{firstName}},\n\nThis is my last follow-up on {{company}}. If you want the audit, book here: {{bookingUrl}}. If now is the wrong time, reply "later" and I''ll leave it.\n\nBilly\nAI AutoTech Pty Ltd'),
  ('audit_reminder_whatsapp', 'whatsapp', 'Audit reminder (WhatsApp)', '',
   E'Hi {{firstName}}, reminder from Billy at AI AutoTech. Your audit for {{company}} is coming up{{when}}. Reply if you need to move it.'),
  ('audit_reminder_email', 'email', 'Audit reminder (email)', 'Reminder: {{company}} audit',
   E'Hi {{firstName}},\n\nYour AI AutoTech audit for {{company}} is coming up{{when}}. Reply if you need a different time.\n\nBilly\nAI AutoTech Pty Ltd'),
  ('proposal_followup_whatsapp', 'whatsapp', 'Proposal follow-up (WhatsApp)', '',
   E'Hi {{firstName}}, Billy from AI AutoTech. The proposal for {{company}} has been with you for a few days. Happy to walk through the price and what we deliver. Reply here, or book: {{bookingUrl}}'),
  ('proposal_followup_email', 'email', 'Proposal follow-up (email)', 'Following up on the {{company}} proposal',
   E'Hi {{firstName}},\n\nChecking in on the proposal for {{company}}. I can walk through the price and the handover whenever you''re ready.\n\nBilly\nAI AutoTech Pty Ltd')
on conflict (key) do nothing;
