-- WhatsApp inbound-lead auto-responder (Cloud API webhook + CRM simulator).
-- New tables only. Nothing here alters existing CRM tables.
-- One row per WhatsApp number (or simulator session). Test rows (simulator / WHATSAPP_TEST_NUMBERS):
-- status = 'test', is_test = true, and they are never mirrored into crm_leads.
create table if not exists crm_whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  wa_id text not null unique,                      -- E.164 digits (27...) or 'sim:<uuid>' for the simulator
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'simulator')),
  source text not null default 'whatsapp',
  profile_name text not null default '',
  status text not null default 'active'
    check (status in ('active', 'handover', 'opted_out', 'closed', 'test')),
  is_test boolean not null default false,
  bot_paused_until timestamptz,                    -- no auto-replies before this time (handover / Billy replied)
  handover_reason text not null default '',
  handover_at timestamptz,
  needs_attention boolean not null default false,  -- CRM flag: Billy should look at this thread
  opted_out boolean not null default false,
  opted_out_at timestamptz,
  lead jsonb not null default '{}'::jsonb,         -- name, business, industry, pain, budget, timeline, email
  crm_lead_id text,                                -- crm_leads.id once a name or business is known (real leads only)
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  message_count integer not null default 0
);

create index if not exists crm_whatsapp_conversations_updated_idx on crm_whatsapp_conversations (updated_at desc);
create index if not exists crm_whatsapp_conversations_attention_idx on crm_whatsapp_conversations (needs_attention) where needs_attention;

create table if not exists crm_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid not null references crm_whatsapp_conversations (id) on delete cascade,
  wa_message_id text unique,                       -- Meta message id (idempotency); null for simulator bot rows
  direction text not null check (direction in ('in', 'out')),
  author text not null default 'lead' check (author in ('lead', 'bot', 'billy', 'system')),
  type text not null default 'text',               -- text, audio, image, document, video, sticker, location, ...
  body text not null default '',
  media_id text,
  status text not null default '',                 -- sent / failed / skipped
  meta jsonb not null default '{}'::jsonb
);

create index if not exists crm_whatsapp_messages_conv_idx on crm_whatsapp_messages (conversation_id, created_at);

alter table crm_whatsapp_conversations enable row level security;
alter table crm_whatsapp_messages enable row level security;
revoke all on table crm_whatsapp_conversations from anon, authenticated;
revoke all on table crm_whatsapp_messages from anon, authenticated;
