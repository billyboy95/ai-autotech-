-- Phase 4d: one-click Education pack for the existing EASTC client workspace.
-- Additive. No tenant rows are deleted. sending_enabled is not turned on.
-- This file does not apply the pack. After it is on the database, an agency
-- owner or staff member uses Apply Education pack to EASTC in the app.
-- Contacts, messages, secrets, and outbox rows are not copied.
-- Leave AI_REPLY_CRON_ENABLED unset. Do not turn sending on.

do $need$
begin
  if to_regprocedure('public.snapshot_apply(uuid, uuid)') is null then
    raise exception 'snapshot_apply is missing; apply phase 2c first';
  end if;
  if to_regprocedure('public.snapshot_write_workflow(uuid, jsonb, boolean)') is null then
    raise exception 'snapshot_write_workflow is missing; apply phase 2d first';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'has_org_role is missing; apply phase 2a first';
  end if;
end
$need$;

-- The phase 2c seed stored pipelines, templates, sequences, and custom fields.
-- The TypeScript Education payload also has one inactive admissions workflow.
-- Add that workflow to the seeded snapshot when it is missing. Re-running this
-- file does not append a second copy.
do $education_workflow$
declare
  education_id uuid := 'a2c00000-0000-4000-8000-000000000002';
  admission jsonb := $wf$[{"asset_key":"workflow:admissions-enquiry","name":"Enquiry received","active":false,"trigger_type":"form.submitted","trigger":{},"steps":[{"id":"note","title":"Tell the owner","action":{"kind":"notify_user","text":"Enquiry stored. Nothing is sent."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]}]$wf$::jsonb;
  current jsonb;
  issues text[];
begin
  select payload into current from snapshots where id = education_id;
  if current is null then
    raise notice 'Education snapshot is missing; workflow patch skipped';
    return;
  end if;
  if current->'workflows' is null
     or not exists (
       select 1
       from jsonb_array_elements(coalesce(current->'workflows', '[]'::jsonb)) item
       where item->>'asset_key' = 'workflow:admissions-enquiry'
     ) then
    current := jsonb_set(current, '{workflows}', coalesce(current->'workflows', '[]'::jsonb) || admission, true);
  end if;
  issues := public.snapshot_payload_issues(current);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'education snapshot contains private data: %', issues;
  end if;
  update snapshots
  set payload = current,
      updated_at = now()
  where id = education_id
    and payload is distinct from current;
end
$education_workflow$;

create or replace function public.eastc_pack_private_rows()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rel text;
  total bigint := 0;
  part bigint;
begin
  foreach rel in array array[
    'crm_leads',
    'crm_contacts',
    'crm_prospects',
    'crm_outbox',
    'crm_lead_activity',
    'workspace_messages',
    'messages',
    'conversations',
    'invitations'
  ]
  loop
    if to_regclass('public.' || rel) is not null then
      execute format('select count(*) from public.%I', rel) into part;
      total := total + coalesce(part, 0);
    end if;
  end loop;
  if to_regclass('private.channel_secrets') is not null then
    execute 'select count(*) from private.channel_secrets' into part;
    total := total + coalesce(part, 0);
  end if;
  return total;
end;
$$;

create or replace function public.apply_education_pack_to_eastc()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  eastc_seed uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
  education_seed uuid := 'a2c00000-0000-4000-8000-000000000002';
  target uuid;
  by_slug uuid;
  by_id uuid;
  snap snapshots%rowtype;
  report jsonb;
  sending boolean;
  before_private bigint;
  after_private bigint;
  before_orgs bigint;
  meta jsonb;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;

  select id into by_slug
  from organizations
  where slug = 'eastc'
    and org_type = 'client';

  select id into by_id
  from organizations
  where id = eastc_seed;

  if by_slug is not null and by_id is not null and by_slug is distinct from by_id then
    raise exception 'EASTC slug and seed id point at different organisations';
  end if;

  target := coalesce(by_slug, by_id);
  if target is null then
    raise exception 'EASTC client workspace was not found';
  end if;

  if not exists (
    select 1
    from organizations child
    join organizations parent on parent.id = child.parent_id
    where child.id = target
      and child.slug = 'eastc'
      and child.org_type = 'client'
      and parent.slug = 'ai-autotech'
  ) then
    raise exception 'EASTC client workspace was not found';
  end if;

  if not public.has_org_role(target, array['agency_owner', 'agency_staff']) then
    raise exception 'not allowed';
  end if;

  select * into snap from snapshots where id = education_seed;
  if snap.id is null or snap.name not ilike '%education%' then
    raise exception 'Education snapshot was not found';
  end if;

  select sending_enabled into sending from organizations where id = target;
  if sending is distinct from false then
    raise exception 'sending must stay off';
  end if;

  before_private := public.eastc_pack_private_rows();
  select count(*) into before_orgs from organizations;

  report := public.snapshot_apply(snap.id, target);

  select sending_enabled into sending from organizations where id = target;
  if sending is distinct from false then
    raise exception 'sending must stay off';
  end if;

  after_private := public.eastc_pack_private_rows();
  if after_private is distinct from before_private then
    raise exception 'education pack must not copy contacts, messages, or secrets';
  end if;
  if (select count(*) from organizations) is distinct from before_orgs then
    raise exception 'education pack must not create a workspace';
  end if;
  if (select count(*) from organizations where slug = 'eastc') is distinct from 1 then
    raise exception 'education pack must not create a workspace';
  end if;

  -- Admissions becomes the only default pipeline. Enrolment rows stay.
  -- source_checksum is rewritten with the new default so this is not a client edit.
  update pipelines as pipe
  set is_default = (pipe.asset_key = 'pipeline:admissions'),
      source_checksum = public.snapshot_checksum(
        public.snapshot_pipeline_doc(pipe.asset_key, pipe.name, pipe.asset_key = 'pipeline:admissions')
      ),
      updated_at = now()
  where pipe.org_id = target
    and pipe.is_default is distinct from (pipe.asset_key = 'pipeline:admissions');

  meta := jsonb_build_object(
    'snapshot_id', snap.id,
    'slug', 'eastc',
    'org_id', target,
    'sending_enabled', false,
    'report', report
  );

  insert into org_activity (org_id, actor_id, action, entity, entity_id, meta, acting_as_agency)
  values (target, auth.uid(), 'snapshot.education_applied', 'snapshot', snap.id::text, meta, true);

  if to_regclass('public.activity_logs') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'activity_logs' and column_name = 'org_id'
    ) then
      insert into activity_logs (actor_id, entity_type, entity_id, action, metadata, org_id)
      values (auth.uid(), 'snapshot', snap.id, 'snapshot.education_applied', meta, target);
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'activity_logs' and column_name = 'organization_id'
    ) then
      insert into activity_logs (actor_id, entity_type, entity_id, action, metadata, organization_id)
      values (auth.uid(), 'snapshot', snap.id, 'snapshot.education_applied', meta, target);
    else
      insert into activity_logs (actor_id, entity_type, entity_id, action, metadata)
      values (auth.uid(), 'snapshot', snap.id, 'snapshot.education_applied', meta);
    end if;
  end if;

  return jsonb_build_object(
    'org_id', target,
    'slug', 'eastc',
    'snapshot_id', snap.id,
    'sending_enabled', false,
    'report', report
  );
end;
$$;

revoke all on function public.eastc_pack_private_rows() from public, anon, authenticated;
revoke all on function public.apply_education_pack_to_eastc() from public, anon;
grant execute on function public.apply_education_pack_to_eastc() to authenticated;
