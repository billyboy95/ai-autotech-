# Phone checklist: campaign Dry run (no send)

Billy runs this on a phone in South Africa (Safari or Chrome). It is the tap path for **Dry run** on `/command-centre/campaigns`. The desktop notes stay in [`docs/campaign-dry-run.md`](campaign-dry-run.md). The later gate that turns sending on for one named workspace is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). This page is not that yes.

Writing this page does not apply SQL, does not set a flag, does not send, and does not register a webhook. Steps 20 through 36 stay unapplied until a Success from a previous visit is already written down. This page does not invent that Success. Gated Phase 5 command-centre panels stay paused until that SQL and Billy’s yes to the matching flag. Opening the campaigns page in fixture mode does not unpause them.

The production CRM is https://ai-autotech-crm.vercel.app . The workspace for this visit is slug `ai-autotech`.

## Preconditions

All of these stay true on this visit. If one is false, stop.

1. Steps 20 through 36 are still unapplied. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) and [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) still say so. A phone verify in fixture mode is allowed before that Success. This page does not paste SQL and does not claim Success.
2. Step 26 is `supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql` (`phase5e_campaign_dry_run`). A stored dry-run report waits until that file has shown Success (`Success. No rows returned` in the SQL editor, or `Success. Steps 20–36 applied.` from the CLI). Until that Success is already logged, the panel stays fixture-only and stores nothing.
3. Leave `CAMPAIGN_DRY_RUN_ENABLED` unset until step 26 has succeeded and Billy says yes to that flag on a later call. Unset, blank, or any value other than the string `true` keeps the page fixture-only. Fixture mode is the phone verify on this visit. Setting the flag does not apply SQL and does not send.
4. Leave `META_CONNECT_STUB_ENABLED` unset on this visit. The same gate applies: step 26 Success, then Billy’s yes to that name. A stub flag is not a live WhatsApp or Meta connection.
5. `sending_enabled` stays false on every workspace. The checkbox **Sending enabled** stays unticked.
6. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A yes to this dry run is not a yes to either switch. The only later yes is one named workspace on [`docs/phone-sending-enabled.md`](phone-sending-enabled.md).
7. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). See [`docs/website-publish-decision.md`](website-publish-decision.md).

The logged-out production smoke, after SQL Success, is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). This page is the signed-in fixture tap. It does not replace that smoke, and that smoke does not replace this tap.

## 1. Open campaigns on the phone

1. Open https://ai-autotech-crm.vercel.app/command-centre/campaigns?org=ai-autotech
2. Signed out, the phone lands on `/login`. `next` is the campaigns path you opened, including `org=ai-autotech` when you used that link. Sign in as the agency owner. The documented address is `billyfaber06@gmail.com` when that Auth user exists ([`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md), Phone-first unblock, step 4).
3. After sign-in, open the same campaigns URL again if the app landed on `/agency`.
4. Pass: the heading is **Campaigns**. The slug is `ai-autotech`. The header names AI AutoTech. The organisation row is AI AutoTech Pty Ltd, so that legal name on the same workspace is still a pass. If the header names EASTC or Zentrix, open the `?org=ai-autotech` link again, then open campaigns again.

Scroll to the heading **Campaign dry run**. Leave these alone on this visit:

- **Sandbox CSV import** and **Dry-load CSV**. That path is [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md).
- **Load sandbox seed** under **East Rand sandbox seed**.
- **Import and queue** under **Import prospects**.
- **Save sequence**.

Read the banner under **Campaign dry run**.

- Amber: `Fixture only. Reports are not stored until CAMPAIGN_DRY_RUN_ENABLED is true and step 26 is applied. Nothing is queued.` That line is the pass for this visit. The tap stores nothing.
- Slate: `Sandbox reports can be stored. Sending stays off. Nothing is queued.` That line means step 26 has succeeded and `CAMPAIGN_DRY_RUN_ENABLED` is the string `true` on the running deployment, after Billy’s yes to that flag. This visit does not create that line. If the slate line is on screen before that Success is already written down, stop.

The same panel says `Sending stays off. Send now and go live are refused. Outbox queued: 0.` If the page says sending is on, stop.

## 2. Tap Dry run only

1. Tap **Dry run** once. It is the dark button under the report.
2. Leave **Send now** untapped.
3. Leave **Go live** untapped.

Fixture pass, the amber status under the buttons:

`Dry run only. Nothing was queued. Fixture only. This report is not stored. Outbox queued: 0.`

That tap does not insert a queued outbox row and does not insert a sent outbox row. The queued count stays 0.

When the slate store line was already honest (step 26 Success already logged, and Billy already said yes to `CAMPAIGN_DRY_RUN_ENABLED`), the status can instead read:

`Dry run only. Nothing was queued. Stored as a sandbox report. Outbox queued: 0.`

`charged` stays false. `queued_count` and `sent_count` stay 0. This page does not turn the flag on to reach that line.

Then tap **Open the outbox**. The queued count stays 0. Leave every button on the outbox untapped. Go back to campaigns. Do not tap **Dry run** a second time on this visit.

Stop on any other status. These lines mean stop:

- The queued count is anything other than 0.
- The status does not contain `Nothing was queued`.
- `Apply step 26 before a dry-run report is stored. Nothing was queued.` The flag is on and the schema is missing step 26. Leave `CAMPAIGN_DRY_RUN_ENABLED` unset until step 26 has succeeded. Do not paste SQL on this visit.
- `Sending stays off. Send now is refused. Nothing was queued. Outbox queued: 0.` That is the refuse line for **Send now** and **Go live**. It is not the Dry run pass. If you tapped one of those, stop. Leave them untapped. The outbox queued count must still be 0.

## 3. What the report shows

The panel shows the preview before the tap. A fixture **Dry run** keeps the same numbers. The estimate is a placeholder. It is not a provider quote and it is not charged.

While the amber fixture banner is on screen, the campaign name is **Sandbox prospect draft** and the report is:

| Line | Fixture value |
| --- | --- |
| Recipients | 5 |
| Would receive | 2 |
| Blocked | 3 |
| `consent_basis` | `consent 1 · existing_customer 1 · missing 1 · opted_out 1 · STOP 1` |
| Estimated cost | `Estimated cost R 0.67. Not charged.` |

Who would receive, and who is blocked:

- Ayesha Patel — would receive · whatsapp
- Johan Botha — would receive · email
- Thabo Ndlovu — blocked (POPIA) · sms
- Nomsa Dlamini — blocked (consent) · whatsapp
- Pieter Venter — blocked (STOP) · whatsapp

The block rules are the same as [`docs/campaign-dry-run.md`](campaign-dry-run.md):

- POPIA: `consent_basis` is missing, or it is not `consent` or `existing_customer`. A row with no channel is blocked as POPIA even when the basis is valid.
- Consent: the person is opted out or suppressed.
- STOP: the person sent STOP. STOP is honoured. That person is not in the would-receive list.

The ZAR figure uses the placeholder rates already in the desktop notes: WhatsApp R0.62, SMS R0.35, email R0.05, per person who would receive. The fixture R 0.67 is Ayesha (WhatsApp) plus Johan (email). Thabo is blocked, so the SMS rate is not added. Nothing is charged. No card, no SMS credit, and no Meta bill.

A would-receive line is a preview. It is not a delivery.

When the slate store banner is already honest, the counts can come from draft prospects and the latest contact import. They can differ from the fixture five. The same three block reasons still apply. The estimate is still not charged. The outbox queued count stays 0.

## 4. WhatsApp and Meta stubs

Keys, when Billy says yes on a later visit, stay on [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md). This page does not collect a key, does not run OAuth, and does not register a webhook.

1. Open https://ai-autotech-crm.vercel.app/command-centre/connect-accounts?org=ai-autotech
2. The heading is **Connect accounts**. If the header names another workspace, open the `?org=ai-autotech` link again, then open connect accounts again.
3. Read **WhatsApp (Meta Cloud)** and **Facebook / Instagram**. The page names three statuses:
   - **Not connected**: no stub has been saved.
   - **Sandbox stub**: a stub row was saved. It is not a live connection.
   - **Needs provider keys**: Billy still has to add the Meta app credentials. This page does not store a secret.
4. On this visit, with `META_CONNECT_STUB_ENABLED` unset and step 26 still unapplied, the badge on those two cards is **Not connected**.
5. Tap **Connect WhatsApp (Meta Cloud)**. The address is `/command-centre/connect-accounts/whatsapp`. If the button already says **Open sandbox stub**, that means a stub row exists. Read it, and leave **Save sandbox stub** untapped.
6. The page says: `This is a sandbox stub. Billy must add Meta app credentials later. No OAuth runs on this page and no key is stored.`
7. The page says provider keys are missing, so Send test is a dry run only and is refused. Outbox queued: 0.
8. Amber, when it is on screen: `Fixture only. Nothing is stored until META_CONNECT_STUB_ENABLED is true and step 26 is applied. No key is stored and nothing is sent.` That line is a pass. Leave the flag unset.
9. Open `/command-centre/connect-accounts/meta` the same way. Same three badges. Same refuse. Leave **Save sandbox stub** untapped.

Leave **Send test** untapped. It does not call Meta. If it is tapped while provider keys are missing, the refuse line is `Provider keys are missing. Send test is a dry run only and is refused. Nothing was queued. Outbox queued: 0.` That tap is not part of the pass. Do not tap it to produce the line.

The other account cards stay on the step 24 checklist ([`docs/connect-import.md`](connect-import.md)). Email and SMS stubs are step 27. Leave them alone. Their dry-load is [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md).

## Stop rules

- No real send. Leave **Send now**, **Go live**, **Send test**, **Import and queue**, **Load sandbox seed**, and **Dry-load CSV** untapped.
- No social post. Leave **Publish** and **Post now** untapped.
- No ad spend, no SMS credit, no phone-number purchase, and no card charge.
- No cron registration. Leave `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, and `/api/cron/ai-replies` uncalled. The schedule paste stays on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md).
- No webhook, including a Meta callback URL.
- No secret, key, token, password, or merchant value in git, a pull request, chat, an issue, or this file.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- `CAMPAIGN_DRY_RUN_ENABLED` and `META_CONNECT_STUB_ENABLED` stay unset on this visit.
- Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).
- Gated Phase 5 command-centre panels stay paused.
- Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) until a Success from a previous visit is already logged. This page does not claim they are applied.

## Pass means

You were signed in on the phone at `/command-centre/campaigns` for `ai-autotech`. You tapped **Dry run** once. The status said nothing was queued, and the outbox queued count stayed 0. The fixture report showed 5 recipients, the `consent_basis` breakdown, and estimated cost R 0.67 that is not charged. Would-receive and blocked lines matched POPIA, consent, and STOP. WhatsApp and Facebook / Instagram showed **Not connected**, and the page named **Sandbox stub** and **Needs provider keys**. **Send test** stayed untapped. No webhook was registered. No cron was registered. No secret was copied into git, a pull request, chat, or this file. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset or `false`.

A pass does not mean a message was delivered, a report was stored, step 26 was applied by this page, or sending was turned on.
