# Sandbox social drafts and TikTok / LinkedIn stubs

`/command-centre/social` keeps the copy-and-post list and adds a sandbox queue of week 1 drafts. `/command-centre/connect-accounts` adds TikTok and LinkedIn stubs beside WhatsApp, Facebook / Instagram, Email, and SMS. Nothing is posted, nothing is charged, no ad is bought, and `sending_enabled` stays false.

## Social drafts

Week 1 topics are Monday through Friday: introduce the business, one problem, how it works, proof without a real name, and an offer of a conversation. Create or edit a draft from those topics, then schedule it locally in Johannesburg time.

- Save draft stores a draft. It does not post.
- Schedule locally stores `scheduled_for` on the draft. That time is a note. It does not run a cron and it does not write the outbox.
- Publish, Post now, and Go live are refused. Billy must approve sends. This phase does not post under his name.

With `SOCIAL_DRAFTS_ENABLED` unset, the list is fixture-only and is not stored. Set it to the string `true` only after step 28, and only to store sandbox drafts.

## TikTok and LinkedIn

Connect opens `/command-centre/connect-accounts/tiktok` or `/command-centre/connect-accounts/linkedin`.

Status badges:

- Not connected: no stub has been saved.
- Sandbox stub: a stub row was saved. It is not a live connection.
- Needs provider keys: Billy still has to add the provider keys. This page does not run OAuth and does not store a secret.

Send, test, and publish are refused while provider keys are missing. No provider is called.

## Feature flags

Leave both unset until step 28 is applied. Unset, blank, or any value other than `true` keeps the pages visible and fixture-only. Nothing is written.

- `SOCIAL_DRAFTS_ENABLED=true` stores sandbox social drafts.
- `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED=true` stores the TikTok and LinkedIn stub status.

`CAMPAIGN_CSV_IMPORT_ENABLED`, `EMAIL_SMS_CONNECT_STUB_ENABLED`, `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, and `HOME_CHAT_ENABLED` are unchanged.

Leave these unset:

- `CRON_SECRET`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a live TikTok, LinkedIn, Meta, SMS, or PayFast key in the environment for this step.

## Apply the migration

This is step 28 in `supabase/APPLY-ORDER.md`, after step 27:

`supabase/migrations/20261103120000_phase5g_social_drafts.sql`

Apply it after step 27. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not schedule a cron.

Step 29 is the Zentrix Online workspace pack. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset until that file is applied. See `docs/zentrix-workspace-pack.md`.

## Fixture check

With Supabase keys empty, open `/command-centre/social`. The sandbox list should show the week 1 topics. Publish, Post now, and Go live are refused, and the page says Billy must approve sends. Nothing is posted.

Open `/command-centre/connect-accounts`. TikTok and LinkedIn show Not connected, and the page names Sandbox stub and Needs provider keys. Open each stub. It says Billy must add the keys later. Send test and Publish are refused. Nothing is posted.

With Supabase keys set and no session, `/command-centre/social`, `/command-centre/connect-accounts`, `/command-centre/connect-accounts/tiktok`, and `/command-centre/connect-accounts/linkedin` redirect to `/login`.
