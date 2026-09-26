-- Agency workspace defaults from the owner's deck: navy #1B3A5C, blue #4A9EDB.
-- Job types gain the sourced service and package names. Older labels stay valid.
-- No prices are stored. Nothing is deleted.

update organizations
set
  primary_color = '#1B3A5C',
  accent_color = '#4A9EDB',
  branding = coalesce(branding, '{}'::jsonb) || jsonb_build_object(
    'primary_color', '#1B3A5C',
    'accent_color', '#4A9EDB',
    'pale', '#BAE6FD',
    'tagline', 'Automate · Innovate · Elevate'
  )
where slug = 'ai-autotech'
  and primary_color = '#0B1F3A'
  and accent_color = '#2563EB';

update organizations
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{channels,whatsapp,displayPhone}',
  to_jsonb('27646863803'::text),
  true
)
where slug = 'ai-autotech'
  and coalesce(settings #>> '{channels,whatsapp,displayPhone}', '') in ('', '27715994283');

do $job_kinds$
declare
  constraint_name text;
begin
  if to_regclass('public.crm_jobs') is null then
    return;
  end if;
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.crm_jobs'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.crm_jobs drop constraint %I', constraint_name);
  end loop;
  alter table public.crm_jobs
    add constraint crm_jobs_kind_check
    check (kind in (
      'Professional Websites',
      'Landing Pages',
      'Sales Funnels',
      'Lead Capture Systems',
      'Brand Identity Starter Kits',
      'Basic Automation Setup',
      'AI AutoTech Upgrade Path',
      'Starter Online Presence',
      'Business Website System',
      'Funnel + Lead Generation System',
      'AI AutoTech Scale Upgrade',
      'Website',
      'WhatsApp',
      'AI Employee',
      'Other'
    ));
end
$job_kinds$;
