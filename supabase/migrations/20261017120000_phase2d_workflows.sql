-- Phase 2d: workflow engine.
-- Additive. No rows are deleted. sending_enabled is not turned on.
-- workflow_engine_enabled stays false, so phase 1 automations keep running
-- until WORKFLOW_ENGINE_ENABLED is turned on.
--
-- Minute schedule: Vercel Cron can call /api/cron/workflows with "* * * * *"
-- on a plan that allows it. Hobby plans only allow a daily cron, so that
-- schedule is not added to vercel.json. The fallback is in APPLY-ORDER.md
-- (Supabase pg_cron + pg_net). This file does not enable those extensions.

alter table organizations
  add column if not exists workflow_engine_enabled boolean not null default false;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type text not null check (type in (
    'lead.created',
    'lead.stage_changed',
    'contact.tag_added',
    'form.submitted',
    'message.inbound',
    'message.no_reply',
    'appointment.booked',
    'invoice.paid',
    'opt_out.received',
    'schedule.cron',
    'webhook.inbound'
  )),
  subject_type text not null,
  subject_id text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists events_org_idempotency_idx
  on events (org_id, idempotency_key)
  where idempotency_key <> '';

create index if not exists events_org_type_idx on events (org_id, type, occurred_at desc);

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  asset_key text not null,
  name text not null,
  active boolean not null default false,
  trigger_type text not null check (trigger_type in (
    'lead.created',
    'lead.stage_changed',
    'contact.tag_added',
    'form.submitted',
    'message.inbound',
    'message.no_reply',
    'appointment.booked',
    'invoice.paid',
    'opt_out.received',
    'schedule.cron',
    'webhook.inbound'
  )),
  trigger jsonb not null default '{}'::jsonb,
  definition jsonb not null default '{"steps":[]}'::jsonb,
  checksum text not null default '',
  source_checksum text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, asset_key)
);

create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  subject_id text not null,
  event_id uuid not null references events(id) on delete cascade,
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'running', 'waiting', 'succeeded', 'failed', 'cancelled')),
  cursor text not null default '',
  next_run_at timestamptz not null default now(),
  attempt integer not null default 0,
  context jsonb not null default '{}'::jsonb,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflow_runs_due_idx on workflow_runs (status, next_run_at);

create table if not exists workflow_run_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  run_id uuid not null references workflow_runs(id) on delete cascade,
  step_id text not null,
  status text not null,
  attempt integer not null default 1,
  error text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_run_logs_run_idx on workflow_run_logs (run_id, created_at);

create table if not exists workflow_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  run_id uuid references workflow_runs(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists contact_tags (
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id text not null,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, subject_id, tag)
);

select public.attach_org_tenancy('public.events'::regclass);
select public.attach_org_tenancy('public.workflows'::regclass);
select public.attach_org_tenancy('public.workflow_runs'::regclass);
select public.attach_org_tenancy('public.workflow_run_logs'::regclass);
select public.attach_org_tenancy('public.workflow_alerts'::regclass);
select public.attach_org_tenancy('public.contact_tags'::regclass);

create or replace function public.workflow_touch_checksum()
returns trigger
language plpgsql
as $$
declare
  doc jsonb;
begin
  doc := jsonb_build_object(
    'asset_key', new.asset_key,
    'name', new.name,
    'active', new.active,
    'trigger_type', new.trigger_type,
    'trigger', coalesce(new.trigger, '{}'::jsonb),
    'steps', coalesce(new.definition->'steps', '[]'::jsonb)
  );
  new.checksum := public.snapshot_checksum(doc);
  if tg_op = 'INSERT' or new.source_checksum is null or btrim(new.source_checksum) = '' then
    new.source_checksum := new.checksum;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workflow_checksum on workflows;
create trigger workflow_checksum before insert or update on workflows
  for each row execute function public.workflow_touch_checksum();

create or replace function public.snapshot_write_workflow(p_org uuid, item jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key text := item->>'asset_key';
  doc jsonb;
  sum text;
  existing workflows%rowtype;
  result text;
  steps jsonb := coalesce(item->'steps', '[]'::jsonb);
  trig jsonb := coalesce(item->'trigger', '{}'::jsonb);
begin
  if key is null or btrim(key) = '' then
    raise exception 'workflow asset_key required';
  end if;
  doc := jsonb_build_object(
    'asset_key', key,
    'name', item->>'name',
    'active', coalesce((item->>'active')::boolean, false),
    'trigger_type', item->>'trigger_type',
    'trigger', trig,
    'steps', steps
  );
  sum := public.snapshot_checksum(doc);
  select * into existing from workflows where org_id = p_org and asset_key = key;
  if not found then
    insert into workflows (org_id, asset_key, name, active, trigger_type, trigger, definition, source_checksum)
    values (
      p_org,
      key,
      item->>'name',
      coalesce((item->>'active')::boolean, false),
      item->>'trigger_type',
      trig,
      jsonb_build_object('steps', steps),
      sum
    );
    result := 'created';
  elsif (not p_force) and existing.checksum is distinct from existing.source_checksum then
    result := 'skipped_client_edit';
  elsif existing.checksum = sum then
    result := 'unchanged';
  else
    update workflows
    set name = item->>'name',
        active = coalesce((item->>'active')::boolean, false),
        trigger_type = item->>'trigger_type',
        trigger = trig,
        definition = jsonb_build_object('steps', steps),
        source_checksum = sum,
        updated_at = now()
    where id = existing.id;
    result := 'updated';
  end if;
  return jsonb_build_object('asset_key', key, 'kind', 'workflow', 'result', result);
end;
$$;

create or replace function public.enqueue_workflow_runs(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  insert into workflow_runs (org_id, workflow_id, subject_id, event_id, dedupe_key, status, next_run_at, context)
  select
    event.org_id,
    workflow.id,
    event.subject_id,
    event.id,
    workflow.id::text || ':' || event.subject_id || ':' || event.id::text,
    'pending',
    now(),
    coalesce(event.payload, '{}'::jsonb)
  from events event
  join workflows workflow
    on workflow.org_id = event.org_id
   and workflow.active
   and workflow.trigger_type = event.type
  where event.id = p_event_id
    and (
      event.type <> 'message.no_reply'
      or coalesce((event.payload->>'hours')::numeric, 0) >= coalesce((workflow.trigger->>'after_hours')::numeric, 0)
    )
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function public.record_workflow_event(
  p_org uuid,
  p_type text,
  p_subject_type text,
  p_subject_id text,
  p_payload jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
  created uuid;
  key text := coalesce(p_idempotency_key, '');
begin
  if key <> '' then
    select id into existing
    from events
    where org_id = p_org and idempotency_key = key;
    if existing is not null then
      perform public.enqueue_workflow_runs(existing);
      return existing;
    end if;
  end if;

  insert into events (org_id, type, subject_type, subject_id, payload, idempotency_key)
  values (p_org, p_type, p_subject_type, p_subject_id, coalesce(p_payload, '{}'::jsonb), key)
  returning id into created;

  perform public.enqueue_workflow_runs(created);
  return created;
end;
$$;

-- Claim due runs. select … for update skip locked limit 100.
create or replace function public.claim_due_workflow_runs(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 100), 0), 100);
  result jsonb;
begin
  with due as (
    select run.id
    from workflow_runs run
    where run.status in ('pending', 'waiting')
      and run.next_run_at <= now()
    order by run.next_run_at, run.id
    for update skip locked
    limit lim
  ),
  claimed as (
    update workflow_runs run
    set status = 'running',
        updated_at = now()
    from due
    where run.id = due.id
    returning run.id, run.workflow_id, run.subject_id, run.event_id, run.status
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', claimed.id,
    'asset_key', workflow.asset_key,
    'subject_id', claimed.subject_id,
    'event_id', claimed.event_id,
    'event_type', event.type,
    'event_payload', event.payload,
    'definition', workflow.definition,
    'status', claimed.status
  )), '[]'::jsonb)
  into result
  from claimed
  join workflows workflow on workflow.id = claimed.workflow_id
  join events event on event.id = claimed.event_id;

  return coalesce(result, '[]'::jsonb);
end;
$$;

create or replace function public.snapshot_apply_payload(p_org uuid, p_payload jsonb, p_force boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  report jsonb := '[]'::jsonb;
  pipe jsonb;
  stage jsonb;
  item jsonb;
  seq jsonb;
  step jsonb;
begin
  if p_org is null or not exists (select 1 from organizations where id = p_org) then
    raise exception 'target org not found';
  end if;

  for pipe in select entry.value from jsonb_array_elements(coalesce(p_payload->'pipelines', '[]'::jsonb)) as entry
  loop
    report := report || jsonb_build_array(public.snapshot_write_pipeline(p_org, pipe, p_force));
    for stage in select entry.value from jsonb_array_elements(coalesce(pipe->'stages', '[]'::jsonb)) as entry
    loop
      report := report || jsonb_build_array(public.snapshot_write_stage(
        p_org,
        stage || jsonb_build_object('pipeline_asset_key', pipe->>'asset_key'),
        p_force
      ));
    end loop;
  end loop;

  for item in select entry.value from jsonb_array_elements(coalesce(p_payload->'message_templates', '[]'::jsonb)) as entry
  loop
    report := report || jsonb_build_array(public.snapshot_write_template(p_org, item, p_force));
  end loop;

  for seq in select entry.value from jsonb_array_elements(coalesce(p_payload->'sequences', '[]'::jsonb)) as entry
  loop
    report := report || jsonb_build_array(public.snapshot_write_sequence(p_org, seq, p_force));
    for step in select entry.value from jsonb_array_elements(coalesce(seq->'steps', '[]'::jsonb)) as entry
    loop
      report := report || jsonb_build_array(public.snapshot_write_step(
        p_org,
        step || jsonb_build_object('sequence_asset_key', seq->>'asset_key'),
        p_force
      ));
    end loop;
  end loop;

  for item in select entry.value from jsonb_array_elements(coalesce(p_payload->'custom_fields', '[]'::jsonb)) as entry
  loop
    report := report || jsonb_build_array(public.snapshot_write_field(p_org, item, p_force));
  end loop;

  for item in select entry.value from jsonb_array_elements(coalesce(p_payload->'workflows', '[]'::jsonb)) as entry
  loop
    report := report || jsonb_build_array(public.snapshot_write_workflow(p_org, item, p_force));
  end loop;

  return report;
end;
$$;

create or replace function public.snapshot_export(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pipelines_json jsonb := '[]'::jsonb;
  templates_json jsonb := '[]'::jsonb;
  sequences_json jsonb := '[]'::jsonb;
  fields_json jsonb := '[]'::jsonb;
  workflows_json jsonb := '[]'::jsonb;
  pipe pipelines%rowtype;
  seq sequences%rowtype;
  stages jsonb;
  steps jsonb;
  result jsonb;
  issues text[];
begin
  if auth.uid() is null or p_org_id not in (select public.accessible_org_ids()) then
    raise exception 'not allowed';
  end if;

  for pipe in select * from pipelines where org_id = p_org_id order by name, asset_key
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'asset_key', stage.asset_key,
      'name', stage.name,
      'position', stage.position,
      'is_won', stage.is_won,
      'is_lost', stage.is_lost
    ) order by stage.position), '[]'::jsonb)
    into stages
    from pipeline_stages stage
    where stage.pipeline_id = pipe.id;

    pipelines_json := pipelines_json || jsonb_build_array(jsonb_build_object(
      'asset_key', pipe.asset_key,
      'name', pipe.name,
      'is_default', pipe.is_default,
      'stages', stages
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_key', template.asset_key,
    'channel', template.channel,
    'name', template.name,
    'subject', template.subject,
    'body', template.body,
    'active', template.active
  ) order by template.asset_key), '[]'::jsonb)
  into templates_json
  from message_templates template
  where template.org_id = p_org_id;

  for seq in select * from sequences where org_id = p_org_id order by asset_key
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'asset_key', step.asset_key,
      'position', step.position,
      'delay_hours', step.delay_hours,
      'channel', step.channel,
      'template_asset_key', step.template_asset_key
    ) order by step.position), '[]'::jsonb)
    into steps
    from sequence_steps step
    where step.sequence_id = seq.id;

    sequences_json := sequences_json || jsonb_build_array(jsonb_build_object(
      'asset_key', seq.asset_key,
      'name', seq.name,
      'active', seq.active,
      'steps', steps
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_key', field.asset_key,
    'entity', field.entity,
    'field_key', field.field_key,
    'label', field.label,
    'field_type', field.field_type,
    'options', field.options,
    'required', field.required,
    'position', field.position
  ) order by field.position), '[]'::jsonb)
  into fields_json
  from custom_fields field
  where field.org_id = p_org_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_key', workflow.asset_key,
    'name', workflow.name,
    'active', workflow.active,
    'trigger_type', workflow.trigger_type,
    'trigger', workflow.trigger,
    'steps', coalesce(workflow.definition->'steps', '[]'::jsonb)
  ) order by workflow.asset_key), '[]'::jsonb)
  into workflows_json
  from workflows workflow
  where workflow.org_id = p_org_id;

  result := jsonb_build_object(
    'version', 1,
    'pipelines', pipelines_json,
    'message_templates', templates_json,
    'sequences', sequences_json,
    'custom_fields', fields_json,
    'workflows', workflows_json
  );
  issues := public.snapshot_payload_issues(result);
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'snapshot export refused private data';
  end if;
  return result;
end;
$$;

revoke all on function public.snapshot_write_workflow(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.enqueue_workflow_runs(uuid) from public, anon, authenticated;
revoke all on function public.record_workflow_event(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.claim_due_workflow_runs(integer) from public, anon, authenticated;

do $grant$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.record_workflow_event(uuid, text, text, text, jsonb, text) to service_role;
    grant execute on function public.claim_due_workflow_runs(integer) to service_role;
    grant execute on function public.enqueue_workflow_runs(uuid) to service_role;
  end if;
end
$grant$;

-- PHASE1_WORKFLOWS
-- [{"asset_key":"workflow:assign-and-ack","name":"Assign owner and queue acknowledgement","active":true,"trigger_type":"lead.created","trigger":{},"steps":[{"id":"assign","title":"Assign owner","action":{"kind":"assign_owner","strategy":"fixed","default_owner":"Billy","rules":[{"name":"Billy phone QR","match_source":"","match_qr_source":"billy_phone_qr","owner":"Billy"}]},"next":"send-ack"},{"id":"send-ack","title":"Queue acknowledgement","action":{"kind":"send_message","sequence_step":"ack"},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:pipeline-cron","name":"Stage rules, follow-ups, and handover","active":true,"trigger_type":"schedule.cron","trigger":{},"steps":[{"id":"enrolled","title":"Lead is enrolled","condition":{"kind":"field_compare","field":"enrolled","cmp":"eq","value":"true"},"yes":"owner","no":"end"},{"id":"owner","title":"Owner is missing","condition":{"kind":"field_compare","field":"owner_name","cmp":"absent"},"yes":"assign","no":"open"},{"id":"assign","title":"Assign owner","action":{"kind":"assign_owner","strategy":"fixed","default_owner":"Billy","rules":[{"name":"Billy phone QR","match_source":"","match_qr_source":"billy_phone_qr","owner":"Billy"}]},"next":"open"},{"id":"open","title":"Still open for follow-up","condition":{"kind":"and","all":[{"kind":"not","of":{"kind":"reply_received"}},{"kind":"not","of":{"kind":"stage_is","stage":"Lost"}},{"kind":"not","of":{"kind":"stage_is","stage":"Won"}},{"kind":"not","of":{"kind":"stage_is","stage":"Onboarding/Handover"}}]},"yes":"follow-new","no":"stage-ack"},{"id":"follow-new","title":"New lead sequence window","condition":{"kind":"and","all":[{"kind":"or","any":[{"kind":"stage_is","stage":"New"},{"kind":"stage_is","stage":"Contacted"}]},{"kind":"field_compare","field":"booked_at","cmp":"absent"}]},"yes":"ack","no":"audit"},{"id":"ack","title":"Acknowledgement due","condition":{"kind":"field_compare","field":"sequence_step","cmp":"lt","value":"1"},"yes":"send-ack","no":"day1"},{"id":"send-ack","title":"Queue acknowledgement","action":{"kind":"send_message","sequence_step":"ack"},"next":"day1"},{"id":"day1","title":"Day 1 nudge due","condition":{"kind":"and","all":[{"kind":"field_compare","field":"age_hours","cmp":"gte","value":"24"},{"kind":"field_compare","field":"sequence_step","cmp":"lt","value":"2"}]},"yes":"send-day1","no":"day3"},{"id":"send-day1","title":"Queue day 1 nudge","action":{"kind":"send_message","sequence_step":"day1"},"next":"day3"},{"id":"day3","title":"Day 3 nudge due","condition":{"kind":"and","all":[{"kind":"field_compare","field":"age_hours","cmp":"gte","value":"72"},{"kind":"field_compare","field":"sequence_step","cmp":"lt","value":"3"}]},"yes":"send-day3","no":"day7"},{"id":"send-day3","title":"Queue day 3 nudge","action":{"kind":"send_message","sequence_step":"day3"},"next":"day7"},{"id":"day7","title":"Day 7 nudge due","condition":{"kind":"and","all":[{"kind":"field_compare","field":"age_hours","cmp":"gte","value":"168"},{"kind":"field_compare","field":"sequence_step","cmp":"lt","value":"4"}]},"yes":"send-day7","no":"audit"},{"id":"send-day7","title":"Queue day 7 nudge","action":{"kind":"send_message","sequence_step":"day7"},"next":"audit"},{"id":"audit","title":"Audit is within a day","condition":{"kind":"and","all":[{"kind":"stage_is","stage":"Audit booked"},{"kind":"field_compare","field":"hours_until_booking","cmp":"gt","value":"0"},{"kind":"field_compare","field":"hours_until_booking","cmp":"lte","value":"24"}]},"yes":"send-audit","no":"proposal"},{"id":"send-audit","title":"Queue audit reminder","action":{"kind":"send_message","sequence_step":"audit_reminder"},"next":"proposal"},{"id":"proposal","title":"Proposal follow-up due","condition":{"kind":"and","all":[{"kind":"stage_is","stage":"Proposal sent"},{"kind":"field_compare","field":"proposal_age_hours","cmp":"gte","value":"$proposal_followup_hours"}]},"yes":"send-proposal","no":"stage-ack"},{"id":"send-proposal","title":"Queue proposal follow-up","action":{"kind":"send_message","sequence_step":"proposal_followup"},"next":"stage-ack"},{"id":"stage-ack","title":"Acknowledgement is queued","condition":{"kind":"and","all":[{"kind":"stage_is","stage":"New"},{"kind":"field_compare","field":"ack_ready","cmp":"eq","value":"true"}]},"yes":"to-contacted","no":"stage-lost"},{"id":"to-contacted","title":"Move to Contacted","action":{"kind":"move_stage","stage":"Contacted"},"next":"stage-lost"},{"id":"stage-lost","title":"No reply after the sequence","condition":{"kind":"and","all":[{"kind":"not","of":{"kind":"reply_received"}},{"kind":"field_compare","field":"booked_at","cmp":"absent"},{"kind":"or","any":[{"kind":"stage_is","stage":"New"},{"kind":"stage_is","stage":"Contacted"}]},{"kind":"field_compare","field":"day7_queued","cmp":"eq","value":"true"},{"kind":"field_compare","field":"age_hours","cmp":"gte","value":"$stale_cutoff_hours"}]},"yes":"to-lost","no":"handover-check"},{"id":"to-lost","title":"Move to Lost","action":{"kind":"move_stage","stage":"Lost","lost_reason":"No reply after the day 1, day 3 and day 7 follow-ups."},"next":"handover-check"},{"id":"handover-check","title":"Won deal has a handover","condition":{"kind":"and","all":[{"kind":"stage_is","stage":"Won"},{"kind":"field_compare","field":"handover_open","cmp":"eq","value":"true"}]},"yes":"to-handover","no":"end"},{"id":"to-handover","title":"Move into handover","action":{"kind":"move_stage","stage":"Onboarding/Handover"},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:appointment-booked","name":"Audit booked","active":true,"trigger_type":"appointment.booked","trigger":{},"steps":[{"id":"stop","title":"Stop follow-up nudges","action":{"kind":"update_field","field":"cancel_nudges","value":"true"},"next":"book"},{"id":"book","title":"Store the booking time","action":{"kind":"update_field","field":"booked_at","from_event":"starts_at"},"next":"stage"},{"id":"stage","title":"Move to Audit booked","action":{"kind":"move_stage","stage":"Audit booked"},"next":"soon"},{"id":"soon","title":"Reminder window","condition":{"kind":"and","all":[{"kind":"field_compare","field":"hours_until_booking","cmp":"gt","value":"0"},{"kind":"field_compare","field":"hours_until_booking","cmp":"lte","value":"24"}]},"yes":"remind","no":"end"},{"id":"remind","title":"Queue audit reminder","action":{"kind":"send_message","sequence_step":"audit_reminder"},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:message-inbound","name":"Reply received","active":true,"trigger_type":"message.inbound","trigger":{},"steps":[{"id":"stop","title":"Stop follow-up nudges","action":{"kind":"update_field","field":"cancel_nudges","value":"true"},"next":"reply"},{"id":"reply","title":"Record the reply","action":{"kind":"update_field","field":"replied_at","value":"$now"},"next":"promote"},{"id":"promote","title":"Still New","condition":{"kind":"stage_is","stage":"New"},"yes":"contacted","no":"end"},{"id":"contacted","title":"Move to Contacted","action":{"kind":"move_stage","stage":"Contacted"},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:opt-out","name":"Opt-out received","active":true,"trigger_type":"opt_out.received","trigger":{},"steps":[{"id":"stop","title":"Suppress and stop","action":{"kind":"update_field","field":"opt_out","value":"true"},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:stage-changed","name":"Stage change","active":true,"trigger_type":"lead.stage_changed","trigger":{},"steps":[{"id":"won","title":"Marked won","condition":{"kind":"field_compare","field":"event_stage","cmp":"eq","value":"Won"},"yes":"do-handover","no":"apply"},{"id":"do-handover","title":"Open handover","action":{"kind":"handover"},"next":"end"},{"id":"apply","title":"Apply the stage","action":{"kind":"move_stage","from_event":true,"value_from_event":true},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:tag-added","name":"Tag added","active":true,"trigger_type":"contact.tag_added","trigger":{},"steps":[{"id":"tag","title":"Add the tag","action":{"kind":"add_tag","from_event":true},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:form-submitted","name":"Form submitted","active":true,"trigger_type":"form.submitted","trigger":{},"steps":[{"id":"note","title":"Tell the owner","action":{"kind":"notify_user","text":"A form was submitted."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:invoice-paid","name":"Invoice paid","active":true,"trigger_type":"invoice.paid","trigger":{},"steps":[{"id":"note","title":"Tell the owner","action":{"kind":"notify_user","text":"An invoice was marked paid."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:no-reply","name":"No reply","active":true,"trigger_type":"message.no_reply","trigger":{"after_hours":24},"steps":[{"id":"quiet","title":"Still no reply","condition":{"kind":"not","of":{"kind":"reply_received"}},"yes":"note","no":"end"},{"id":"note","title":"Tell the owner","action":{"kind":"notify_user","text":"No reply yet."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:webhook-inbound","name":"Inbound webhook","active":true,"trigger_type":"webhook.inbound","trigger":{},"steps":[{"id":"note","title":"Tell the owner","action":{"kind":"notify_user","text":"An inbound webhook arrived."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]}]
-- END_PHASE1_WORKFLOWS

do $seed$
declare
  defs jsonb := $wf$[{"asset_key":"workflow:assign-and-ack","name":"Assign owner and queue acknowledgement","active":true,"trigger_type":"lead.created","trigger":{},"steps":[{"id":"assign","title":"Assign owner","action":{"kind":"assign_owner","strategy":"fixed","default_owner":"Billy","rules":[{"name":"Billy phone QR","match_source":"","match_qr_source":"billy_phone_qr","owner":"Billy"}]},"next":"send-ack"},{"id":"send-ack","title":"Queue acknowledgement","action":{"kind":"send_message","sequence_step":"ack"},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:pipeline-cron","name":"Stage rules, follow-ups, and handover","active":true,"trigger_type":"schedule.cron","trigger":{},"steps":[{"id":"enrolled","title":"Lead is enrolled","condition":{"kind":"field_compare","field":"enrolled","cmp":"eq","value":"true"},"yes":"owner","no":"end"},{"id":"owner","title":"Owner is missing","condition":{"kind":"field_compare","field":"owner_name","cmp":"absent"},"yes":"assign","no":"open"},{"id":"assign","title":"Assign owner","action":{"kind":"assign_owner","strategy":"fixed","default_owner":"Billy","rules":[{"name":"Billy phone QR","match_source":"","match_qr_source":"billy_phone_qr","owner":"Billy"}]},"next":"open"},{"id":"open","title":"Still open for follow-up","condition":{"kind":"and","all":[{"kind":"not","of":{"kind":"reply_received"}},{"kind":"not","of":{"kind":"stage_is","stage":"Lost"}},{"kind":"not","of":{"kind":"stage_is","stage":"Won"}},{"kind":"not","of":{"kind":"stage_is","stage":"Onboarding/Handover"}}]},"yes":"follow-new","no":"stage-ack"},{"id":"follow-new","title":"New lead sequence window","condition":{"kind":"and","all":[{"kind":"or","any":[{"kind":"stage_is","stage":"New"},{"kind":"stage_is","stage":"Contacted"}]},{"kind":"field_compare","field":"booked_at","cmp":"absent"}]},"yes":"ack","no":"audit"},{"id":"ack","title":"Acknowledgement due","condition":{"kind":"field_compare","field":"sequence_step","cmp":"lt","value":"1"},"yes":"send-ack","no":"day1"},{"id":"send-ack","title":"Queue acknowledgement","action":{"kind":"send_message","sequence_step":"ack"},"next":"day1"},{"id":"day1","title":"Day 1 nudge due","condition":{"kind":"and","all":[{"kind":"field_compare","field":"age_hours","cmp":"gte","value":"24"},{"kind":"field_compare","field":"sequence_step","cmp":"lt","value":"2"}]},"yes":"send-day1","no":"day3"},{"id":"send-day1","title":"Queue day 1 nudge","action":{"kind":"send_message","sequence_step":"day1"},"next":"day3"},{"id":"day3","title":"Day 3 nudge due","condition":{"kind":"and","all":[{"kind":"field_compare","field":"age_hours","cmp":"gte","value":"72"},{"kind":"field_compare","field":"sequence_step","cmp":"lt","value":"3"}]},"yes":"send-day3","no":"day7"},{"id":"send-day3","title":"Queue day 3 nudge","action":{"kind":"send_message","sequence_step":"day3"},"next":"day7"},{"id":"day7","title":"Day 7 nudge due","condition":{"kind":"and","all":[{"kind":"field_compare","field":"age_hours","cmp":"gte","value":"168"},{"kind":"field_compare","field":"sequence_step","cmp":"lt","value":"4"}]},"yes":"send-day7","no":"audit"},{"id":"send-day7","title":"Queue day 7 nudge","action":{"kind":"send_message","sequence_step":"day7"},"next":"audit"},{"id":"audit","title":"Audit is within a day","condition":{"kind":"and","all":[{"kind":"stage_is","stage":"Audit booked"},{"kind":"field_compare","field":"hours_until_booking","cmp":"gt","value":"0"},{"kind":"field_compare","field":"hours_until_booking","cmp":"lte","value":"24"}]},"yes":"send-audit","no":"proposal"},{"id":"send-audit","title":"Queue audit reminder","action":{"kind":"send_message","sequence_step":"audit_reminder"},"next":"proposal"},{"id":"proposal","title":"Proposal follow-up due","condition":{"kind":"and","all":[{"kind":"stage_is","stage":"Proposal sent"},{"kind":"field_compare","field":"proposal_age_hours","cmp":"gte","value":"$proposal_followup_hours"}]},"yes":"send-proposal","no":"stage-ack"},{"id":"send-proposal","title":"Queue proposal follow-up","action":{"kind":"send_message","sequence_step":"proposal_followup"},"next":"stage-ack"},{"id":"stage-ack","title":"Acknowledgement is queued","condition":{"kind":"and","all":[{"kind":"stage_is","stage":"New"},{"kind":"field_compare","field":"ack_ready","cmp":"eq","value":"true"}]},"yes":"to-contacted","no":"stage-lost"},{"id":"to-contacted","title":"Move to Contacted","action":{"kind":"move_stage","stage":"Contacted"},"next":"stage-lost"},{"id":"stage-lost","title":"No reply after the sequence","condition":{"kind":"and","all":[{"kind":"not","of":{"kind":"reply_received"}},{"kind":"field_compare","field":"booked_at","cmp":"absent"},{"kind":"or","any":[{"kind":"stage_is","stage":"New"},{"kind":"stage_is","stage":"Contacted"}]},{"kind":"field_compare","field":"day7_queued","cmp":"eq","value":"true"},{"kind":"field_compare","field":"age_hours","cmp":"gte","value":"$stale_cutoff_hours"}]},"yes":"to-lost","no":"handover-check"},{"id":"to-lost","title":"Move to Lost","action":{"kind":"move_stage","stage":"Lost","lost_reason":"No reply after the day 1, day 3 and day 7 follow-ups."},"next":"handover-check"},{"id":"handover-check","title":"Won deal has a handover","condition":{"kind":"and","all":[{"kind":"stage_is","stage":"Won"},{"kind":"field_compare","field":"handover_open","cmp":"eq","value":"true"}]},"yes":"to-handover","no":"end"},{"id":"to-handover","title":"Move into handover","action":{"kind":"move_stage","stage":"Onboarding/Handover"},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:appointment-booked","name":"Audit booked","active":true,"trigger_type":"appointment.booked","trigger":{},"steps":[{"id":"stop","title":"Stop follow-up nudges","action":{"kind":"update_field","field":"cancel_nudges","value":"true"},"next":"book"},{"id":"book","title":"Store the booking time","action":{"kind":"update_field","field":"booked_at","from_event":"starts_at"},"next":"stage"},{"id":"stage","title":"Move to Audit booked","action":{"kind":"move_stage","stage":"Audit booked"},"next":"soon"},{"id":"soon","title":"Reminder window","condition":{"kind":"and","all":[{"kind":"field_compare","field":"hours_until_booking","cmp":"gt","value":"0"},{"kind":"field_compare","field":"hours_until_booking","cmp":"lte","value":"24"}]},"yes":"remind","no":"end"},{"id":"remind","title":"Queue audit reminder","action":{"kind":"send_message","sequence_step":"audit_reminder"},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:message-inbound","name":"Reply received","active":true,"trigger_type":"message.inbound","trigger":{},"steps":[{"id":"stop","title":"Stop follow-up nudges","action":{"kind":"update_field","field":"cancel_nudges","value":"true"},"next":"reply"},{"id":"reply","title":"Record the reply","action":{"kind":"update_field","field":"replied_at","value":"$now"},"next":"promote"},{"id":"promote","title":"Still New","condition":{"kind":"stage_is","stage":"New"},"yes":"contacted","no":"end"},{"id":"contacted","title":"Move to Contacted","action":{"kind":"move_stage","stage":"Contacted"},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:opt-out","name":"Opt-out received","active":true,"trigger_type":"opt_out.received","trigger":{},"steps":[{"id":"stop","title":"Suppress and stop","action":{"kind":"update_field","field":"opt_out","value":"true"},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:stage-changed","name":"Stage change","active":true,"trigger_type":"lead.stage_changed","trigger":{},"steps":[{"id":"won","title":"Marked won","condition":{"kind":"field_compare","field":"event_stage","cmp":"eq","value":"Won"},"yes":"do-handover","no":"apply"},{"id":"do-handover","title":"Open handover","action":{"kind":"handover"},"next":"end"},{"id":"apply","title":"Apply the stage","action":{"kind":"move_stage","from_event":true,"value_from_event":true},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:tag-added","name":"Tag added","active":true,"trigger_type":"contact.tag_added","trigger":{},"steps":[{"id":"tag","title":"Add the tag","action":{"kind":"add_tag","from_event":true},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:form-submitted","name":"Form submitted","active":true,"trigger_type":"form.submitted","trigger":{},"steps":[{"id":"note","title":"Tell the owner","action":{"kind":"notify_user","text":"A form was submitted."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:invoice-paid","name":"Invoice paid","active":true,"trigger_type":"invoice.paid","trigger":{},"steps":[{"id":"note","title":"Tell the owner","action":{"kind":"notify_user","text":"An invoice was marked paid."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:no-reply","name":"No reply","active":true,"trigger_type":"message.no_reply","trigger":{"after_hours":24},"steps":[{"id":"quiet","title":"Still no reply","condition":{"kind":"not","of":{"kind":"reply_received"}},"yes":"note","no":"end"},{"id":"note","title":"Tell the owner","action":{"kind":"notify_user","text":"No reply yet."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]},{"asset_key":"workflow:webhook-inbound","name":"Inbound webhook","active":true,"trigger_type":"webhook.inbound","trigger":{},"steps":[{"id":"note","title":"Tell the owner","action":{"kind":"notify_user","text":"An inbound webhook arrived."},"next":"end"},{"id":"end","title":"End","action":{"kind":"end"}}]}]$wf$::jsonb;
  org record;
  item jsonb;
  issues text[];
begin
  issues := public.snapshot_payload_issues(jsonb_build_object('workflows', defs));
  if coalesce(array_length(issues, 1), 0) > 0 then
    raise exception 'workflow seed contains private data: %', issues;
  end if;

  for org in select id from organizations
  loop
    for item in select entry.value from jsonb_array_elements(defs) as entry
    loop
      perform public.snapshot_write_workflow(org.id, item, false);
    end loop;
  end loop;
end
$seed$;
