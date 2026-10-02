# Phase 5k sandbox setup / go-live wizard

A checklist Billy can open without hunting docs. Nothing is sent, nothing is spent, and no secret is stored. `sending_enabled` stays false.

## Setup surface

`/command-centre/setup` keeps the existing team setup interview and adds the go-live wizard above it. `/command-centre` and `/agency` ops readiness link to it.

The checklist, in order:

1. Supabase SQL steps 20 through 31. Each step name comes from `supabase/APPLY-ORDER.md`. Every one stays pending. The page does not claim the SQL is applied. Step 32 is also unapplied.
2. `OWNER_EMAILS` and the agency-owner first login. The documented default is `billyfaber06@gmail.com`. If the variable is unset or blank, that address is attached as `agency_owner` of `ai-autotech` when the user has no membership. The page does not list any other address.
3. `CRON_SECRET` is `configured` or `missing`. The value is not shown. `AI_REPLY_CRON_ENABLED` stays unset. No cron is scheduled.
4. Email, WhatsApp (Meta), and SMS. Each links into the existing connect-accounts stub. Connected versus not comes from the sandbox tables when those tables are loaded. Otherwise the row is a fixture and shows not connected. No secret is read.
5. PayFast and `BILLING_SANDBOX` are presence only: configured or missing. A merchant id is not shown. No charge is sent.
6. Phase 5 flags that must stay unset until their SQL is applied. The page lists them and does not set them. That includes `EAST_RAND_CAMPAIGN_SEED_ENABLED`, `ZENTRIX_WORKSPACE_PACK_ENABLED`, and `PWA_INSTALL_SHELL_ENABLED`. The Education pack and the Zentrix pack are not applied from this page. The phone click order after SQL Success is `docs/GO-LIVE-RUNBOOK.md` (Phone-first unblock, step 8). Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset until Billy says yes.

The copy helper tells Billy to re-authenticate the Supabase SQL editor and paste steps 20 through 31 from `supabase/APPLY-ORDER.md` in that order. There is no auto-apply and this step does not ask for a database URL.

With Supabase keys set and no session, `/command-centre/setup` redirects to `/login` (307).

## Feature flag

Leave this unset until step 32 is applied. Unset, blank, or any value other than `true` keeps the wizard fixture-only. `write` stays false. Nothing is written.

- `SETUP_WIZARD_ENABLED=true` may store one sandbox `setup_checklist_events` row for the signed-in workspace: `org_id`, `step_key`, `status`, `sandbox` true, `charged` false.

The function is `record_setup_checklist_event`. A secret field is refused and is not written. The row has no secret column.

`EAST_RAND_CAMPAIGN_SEED_ENABLED`, `ZENTRIX_WORKSPACE_PACK_ENABLED`, `PWA_INSTALL_SHELL_ENABLED`, and the earlier flags are unchanged. This page does not turn them on.

Leave these unset:

- `CRON_SECRET`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a live email, SMS, Meta, or PayFast key in the environment for this step. Do not create a paid developer account and do not submit a store listing.

## Apply the migration

This is step 32 in `supabase/APPLY-ORDER.md`, after step 31:

`supabase/migrations/20261107120000_phase5k_setup_wizard.sql`

Steps 20 through 31 are still unapplied. Step 32 is also unapplied. After Billy re-authenticates Supabase, run steps 20 through 31, then step 32. Do not claim this SQL is already applied.

Apply it after step 31. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not schedule a cron.

## Fixture check

With Supabase keys empty, open `/command-centre/setup`. The wizard lists steps 20 through 31 as pending, names `billyfaber06@gmail.com`, shows `CRON_SECRET` as missing, and links Email, WhatsApp, and SMS to connect-accounts. `SETUP_WIZARD_ENABLED` is named. Record sandbox checklist event does not write.

Open `/command-centre` and `/agency`. Both ops readiness panels link to the wizard.

With Supabase keys set and no session, `/command-centre/setup` redirects to `/login`.
