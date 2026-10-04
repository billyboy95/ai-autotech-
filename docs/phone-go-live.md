# Phone checklist: go-live checklist panel (no send)

Billy runs this on a phone in South Africa (Safari or Chrome). It is the tap path for the go-live checklist on `/command-centre/go-live` after step 36 (`phase5o_golive_checklist`). `/command-centre` has the link card **Go-live checklist**. `/command-centre/setup` has the same card. `/agency` names the link **Go-live checklist**. The panel itself is on `/command-centre/go-live`. The desktop notes stay in [`docs/phase-5o-golive-checklist.md`](phase-5o-golive-checklist.md). The previous phone companion is the ops secrets panel ([`docs/phone-ops-secrets.md`](phone-ops-secrets.md), step 35). This page is step 36 in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). The flag is `GOLIVE_CHECKLIST_ENABLED`.

This page gathers status rows. It is not the setup wizard. That checklist is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md). It is not the migration runner. That checklist is [`docs/phone-migration-runner.md`](phone-migration-runner.md). It is not the owner bootstrap panel. That checklist is [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md). It is not the ops secrets panel. That checklist is [`docs/phone-ops-secrets.md`](phone-ops-secrets.md). It is not the pack click. That click is [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md). It is not the PWA install verify. That verify is [`docs/phone-pwa-install.md`](phone-pwa-install.md). A pass on any of those pages does not replace this tap. A pass here does not apply SQL, does not click Apply, and does not turn sending on.

Writing this page does not apply SQL, does not set a flag, does not click Apply, does not register a cron, does not send, and does not spend. Steps 20 through 36 stay unapplied until a Success from a previous visit is already written down. This page does not invent that Success. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This page does not paste a token. Gated Phase 5 command-centre panels stay paused until that SQL and Billy’s yes to the matching flag. Opening the checklist in fixture mode does not unpause them.

The production CRM is https://ai-autotech-crm.vercel.app . The workspace for a signed-in look is slug `ai-autotech`. The documented owner email is `billyfaber06@gmail.com` when that Auth user exists. The address list is not shown on this page.

Until `GOLIVE_CHECKLIST_ENABLED` is the string `true` on the running deployment, and only after step 36 has shown Success and Billy has said yes to that flag, this visit is verify-only. Read the fixture sentence. `write` stays false. Do not claim a go-live note is stored. The page stores `pending`, `ready`, `blocked`, or `fixture` only. `sending` stays `blocked`. It does not run SQL, click Apply, register a cron, or turn `sending_enabled` on.

## Preconditions

All of these stay true on this visit. If one is false, stop.

1. Steps 20 through 36 are still unapplied. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) and [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) still say so. A phone verify in fixture mode is allowed before that Success. This page does not paste SQL and does not claim Success.
2. Step 36 is `supabase/migrations/20261111120000_phase5o_golive_checklist.sql` (`phase5o_golive_checklist`). A stored `golive_checklist_notes` row waits until that file has shown Success (`Success. No rows returned` in the SQL editor, or `Success. Steps 20–36 applied.` from the CLI). Until that Success is already logged, the page stays fixture-only and writes nothing. Step 36 comes after step 35. This page does not skip ahead.
3. Leave `GOLIVE_CHECKLIST_ENABLED` unset until step 36 has succeeded and Billy says yes to that flag on a later call. Unset, blank, or any value other than the string `true` keeps `write` false. Fixture mode is the phone verify on this visit. Setting the flag does not apply SQL, does not click Apply, does not register a cron, does not send, and does not spend. A preview render stays fixture-only even if the flag is set.
4. A yes for Dry run, the East Rand seed, the PWA install verify, the setup wizard, the migration runner, the owner bootstrap panel, the ops secrets panel, a channel key, `CRON_SECRET`, the Education pack, the Zentrix pack, a website publish, SQL, or the Owner Auth verify is not a yes for `GOLIVE_CHECKLIST_ENABLED` and is not a yes to send. Dry run is [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md). The East Rand tap is [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md). The PWA verify is [`docs/phone-pwa-install.md`](phone-pwa-install.md). The setup wizard is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md). The migration runner is [`docs/phone-migration-runner.md`](phone-migration-runner.md). The owner bootstrap panel is [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md). The ops secrets panel is [`docs/phone-ops-secrets.md`](phone-ops-secrets.md). The Owner Auth verify is [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md).
5. `sending_enabled` stays false on every workspace. The checkbox **Sending enabled** stays unticked. The header chip on the command centre reads **Sending is off**. The sending row reads **OFF · Blocked**.
6. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A yes to this checklist verify is not a yes to either switch. The only later yes is one named workspace on [`docs/phone-sending-enabled.md`](phone-sending-enabled.md).
7. Leave `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset. This page does not set them.
8. Do not register a cron on this visit. Do not click **Apply Education pack to EASTC** or **Apply Zentrix pack to Zentrix Online**. Do not paste a live Meta, SMS, email, or PayFast key into the database.

The logged-out production smoke, after SQL Success, is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). This page does not replace that smoke, and that smoke does not replace this tap. The Phase 5 flag order is [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This page does not set a name on that list.

## 1. Signed-out gate

Stay logged out for this step. Use a private tab so an old session cookie is not treated as signed in.

Open each URL. Production answers 307 and the phone lands on `/login`. `next` is the path you opened.

| Open | `next` |
| --- | --- |
| https://ai-autotech-crm.vercel.app/command-centre | `/command-centre` |
| https://ai-autotech-crm.vercel.app/command-centre/go-live | `/command-centre/go-live` |
| https://ai-autotech-crm.vercel.app/command-centre/setup | `/command-centre/setup` |
| https://ai-autotech-crm.vercel.app/agency | `/agency` |

A phone browser follows that redirect, so the address bar shows the sign-in page and does not show the number 307. A check that does not follow redirects reports **307** and a `Location` whose path is `/login` with that `next`. That is the same gate.

Pass: you see the sign-in page. You do not see **Go-live checklist**, **Record sandbox note**, or a pack button. Landing on `/login` is a pass for the gate. It is not the page storing a note.

The same gate with `?org=ai-autotech` puts `org=ai-autotech` on `next`. That link also 307s to `/login` while signed out.

## 2. Read the checklist, fixture only

A signed-in look is allowed so you can read the fixture sentence. It is still verify-only. Do not set `GOLIVE_CHECKLIST_ENABLED` to reach it.

1. Open https://ai-autotech-crm.vercel.app/command-centre/go-live?org=ai-autotech
2. Sign in as the agency owner when the phone is on `/login` and that Auth user already exists. The documented address is `billyfaber06@gmail.com` ([`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md), Phone-first unblock, step 4). When that user is missing, skip the signed-in look. Creating the user is that other checklist, and only when Billy says yes there. This page is not that yes. The signed-out gate in section 1 is still a pass.
3. After sign-in, open the same go-live URL again if the app landed on `/agency`.
4. Pass for the look: the eyebrow is **Go-live**. The heading is **Go-live checklist**. The slug is `ai-autotech`. The header chip reads **Sending is off**. That chip is the sending switch. It is a small amber pill. It is not the fixture sentence. If the chip reads **Sending is on**, stop. The header names AI AutoTech. If the header names EASTC or Zentrix, open the `?org=ai-autotech` link again.

`/command-centre` shows a card with the heading **Go-live checklist**. The card says status only and that nothing is sent. `/command-centre/setup` shows the same heading. The agency header names the link **Go-live checklist**. Any of those links opens `/command-centre/go-live`. This visit uses the go-live URL above. It does not change a flag from those panels. The checklist panel is not embedded on `/command-centre`, `/command-centre/setup`, or `/agency`.

Read the lines under the heading. They are slate body text. This panel has no yellow banner. The fixture sentence is the words. Previous phone checklists call that sentence the amber pass. Match the words.

The first line under the heading is:

`Status only. Nothing is sent, nothing is spent, and no secret value is shown. This page does not run SQL and does not click Apply.`

These lines are on screen together. A preview render, or empty Supabase keys, keeps the checklist rows on **Fixture** except sending. A signed-in member workspace can show **Pending**, **Missing**, or **Configured** on the other rows. Either set is a pass on this visit when the fixture sentence is on screen and `write` stays false. **Configured** is a green pill. **Missing** and **Fixture** are amber pills. **Pending** is a slate pill. **OFF · Blocked** is a rose pill. Those pills are the status. They are not the fixture sentence. A green pill on this visit is still verify-only. Do not claim a go-live note is stored. If a key, a token, a merchant id, an email address, or a secret value is on screen, stop.

- SQL migrations. **Pending**: `Pending. Steps 20 through 35 are not applied. Step 36 is also unapplied. Do not claim this SQL is already applied. This page does not run SQL.` **Fixture**: `Fixture. Steps 20 through 35 are not applied. Step 36 is also unapplied. Do not claim this SQL is already applied. This page does not run SQL.` If this row says Applied before that Success is already written down, stop. The link is **Open migration runner**. Leave it untapped. That visit is [`docs/phone-migration-runner.md`](phone-migration-runner.md).
- Setup wizard. **Pending**: `SETUP_WIZARD_ENABLED is unset. This page does not turn it on. The wizard is pending. This page does not write a wizard event.` **Fixture**: `Fixture. SETUP_WIZARD_ENABLED stays unset. This page does not turn it on.` The link is **Open setup wizard**. Leave it untapped. That visit is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md).
- Owner bootstrap. The address list is not shown. **Pending**: `Pending. OWNER_EMAILS is configured. The list is not shown. Auth attach is not confirmed here. OWNER_BOOTSTRAP_UI_ENABLED stays unset. This page does not create an Auth user and does not run owner-bootstrap.sql.` **Missing**: `OWNER_EMAILS is missing. The list is not shown. OWNER_BOOTSTRAP_UI_ENABLED stays unset. This page does not create an Auth user and does not run owner-bootstrap.sql.` **Fixture**: `Fixture. OWNER_BOOTSTRAP_UI_ENABLED stays unset. The address list is not shown. This page does not create an Auth user and does not run owner-bootstrap.sql.` The link is **Open owner bootstrap**. Leave it untapped. That visit is [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md).
- Ops secrets. The detail says `CRON_SECRET, email, WhatsApp / Meta, SMS, and PayFast sandbox are presence only. The value is not shown. OPS_SECRETS_READY_ENABLED stays unset. This page does not register a cron.` Each part ends `The value is not shown.` The parts are `CRON_SECRET`, `Email`, `WhatsApp / Meta`, `SMS`, and `PayFast sandbox`. Each is `configured`, `missing`, or `fixture`. The link is **Open ops secrets**. Leave it untapped. That visit is [`docs/phone-ops-secrets.md`](phone-ops-secrets.md).
- Education pack (EASTC). **Pending**: `Pending. The Education pack is not applied to EASTC. Do not click Apply from this checklist.` **Fixture**: `Fixture. Pending until the Education pack is applied to EASTC. Do not click Apply from this checklist.` If this row says Applied, stop. Packs are not applied. The link is **View Education pack**. Leave it untapped. The click order, after SQL Success and Billy’s yes, is [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md).
- Zentrix pack. **Pending**: `Pending. The Zentrix pack is not applied. ZENTRIX_WORKSPACE_PACK_ENABLED is unset. This page does not turn it on. Do not click Apply from this checklist.` **Fixture**: `Fixture. Pending until the Zentrix pack is applied. Leave ZENTRIX_WORKSPACE_PACK_ENABLED unset. Do not click Apply from this checklist.` If this row says Applied, stop. The link is **View Zentrix pack**. Leave it untapped.
- PWA install shell. **Pending**: `Flag status only. PWA_INSTALL_SHELL_ENABLED is unset. This page does not turn it on. Optional. Not a go-live blocker. This page does not write an install intent.` **Fixture**: `Fixture. Flag status only. PWA_INSTALL_SHELL_ENABLED is unset. Optional. Not a go-live blocker. This page does not write an install intent.` The link is **Open install shell**. Leave it untapped. That visit is [`docs/phone-pwa-install.md`](phone-pwa-install.md).
- `sending_enabled`. The pill is **OFF · Blocked**. The line is `sending_enabled is OFF. Blocked for go-live until Billy explicitly enables it later. This page does not turn it on.` If the line says sending is on, stop.
- `GOLIVE_CHECKLIST_ENABLED is unset. Leave it unset until step 36 is applied. This page does not turn it on.` If this line says the flag is the string `true` before step 36 Success is already written down and Billy has said yes to that flag, stop.
- `Steps 20 through 35 are not applied. Step 36 is also unapplied. Do not claim this SQL is already applied.`
- Each of `MIGRATION_RUNNER_ENABLED`, `SETUP_WIZARD_ENABLED`, `OWNER_BOOTSTRAP_UI_ENABLED`, `OPS_SECRETS_READY_ENABLED`, `ZENTRIX_WORKSPACE_PACK_ENABLED`, `EAST_RAND_CAMPAIGN_SEED_ENABLED`, `PWA_INSTALL_SHELL_ENABLED`, and `AI_REPLY_CRON_ENABLED` reads unset on this visit, with `This page does not turn it on.`

Fixture sentence (the amber pass for this visit):

`Fixture only. This page writes nothing until GOLIVE_CHECKLIST_ENABLED is the string true and step 36 is applied. It does not run SQL, click Apply, register a cron, or turn sending on.`

That sentence is the last line under the heading, and the form under **Sandbox note** repeats it and ends `write: false`. The form line is:

`Fixture only. This page writes nothing until GOLIVE_CHECKLIST_ENABLED is the string true and step 36 is applied. It does not run SQL, click Apply, register a cron, or turn sending on. write: false.`

`write` stays false. Leave **Record sandbox note** untapped.

Flag-on sentence (the slate line). This visit does not create it. Do not set the flag to see it.

`A sandbox note can be stored. charged stays false. The note stores pending, ready, blocked, or fixture only. SQL is not applied. A pack is not applied. sending_enabled stays false.`

That line would mean step 36 has succeeded, `GOLIVE_CHECKLIST_ENABLED` is the string `true` on the running deployment after Billy’s yes, and you are signed in on a member workspace. The form would then end `write: true`. The flag line would read `GOLIVE_CHECKLIST_ENABLED is the string true. A sandbox note can be stored. It stores pending, ready, blocked, or fixture only.` If that ready line is on screen before that Success is already written down, stop. A preview render stays fixture-only even when the flag is set. `write` stays false. This visit does not create that line either.

**Sandbox note** says the note stores pending, ready, blocked, or fixture, sending stays blocked, and it does not store a secret, run SQL, or click Apply. There is no secret field on the form. Leave the button untapped. Do not type a key, a token, an email, or a merchant id into the page.

Leave these alone on the same screens. They are other visits:

- **Open migration runner**, **Open setup wizard**, **Open owner bootstrap**, **Open ops secrets**, and **Open install shell**.
- **View Education pack** and **View Zentrix pack**.
- **Record sandbox note** on owner bootstrap and on ops secrets.
- **Record sandbox checklist event** on the setup wizard.
- **Record sandbox dry-run** on the migration runner.
- **Run automations** under Advanced on `/command-centre`.
- **Apply Education pack to EASTC** and **Apply Zentrix pack to Zentrix Online** on `/agency`.
- **Create client workspace**.
- **Lead Agent** on the setup page. Leave **Continue** and **Pay in the sandbox** untapped.

## 3. Record sandbox note, only when the slate line was already honest

On the verify-only visit, skip this section. Leave **Record sandbox note** untapped.

If the fixture sentence is on screen and the button under **Sandbox note** is tapped anyway, the status becomes `Fixture only. This page writes nothing until GOLIVE_CHECKLIST_ENABLED is the string true and step 36 is applied. It does not run SQL, click Apply, register a cron, or turn sending on.` Nothing is written. `write` stays false. SQL was not applied. A pack was not applied. A cron was not registered. Sending stayed off. That tap is not required for the pass. Do not tap it a second time. Do not claim a go-live note was stored.

When the slate line was already honest (step 36 Success already logged, and Billy already said yes to `GOLIVE_CHECKLIST_ENABLED`), one tap can store a sandbox note:

1. Stay on https://ai-autotech-crm.vercel.app/command-centre/go-live?org=ai-autotech
2. Tap **Record sandbox note** once, the button under **Sandbox note**.
3. Pass: `Sandbox note stored. Status enums only. Secret values were not stored. SQL was not applied. A pack was not applied. Nothing is sent.`

The function is `record_golive_checklist_note`. It stores one `golive_checklist_notes` row: `pending`, `ready`, `blocked`, or `fixture` for SQL migrations, the setup wizard, owner bootstrap, ops secrets, the Education pack, the Zentrix pack, and the PWA install flag. `sending` stays `blocked`. `status` stays `noted`. `sandbox` stays true. `charged` stays false. The row has no secret column. The function does not run migration SQL, does not click Apply, does not register a cron, and does not update `sending_enabled`. It does not send, spend, or call Meta, an SMS provider, Resend, SMTP, PayFast, Paystack, Yoco, E2B, or Browserbase. This page does not turn the flag on to reach that line.

Stop on any other status. These lines mean stop:

- `Apply step 36 before a sandbox note is stored. Nothing was written. SQL was not applied.` The flag is on and the schema is missing step 36. Leave `GOLIVE_CHECKLIST_ENABLED` unset until step 36 has succeeded. Do not paste SQL on this visit.
- `The note was not stored. Nothing was written. SQL was not applied.`
- `The note was refused. Nothing was written. SQL was not applied. A pack was not applied.`
- `Secrets are not stored. Nothing was written. SQL was not applied. A pack was not applied.` A secret field was refused. Do not paste a key, a token, an email, a merchant id, or a database URL into the form.
- `Nothing was written. SQL was not applied. A pack was not applied.` when you expected the slate store line. The flag is not the string `true` for this signed-in workspace, the role cannot store the note, or the header is another workspace. Re-open `?org=ai-autotech`. Do not set the flag on this visit.

## Stop rules

- No real send. Leave **Send now**, **Go live**, **Send test**, **Publish**, and **Post now** untapped. This panel has none of those buttons. Do not go looking for them. The flag name is not the **Go live** button.
- No spend. No purchase. No card charge. No ad. No SMS credit. No phone-number purchase. No store listing. No paid developer account. Leave **Pay in the sandbox** untapped.
- No DNS edit. Stay on https://ai-autotech-crm.vercel.app . The hostname checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md). This visit does not open GoDaddy and does not change a record.
- No SQL paste. Do not open the SQL editor from this page. Do not paste steps 20 through 36. The steps paste, when Billy does it later, is [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md). This page does not run SQL.
- No pack click. Leave **Apply Education pack to EASTC** and **Apply Zentrix pack to Zentrix Online** untapped. The click order is [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md). A yes for this checklist verify is not that yes.
- No cron registration. Leave `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, and `/api/cron/ai-replies` uncalled. The schedule paste stays on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md).
- No live secret in the database. Do not paste a Meta, SMS, email, or PayFast key into a form or into SQL.
- No other Phase 5 flag on this visit. Leave `HOME_CHAT_ENABLED`, `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, `CAMPAIGN_CSV_IMPORT_ENABLED`, `EMAIL_SMS_CONNECT_STUB_ENABLED`, `SOCIAL_DRAFTS_ENABLED`, `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`, `ZENTRIX_WORKSPACE_PACK_ENABLED`, `EAST_RAND_CAMPAIGN_SEED_ENABLED`, `PWA_INSTALL_SHELL_ENABLED`, `SETUP_WIZARD_ENABLED`, `MIGRATION_RUNNER_ENABLED`, `OWNER_BOOTSTRAP_UI_ENABLED`, `OPS_SECRETS_READY_ENABLED`, `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset. The order stays on [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). `GOLIVE_CHECKLIST_ENABLED` stays unset on this visit too.
- No webhook. Do not run `supabase/owner-bootstrap.sql` from this page.
- No secret, key, token, password, database URL, merchant id, or service-role value in git, a pull request, chat, an issue, or this file. `SUPABASE_ACCESS_TOKEN` stays a chat note until a real `sbp_` token replaces it on its own checklist. This page does not paste that token.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Gated Phase 5 command-centre panels stay paused.
- Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) until a Success from a previous visit is already logged. This page does not claim they are applied.
- Leave **Load sandbox seed**, **Dry run**, **Dry-load CSV**, **Record install intent**, **Record sandbox checklist event**, **Record sandbox dry-run**, and the owner-bootstrap and ops-secrets **Record sandbox note** untapped. Those visits are [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md), [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md), [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md), [`docs/phone-pwa-install.md`](phone-pwa-install.md), [`docs/phone-setup-wizard.md`](phone-setup-wizard.md), [`docs/phone-migration-runner.md`](phone-migration-runner.md), [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md), and [`docs/phone-ops-secrets.md`](phone-ops-secrets.md).

## Pass means

Signed out, https://ai-autotech-crm.vercel.app/command-centre , `/command-centre/go-live`, `/command-centre/setup`, and `/agency` each answered 307 and the phone landed on `/login` with `next` set to the path you opened. You did not see the checklist while signed out. If you signed in to read the page, the heading was **Go-live checklist** on slug `ai-autotech`, the header chip read **Sending is off**, the sending row read **OFF · Blocked**, no secret value was on screen, the fixture sentence was on screen, and the form ended `write: false`. **Record sandbox note** stayed untapped, or a tap while that fixture sentence was showing wrote nothing. You did not claim a go-live note was stored. You did not run SQL. You did not click Apply. You did not register a cron. Nothing was sent. No DNS record was edited. No other Phase 5 flag was set. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset or `false`. `GOLIVE_CHECKLIST_ENABLED` stayed unset. `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` stayed unset.

A pass does not mean a go-live note was stored, step 36 was applied by this page, the flag was turned on, SQL was applied, a pack was applied, a cron was registered, sending was turned on, or go-live was unblocked.
