# Phone checklist: ops secrets panel (no send)

Billy runs this on a phone in South Africa (Safari or Chrome). It is the tap path for the ops secrets panel on `/command-centre/ops-secrets`, `/command-centre/setup`, and `/agency` after step 35 (`phase5n_ops_secrets_ready`). `/command-centre` has the link card **Ops secrets**. The panel itself is on the three paths above. The desktop notes stay in [`docs/phase-5n-ops-secrets.md`](phase-5n-ops-secrets.md). The previous phone companion is the owner bootstrap panel ([`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md), step 34). This page is step 35 in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). The flag is `OPS_SECRETS_READY_ENABLED`.

This page is the UI panel companion for presence notes. It is not the generate-and-save checklist for `CRON_SECRET`. That checklist is [`docs/phone-cron-secret.md`](phone-cron-secret.md). It is not the schedule paste. That paste is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). It is not the channel-key pages. Email is [`docs/phone-resend-willem.md`](phone-resend-willem.md). WhatsApp and Meta are [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md). SMS is [`docs/phone-sms-provider-keys.md`](phone-sms-provider-keys.md). LinkedIn is [`docs/phone-linkedin-keys.md`](phone-linkedin-keys.md). PayFast sandbox is [`docs/phone-payfast-sandbox.md`](phone-payfast-sandbox.md). A pass on any of those pages does not replace this tap. A pass here does not save a key and does not register a cron.

Writing this page does not apply SQL, does not set a flag, does not register a cron, does not put a live key in the database, does not send, and does not spend. Steps 20 through 36 stay unapplied until a Success from a previous visit is already written down. This page does not invent that Success. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This page does not paste a token. Gated Phase 5 command-centre panels stay paused until that SQL and Billy’s yes to the matching flag. Opening the panel in fixture mode does not unpause them.

The production CRM is https://ai-autotech-crm.vercel.app . The workspace for a signed-in look is slug `ai-autotech`. The documented owner email is `billyfaber06@gmail.com` when that Auth user exists.

Until `OPS_SECRETS_READY_ENABLED` is the string `true` on the running deployment, and only after step 35 has shown Success and Billy has said yes to that flag, this visit is verify-only. Read the fixture sentence. `write` stays false. Do not claim an ops note is stored. The panel stores presence only (`configured`, `missing`, or `fixture`). It does not register a cron. It does not put a live Meta, SMS, email, or PayFast key in the database. It does not turn `sending_enabled` on.

## Preconditions

All of these stay true on this visit. If one is false, stop.

1. Steps 20 through 36 are still unapplied. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) and [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) still say so. A phone verify in fixture mode is allowed before that Success. This page does not paste SQL and does not claim Success.
2. Step 35 is `supabase/migrations/20261110120000_phase5n_ops_secrets_ready.sql` (`phase5n_ops_secrets_ready`). A stored `ops_secrets_notes` row waits until that file has shown Success (`Success. No rows returned` in the SQL editor, or `Success. Steps 20–36 applied.` from the CLI). Until that Success is already logged, the panel stays fixture-only and writes nothing. Step 35 comes after step 34. This page does not skip ahead.
3. Leave `OPS_SECRETS_READY_ENABLED` unset until step 35 has succeeded and Billy says yes to that flag on a later call. Unset, blank, or any value other than the string `true` keeps `write` false. Fixture mode is the phone verify on this visit. Setting the flag does not apply SQL, does not register a cron, does not store a secret, does not send, and does not spend. A preview render stays fixture-only even if the flag is set.
4. A yes for Dry run, the East Rand seed, the PWA install verify, the setup wizard, the migration runner, the owner bootstrap panel, a channel key, `CRON_SECRET`, the Education pack, the Zentrix pack, a website publish, SQL, or the Owner Auth verify is not a yes for `OPS_SECRETS_READY_ENABLED` and is not a yes to send. Dry run is [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md). The East Rand tap is [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md). The PWA verify is [`docs/phone-pwa-install.md`](phone-pwa-install.md). The setup wizard is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md). The migration runner is [`docs/phone-migration-runner.md`](phone-migration-runner.md). The owner bootstrap panel is [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md). The Owner Auth verify is [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md).
5. `sending_enabled` stays false on every workspace. The checkbox **Sending enabled** stays unticked. The header chip on the command centre reads **Sending is off**.
6. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A yes to this panel verify is not a yes to either switch. The only later yes is one named workspace on [`docs/phone-sending-enabled.md`](phone-sending-enabled.md).
7. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). See [`docs/website-publish-decision.md`](website-publish-decision.md).
8. Do not register a cron on this visit. Do not paste a live Meta, SMS, email, or PayFast key into the database. Do not open Vercel to save a key from this page. Saving `CRON_SECRET` stays on [`docs/phone-cron-secret.md`](phone-cron-secret.md). The schedule paste stays on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). Channel keys stay on the pages named above.

The logged-out production smoke, after SQL Success, is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). This page does not replace that smoke, and that smoke does not replace this tap. The Phase 5 flag order is [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This page does not set a name on that list.

There is no `docs/phone-go-live.md` yet. That visit is later. It is step 36 (`GOLIVE_CHECKLIST_ENABLED`) on `/command-centre/go-live`. The desktop notes are [`docs/phase-5o-golive-checklist.md`](phase-5o-golive-checklist.md). This visit does not set `GOLIVE_CHECKLIST_ENABLED`.

## 1. Signed-out gate

Stay logged out for this step. Use a private tab so an old session cookie is not treated as signed in.

Open each URL. Production answers 307 and the phone lands on `/login`. `next` is the path you opened.

| Open | `next` |
| --- | --- |
| https://ai-autotech-crm.vercel.app/command-centre | `/command-centre` |
| https://ai-autotech-crm.vercel.app/command-centre/ops-secrets | `/command-centre/ops-secrets` |
| https://ai-autotech-crm.vercel.app/command-centre/setup | `/command-centre/setup` |
| https://ai-autotech-crm.vercel.app/agency | `/agency` |

A phone browser follows that redirect, so the address bar shows the sign-in page and does not show the number 307. A check that does not follow redirects reports **307** and a `Location` whose path is `/login` with that `next`. That is the same gate.

Pass: you see the sign-in page. You do not see **Ops secrets**, **Record sandbox note**, or a pack button. Landing on `/login` is a pass for the gate. It is not the panel storing a note.

The same gate with `?org=ai-autotech` puts `org=ai-autotech` on `next`. That link also 307s to `/login` while signed out.

## 2. Read the panel, fixture only

A signed-in look is allowed so you can read the fixture sentence. It is still verify-only. Do not set `OPS_SECRETS_READY_ENABLED` to reach it. Do not paste a key to reach it.

1. Open https://ai-autotech-crm.vercel.app/command-centre/ops-secrets?org=ai-autotech
2. Sign in as the agency owner when the phone is on `/login` and that Auth user already exists. The documented address is `billyfaber06@gmail.com` ([`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md), Phone-first unblock, step 4). When that user is missing, skip the signed-in look. Creating the user is that other checklist, and only when Billy says yes there. This page is not that yes. The signed-out gate in section 1 is still a pass.
3. After sign-in, open the same ops-secrets URL again if the app landed on `/agency`.
4. Pass for the look: the eyebrow is **Go-live**. The heading is **Ops secrets**. The slug is `ai-autotech`. The header chip reads **Sending is off**. That chip is the sending switch. It is a small amber pill. It is not the fixture sentence. If the chip reads **Sending is on**, stop. If the header names EASTC or Zentrix, open the `?org=ai-autotech` link again.

The same panel is on https://ai-autotech-crm.vercel.app/command-centre/setup?org=ai-autotech and on https://ai-autotech-crm.vercel.app/agency . Scroll to **Ops secrets** on each. `/command-centre` shows a card with the same heading. That card is a link. Ops readiness on `/command-centre` names the link **Open ops secrets**. The agency header names the link **Ops secrets**. The setup wizard names **Open ops secrets**. Any of those links opens `/command-centre/ops-secrets`. This visit uses the ops-secrets URL above. It does not change a flag from those panels.

Read the lines under the heading. They are slate body text. This panel has no yellow banner. The fixture sentence is the words. Previous phone checklists call that sentence the amber pass. Match the words.

These lines are on screen together. The five presence lines follow the heading. Each line ends `The value is not shown.` If a key, a token, a merchant id, or a secret value is on screen, stop.

- `CRON_SECRET is configured. The value is not shown.` or `CRON_SECRET is missing. The value is not shown.` or `CRON_SECRET is fixture. This render did not read the deployment. The value is not shown.`
- `Email provider is configured. The value is not shown.` or `Email provider is missing. The value is not shown.` or `Email provider is fixture. This render did not read the deployment. The value is not shown.`
- `WhatsApp / Meta is configured. The value is not shown.` or `WhatsApp / Meta is missing. The value is not shown.` or `WhatsApp / Meta is fixture. This render did not read the deployment. The value is not shown.`
- `SMS provider is configured. The value is not shown.` or `SMS provider is missing. The value is not shown.` or `SMS provider is fixture. This render did not read the deployment. The value is not shown.`
- `PayFast sandbox keys are configured. The value is not shown.` or `PayFast sandbox keys are missing. The value is not shown.` or `PayFast sandbox keys are fixture. This render did not read the deployment. The value is not shown.` A PayFast merchant id that is not the sandbox merchant stays missing. The id is not shown.
- `Cron dry-run names only: automation, workflow-engine, billing-cycle, ai-reply-drafts. These jobs would be registered once CRON_SECRET exists. This page does not register them.`
- `Leave AI_REPLY_CRON_ENABLED unset. This page does not schedule a cron.`
- `Steps 20 through 34 are not applied. Step 35 is also unapplied. Do not claim this SQL is already applied.`
- `sending_enabled stays false. Nothing is sent. Nothing is spent.`
- `OPS_SECRETS_READY_ENABLED is unset. Leave it unset until step 35 is applied. This page does not turn it on.` If this line says the flag is set before step 35 Success is already written down and Billy has said yes to that flag, stop.
- `Leave MIGRATION_RUNNER_ENABLED, SETUP_WIZARD_ENABLED, and OWNER_BOOTSTRAP_UI_ENABLED unset. This page does not turn them on.`

On a signed-in member workspace the five pills can read **Configured** or **Missing**. **Configured** is a green pill. **Missing** and **Fixture** are amber pills. Those pills are the status. They are not the fixture sentence. **Configured** means the signed-in deployment has that name set. The value is not on screen. It is not a row in `ops_secrets_notes`. **Missing** means that name is not set on this deployment. **Fixture** means this render did not read the deployment. Preview and empty Supabase keys stay **Fixture** on all five. A green pill on this visit is still verify-only. Do not claim an ops note is stored.

Each card says `Presence only. The value is not shown.`

**Cron dry-run** lists four names and no schedule:

- `automation`
- `workflow-engine`
- `billing-cycle`
- `ai-reply-drafts`

The line under that heading says the names would be registered once `CRON_SECRET` exists, and that this page does not register them. Leave `AI_REPLY_CRON_ENABLED` unset. Do not call `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, or `/api/cron/ai-replies`. The schedule paste, when Billy does it later, is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This visit does not open that paste.

Fixture sentence (the amber pass for this visit):

`Fixture only. This panel writes nothing until OPS_SECRETS_READY_ENABLED is the string true and step 35 is applied. It does not register a cron and it does not store a secret.`

That sentence is the last line under the heading, and the form under **Sandbox note** repeats it and ends `write: false`. The form line is:

`Fixture only. This panel writes nothing until OPS_SECRETS_READY_ENABLED is the string true and step 35 is applied. It does not register a cron and it does not store a secret. write: false.`

`write` stays false. Leave **Record sandbox note** untapped. The button under **Owner bootstrap** uses the same words. Leave that one untapped too. That visit is [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md).

Flag-on sentence (the slate line). This visit does not create it. Do not set the flag to see it.

`A sandbox note can be stored. charged stays false. A cron is not registered. Secret values are not stored.`

That line would mean step 35 has succeeded, `OPS_SECRETS_READY_ENABLED` is the string `true` on the running deployment after Billy’s yes, and you are signed in on a member workspace. The form would then end `write: true`. The flag line would read `OPS_SECRETS_READY_ENABLED is set. A sandbox note can be stored. It stores presence only and does not register a cron.` If that ready line is on screen before that Success is already written down, stop. A preview render stays fixture-only even when the flag is set. `write` stays false. This visit does not create that line either.

**Sandbox note** says the note stores configured, missing, or fixture, plus the cron names above. It does not store a secret and it does not register a cron. There is no secret field on the form. Leave the button untapped. Do not type a key, a token, or a merchant id into the page.

Leave these alone on the same screens. They are other visits:

- **Setup wizard** and **Record sandbox checklist event** on `/command-centre/setup`.
- **Owner bootstrap** and its **Record sandbox note**. That visit is [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md).
- **Migration runner** and **Record sandbox dry-run**.
- **Go-live checklist**. It links to `/command-centre/go-live`. There is no phone checklist for that page yet. That later page is step 36 (`GOLIVE_CHECKLIST_ENABLED`).
- **Run automations** under Advanced.
- **Apply Education pack to EASTC** and **Apply Zentrix pack to Zentrix Online** on `/agency`.
- **Create client workspace**.
- **Lead Agent** on the setup page. Leave **Continue** and **Pay in the sandbox** untapped.

## 3. Record sandbox note, only when the slate line was already honest

On the verify-only visit, skip this section. Leave **Record sandbox note** untapped.

If the fixture sentence is on screen and the button under **Ops secrets** is tapped anyway, the status becomes `Fixture only. This panel writes nothing until OPS_SECRETS_READY_ENABLED is the string true and step 35 is applied. It does not register a cron and it does not store a secret.` Nothing is written. `write` stays false. A cron was not registered. A secret was not stored. That tap is not required for the pass. Do not tap it a second time. Do not claim an ops note was stored.

When the slate line was already honest (step 35 Success already logged, and Billy already said yes to `OPS_SECRETS_READY_ENABLED`), one tap can store a sandbox note:

1. Stay on https://ai-autotech-crm.vercel.app/command-centre/ops-secrets?org=ai-autotech
2. Tap **Record sandbox note** once, the button under **Ops secrets**.
3. Pass: `Sandbox note stored. Secret values were not stored. A cron was not registered. Nothing is sent.`

The function is `record_ops_secrets_note`. It stores one `ops_secrets_notes` row: `configured`, `missing`, or `fixture` for `CRON_SECRET`, the email provider, WhatsApp / Meta, the SMS provider, and PayFast sandbox keys, plus the cron names `automation`, `workflow-engine`, `billing-cycle`, and `ai-reply-drafts`. `status` stays `noted`. `sandbox` stays true. `charged` stays false. The row has no secret column and no email column. The function does not register a cron and does not read a secret value back out. `sending_enabled` stays false. This page does not turn the flag on to reach that line. This page does not paste a live key to reach that line.

Stop on any other status. These lines mean stop:

- `Apply step 35 before a sandbox note is stored. Nothing was written. A cron was not registered.` The flag is on and the schema is missing step 35. Leave `OPS_SECRETS_READY_ENABLED` unset until step 35 has succeeded. Do not paste SQL on this visit.
- `The note was not stored. Nothing was written. A cron was not registered.`
- `The note was refused. Nothing was written. A cron was not registered.`
- `Secrets are not stored. Nothing was written. A cron was not registered.` A secret field was refused. Do not paste a key, a token, a merchant id, or a database URL into the form.
- `Nothing was written. A cron was not registered.` when you expected the slate store line. The flag is not the string `true` for this signed-in workspace, the role cannot store the note, or the header is another workspace. Re-open `?org=ai-autotech`. Do not set the flag on this visit.

## Stop rules

- No real send. Leave **Send now**, **Go live**, **Send test**, **Publish**, and **Post now** untapped. This panel has none of those buttons. Do not go looking for them.
- No spend. No purchase. No card charge. No ad. No SMS credit. No phone-number purchase. No store listing. No paid developer account. Leave **Pay in the sandbox** untapped.
- No DNS edit. Stay on https://ai-autotech-crm.vercel.app . The hostname checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md). This visit does not open GoDaddy and does not change a record.
- No SQL paste. Do not open the SQL editor from this page. Do not paste steps 20 through 36. The steps paste, when Billy does it later, is [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md).
- No cron registration. Leave `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, and `/api/cron/ai-replies` uncalled. The schedule paste stays on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). Listing the four names on this panel is not that paste.
- No live secret in the database. Do not paste a Meta, SMS, email, or PayFast key into a form or into SQL. Saving those names, when Billy says yes, stays on [`docs/phone-cron-secret.md`](phone-cron-secret.md), [`docs/phone-resend-willem.md`](phone-resend-willem.md), [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md), [`docs/phone-sms-provider-keys.md`](phone-sms-provider-keys.md), [`docs/phone-linkedin-keys.md`](phone-linkedin-keys.md), and [`docs/phone-payfast-sandbox.md`](phone-payfast-sandbox.md). A yes on any of those pages is not a yes for `OPS_SECRETS_READY_ENABLED`.
- No other Phase 5 flag on this visit. Leave `HOME_CHAT_ENABLED`, `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, `CAMPAIGN_CSV_IMPORT_ENABLED`, `EMAIL_SMS_CONNECT_STUB_ENABLED`, `SOCIAL_DRAFTS_ENABLED`, `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`, `ZENTRIX_WORKSPACE_PACK_ENABLED`, `EAST_RAND_CAMPAIGN_SEED_ENABLED`, `PWA_INSTALL_SHELL_ENABLED`, `SETUP_WIZARD_ENABLED`, `MIGRATION_RUNNER_ENABLED`, `OWNER_BOOTSTRAP_UI_ENABLED`, `GOLIVE_CHECKLIST_ENABLED`, `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset. The order stays on [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). `OPS_SECRETS_READY_ENABLED` stays unset on this visit too.
- No webhook. Do not run `supabase/owner-bootstrap.sql` from this page.
- No secret, key, token, password, database URL, merchant id, or service-role value in git, a pull request, chat, an issue, or this file. `SUPABASE_ACCESS_TOKEN` stays a chat note until a real `sbp_` token replaces it on its own checklist. This page does not paste that token.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).
- Gated Phase 5 command-centre panels stay paused.
- Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) until a Success from a previous visit is already logged. This page does not claim they are applied.
- Leave **Load sandbox seed**, **Dry run**, **Dry-load CSV**, **Record install intent**, **Record sandbox checklist event**, **Record sandbox dry-run**, and the owner-bootstrap **Record sandbox note** untapped. Those visits are [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md), [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md), [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md), [`docs/phone-pwa-install.md`](phone-pwa-install.md), [`docs/phone-setup-wizard.md`](phone-setup-wizard.md), [`docs/phone-migration-runner.md`](phone-migration-runner.md), and [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md).

## Pass means

Signed out, https://ai-autotech-crm.vercel.app/command-centre , `/command-centre/ops-secrets`, `/command-centre/setup`, and `/agency` each answered 307 and the phone landed on `/login` with `next` set to the path you opened. You did not see the panel while signed out. If you signed in to read the page, the heading was **Ops secrets** on slug `ai-autotech`, the header chip read **Sending is off**, the five presence lines were on screen and none of them showed a value, the four cron names were listed, the fixture sentence was on screen, and the form ended `write: false`. **Record sandbox note** stayed untapped, or a tap while that fixture sentence was showing wrote nothing. You did not claim an ops note was stored. You did not register a cron. You did not paste a live key into the database. Nothing was sent. No DNS record was edited. No other Phase 5 flag was set. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset or `false`. `OPS_SECRETS_READY_ENABLED` stayed unset. `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` stayed unset.

A pass does not mean an ops note was stored, step 35 was applied by this page, the flag was turned on, a cron was registered, a live secret was stored, sending was turned on, or go-live was unblocked.
