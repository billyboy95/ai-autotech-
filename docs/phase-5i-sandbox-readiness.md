# Phase 5i sandbox seed and ops readiness

Two sandbox controls. Neither one sends, spends, or stores a secret. `sending_enabled` stays false.

## East Rand sandbox seed

`/command-centre/campaigns` shows a one-click control on the AI AutoTech workspace. It dry-loads the in-repo fixture `data/campaigns/east-rand-sandbox.csv`.

The file uses the phase 5f consent-ready columns, including `consent_basis`. The rows are labelled sandbox. Names, emails, and phones are fake. The file is not Billy's box export.

Dry-load writes a draft only:

- Campaign name is `East Rand sandbox (draft)`.
- Rows land in `campaign_csv_imports` and `campaign_csv_prospects` through `save_campaign_csv_import`.
- A missing `consent_basis` is skipped and is not queued.
- `queued_count` and `sent_count` stay 0. `charged` stays false. Status stays `draft`.
- Send now and Go live call `refuse_east_rand_seed_send`, which calls `refuse_campaign_csv_send`.
- Clicking the seed again with the same rows returns the existing draft.

With the flag unset, the panel uses the fixture and does not write. With the flag on for a signed-in agency owner, agency staff member, or client admin of AI AutoTech, the dry-load is stored.

## Ops readiness

`/agency` and `/command-centre` show a read-only checklist:

- Steps 20 through 29 are still unapplied. Step 30 is also unapplied. Step 31 is also unapplied. The page does not claim the SQL is applied.
- PWA install is optional. It is not a go-live blocker and it does not say needs Billy. No store listing is live. See `docs/phase-5j-pwa-mobile-shell.md`.
- Whether the current user has `agency_owner` on `ai-autotech`. `OWNER_EMAILS` is reported as set or unset. The address list is not shown.
- `CRON_SECRET` is present or missing. The value is not shown. A missing secret says needs Billy.
- Meta, SMS, and email keys say needs Billy. The checklist does not read those values.
- `sending_enabled` must stay false.
- `BILLING_SANDBOX` and the PayFast sandbox merchant. A non-sandbox merchant id is refused and is not shown.
- Apply Education pack to EASTC links to the existing button. The phone click order is `docs/GO-LIVE-RUNBOOK.md` (Phone-first unblock, step 8). This page does not click it. The pack is not applied.
- Apply Zentrix pack links to the existing button and names `ZENTRIX_WORKSPACE_PACK_ENABLED`. The same step 8 is the click path. Leave the flag unset. The pack is not applied.

The checklist does not write, does not call Vercel, and does not send.

## Feature flag

Leave this unset until step 30 is applied. Unset, blank, or any value other than `true` keeps the seed visible and fixture-only. Nothing is written.

- `EAST_RAND_CAMPAIGN_SEED_ENABLED=true` stores the sandbox draft.

`ZENTRIX_WORKSPACE_PACK_ENABLED` and the earlier flags are unchanged.

Leave these unset:

- `CRON_SECRET`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a live email, SMS, Meta, or PayFast key in the environment for this step.

## Apply the migration

This is step 30 in `supabase/APPLY-ORDER.md`, after step 29:

`supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql`

Steps 20 through 30 are still unapplied. Step 31 is also unapplied. After Billy re-authenticates Supabase, run steps 20 through 29, then step 30, then step 31. Do not claim this SQL is already applied.

Apply it after step 29. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not schedule a cron.

## Fixture check

With Supabase keys empty, open `/command-centre/campaigns`. The East Rand sandbox seed shows sandbox rows, a missing-consent skip, a POPIA block, and a STOP block. Load sandbox seed does not queue. Send now and Go live are refused. The page names `EAST_RAND_CAMPAIGN_SEED_ENABLED`.

Open `/agency` and `/command-centre`. Both show Ops readiness, steps 20 through 29, `sending_enabled`, `CRON_SECRET`, `BILLING_SANDBOX`, and `ZENTRIX_WORKSPACE_PACK_ENABLED`. Channel keys say needs Billy. Step 30 is also unapplied. Step 31 is also unapplied. PWA install is optional and is not a Billy blocker.

With Supabase keys set and no session, `/command-centre/campaigns`, `/command-centre`, and `/agency` redirect to `/login`.
