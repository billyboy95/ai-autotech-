# Phase 5n sandbox ops secrets readiness

A checklist Billy can open next to the setup wizard. It shows whether `CRON_SECRET` and the outbound channel provider keys are present on this deployment. Each row is `configured`, `missing`, or `fixture`. The value is never shown and never stored. Nothing is sent, nothing is spent, and `sending_enabled` stays false. The page does not register a cron.

## Where it shows

- `/command-centre/ops-secrets`
- A link on `/command-centre`
- A link and the panel on `/agency`
- A link and the panel on `/command-centre/setup`

`CRON_SECRET`, the email provider (Resend or SMTP), WhatsApp / Meta, the SMS provider, and PayFast sandbox keys are each `configured`, `missing`, or `fixture`.

Whether `Willem@aiautotech.co.za` can receive is [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md) (Phone-first unblock, step 13). That page verifies Google MX and SPF. It does not set a key and it does not send. The From checklist is [`docs/phone-willem-send-from.md`](phone-willem-send-from.md) (step 12).

- `configured` means the signed-in deployment has the provider keys set. The value is not shown.
- `missing` means the signed-in deployment does not have that provider set. A PayFast merchant id that is not the sandbox merchant stays missing. The id is not shown.
- `fixture` means this render is not a signed-in deployment read. Preview and empty Supabase keys stay fixture.

When Supabase keys are empty, the panel is fixture and `write` is false.

With Supabase keys set and no session, `/command-centre/ops-secrets` redirects to `/login` (307). `/command-centre`, `/command-centre/setup`, and `/agency` do the same.

The phone checklist for this panel is `docs/phone-ops-secrets.md` (step 35). Fixture mode is the verify before the flag. Signed out, `/command-centre`, `/command-centre/ops-secrets`, `/command-centre/setup`, and `/agency` answer 307 and land on `/login`. With the flag unset the fixture sentence stays on screen and `write` stays false. Do not claim an ops note is stored. That page does not register a cron and does not put a live Meta, SMS, email, or PayFast key in the database. A yes for Dry run, the East Rand seed, the PWA install verify, the setup wizard, the migration runner, the owner bootstrap panel, keys, `CRON_SECRET`, packs, a website publish, SQL, or the Owner Auth verify is not a yes for `OPS_SECRETS_READY_ENABLED`. Generating and saving `CRON_SECRET` stays `docs/phone-cron-secret.md`. The schedule paste stays `docs/phone-pg-cron-schedules.md`. The next phone checklist is `docs/phone-go-live.md` (step 36). This page does not set `GOLIVE_CHECKLIST_ENABLED`. Signed out, `/command-centre`, `/command-centre/go-live`, `/command-centre/setup`, and `/agency` answer 307 and land on `/login`. With the flag unset, `write` stays false. The go-live page stores pending, ready, blocked, or fixture only and does not run SQL.

## Cron dry-run

The panel lists these names only:

- `automation`
- `workflow-engine`
- `billing-cycle`
- `ai-reply-drafts`

These are the jobs that would be registered once `CRON_SECRET` exists. The page does not register them. `AI_REPLY_CRON_ENABLED` stays unset. `vercel.json` is not changed. After `CRON_SECRET` is saved, the phone paste is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This panel still does not register them.

## Feature flag

Leave this unset until step 35 is applied. Unset, blank, or any value other than the string `true` keeps `write` false. A preview render stays fixture-only even if the flag is set.

- `OPS_SECRETS_READY_ENABLED` as the string `true` and a signed-in agency workspace may store one sandbox `ops_secrets_notes` row. The row stores the five presence values and the cron names above. `status` stays `noted`. `sandbox` stays true. `charged` stays false.

The function is `record_ops_secrets_note`. It does not read a secret back out. It does not register a cron. A secret field is refused and is not written. The row has no secret column and no email column.

`MIGRATION_RUNNER_ENABLED`, `SETUP_WIZARD_ENABLED`, `OWNER_BOOTSTRAP_UI_ENABLED`, and the earlier phase 5 flags stay unset. This page does not turn them on.

Leave these unset:

- `AI_REPLY_CRON_ENABLED`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`

Do not put a live email, SMS, Meta, or PayFast key in the database for this step. Do not turn sending on. Do not schedule a cron that sends.

## Apply the migration

This is step 35 in `supabase/APPLY-ORDER.md`, after step 34:

`supabase/migrations/20261110120000_phase5n_ops_secrets_ready.sql`

Steps 20 through 34 are still unapplied. Step 35 is also unapplied. After Billy re-authenticates Supabase, run steps 20 through 34, then step 35. Do not claim this SQL is already applied.

Apply it after step 34. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not register a cron.

## Fixture check

With Supabase keys empty, open `/command-centre/ops-secrets`, `/command-centre/setup`, and `/agency`. Each panel shows the five rows as fixture, the four cron names, and `OPS_SECRETS_READY_ENABLED` unset. Record sandbox note does not write. `write` stays false.

With Supabase keys set and no session, `/command-centre/ops-secrets` redirects to `/login`.
