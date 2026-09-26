-- Runs after phase 1 migrations dated in September 2026.
-- If those tables are not in this database yet, this file is a no-op.
-- When they exist, every business table gains org_id, an index, and the same
-- agency/client RLS policy used by the company CRM. Rows without an org are
-- placed in the AI AutoTech agency workspace. Nothing is deleted.

do $phase1$
declare
  agency uuid;
  rel text;
begin
  if to_regprocedure('public.attach_org_tenancy(regclass)') is null then
    raise notice 'attach_org_tenancy is missing; apply 20260926160000_agency_tenancy.sql first';
    return;
  end if;

  select id into agency from organizations where slug = 'ai-autotech';

  foreach rel in array array[
    'pipelines',
    'pipeline_stages',
    'deals',
    'messages',
    'message_templates',
    'templates',
    'campaigns',
    'campaign_recipients',
    'sequences',
    'sequence_steps',
    'follow_up_sequences',
    'follow_up_steps',
    'followups',
    'outbox',
    'message_outbox',
    'channel_adapters',
    'channels',
    'assignments',
    'lead_assignments',
    'activities',
    'handovers',
    'automation_rules',
    'crm_lead_activity',
    'crm_message_templates',
    'crm_outbox',
    'crm_automation_settings',
    'crm_handovers',
    'crm_onboarding_tasks',
    'crm_quote_placeholders'
  ]
  loop
    if to_regclass('public.' || rel) is null then
      continue;
    end if;
    perform public.attach_org_tenancy(to_regclass('public.' || rel));
    if agency is not null then
      execute format('update public.%I set org_id = $1 where org_id is null', rel) using agency;
    end if;
  end loop;
end
$phase1$;
