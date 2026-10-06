#!/usr/bin/env node
/**
 * Create or update the AI AutoTech client workspace from the agency template.
 *
 *   node scripts/provision-ai-autotech.mjs
 *   node scripts/provision-ai-autotech.mjs --apply --project-ref <ref>
 *
 * Default is a dry-run. Nothing is sent and no SQL runs.
 * --apply requires AI_AUTOTECH_PROVISION_CONFIRM and an sbp_ token.
 * The production project also requires the production confirm string.
 * This file does not turn sending on and does not send email, SMS, or WhatsApp.
 */
import { pathToFileURL } from "node:url";

export const AI_AUTOTECH_PROFILE = {
  businessName: "AI AutoTech",
  slug: "aiautotech",
  website: "https://aiautotech.co.za",
  domain: "aiautotech.co.za",
  bookingUrl: "https://aiautotech.co.za/book",
  senderAddress: "Willem@aiautotech.co.za",
  senderName: "AI AutoTech",
  snapshotId: "a2c00000-0000-4000-8000-000000000001",
  idempotencyKey: "dup:snapshot:a2c00000-0000-4000-8000-000000000001:aiautotech",
  intakeMarker: "aiautotech",
};

export const CONFIRM_VALUE = "yes-provision-ai-autotech";
export const PRODUCTION_CONFIRM_VALUE = "yes-provision-ai-autotech-production";
export const PRODUCTION_PROJECT_REF = "fnysxlswzufdnlbhndxc";

const PROJECT_REF = /^[a-z]{20}$/;

export const PROVISION_SQL = `
do $provision$
declare
  parent uuid;
  owner_id uuid;
  existing uuid;
  dup jsonb;
  swap jsonb;
  enabled boolean;
begin
  select id into parent
  from public.organizations
  where slug = 'ai-autotech' and org_type = 'agency';
  if parent is null then
    raise exception 'agency workspace ai-autotech is required';
  end if;

  select m.user_id into owner_id
  from public.memberships m
  where m.org_id = parent and m.role = 'agency_owner'
  order by m.created_at
  limit 1;
  if owner_id is null then
    raise exception 'an agency owner is required';
  end if;

  if not exists (
    select 1 from public.snapshots
    where id = '${AI_AUTOTECH_PROFILE.snapshotId}' and org_id = parent
  ) then
    raise exception 'agency template snapshot is missing';
  end if;

  select id into existing from public.organizations where slug = '${AI_AUTOTECH_PROFILE.slug}';

  if existing is null then
    swap := jsonb_build_object(
      'name', '${AI_AUTOTECH_PROFILE.businessName}',
      'slug', '${AI_AUTOTECH_PROFILE.slug}',
      'primary_colour', '#1B3A5C',
      'accent_colour', '#4A9EDB',
      'logo_url', '',
      'phone', '',
      'email', '${AI_AUTOTECH_PROFILE.senderAddress}',
      'address', 'South Africa',
      'hours', '',
      'booking_url', '${AI_AUTOTECH_PROFILE.bookingUrl}',
      'services_text', '',
      'services', '[]'::jsonb
    );
    perform set_config('request.jwt.claim.sub', owner_id::text, true);
    execute 'select public.duplicate_workspace($1, $2, $3::jsonb, $4)'
      into dup
      using 'snapshot', '${AI_AUTOTECH_PROFILE.snapshotId}'::uuid, swap, '${AI_AUTOTECH_PROFILE.idempotencyKey}';
    existing := (dup->>'org_id')::uuid;
  else
    if exists (
      select 1 from public.organizations org
      where org.id = existing
        and org.parent_id is distinct from parent
        and coalesce(org.settings->>'public_intake', '') is distinct from '${AI_AUTOTECH_PROFILE.intakeMarker}'
    ) then
      raise exception 'slug aiautotech is already used by another workspace';
    end if;
  end if;

  update public.organizations
  set
    name = '${AI_AUTOTECH_PROFILE.businessName}',
    legal_name = '${AI_AUTOTECH_PROFILE.businessName}',
    domain = '${AI_AUTOTECH_PROFILE.domain}',
    sender_name = '${AI_AUTOTECH_PROFILE.senderName}',
    sending_enabled = false,
    created_from_snapshot_id = '${AI_AUTOTECH_PROFILE.snapshotId}'::uuid,
    form_key = case
      when form_key is null or form_key = '${AI_AUTOTECH_PROFILE.slug}' then '${AI_AUTOTECH_PROFILE.slug}'
      else form_key
    end,
    settings = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            coalesce(settings, '{}'::jsonb),
            '{channels,email,fromAddress}',
            to_jsonb('${AI_AUTOTECH_PROFILE.senderAddress}'::text),
            true
          ),
          '{public_intake}',
          to_jsonb('${AI_AUTOTECH_PROFILE.intakeMarker}'::text),
          true
        ),
        '{website}',
        to_jsonb('${AI_AUTOTECH_PROFILE.website}'::text),
        true
      ),
      '{booking_url}',
      to_jsonb('${AI_AUTOTECH_PROFILE.bookingUrl}'::text),
      true
    ),
    updated_at = now()
  where id = existing;

  insert into public.client_website_configs (org_id, config)
  values (
    existing,
    jsonb_build_object(
      'business_name', '${AI_AUTOTECH_PROFILE.businessName}',
      'booking_url', '${AI_AUTOTECH_PROFILE.bookingUrl}',
      'email', '${AI_AUTOTECH_PROFILE.senderAddress}',
      'website', '${AI_AUTOTECH_PROFILE.website}'
    )
  )
  on conflict (org_id) do update
    set config = public.client_website_configs.config || excluded.config,
        updated_at = now();

  select sending_enabled into enabled from public.organizations where id = existing;
  if enabled is distinct from false then
    raise exception 'sending must stay off';
  end if;
end
$provision$;
`.trim();

export function projectRefFrom(argv, env) {
  const flag = argv.indexOf("--project-ref");
  const fromArg = flag >= 0 ? argv[flag + 1] : "";
  const value = String(fromArg || env.SUPABASE_PROJECT_REF || env.SUPABASE_PROJECT_ID || "").trim();
  return PROJECT_REF.test(value) ? value : "";
}

export function isProductionTarget(projectRef, env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || "");
  return projectRef === PRODUCTION_PROJECT_REF || url.includes(PRODUCTION_PROJECT_REF);
}

/** Dry-run unless --apply and the confirm string match the target. CI never applies. */
export function decideProvision(argv, env) {
  const apply = argv.includes("--apply");
  const profile = { ...AI_AUTOTECH_PROFILE };
  if (!apply) {
    return { action: "dry-run", reason: "default", profile, sql: PROVISION_SQL };
  }
  if (String(env.CI || "").trim() === "true" || String(env.GITHUB_ACTIONS || "").trim() === "true") {
    return { action: "refuse", reason: "ci", profile };
  }
  const projectRef = projectRefFrom(argv, env);
  if (!projectRef) return { action: "refuse", reason: "missing_project_ref", profile };
  const token = String(env.SUPABASE_ACCESS_TOKEN || "");
  if (!token.startsWith("sbp_") || token.length < 20) {
    return { action: "refuse", reason: "missing_token", profile, projectRef };
  }
  const confirm = String(env.AI_AUTOTECH_PROVISION_CONFIRM || "").trim();
  const production = isProductionTarget(projectRef, env);
  if (production && confirm !== PRODUCTION_CONFIRM_VALUE) {
    return { action: "refuse", reason: "production_confirm", profile, projectRef, production: true };
  }
  if (!production && confirm !== CONFIRM_VALUE) {
    return { action: "refuse", reason: "confirm", profile, projectRef, production: false };
  }
  return { action: "apply", reason: "confirmed", profile, projectRef, production, sql: PROVISION_SQL };
}

export async function postProvisionSql({ sql, projectRef, token, fetchImpl }) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: sql, read_only: false }),
  });
  const body = typeof response.text === "function" ? await response.text() : "";
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Management API ${response.status}: ${String(body).slice(0, 240)}`);
  }
  return { status: response.status };
}

function printPlan(decision) {
  const profile = decision.profile;
  console.log("AI AutoTech provision: dry-run. No SQL was sent.");
  console.log(`business: ${profile.businessName}`);
  console.log(`slug: ${profile.slug}`);
  console.log(`website: ${profile.website}`);
  console.log(`booking: ${profile.bookingUrl}`);
  console.log(`sender: ${profile.senderAddress}`);
  console.log(`template: ${profile.snapshotId}`);
  console.log("sending_enabled stays false. Audit and guide intake use settings.public_intake = aiautotech.");
  console.log("Pass --apply with AI_AUTOTECH_PROVISION_CONFIRM and --project-ref to write. The production project needs the production confirm string.");
}

const REFUSE_TEXT = {
  ci: "Refused. CI does not provision a workspace. Nothing was sent.",
  missing_project_ref: "Refused. Pass --project-ref. Nothing was sent.",
  missing_token: "Refused. SUPABASE_ACCESS_TOKEN must start with sbp_. Nothing was sent.",
  confirm: `Refused. Set AI_AUTOTECH_PROVISION_CONFIRM=${CONFIRM_VALUE} before --apply. Nothing was sent.`,
  production_confirm: `Refused. The production project needs AI_AUTOTECH_PROVISION_CONFIRM=${PRODUCTION_CONFIRM_VALUE}. Nothing was sent.`,
};

export async function runProvision(argv, env, fetchImpl = globalThis.fetch) {
  const decision = decideProvision(argv, env);
  if (decision.action === "dry-run") {
    printPlan(decision);
    return { ...decision, sent: false };
  }
  if (decision.action === "refuse") {
    console.error(REFUSE_TEXT[decision.reason] || "Refused. Nothing was sent.");
    return { ...decision, sent: false };
  }
  await postProvisionSql({
    sql: decision.sql,
    projectRef: decision.projectRef,
    token: env.SUPABASE_ACCESS_TOKEN,
    fetchImpl,
  });
  console.log(`AI AutoTech provision applied to ${decision.projectRef}. Sending stays off. No message was sent.`);
  return { ...decision, sent: true };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  runProvision(process.argv.slice(2), process.env)
    .then((result) => {
      if (result.action === "refuse") process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "Provision failed. Nothing was sent.");
      process.exitCode = 1;
    });
}
