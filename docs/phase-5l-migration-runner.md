# Phase 5l sandbox pending-SQL migration runner

A checklist Billy can open on the agency and command centre. It lists APPLY-ORDER steps 20 through 33 with a sha256 checksum of each file. Nothing is sent, nothing is spent, and no secret is stored. `sending_enabled` stays false. The runner does not apply SQL.

## Where it shows

- `/command-centre`
- `/command-centre/migrations`
- `/agency`

Each row is `pending` until a later verification says otherwise. This phase does not verify any step as applied. Steps 20 through 32 are not applied in production. Step 33 is not applied either. The page must not claim they are.

When Supabase keys are empty, or `SUPABASE_DB_URL` is missing, the list is a fixture and every step stays pending. `SUPABASE_DB_URL` is shown as `configured` or `missing`. The value is not shown.

With Supabase keys set and no session, `/command-centre/migrations` redirects to `/login` (307). `/command-centre` and `/agency` do the same.

## Read-only catalog

Filenames come from the numbered list in `supabase/APPLY-ORDER.md`. Checksums are the sha256 of those files in the repo. The page does not read a secret, a merchant id, or a token.

## Feature flag

Leave this unset until step 33 is applied. Unset, blank, or any value other than the string `true` keeps `write` false. A preview render stays fixture-only even if the flag is set.

- `MIGRATION_RUNNER_ENABLED` as the string `true`, a signed-in workspace, and a configured `SUPABASE_DB_URL` may store a sandbox dry-run: one `migration_runner_events` row per step, with `status` `pending`, `sandbox` true, and `charged` false.

The function is `record_migration_dry_run`. It does not execute the migration files. It does not mark a step applied. A secret field is refused and is not written. The row has no secret column.

Without `SUPABASE_DB_URL`, the dry-run writes nothing even when the flag is the string `true`.

`SETUP_WIZARD_ENABLED` and the earlier phase 5 flags stay unset. This page does not turn them on.

Leave these unset:

- `CRON_SECRET`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a live email, SMS, Meta, or PayFast key in the environment for this step. Do not create a paid developer account and do not submit a store listing.

## Apply the migration

This is step 33 in `supabase/APPLY-ORDER.md`, after step 32:

`supabase/migrations/20261108120000_phase5l_migration_runner.sql`

Steps 20 through 32 are still unapplied. Step 33 is also unapplied. After Billy re-authenticates Supabase, run steps 20 through 32, then step 33. A real `sbp_` connection string, or the SQL editor after re-auth, is what Billy still needs. Do not claim this SQL is already applied.

Apply it after step 32. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not schedule a cron.

## Fixture check

With Supabase keys empty, open `/command-centre`, `/agency`, and `/command-centre/migrations`. Each panel lists steps 20 through 33 as pending, shows `phase5l_migration_runner`, and shows `MIGRATION_RUNNER_ENABLED` unset. Record sandbox dry-run does not write. `write` stays false.

With Supabase keys set and no session, `/command-centre/migrations` redirects to `/login`.
