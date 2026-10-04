# Phone checklist: East Rand sandbox seed (no send)

Billy runs this on a phone in South Africa (Safari or Chrome). It is the tap path for **Load sandbox seed** under **East Rand sandbox seed** on `/command-centre/campaigns`. The desktop notes stay in [`docs/phase-5i-sandbox-readiness.md`](phase-5i-sandbox-readiness.md). The box consent CSV is a different visit ([`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md)). **Dry run** on the same page is a different visit ([`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md)). The later gate that turns sending on for one named workspace is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). This page is not that yes.

Writing this page does not apply SQL, does not set a flag, does not send, and does not register a webhook. Steps 20 through 36 stay unapplied until a Success from a previous visit is already written down. This page does not invent that Success. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This page does not paste a token. Gated Phase 5 command-centre panels stay paused until that SQL and Billy’s yes to the matching flag. Opening the campaigns page in fixture mode does not unpause them.

The production CRM is https://ai-autotech-crm.vercel.app . The workspace for this visit is slug `ai-autotech`.

## Preconditions

All of these stay true on this visit. If one is false, stop.

1. Steps 20 through 36 are still unapplied. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) and [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) still say so. A phone verify in fixture mode is allowed before that Success. This page does not paste SQL and does not claim Success.
2. Step 30 is `supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql` (`phase5i_campaign_seed_ops`). A stored draft waits until that file has shown Success (`Success. No rows returned` in the SQL editor, or `Success. Steps 20–36 applied.` from the CLI). Until that Success is already logged, the panel stays fixture-only and stores nothing. Step 30 also needs step 27 (`save_campaign_csv_import`). This page does not skip ahead.
3. Leave `EAST_RAND_CAMPAIGN_SEED_ENABLED` unset until step 30 has succeeded and Billy says yes to that flag on a later call. Unset, blank, or any value other than the string `true` keeps the page fixture-only. Fixture mode is the phone verify on this visit. Setting the flag does not apply SQL and does not send.
4. A yes for **Dry run**, the consent CSV load, a channel key, `CRON_SECRET`, the Education pack, the Zentrix pack, or a website publish is not a yes for `EAST_RAND_CAMPAIGN_SEED_ENABLED` and is not a yes to send.
5. `sending_enabled` stays false on every workspace. The checkbox **Sending enabled** stays unticked.
6. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A yes to this seed is not a yes to either switch. The only later yes is one named workspace on [`docs/phone-sending-enabled.md`](phone-sending-enabled.md).
7. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). See [`docs/website-publish-decision.md`](website-publish-decision.md).

The logged-out production smoke, after SQL Success, is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). This page is the signed-in fixture tap. It does not replace that smoke, and that smoke does not replace this tap.

## The file

The button dry-loads the in-repo fixture `data/campaigns/east-rand-sandbox.csv`. Billy does not paste it. The phone does not upload it.

The header is the consent-ready columns, including `consent_basis`:

`name`, `business`, `niche`, `website`, `phone`, `email`, `opening line`, `consent_basis`

The file has 22 data rows. Names start with `Sandbox`. Emails end with `@sandbox.example`. Phones are fake. The file is not Billy’s box export. It is not `/workspace/aiautotech-outbound/campaign-east-rand-consent-ready.csv`. That box file is [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md). It is not the held-draft file behind **Load held draft**.

## 1. Open campaigns on the phone

1. Open https://ai-autotech-crm.vercel.app/command-centre/campaigns
2. Signed out, the auth gate answers 307 and the phone lands on `/login`. `next` is `/command-centre/campaigns`. Sign in as the agency owner. The documented address is `billyfaber06@gmail.com` when that Auth user exists ([`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md), Phone-first unblock, step 4).
3. After sign-in, open the same campaigns URL again if the app landed on `/agency`.
4. Pass: the heading is **Campaigns**. The slug is `ai-autotech`. The header names AI AutoTech. The organisation row is AI AutoTech Pty Ltd, so that legal name on the same workspace is still a pass. If the header names EASTC or Zentrix, open https://ai-autotech-crm.vercel.app/command-centre/campaigns?org=ai-autotech , then open campaigns again. The seed panel is only on slug `ai-autotech`. Signed out, that link also 307s to `/login`, and `next` includes `org=ai-autotech`.

Scroll to the heading **East Rand sandbox seed**. The intro says one click dry-loads a fixed sandbox prospect set into `East Rand sandbox (draft)`, columns include `consent_basis`, the contacts are fake sandbox rows, and status stays draft.

Leave these alone on this visit:

- **Dry run** under **Campaign dry run**. That path is [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md).
- **Dry-load CSV** under **Sandbox CSV import**. That path is [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md).
- **Load held draft** under **East Rand draft**.
- **Import and queue** under **Import prospects**.
- **Save sequence**.

Read the banner under **East Rand sandbox seed**.

- Amber: `Fixture only. This seed is not stored until EAST_RAND_CAMPAIGN_SEED_ENABLED is true and step 30 is applied. Outbox queued: 0.` That line is the pass for this visit. The tap stores nothing.
- Slate: `Sandbox seed can be stored as a draft campaign. Sending stays off. Outbox queued: 0.` That line means step 30 has succeeded and `EAST_RAND_CAMPAIGN_SEED_ENABLED` is the string `true` on the running deployment, after Billy’s yes to that flag. This visit does not create that line. If the slate line is on screen before that Success is already written down, stop.

The same panel says `Sending stays off. Send now and Go live are refused. Outbox queued: 0.` If the page says `This sandbox seed does not send.` or says sending is on, stop.

## 2. Tap Load sandbox seed only

1. Tap **Load sandbox seed** once. It is the dark button under the counts.
2. Leave **Send now** untapped.
3. Leave **Go live** untapped.

Fixture pass, the amber status under the buttons:

`Fixture only. This seed is not stored until EAST_RAND_CAMPAIGN_SEED_ENABLED is true and step 30 is applied. Outbox queued: 0.`

That tap does not insert a campaign row, a queued outbox row, or a sent outbox row. The queued count stays 0. `sent_count` stays 0. `charged` stays false. Status stays draft. The label stays `sandbox`.

The counts on the panel are the fixture preview. They are on screen before the tap. They are not a stored import:

| Line | Fixture value |
| --- | --- |
| Sandbox rows | 22 |
| Imported | 21 |
| Skipped (missing consent) | 1 |
| POPIA blocked | 1 |
| STOP blocked | 1 |
| Label | `sandbox` |

The list under those counts has 22 lines. 19 say `would receive`. Three are blocked:

- Sandbox Chris Example — blocked (POPIA) · whatsapp. `consent_basis` is blank. This is the missing-consent skip. It is not stored as a draft prospect.
- Sandbox Olga Example — blocked (consent) · whatsapp. `consent_basis` is `opted_out`.
- Sandbox Sam Example — blocked (STOP) · whatsapp. `consent_basis` is `stopped`. STOP is honoured.

Sandbox Naledi Example is the email line: `would receive` · email. That row has no phone and `consent_basis` is `existing_customer`. The other would-receive lines are WhatsApp. A would-receive line is a preview. It is not a delivery.

`consent_basis` on the 22 rows is `consent` 16, `existing_customer` 3, missing 1, `opted_out` 1, `stopped` 1. The panel does not print that breakdown as its own line. It prints `POPIA blocked 1. STOP blocked 1. Label: sandbox.`

This panel does not show an estimated cost. If a rand line appears, it is a placeholder and it is not charged. `charged` stays false. The `Estimated cost R 0.67. Not charged.` line on **Campaign dry run** belongs to that other panel ([`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md)). It is not a charge for this seed. No card, no SMS credit, and no Meta bill.

Then tap **Open the outbox**. The queued count stays 0. Leave every button on the outbox untapped. Go back to campaigns. Do not tap **Load sandbox seed** a second time on this visit. A second fixture tap still stores nothing and still does not send.

Stop on any other status. These lines mean stop:

- The queued count is anything other than 0.
- The status does not contain `Outbox queued: 0`.
- `Apply step 30 before the East Rand sandbox seed is stored. Outbox queued: 0.` The flag is on and the schema is missing step 30. Leave `EAST_RAND_CAMPAIGN_SEED_ENABLED` unset until step 30 has succeeded. Do not paste SQL on this visit.
- `The sandbox seed was refused. Outbox queued: 0.`
- `Sending stays off. Send now is refused. Outbox queued: 0.` That is the refuse line for **Send now** and **Go live**. It is not the seed pass. If you tapped one of those, stop. Leave them untapped. The outbox queued count must still be 0.
- `This sandbox seed does not send. Outbox queued: 0.` That line means the page thinks sending is on. `sending_enabled` stays false. Stop.

When the slate store line was already honest (step 30 Success already logged, and Billy already said yes to `EAST_RAND_CAMPAIGN_SEED_ENABLED`), the status can instead read `Stored as a sandbox draft. Outbox queued: 0.` A later tap with the same rows reads `Already stored as a sandbox draft. Outbox queued: 0.` The campaign name stays `East Rand sandbox (draft)`. Status stays draft. `queued_count` and `sent_count` stay 0. `charged` stays false. This page does not turn the flag on to reach those lines.

## Stop rules

- No real send. Leave **Send now**, **Go live**, **Send test**, **Import and queue**, **Dry-load CSV**, **Dry run**, and **Load held draft** untapped.
- No social post. Leave **Publish** and **Post now** untapped.
- No ad spend, no SMS credit, no phone-number purchase, and no card charge.
- No cron registration. Leave `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, and `/api/cron/ai-replies` uncalled. The schedule paste stays on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md).
- No webhook.
- No secret, key, token, password, or merchant value in git, a pull request, chat, an issue, or this file. Do not paste the fixture phones, the box CSV, or a token.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- `EAST_RAND_CAMPAIGN_SEED_ENABLED` stays unset on this visit. A yes for Dry run, the CSV load, keys, `CRON_SECRET`, packs, or a website publish is not a yes for that flag.
- Do not set `PWA_INSTALL_SHELL_ENABLED`. That optional visit is [`docs/phone-pwa-install.md`](phone-pwa-install.md). A yes for this seed is not that yes. PWA install is not a go-live blocker.
- Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).
- Gated Phase 5 command-centre panels stay paused.
- Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) until a Success from a previous visit is already logged. This page does not claim they are applied.

## Pass means

You were signed in on the phone at `/command-centre/campaigns` for `ai-autotech`. Signed out, that URL 307s to `/login`. You tapped **Load sandbox seed** once. The amber status said the seed is not stored until `EAST_RAND_CAMPAIGN_SEED_ENABLED` is true and step 30 is applied, and the outbox queued count stayed 0. The fixture preview showed 22 sandbox rows, 21 imported, 1 skipped for missing consent, POPIA blocked 1, and STOP blocked 1. Chris, Olga, and Sam were the blocked lines. Naledi was the email would-receive line. No estimated cost was charged. **Send now** and **Go live** stayed untapped. No cron was registered. No secret was copied into git, a pull request, chat, or this file. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset or `false`. `EAST_RAND_CAMPAIGN_SEED_ENABLED` stayed unset.

A pass does not mean a draft was stored, a message was delivered, step 30 was applied by this page, the East Rand flag was turned on, or sending was turned on.
