# Connect accounts and import contacts

After the Lead Agent sandbox trial, the next step is to connect accounts and import contacts. Both pages are sandbox stubs. They do not call Gmail, Meta, TikTok, or an SMS provider. They do not send messages, buy ads, or charge a card. `sending_enabled` stays false.

## Pages

- `/command-centre/connect-accounts` lists Email / Gmail, WhatsApp (Meta Cloud), SMS, Facebook / Instagram, Calendar (Google), TikTok, and LinkedIn.
- Connect means not started. Needs keys means a checklist row is saved and Vault has no secret. Connected means a `channel_connections` row is connected and `secret_id` is set.
- Calendar stays a checklist row. TikTok and LinkedIn are sandbox stubs from step 28. They are not added to the phase 2b channel check. See `docs/social-drafts.md`.
- `/command-centre/import-contacts` maps a consent-ready CSV (`name`, `phone`, `email`, `consent_basis`) and runs a dry run. Import to sandbox writes `contact_import_drafts` when step 24 is applied. Otherwise it stays a stub. Rows are not copied to `crm_outbox`.

The command centre still requires a login when Supabase keys are set. Fixture mode, with those keys empty, renders both pages.

## Environment

Leave these unset:

- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`
- `CRON_SECRET`

Do not put a live provider key in the environment for this step.

## Apply the migration

This is step 24 in `supabase/APPLY-ORDER.md`, after step 23:

`supabase/migrations/20261030120000_phase5c_connect_import.sql`

Apply it after step 23. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on.

## Fixture check

With Supabase keys empty, open `/command-centre/connect-accounts`. The page should load, list the seven accounts, and name Connect, Needs keys, and Connected. Open `/command-centre/import-contacts`. The page should load, show `consent_basis`, and offer Import to sandbox. Nothing is sent.

With Supabase keys set and no session, both URLs redirect to `/login`.

## WhatsApp and Facebook / Instagram

WhatsApp (Meta Cloud) and Facebook / Instagram also show Not connected, Sandbox stub, and Needs provider keys. Connect opens a sandbox stub. Billy adds the Meta app credentials later. No key is stored and Send test is refused. See `docs/campaign-dry-run.md`.

## Email and SMS

Email (Resend or SMTP) and SMS (SMSPortal, BulkSMS, or Clickatell) use the same three statuses. Connect opens `/command-centre/connect-accounts/gmail` or `/command-centre/connect-accounts/sms`. Billy adds the provider keys later. SMS names are placeholders. No OAuth runs, no key is stored, and Send test is refused. Leave `EMAIL_SMS_CONNECT_STUB_ENABLED` unset until step 27 is applied. See `docs/campaign-csv-import.md`.

## TikTok and LinkedIn

TikTok and LinkedIn use the same three statuses. Connect opens `/command-centre/connect-accounts/tiktok` or `/command-centre/connect-accounts/linkedin`. Billy adds the keys later. No OAuth runs, no key is stored, and send, test, and publish are refused. Leave `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED` and `SOCIAL_DRAFTS_ENABLED` unset until step 28 is applied. See `docs/social-drafts.md`.

## After import

The home assistant is the next step. See `docs/home-chat.md`. It stays fixture-only until `HOME_CHAT_ENABLED` is the string `true`. Nothing is sent.
