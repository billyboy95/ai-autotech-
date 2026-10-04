# Phone checklist: East Rand consent CSV into a sandbox draft

Tracker item 8. The prospect list and the first campaign stay a sandbox draft. This page stores that draft only. It does not send, does not spend, and does not turn `sending_enabled` on.

Steps 20 through 36 are still unapplied. The blocker is a real `SUPABASE_ACCESS_TOKEN` that starts with `sbp_`, or a fresh sign-in on the Supabase SQL editor. Writing this page does not apply SQL. Do not claim the SQL is applied.

Token replace, Vercel names, Owner Auth, `CRON_SECRET`, channel keys, PayFast, the SQL editor paste, `NOTIFY pgrst, 'reload schema';`, the Education pack, and the Zentrix pack stay in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Phone-first unblock). This page does not repeat that runbook. Pack click order is step 8 there. Website publish for aiautotech #4 and #5 is [`docs/website-publish-decision.md`](website-publish-decision.md). Do not merge those pull requests from this agent.

## Stop until SQL and the flags are true

Do not invent campaign rows in production until every check below is true. A dry-load before that stores nothing. No real sends.

1. SQL Success. One of these is true:
   - SQL editor: every file from step 20 through step 36 has shown `Success. No rows returned`, or the editor’s equivalent success with no error. That paste is Phone-first unblock, step 7.
   - CLI, once the token starts with `sbp_`: the apply prints `Success. Steps 20–36 applied.` That command is Phone-first unblock, step 2.
2. Schema reload. After step 36, this has shown success in the same SQL editor:

```sql
NOTIFY pgrst, 'reload schema';
```

That line is Phone-first unblock, step 8, item 2. It refreshes the PostgREST schema cache. It does not apply another migration and it does not send. If it errors, stop.

3. Flags. Set a name only after the step that introduces it has succeeded, and only when Billy says yes to that name. Unset, blank, or any value other than the string `true` keeps the page fixture-only. A saved variable is read on the next deployment. Setting a flag does not apply SQL and does not send.
   - `CAMPAIGN_CSV_IMPORT_ENABLED` = `true` after step 27 (`supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql`). This is the flag that stores the dry-load.
   - `CAMPAIGN_DRY_RUN_ENABLED` = `true` after step 26 (`supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql`) when Billy wants the dry-run report on the same page stored. The CSV dry-load stores through `CAMPAIGN_CSV_IMPORT_ENABLED`. Leave `CAMPAIGN_DRY_RUN_ENABLED` unset until step 26 has succeeded.

Leave these as they are for this checklist:

- `EAST_RAND_CAMPAIGN_SEED_ENABLED` stays unset. Step 30 stores the fake in-repo fixture, not this CSV.
- `EMAIL_SMS_CONNECT_STUB_ENABLED` stays unset. It is not this load.
- `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` stay unset.
- `CRON_SECRET` and the outbound channel keys stay on runbook step 5. Leave them unset until Billy says yes.
- `sending_enabled` stays false on every workspace.
- `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.

4. Sign-in. The session is the agency owner on workspace slug `ai-autotech`. The documented address is `billyfaber06@gmail.com` when that Auth user exists (runbook step 4). Agency staff on that workspace can use the same button. A `client_admin` of `ai-autotech` can store the dry-load. This file stays on `ai-autotech`. EASTC and Zentrix are other workspaces.

If any check is false, stop. Do not type prospect rows into production to fill the gap.

## The file

On the shared box:

- `/workspace/aiautotech-outbound/campaign-east-rand-consent-ready.csv` — 24 data rows, plus the header
- `/workspace/aiautotech-outbound/CAMPAIGN-IMPORT.md` — the notes that already sit with that file

Use that file whole. Confirm 24 data rows before you load it. Do not retype the rows. Do not paste the CSV into git, a pull request, or this page. A shorter paste is a different list. If the phone cuts the paste, stop and load the file from a desktop that can read the box path, or use **Or upload a CSV**.

Required columns. The CRM already accepts this box format (`docs/campaign-csv-import.md`):

`name`, `business`, `niche`, `website`, `phone`, `email`, `opening line`, `consent_basis`

`consent_basis` is required on the header. `yes` and `opted_in` count as `consent`. `existing` and `customer` count as `existing_customer`.

This file is not `data/campaigns/ai-autotech-east-rand-prospects.csv` and it is not `data/campaigns/east-rand-sandbox.csv`. The sandbox file is fake. **Load sandbox seed** loads that fake file.

## Click path

On the phone, after the checks above:

1. Open `/login` and sign in. A valid agency-owner session lands on `/agency`.
2. Open `/command-centre/campaigns?org=ai-autotech`. The heading is **Campaigns**. The workspace name is AI AutoTech. The slug is `ai-autotech`.
3. Scroll to the heading **Sandbox CSV import**. Leave **Campaign dry run** alone on this visit. Leave **Send now** and **Go live** on that panel untapped.
4. Read the banner under **Sandbox CSV import**.
   - Amber: `Fixture only. This dry-load is not stored until CAMPAIGN_CSV_IMPORT_ENABLED is true and step 27 is applied. Nothing is queued.` Stop. The tap stores nothing. Wait until step 27 has succeeded, the schema reload has succeeded, and `CAMPAIGN_CSV_IMPORT_ENABLED` is the string `true` on a deployment that replaces this amber line.
   - Slate: `Sandbox dry-load can be stored as a draft campaign. Sending stays off. Nothing is queued.` That line means a dry-load can be stored.
5. The same panel says `Sending stays off. Send now and go live are refused. Outbox queued: 0.` If the page says sending is on, stop.
6. In **Draft campaign name**, replace `Sandbox prospect draft` with `East Rand consent (draft)`.
7. In **Consent-ready CSV**, replace the fixture sample with the whole box file, header included. Or tap **Or upload a CSV** and choose `campaign-east-rand-consent-ready.csv`. The fixture sample stays out of the field.
8. Tap **Dry-load CSV** once. Leave **Send now** untapped. Leave **Go live** untapped.

Success is the amber status under the buttons:

`Dry-load only. Nothing was queued. Stored as a draft campaign. Nothing was queued. Outbox queued: 0.`

What you should see on that success:

- **Imported** plus **Skipped (missing consent)** equals the named rows from the file. The file has 24 data rows. A blank name is ignored. If the two counts together are not the named rows in that file, stop. Do not add rows by hand.
- The line `POPIA blocked N. STOP blocked M.`
- Each row says `would receive`, or `blocked (POPIA)`, `blocked (consent)`, or `blocked (STOP)`.
- The stored campaign stays `draft`. `queued_count` and `sent_count` stay 0. `charged` stays false. The label is `sandbox`. Draft prospects land in `campaign_csv_imports` and `campaign_csv_prospects`. A missing `consent_basis` is counted and is not stored as a draft prospect.
- Tap **Open the outbox**. Queued stays 0.

A second tap of **Dry-load CSV** stores another draft copy of the same rows. It still does not send. Leave the button after the success line is on screen.

Any other status is a stop. Nothing was sent. Do not invent rows and try again. These lines mean stop:

- `Fixture only. This dry-load is not stored.`
- `Apply step 27 before a CSV dry-load is stored. Nothing was queued.` The schema cache is missing step 27. Return to the schema reload. Do not skip ahead.
- `The CSV is empty.` or `CSV is missing: consent_basis.` The paste is not the box file.
- `field too long` or `dry load only` in the message, then `Nothing was queued.` The store refused the file. Do not edit a row in production to force it in.
- `Sending stays off. Send now is refused. Nothing was queued. Outbox queued: 0.` That is the refuse line. It is not a successful load.

## POPIA, consent, and STOP

The preview uses the same rules as the phase 5e dry run (`docs/campaign-dry-run.md`). A `would receive` line is a preview. It is not a delivery.

- POPIA: `consent_basis` is missing, or it is not `consent` or `existing_customer`, and the row is not STOP and not opted out. The row is skipped. It is not queued. It is blocked as POPIA.
- Consent: the person is opted out or suppressed (`opted_out`, `opt_out`, `optout`). They are stored as a draft and blocked as consent. They are not in the would-receive list.
- STOP: the person sent STOP, `stopped` is set, or `consent_basis` is `stop` or `stopped`. STOP is honoured. They are stored as a draft and blocked as STOP. They are not in the would-receive list.
- A phone on the row is previewed as WhatsApp. An email with no phone is previewed as email. A row with neither channel is blocked as POPIA even when `consent` or `existing_customer` is present.
- The ZAR figure on the separate dry-run panel is a placeholder (WhatsApp R0.62, SMS R0.35, email R0.05). It is not charged. This dry-load does not charge.

A blank `consent_basis` is a skip on **Dry-load CSV**. This button does not send a consent request.

## Hard refuse

**Send now** and **Go live** stay refused on **Sandbox CSV import** and on **Campaign dry run**. Tap neither.

While `sending_enabled` is false, the refuse line is `Sending stays off. Send now is refused. Nothing was queued. Outbox queued: 0.`

This dry-load also refuses those buttons if sending were on. The line is `This dry-load does not send. Nothing was queued.` `sending_enabled` stays false until Billy says yes. This page is not that yes. No outbound under Billy’s name. No ads. No spend.

Leave these controls alone on this visit:

- **Load sandbox seed** under **East Rand sandbox seed**. That loads fake rows from `data/campaigns/east-rand-sandbox.csv` into `East Rand sandbox (draft)`. Leave it untapped on this CSV visit. The phone tap path is [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md). Desktop notes are [`docs/phase-5i-sandbox-readiness.md`](phase-5i-sandbox-readiness.md). A yes to this CSV load is not a yes to `EAST_RAND_CAMPAIGN_SEED_ENABLED`.
- **Load held draft** under **East Rand draft**. That loads the bundled repo file, not the box consent CSV.
- **Import and queue** under **Import prospects**. That is a different action.
- **Save sequence** while Status is Active.
- Website pull requests [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). The decision card is [`docs/website-publish-decision.md`](website-publish-decision.md). Do not merge them from this agent.

## Do not invent live rows

Do not insert campaign rows in production by hand, by SQL, or with **Dry-load CSV**, until steps 20 through 36 have shown Success, `NOTIFY pgrst, 'reload schema';` has shown Success, and `CAMPAIGN_CSV_IMPORT_ENABLED` is the string `true` on a deployment whose **Sandbox CSV import** banner is the slate store line. Until then the dry-load is fixture-only and stores nothing. **Load sandbox seed** stays untapped on this visit. Its fixture tap stores nothing and is [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md). A stored seed waits for step 30 and Billy’s yes to `EAST_RAND_CAMPAIGN_SEED_ENABLED`. A yes to this CSV load is not that yes. No real sends. `sending_enabled` stays false.
