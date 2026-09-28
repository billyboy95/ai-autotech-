# Sandbox campaign CSV import and email / SMS stubs

`/command-centre/campaigns` can dry-load a consent-ready CSV into a draft campaign. `/command-centre/connect-accounts` keeps the account list. Email and SMS open a sandbox stub next to the WhatsApp and Facebook / Instagram stubs from step 26. Nothing is sent, nothing is charged, and `sending_enabled` stays false.

## Campaign CSV

The box format is the phase 2b prospect file. These columns are required:

`name`, `business`, `niche`, `website`, `phone`, `email`, `opening line`, `consent_basis`

`consent_basis` is required. `yes` and `opted_in` count as `consent`. `existing` and `customer` count as `existing_customer`.

Dry-load writes a draft campaign only:

- Imported rows are stored as draft prospects.
- Skipped rows are the ones with missing consent. They are not queued.
- The preview blocks POPIA, consent, and STOP the same way as the phase 5e dry run.
- Send now and Go live are refused while sending is off. They are also refused if sending were on, because this path does not send.
- The outbox stays at 0 queued.

With the flag unset, the panel uses a fixture and does not write. With the flag on for a signed-in workspace, the dry-load is stored in `campaign_csv_imports` and `campaign_csv_prospects`.

## Email and SMS

Connect on those two cards opens `/command-centre/connect-accounts/gmail` or `/command-centre/connect-accounts/sms`.

Email is a Resend or SMTP stub. SMS names SMSPortal, BulkSMS, and Clickatell as placeholders. This page does not call those providers.

Status badges:

- Not connected: no stub has been saved.
- Sandbox stub: a stub row was saved. It is not a live connection.
- Needs provider keys: Billy still has to add the provider keys. This page does not run OAuth and does not store a secret.

Send test is a dry run only. It is refused while provider keys are missing.

WhatsApp and Facebook / Instagram stay on the step 26 stub. Email and SMS stay on this step. Calendar stays on the step 24 checklist. TikTok and LinkedIn are sandbox stubs in step 28. See `docs/social-drafts.md`.

## Feature flags

Leave both unset until step 27 is applied. Unset, blank, or any value other than `true` keeps the pages visible and fixture-only. Nothing is written.

- `CAMPAIGN_CSV_IMPORT_ENABLED=true` stores a sandbox CSV dry-load.
- `EMAIL_SMS_CONNECT_STUB_ENABLED=true` stores the Email and SMS stub status.

Apply this step after step 26. `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, and `HOME_CHAT_ENABLED` are unchanged.

Leave these unset:

- `CRON_SECRET`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a live email, SMS, Meta, or PayFast key in the environment for this step.

## Apply the migration

This is step 27 in `supabase/APPLY-ORDER.md`, after step 26:

`supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql`

Apply it after step 26. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not schedule a cron.

## Fixture check

With Supabase keys empty, open `/command-centre/campaigns`. The sandbox CSV panel should show imported and skipped (missing consent), a POPIA block, and a STOP block. Dry-load does not queue. Send now is refused. Open `/command-centre/outbox` and the queued count stays 0.

Open `/command-centre/connect-accounts`. Email and SMS show Not connected, and the page names Sandbox stub and Needs provider keys. Open the Email stub. It says Billy must add Resend or SMTP keys later. Open the SMS stub. It names SMSPortal, BulkSMS, and Clickatell as placeholders. Send test is refused. Nothing is sent.

With Supabase keys set and no session, `/command-centre/campaigns`, `/command-centre/connect-accounts`, `/command-centre/connect-accounts/gmail`, and `/command-centre/connect-accounts/sms` redirect to `/login`.
