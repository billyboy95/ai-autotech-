# Phase 5o sandbox go-live readiness checklist

One page that gathers the existing Phase 5 checks so Billy can see what is left before production go-live. Each row is a status. The value is never shown and never stored. Nothing is sent, nothing is spent, SQL is not run, and Apply is not clicked. `sending_enabled` stays false and shows as OFF / blocked.

## Where it shows

- `/command-centre/go-live`
- A link on `/command-centre`
- A link on `/agency`
- A link on `/command-centre/setup`

With Supabase keys empty, the checklist is fixture and `write` is false. `sending_enabled` still shows OFF / blocked.

With Supabase keys set and no session, `/command-centre/go-live` redirects to `/login` (307). `/command-centre`, `/command-centre/setup`, and `/agency` do the same.

The phone checklist for this page is `docs/phone-go-live.md` (step 36). Fixture mode is the verify before the flag. Signed out, `/command-centre`, `/command-centre/go-live`, `/command-centre/setup`, and `/agency` answer 307 and land on `/login`. With the flag unset the fixture sentence stays on screen and `write` stays false. Do not claim a go-live note is stored. That page does not run SQL, click Apply, register a cron, or turn sending on. `sending_enabled` shows OFF / blocked. A yes for Dry run, the East Rand seed, the PWA install verify, the setup wizard, the migration runner, the owner bootstrap panel, the ops secrets panel, keys, `CRON_SECRET`, packs, a website publish, SQL, or the Owner Auth verify is not a yes for `GOLIVE_CHECKLIST_ENABLED`.

## Rows

Status words on the page are `configured`, `missing`, `pending`, `fixture`, or `blocked`. A stored note uses `pending`, `ready`, `blocked`, or `fixture` only.

- SQL migrations. Pending until steps 20 through 36 are verified. The link opens `/command-centre/migrations`. This page does not run SQL.
- Setup wizard. Link to `/command-centre/setup`. `SETUP_WIZARD_ENABLED` stays unset.
- Owner bootstrap. Link to `/command-centre/owner`. The address list is not shown. This page does not create an Auth user and does not run `owner-bootstrap.sql`.
- Ops secrets. Link to `/command-centre/ops-secrets`. CRON_SECRET, email, WhatsApp / Meta, SMS, and PayFast sandbox are presence only.
- Education pack (EASTC). Applied or pending. This page does not click Apply. The phone click order, after steps 20 through 36 succeed, is `docs/GO-LIVE-RUNBOOK.md` (Phone-first unblock, step 8). There is no env flag that applies this pack. The pack is not applied.
- Zentrix pack. Applied or pending. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset. This page does not click Apply. The same step 8 is the click path on `/agency` or `/agency/zentrix/settings`, and only once that flag is the string `true` and Billy says yes. The pack is not applied.
- PWA install shell. Flag status only. Optional. Not a go-live blocker.
- `sending_enabled`. OFF / blocked until Billy explicitly enables it later. This page does not turn it on.

## Feature flag

Leave this unset until step 36 is applied. Unset, blank, or any value other than the string `true` keeps `write` false. A preview render stays fixture-only even if the flag is set.

- `GOLIVE_CHECKLIST_ENABLED` as the string `true` and a signed-in agency workspace may store one sandbox `golive_checklist_notes` row. `sending` stays `blocked`. `status` stays `noted`. `sandbox` stays true. `charged` stays false.

The function is `record_golive_checklist_note`. It does not read a secret back out. It does not apply SQL. It does not click Apply. A secret field is refused and is not written. The row has no secret column.

Leave these unset:

- `MIGRATION_RUNNER_ENABLED`
- `SETUP_WIZARD_ENABLED`
- `OWNER_BOOTSTRAP_UI_ENABLED`
- `OPS_SECRETS_READY_ENABLED`
- `ZENTRIX_WORKSPACE_PACK_ENABLED`
- `EAST_RAND_CAMPAIGN_SEED_ENABLED`
- `PWA_INSTALL_SHELL_ENABLED`
- `AI_REPLY_CRON_ENABLED`
- the earlier phase 5 flags

Do not register a cron. Do not turn sending on. Do not put a live email, SMS, Meta, or PayFast key in the database for this step.

## Apply the migration

This is step 36 in `supabase/APPLY-ORDER.md`, after step 35:

`supabase/migrations/20261111120000_phase5o_golive_checklist.sql`

Steps 20 through 35 are still unapplied. Step 36 is also unapplied. After Billy re-authenticates Supabase, run steps 20 through 35, then step 36. Do not claim this SQL is already applied. The operator sequence (SQL editor or CLI, schema reload, flags, packs, owner SQL, and the decisions Billy still has to make) is `docs/GO-LIVE-RUNBOOK.md`. Pack clicks are Phone-first unblock, step 8, after SQL Success. This page does not apply that sequence and does not click either pack.

Apply it after step 35. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not register a cron.

## Fixture check

With Supabase keys empty, open `/command-centre/go-live`. The checklist shows fixture rows, `sending_enabled` as OFF / blocked, and `GOLIVE_CHECKLIST_ENABLED` unset. Record sandbox note does not write. `write` stays false.

With Supabase keys set and no session, `/command-centre/go-live` redirects to `/login`.
