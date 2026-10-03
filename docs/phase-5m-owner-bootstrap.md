# Phase 5m sandbox owner bootstrap

A checklist Billy can open next to the setup wizard and the migration runner. It shows whether `OWNER_EMAILS` is configured or missing, and whether the documented agency owner is attached in Supabase Auth. Nothing is sent, nothing is spent, and no secret is stored. `sending_enabled` stays false. The page does not create an Auth user and does not run `supabase/owner-bootstrap.sql`.

The only address this page names is `billyfaber06@gmail.com`. That is the documented owner Billy typed for `OWNER_EMAILS`. If the variable is set, the list is not shown. If it is unset or blank, the server uses that same address.

## Where it shows

- `/command-centre/setup`
- `/command-centre/owner`
- `/agency`

`OWNER_EMAILS` is `configured` or `missing`. Auth attach is `configured`, `missing`, or `fixture`.

- `configured` means the documented address exists in Supabase Auth and already has `agency_owner` on `ai-autotech`.
- `missing` means the page could read Auth and the user or the membership is not there.
- `fixture` means this render did not read Auth. Preview, empty Supabase keys, and a failed read stay fixture. A failed read is not reported as missing.

When Supabase keys are empty, the panel is fixture and `write` is false.

With Supabase keys set and no session, `/command-centre/owner` redirects to `/login` (307). `/command-centre/setup` and `/agency` do the same.

## SQL paste

The panel shows the repo file `supabase/owner-bootstrap.sql` read-only, with its sha256 checksum. It links to Authentication → Users and to the Supabase SQL editor.

Create the Auth user in the dashboard first. Then paste that file in the SQL editor. The file attaches `billyfaber06@gmail.com` as `agency_owner` of `ai-autotech`. It does not delete anything. This page does not paste it and does not run it.

The phone checklist is `docs/phone-owner-auth-bootstrap.md` (`docs/GO-LIVE-RUNBOOK.md`, Phone-first unblock, step 4). Confirm the Auth user and the `OWNER_EMAILS` name there. Do not paste `supabase/owner-bootstrap.sql` until steps 20 through 36 have succeeded and the Auth user exists. Leave `OWNER_BOOTSTRAP_UI_ENABLED` unset until step 34 is applied.

Steps 20 through 33 are not applied. Step 34 is also unapplied. Do not claim that SQL is already applied.

## Feature flag

Leave this unset until step 34 is applied. Unset, blank, or any value other than the string `true` keeps `write` false. A preview render stays fixture-only even if the flag is set.

- `OWNER_BOOTSTRAP_UI_ENABLED` as the string `true` and a signed-in agency workspace may store one sandbox `owner_bootstrap_notes` row: `owner_emails` (`configured` or `missing`), `auth_attach` (`configured`, `missing`, or `fixture`), the filename `supabase/owner-bootstrap.sql`, and a sha256 checksum. `status` stays `noted`. `sandbox` stays true. `charged` stays false.

The function is `record_owner_bootstrap_note`. It does not create an Auth user. It does not insert a membership. It does not execute `owner-bootstrap.sql`. A secret field is refused and is not written. The row has no email column and no secret column.

`MIGRATION_RUNNER_ENABLED`, `SETUP_WIZARD_ENABLED`, and the earlier phase 5 flags stay unset. This page does not turn them on.

Leave these unset:

- `CRON_SECRET`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a live email, SMS, Meta, or PayFast key in the environment for this step. Do not create a paid developer account and do not submit a store listing. Do not turn sending on.

## Apply the migration

This is step 34 in `supabase/APPLY-ORDER.md`, after step 33:

`supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql`

Steps 20 through 33 are still unapplied. Step 34 is also unapplied. After Billy re-authenticates Supabase, run steps 20 through 33, then step 34. A real `sbp_` connection string, or the SQL editor after re-auth, is what Billy still needs. Do not claim this SQL is already applied.

Apply it after step 33. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not schedule a cron. It does not create the Auth user. After the Auth user exists, paste `supabase/owner-bootstrap.sql`.

## Fixture check

With Supabase keys empty, open `/command-centre/setup`, `/command-centre/owner`, and `/agency`. Each panel shows `OWNER_EMAILS`, Auth attach as fixture, `billyfaber06@gmail.com`, the SQL text, and `OWNER_BOOTSTRAP_UI_ENABLED` unset. Record sandbox note does not write. `write` stays false.

With Supabase keys set and no session, `/command-centre/owner` redirects to `/login`.
