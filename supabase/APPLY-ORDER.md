# Migration apply order

Nothing below the “Already live” list has been run on the production database.
The command centre still reports that `public.crm_lead_activity` is missing.
Paste each file into the Supabase SQL editor and run it once, in this order only.
Do not sort the folder by filename. Two timestamps are shared, and filename order applies `phase2a_access` before `send_compliance` and `agency_tenancy` before `crm_automation`.

These files are additive. They do not delete existing leads. Do not turn sending on while applying them.

## Already live

The public audit intake still writes to these. They are done.

1. `supabase/migrations/20260903000000_company_crm.sql`
2. `supabase/migrations/20260925000000_audit_leads.sql`
3. `supabase/migrations/20260925120000_contact_leads.sql`

## Unapplied, in the only safe order

PR #3 is merged. Its files are on `main` and are still unapplied. Run them after the automation and compliance files.

1. `supabase/migrations/20260926160000_crm_automation.sql`
2. `supabase/migrations/20260926183000_outbound_channels.sql`
3. `supabase/migrations/20260926200000_send_compliance.sql`
4. `supabase/migrations/20260926160000_agency_tenancy.sql`
5. `supabase/migrations/20260926180000_zentrix_shopify.sql`
6. `supabase/migrations/20260926200000_phase2a_access.sql`
7. `supabase/migrations/20260926210000_agency_brand_offers.sql`
8. `supabase/migrations/20261015120000_org_scope_phase1_tables.sql`
9. `supabase/migrations/20261015140000_phase2b_channels_popia.sql`
10. `supabase/migrations/20261016120000_phase2c_snapshots.sql`
11. `supabase/migrations/20261017120000_phase2d_workflows.sql`
12. `supabase/migrations/20261018120000_phase2e_inbox.sql`
13. `supabase/migrations/20261019120000_phase2f_billing.sql`
14. `supabase/migrations/20261020120000_phase2g_agency_rollup.sql`
15. `supabase/migrations/20261021120000_phase3a_conversation_ai.sql`
16. `supabase/migrations/20261022120000_phase3b_calendars.sql`
17. `supabase/migrations/20261023120000_phase3c_reviews.sql`

Why this order:

- `outbound_channels` alters `crm_outbox` and creates `crm_prospects`. Those come from `crm_automation`.
- `send_compliance` adds consent and cost columns on `crm_leads`, `crm_prospects`, and `crm_outbox`, and replaces the outbox status check so `blocked` is allowed. It has to follow `outbound_channels`.
- `agency_tenancy` creates `organizations`, `memberships`, and `attach_org_tenancy`. It attaches `org_id` to company CRM tables that already exist (`crm_leads`, `crm_clients`, `crm_jobs`, `crm_invoices`, `crm_audit_leads`, `crm_contact_leads`).
- `zentrix_shopify` inserts the Zentrix organisation and calls `attach_org_tenancy` on the Shopify tables. It requires `agency_tenancy`. It does not require phase 2a.
- `phase2a_access` adds `organizations.branding`, `sending_enabled` (default false), and the other workspace columns. It requires `organizations` from `agency_tenancy`.
- `agency_brand_offers` writes `organizations.branding` and the deck colours. It requires phase 2a. It also widens the `crm_jobs.kind` check. `crm_jobs` is already live.
- `org_scope_phase1_tables` calls `attach_org_tenancy` on the automation tables (`crm_lead_activity`, `crm_outbox`, `crm_prospects`, `crm_suppressions`, and the rest of that list). It no-ops for any table that is not there yet, and it returns without changes if `attach_org_tenancy` is missing. Run it before phase 2b and phase 2c so those tables already exist.
- `phase2b_channels_popia` adds channel connections, the vault secret RPCs, POPIA contacts, rate cards, and the usage ledger. It alters `crm_outbox` when that table exists, so it follows the automation and compliance files. It does not turn sending on and it does not put provider secrets in the migration.
- `phase2c_snapshots` adds pipelines, pipeline stages, message templates, sequences, custom fields, and workspace snapshots. It adds `crm_leads.stage_id` only where the stage name matches exactly one stage in that organisation, and it adds `asset_key` on the phase 1 sequence tables. It follows phase 2b. Snapshot payloads do not include contacts, messages, or secrets. Applying a snapshot does not turn sending on.
- `phase2d_workflows` adds the workflow engine tables (`events`, `workflows`, `workflow_runs`, `workflow_run_logs`, `workflow_alerts`, `contact_tags`) and seeds one workflow row per organisation for the phase 1 assignment, stage, and sequence behaviour. It follows phase 2c because snapshot export and apply grow a `workflows` array. `workflow_engine_enabled` stays false, and `sending_enabled` stays false. Leave `WORKFLOW_ENGINE_ENABLED` unset until this file has been applied. Snapshot export then includes workflows and still excludes contacts, messages, and secrets.
- `phase2e_inbox` adds `conversations`, `messages`, and `conversation_notes`, with org indexes and RLS. A `client_user` with `assigned_only` only sees conversations assigned to them. Inbound WhatsApp opens a 24-hour window; free-form replies after that are rejected unless the row points at an approved template. The monthly free service-message counter is `wa_service_sends_this_month` (1,000 per WhatsApp number from 1 Oct 2026). Realtime tables are added to `supabase_realtime` when that publication already exists. This file does not turn `sending_enabled` on. Inbound messages call `record_workflow_event` for `message.inbound`. Apply it after phase 2d.
- `phase2f_billing` adds ZAR `plans`, `org_subscriptions` (sandbox must stay true), idempotent `billing_events`, usage reports, and Yoco sandbox payment-link drafts. It follows phase 2e and the phase 2b usage ledger. A PayFast ITN is applied only by the service role. `past_due` for 7 days becomes `suspended`: the organisation status is suspended, `sending_enabled` is forced false, and queued outbox rows are held. Signed-in writes on a suspended workspace are rejected. This file does not call PayFast, Paystack, or Yoco, and it does not turn sending on. Leave `BILLING_SANDBOX` unset until you have the PayFast sandbox merchant id `10000100`. Do not put a live merchant id in the environment.
- `phase2g_agency_rollup` adds `agency_rollup(agency_id, from_ts, to_ts)`, `workspace_period_metrics` for the same period on one workspace, and `resolve_custom_domain`. It follows phase 2f. A caller who is not an agency member of that agency is rejected, including a `client_admin`. The rollup lists child workspaces only. It does not turn `sending_enabled` on and it does not change sandbox billing. Apply it after step 13. Do not run it until `SUPABASE_DB_URL` is available.
- `phase3a_conversation_ai` adds `ai_reply_settings` and `ai_drafts`. Settings stay disabled (`enabled` default false, `require_human_before_send` default true, mode `draft_only`). Writes to settings are limited to `agency_owner` and `client_admin`. Drafts follow inbox visibility, including `assigned_only`. A draft cannot be approved, queued, or sent unless `consent_ok` is true, and it cannot be marked sent while `sending_enabled` is false. It does not call a model and it does not turn sending on. Apply it after step 14. Do not run it until `SUPABASE_DB_URL` is available. Set `AI_REPLY_API_KEY` before drafting. Optional: `AI_REPLY_BASE_URL`, `AI_REPLY_MODEL`. Leave `AI_REPLY_CRON_ENABLED` unset.
- `phase3b_calendars` adds `calendars`, `calendar_availability` (weekly windows and date exceptions), `calendar_event_types`, `booking_links`, and `crm_appointments`. Classic `public.appointments` from `schema.sql` is left untouched. Appointment status is `scheduled`, `cancelled`, `completed`, or `no_show`. A row cannot be stored without the consent checkbox text. Staff assignment uses `memberships` (`assigned_member_id` and `assigned_user_id`). A `client_user` with `assigned_only` only sees appointments assigned to them, the same helper as the inbox. Public booking is `book_public_appointment`: it creates or updates a contact, records service consent (not marketing), and creates a lead when `crm_leads` is present. It records the existing workflow trigger `appointment.booked` (there is no separate `appointment_booked` value). It does not write `crm_outbox` and it does not turn `sending_enabled` on. No new environment variable is required. `NEXT_PUBLIC_SITE_URL`, when set, is only used to print an absolute booking link. Apply it after step 15. Do not run it until `SUPABASE_DB_URL` is available. Leave `AI_REPLY_CRON_ENABLED` unset.
- `phase3c_reviews` adds `review_requests`, `reviews` (rating 1–5, source, `public_token`), and optional `review_templates`. Reads use `accessible_org_ids`. Managers (`agency_owner`, `agency_staff`, `client_admin`) record reviews and templates. A `client_user` can read the workspace inbox and cannot write it. `create_review_request_draft` stores marketing consent for SMS or email, then writes one `crm_outbox` row with status `draft` and template `review_request`. No consent, an opt-out, or a suppression writes nothing. A trigger rejects `queued`, `approved`, and `sent` for that template, and `sent_at` stays empty. The public page is `submit_public_review` at `/r/<org slug or token>`. It stores a star rating and a short comment. It does not write `crm_outbox` and it does not record a workflow event. `review.received` is deferred: `events.type` and `workflows.trigger_type` do not include it, so seeded workflow rows stay valid. There is no review-request cron. `sending_enabled` stays false. `AI_REPLY_CRON_ENABLED` and billing are untouched. No paid review API is added. Apply it after step 16. Do not run it until `SUPABASE_DB_URL` is available.

## Workflow runner schedule

`/api/cron/workflows` runs every minute once the engine flag is on. It claims due runs with `claim_due_workflow_runs` (`select … for update skip locked`, at most 100). While the flag is off the route does nothing and `/api/cron/automation` keeps the phase 1 job.

Vercel Cron can use this schedule on a plan that allows minute jobs:

```json
{ "path": "/api/cron/workflows", "schedule": "* * * * *" }
```

That entry is not in `vercel.json`. A Hobby plan only accepts a daily cron, and adding a minute schedule would stop the deploy. Until the plan allows it, schedule the same route from Supabase. Do not run this until `SUPABASE_DB_URL` is available, and do not turn sending on.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'workflow-engine',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://REPLACE_WITH_THE_DEPLOYMENT_HOST/api/cron/workflows',
    headers := jsonb_build_object('Authorization', 'Bearer REPLACE_WITH_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
```

## Billing cycle

`/api/cron/billing` runs dunning and writes the previous month's usage report. It does not call PayFast, Paystack, or Yoco, and it does not turn sending on. It is not in `vercel.json`, for the same Hobby-plan reason as the workflow route. Schedule it daily from Supabase after step 13 is applied. Do not run it until `SUPABASE_DB_URL` is available.

```sql
select cron.schedule(
  'billing-cycle',
  '15 2 * * *',
  $$
  select net.http_post(
    url := 'https://REPLACE_WITH_THE_DEPLOYMENT_HOST/api/cron/billing',
    headers := jsonb_build_object('Authorization', 'Bearer REPLACE_WITH_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
```

A failed PayFast sandbox ITN sets `org_subscriptions.status` to `past_due`. Seven days later this job sets `suspended`, forces `sending_enabled` false, and holds queued outbox rows.

## Conversation AI cron

`/api/cron/ai-replies` queues pending drafts only when `AI_REPLY_CRON_ENABLED` is the string `true`. It is not in `vercel.json`. Leave the flag unset. When the flag is on, the route still does nothing unless the workspace has Conversation AI enabled, mode `queue_outbox`, `require_human_before_send` false, and `sending_enabled` true. Consent is checked again. A missing opt-in, STOP, or suppression is not queued. The route does not mark a draft sent and does not turn sending on.

In production the route expects `Authorization: Bearer <CRON_SECRET>`, the same secret as the other cron routes. Do not invent a value. Do not schedule this until step 15 is applied and `SUPABASE_DB_URL` is available.

```sql
select cron.schedule(
  'ai-reply-drafts',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://REPLACE_WITH_THE_DEPLOYMENT_HOST/api/cron/ai-replies',
    headers := jsonb_build_object('Authorization', 'Bearer REPLACE_WITH_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
```

## White-label host

Step 14 does not buy a domain and does not turn sending on. `organizations.custom_domain` is already on the table from phase 2a. `resolve_custom_domain` returns the public brand for that host.

Until the domain is added on Vercel, open the stub path `/d/<hostname>/login`. That sets the `aat_brand_host` cookie and sends you to `/login`. Two reserved test hosts are wired for local preview: `crm.eastc.test` (EASTC) and `crm.zentrix.test` (Zentrix Online). Example: `/d/crm.eastc.test/login`. Clear it at `/brand/clear`.

When you attach a real hostname, add it on the Vercel project and set `organizations.custom_domain` to that host (no port). The app reads `Host` and `x-forwarded-host`. A client login hides the words “AI AutoTech” unless that workspace’s branding has `showPlatformName` set. Email From uses the workspace sender name on the same rule.

## Shared timestamps

Do not apply by filename sort.

| Timestamp | Run first | Run later |
|---|---|---|
| `20260926160000` | `20260926160000_crm_automation.sql` (step 1) | `20260926160000_agency_tenancy.sql` (step 4) |
| `20260926200000` | `20260926200000_send_compliance.sql` (step 3) | `20260926200000_phase2a_access.sql` (step 6) |

Filename sort also places `20260926180000_zentrix_shopify.sql` before `outbound_channels` and `agency_tenancy`. Zentrix needs `organizations`, so it stays at step 5.

## Not part of this apply

`supabase/owner-bootstrap.sql` is not a migration. Run it only after these files, and only after the agency owner exists in Supabase Auth. `supabase/schema.sql` is the classic Command Centre baseline, not one of these pending files. Do not apply this list until `SUPABASE_DB_URL` is available, and do not turn sending on while applying it.

## Owner login without a manual membership insert

`/command-centre` and `/agency` require a Supabase Auth session once `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. Public routes stay open: `/login`, `/audit`, `/api/public/*`, `/book/*`, `/r/*`, `/team/*`, `/auth/callback`, and static assets. The command centre reads with the signed-in user so row level security applies. The service role stays on public intake and cron/worker routes.

Set `OWNER_EMAILS` in the server environment (see `.env.example`). It is a comma-separated list. The documented default is `billyfaber06@gmail.com`. On first login, a user whose email is in that list and who has no membership row is attached as `agency_owner` of the organisation with slug `ai-autotech`. If the variable is unset or blank, that same address is used. The attach is idempotent (`on conflict (user_id, org_id) do nothing` via upsert ignore-duplicates). It does not update a membership that already exists, and it does not delete anything. If the service role key is missing, the attach is skipped and `supabase/owner-bootstrap.sql` remains the manual path.

Add these redirect URLs in Supabase Authentication → URL configuration so magic links, social sign-in, and password resets return to the app: `https://<your-host>/auth/callback`. The app sends users back to the page they asked for (`next`). Social buttons on `/login` are the providers listed in `NEXT_PUBLIC_AUTH_PROVIDERS` that are also enabled at https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/auth/providers. Google stays first. If that list is blank, or a provider is not enabled, its button stays hidden and the email magic link still works. The apps to create are listed in `docs/agency-owner-setup.md`. Do not put provider client secrets in the app env.

Without Supabase keys, and outside Vercel preview/production, the same URLs render fixture data so CI and smoke tests can run.
