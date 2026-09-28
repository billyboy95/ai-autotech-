# Campaign dry run and Meta connect stubs

`/command-centre/campaigns` can preview a campaign against sandbox contacts. `/command-centre/connect-accounts` keeps the account list, and WhatsApp (Meta Cloud) plus Facebook / Instagram open a sandbox stub. Nothing is sent, nothing is charged, and `sending_enabled` stays false.

## Campaign dry run

The panel shows the recipient count, the `consent_basis` breakdown, and an estimated cost in ZAR. The estimate is a placeholder (WhatsApp R0.62, SMS R0.35, email R0.05 per person who would receive). It is not charged.

Dry run lists who would receive and who is blocked:

- POPIA: `consent_basis` is missing, or it is not `consent` or `existing_customer`.
- consent: the person is opted out or suppressed.
- STOP: the person sent STOP. STOP is honoured and that person is not in the would-receive list.

Send now and Go live are refused while sending is off. The outbox stays at 0 queued. A dry run does not insert a queued or sent outbox row.

With the flag unset, the panel uses a fixture (Ayesha Patel, Johan Botha, Thabo Ndlovu, Nomsa Dlamini, Pieter Venter). With the flag on for a signed-in workspace, it uses draft prospects and the latest contact import. A report is stored only then.

## WhatsApp and Facebook / Instagram

Connect on those two cards opens `/command-centre/connect-accounts/whatsapp` or `/command-centre/connect-accounts/meta`.

Status badges:

- Not connected: no stub has been saved.
- Sandbox stub: a stub row was saved. It is not a live connection.
- Needs provider keys: Billy still has to add the Meta app credentials. This page does not run OAuth and does not store a secret.

Send test is a dry run only. It is refused while provider keys are missing. It does not call Meta.

The other account cards stay on the step 24 checklist.

## Feature flags

Leave both unset until step 26 is applied. Unset, blank, or any value other than `true` keeps the pages visible and fixture-only. Nothing is written.

- `CAMPAIGN_DRY_RUN_ENABLED=true` stores sandbox dry-run reports.
- `META_CONNECT_STUB_ENABLED=true` stores the WhatsApp and Facebook / Instagram stub status.

A preview render stays fixture-only. `HOME_CHAT_ENABLED` is unchanged.

Leave these unset:

- `CRON_SECRET`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a live Meta, SMS, or PayFast key in the environment for this step.

## Apply the migration

This is step 26 in `supabase/APPLY-ORDER.md`, after step 25:

`supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql`

Apply it after step 25. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not schedule a cron.

## Fixture check

With Supabase keys empty, open `/command-centre/campaigns`. The page should load the dry-run panel, show `consent_basis`, an estimated cost that is not charged, and say sending stays off. Dry run does not queue. Send now is refused. Open `/command-centre/outbox` and the queued count stays 0.

Open `/command-centre/connect-accounts`. WhatsApp and Facebook / Instagram show Not connected, and the page names Sandbox stub and Needs provider keys. Open the WhatsApp stub. It says Billy must add Meta app credentials later. Send test is refused. Nothing is sent.

With Supabase keys set and no session, `/command-centre/campaigns`, `/command-centre/connect-accounts`, and `/command-centre/connect-accounts/whatsapp` redirect to `/login`.
