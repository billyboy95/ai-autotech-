# Phone checklist: owner bootstrap panel (no send)

Billy runs this on a phone in South Africa (Safari or Chrome). It is the tap path for the owner bootstrap panel on `/command-centre/setup`, `/command-centre/owner`, and `/agency` after step 34 (`phase5m_owner_bootstrap`). The desktop notes stay in [`docs/phase-5m-owner-bootstrap.md`](phase-5m-owner-bootstrap.md). The previous phone companion is the pending-SQL migration runner ([`docs/phone-migration-runner.md`](phone-migration-runner.md), step 33). This page is step 34 in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). The flag is `OWNER_BOOTSTRAP_UI_ENABLED`.

This page is the UI panel companion. It is not the Auth user and `OWNER_EMAILS` verify. That verify is [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md) (Phone-first unblock, step 4 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md)). A pass there does not replace this tap. A pass here does not replace that verify.

Writing this page does not apply SQL, does not set a flag, does not create an Auth user, does not send, and does not spend. Steps 20 through 36 stay unapplied until a Success from a previous visit is already written down. This page does not invent that Success. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This page does not paste a token. Gated Phase 5 command-centre panels stay paused until that SQL and Billy’s yes to the matching flag. Opening the panel in fixture mode does not unpause them.

The production CRM is https://ai-autotech-crm.vercel.app . The workspace for a signed-in look is slug `ai-autotech`. The documented owner email is `billyfaber06@gmail.com` when that Auth user exists. Do not invent another email.

Until `OWNER_BOOTSTRAP_UI_ENABLED` is the string `true` on the running deployment, and only after step 34 has shown Success and Billy has said yes to that flag, this visit is verify-only. Read the fixture sentence. `write` stays false. Do not claim a bootstrap note is stored. The panel does not create an Auth user and does not run `supabase/owner-bootstrap.sql`.

## Preconditions

All of these stay true on this visit. If one is false, stop.

1. Steps 20 through 36 are still unapplied. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) and [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) still say so. A phone verify in fixture mode is allowed before that Success. This page does not paste SQL and does not claim Success.
2. Step 34 is `supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql` (`phase5m_owner_bootstrap`). A stored `owner_bootstrap_notes` row waits until that file has shown Success (`Success. No rows returned` in the SQL editor, or `Success. Steps 20–36 applied.` from the CLI). Until that Success is already logged, the panel stays fixture-only and writes nothing. Step 34 comes after step 33. This page does not skip ahead.
3. Leave `OWNER_BOOTSTRAP_UI_ENABLED` unset until step 34 has succeeded and Billy says yes to that flag on a later call. Unset, blank, or any value other than the string `true` keeps `write` false. Fixture mode is the phone verify on this visit. Setting the flag does not apply SQL, does not create an Auth user, does not send, and does not spend. A preview render stays fixture-only even if the flag is set.
4. A yes for Dry run, the East Rand seed, the PWA install verify, the setup wizard, the migration runner, a channel key, `CRON_SECRET`, the Education pack, the Zentrix pack, a website publish, SQL, or the Owner Auth verify is not a yes for `OWNER_BOOTSTRAP_UI_ENABLED` and is not a yes to send. Dry run is [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md). The East Rand tap is [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md). The PWA verify is [`docs/phone-pwa-install.md`](phone-pwa-install.md). The setup wizard is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md). The migration runner is [`docs/phone-migration-runner.md`](phone-migration-runner.md). The Owner Auth verify is [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md).
5. `sending_enabled` stays false on every workspace. The checkbox **Sending enabled** stays unticked. The header chip on the command centre reads **Sending is off**.
6. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A yes to this panel verify is not a yes to either switch. The only later yes is one named workspace on [`docs/phone-sending-enabled.md`](phone-sending-enabled.md).
7. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). See [`docs/website-publish-decision.md`](website-publish-decision.md).
8. Do not create an Auth user on this visit. Do not paste `supabase/owner-bootstrap.sql`. That file is not a migration. It waits until steps 20 through 36 have shown Success and `billyfaber06@gmail.com` already exists in Supabase Auth. Confirming that user is step 4. This page does not do step 4.

The logged-out production smoke, after SQL Success, is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). This page does not replace that smoke, and that smoke does not replace this tap. The Phase 5 flag order is [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This page does not set a name on that list.

There is no `docs/phone-ops-secrets.md` or `docs/phone-go-live.md` yet. Those visits are later. The desktop notes are [`docs/phase-5n-ops-secrets.md`](phase-5n-ops-secrets.md) and [`docs/phase-5o-golive-checklist.md`](phase-5o-golive-checklist.md). This visit does not set `OPS_SECRETS_READY_ENABLED` or `GOLIVE_CHECKLIST_ENABLED`.

## 1. Signed-out gate

Stay logged out for this step. Use a private tab so an old session cookie is not treated as signed in.

Open each URL. Production answers 307 and the phone lands on `/login`. `next` is the path you opened.

| Open | `next` |
| --- | --- |
| https://ai-autotech-crm.vercel.app/command-centre | `/command-centre` |
| https://ai-autotech-crm.vercel.app/command-centre/setup | `/command-centre/setup` |
| https://ai-autotech-crm.vercel.app/command-centre/owner | `/command-centre/owner` |
| https://ai-autotech-crm.vercel.app/agency | `/agency` |

A phone browser follows that redirect, so the address bar shows the sign-in page and does not show the number 307. A check that does not follow redirects reports **307** and a `Location` whose path is `/login` with that `next`. That is the same gate.

Pass: you see the sign-in page. You do not see **Owner bootstrap**, **Record sandbox note**, or a pack button. Landing on `/login` is a pass for the gate. It is not the panel storing a note.

The same gate with `?org=ai-autotech` puts `org=ai-autotech` on `next`. That link also 307s to `/login` while signed out.

## 2. Read the panel, fixture only

A signed-in look is allowed so you can read the fixture sentence. It is still verify-only. Do not set `OWNER_BOOTSTRAP_UI_ENABLED` to reach it. Do not create an Auth user to reach it.

1. Open https://ai-autotech-crm.vercel.app/command-centre/owner?org=ai-autotech
2. Sign in as the agency owner when the phone is on `/login` and that Auth user already exists. The documented address is `billyfaber06@gmail.com` ([`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md), Phone-first unblock, step 4). When that user is missing, skip the signed-in look. Creating the user is that other checklist, and only when Billy says yes there. This page is not that yes. The signed-out gate in section 1 is still a pass.
3. After sign-in, open the same owner URL again if the app landed on `/agency`.
4. Pass for the look: the eyebrow is **Go-live attach**. The heading is **Owner bootstrap**. The slug is `ai-autotech`. The header chip reads **Sending is off**. That chip is the sending switch. It is a small amber pill. It is not the fixture sentence. If the chip reads **Sending is on**, stop. The header names AI AutoTech. The organisation row is AI AutoTech Pty Ltd, so that legal name on the same workspace is still a pass. If the header names EASTC or Zentrix, open the `?org=ai-autotech` link again.

The same panel is on https://ai-autotech-crm.vercel.app/command-centre/setup?org=ai-autotech and on https://ai-autotech-crm.vercel.app/agency . Scroll to **Owner bootstrap** on each. Ops readiness on `/command-centre` names the link **Open owner bootstrap**. The agency header names the link **Owner bootstrap**. The setup wizard names **Open owner bootstrap** on the agency-owner step. Any of those links opens `/command-centre/owner`. This visit uses the owner URL above. It does not change a flag from those panels.

Read the lines under the heading. They are slate body text. This panel has no yellow banner. The fixture sentence is the words. Previous phone checklists call that sentence the amber pass. Match the words.

These lines are on screen together. The first two follow the chips. Either chip pair below is a pass on this visit. The list of addresses is not shown. If any other email is on screen, stop.

- `OWNER_EMAILS is configured. The list is not shown.` or `OWNER_EMAILS is missing. The server uses the documented default.` Then `The documented owner is billyfaber06@gmail.com. This page does not invent another address.`
- Auth attach is one of three. **Configured**: `Auth attach is configured. billyfaber06@gmail.com exists in Supabase Auth and is agency_owner on ai-autotech.` **Missing**: `Auth attach is missing. Create billyfaber06@gmail.com in Authentication → Users, then paste the SQL. This page does not create that user.` **Fixture**: `Auth attach is fixture. The Auth user was not read on this render. This page does not create an Auth user.` Fixture means this render did not read Auth. It does not mean the user is missing. Missing means the page could read Auth and the user or the membership is not there. Read the Missing sentence. Do not create the user on this visit. Do not paste the SQL on this visit.
- `Steps 20 through 33 are not applied. Step 34 is also unapplied. Step 35 is also unapplied. Do not claim this SQL is already applied.`
- `Open the Supabase SQL editor and paste supabase/owner-bootstrap.sql only after the Auth user exists. This page does not run that file.` Read that sentence. Leave the editor closed. That paste is not this visit. It waits until steps 20 through 36 have shown Success and the Auth user exists.
- `sending_enabled stays false. Nothing is sent. Nothing is spent.`
- `OWNER_BOOTSTRAP_UI_ENABLED is unset. Leave it unset until step 34 is applied. This page does not turn it on.` If this line says the flag is set before step 34 Success is already written down and Billy has said yes to that flag, stop.
- `Leave MIGRATION_RUNNER_ENABLED and SETUP_WIZARD_ENABLED unset. This page does not turn them on.`

The two cards under those lines use short pills. **OWNER_EMAILS** is **Configured** or **Missing**. **Auth attach** is **Configured**, **Missing**, or **Fixture**. **Configured** is a green pill. **Missing** and **Fixture** are amber pills. Those pills are the status. They are not the fixture sentence. Each card names `billyfaber06@gmail.com` and says the list is not shown. The Auth card says `agency_owner on ai-autotech. This page does not create the Auth user.`

Fixture sentence (the amber pass for this visit):

`Fixture only. This panel writes nothing until OWNER_BOOTSTRAP_UI_ENABLED is the string true and step 34 is applied. It does not create an Auth user and does not run owner-bootstrap.sql.`

That sentence is the last line under the heading, and the form under **Sandbox note** repeats it and ends `write: false`. The form line is:

`Fixture only. This panel writes nothing until OWNER_BOOTSTRAP_UI_ENABLED is the string true and step 34 is applied. It does not create an Auth user and does not run owner-bootstrap.sql. write: false.`

`write` stays false. Leave **Record sandbox note** untapped. The button under **Ops secrets** uses the same words. Leave that one untapped too. There is no phone checklist for ops secrets yet.

Flag-on sentence (the slate line). This visit does not create it. Do not set the flag to see it.

`A sandbox note can be stored. charged stays false. An Auth user is not created. owner-bootstrap.sql is not run.`

That line would mean step 34 has succeeded, `OWNER_BOOTSTRAP_UI_ENABLED` is the string `true` on the running deployment after Billy’s yes, and you are signed in on a member workspace. The form would then end `write: true`. The flag line would read `OWNER_BOOTSTRAP_UI_ENABLED is set. A sandbox note can be stored. It does not create an Auth user and does not run the SQL.` If that ready line is on screen before that Success is already written down, stop. A preview render stays fixture-only even when the flag is set. `write` stays false. This visit does not create that line either.

**owner-bootstrap.sql** is a read-only copy of `supabase/owner-bootstrap.sql`. The line names the file, then the word Checksum, then a 64-character sha256. Do not copy the checksum into chat, git, a pull request, or this file. The hash is not a token. Scroll past the dark SQL block. Do not select it. Do not paste it. The block names `billyfaber06@gmail.com` and no other address. If another address is in that block, stop.

Leave these links untapped. They leave the CRM:

- **Open Authentication users**. The Auth confirm is [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md). This visit does not create a user.
- **Open SQL editor**. The steps 20 through 36 paste, when Billy does it later, is [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md). `supabase/owner-bootstrap.sql` is a later paste, after that Success and after the Auth user exists. This visit does not open the editor.

**Sandbox note** says the note stores configured, missing, or fixture, it does not store an email or a secret, and it does not create an Auth user and it does not run the SQL. There is no email field and no secret field on the form. Leave the button untapped.

Leave these alone on the same screens. They are other visits:

- **Setup wizard** and **Record sandbox checklist event** on `/command-centre/setup`.
- **Migration runner** and **Record sandbox dry-run**.
- **Ops secrets** and its **Record sandbox note**.
- **Go-live checklist**. It links to `/command-centre/go-live`. There is no phone checklist for that page yet.
- **Run automations** under Advanced.
- **Apply Education pack to EASTC** and **Apply Zentrix pack to Zentrix Online** on `/agency`.
- **Create client workspace**.
- **Lead Agent** on the setup page. Leave **Continue** and **Pay in the sandbox** untapped.

## 3. Record sandbox note, only when the slate line was already honest

On the verify-only visit, skip this section. Leave **Record sandbox note** untapped.

If the fixture sentence is on screen and the button under **Owner bootstrap** is tapped anyway, the status becomes `Fixture only. This panel writes nothing until OWNER_BOOTSTRAP_UI_ENABLED is the string true and step 34 is applied. It does not create an Auth user and does not run owner-bootstrap.sql.` Nothing is written. `write` stays false. An Auth user was not created. `owner-bootstrap.sql` was not run. That tap is not required for the pass. Do not tap it a second time. Do not claim a bootstrap note was stored.

When the slate line was already honest (step 34 Success already logged, and Billy already said yes to `OWNER_BOOTSTRAP_UI_ENABLED`), one tap can store a sandbox note:

1. Stay on https://ai-autotech-crm.vercel.app/command-centre/owner?org=ai-autotech
2. Tap **Record sandbox note** once, the button under **Owner bootstrap**.
3. Pass: `Sandbox note stored. No email was stored. An Auth user was not created. owner-bootstrap.sql was not run. Nothing is sent.`

The function is `record_owner_bootstrap_note`. It stores one `owner_bootstrap_notes` row: `configured` or `missing` for `OWNER_EMAILS`, and `configured`, `missing`, or `fixture` for the Auth attach, plus the filename `supabase/owner-bootstrap.sql` and its sha256. `status` stays `noted`. `sandbox` stays true. `charged` stays false. The row has no email column and no secret column. The function does not insert into `auth.users`, does not insert a membership, and does not execute `owner-bootstrap.sql`. `sending_enabled` stays false. This page does not turn the flag on to reach that line. This page does not create the Auth user to reach that line.

Stop on any other status. These lines mean stop:

- `Apply step 34 before a sandbox note is stored. Nothing was written. An Auth user was not created. owner-bootstrap.sql was not run.` The flag is on and the schema is missing step 34. Leave `OWNER_BOOTSTRAP_UI_ENABLED` unset until step 34 has succeeded. Do not paste SQL on this visit.
- `The note was not stored. Nothing was written. An Auth user was not created. owner-bootstrap.sql was not run.`
- `The note was refused. Nothing was written. An Auth user was not created. owner-bootstrap.sql was not run.`
- `Secrets are not stored. Nothing was written. An Auth user was not created. owner-bootstrap.sql was not run.` A secret field was refused. Do not paste a key, a token, an email, or a checksum into the form.
- `Nothing was written. An Auth user was not created. owner-bootstrap.sql was not run.` when you expected the slate store line. The flag is not the string `true` for this signed-in workspace, the role cannot store the note, or the header is another workspace. Re-open `?org=ai-autotech`. Do not set the flag on this visit.

## Stop rules

- No real send. Leave **Send now**, **Go live**, **Send test**, **Publish**, and **Post now** untapped. This panel has none of those buttons. Do not go looking for them.
- No spend. No purchase. No card charge. No ad. No SMS credit. No phone-number purchase. No store listing. No paid developer account. Leave **Pay in the sandbox** untapped.
- No DNS edit. Stay on https://ai-autotech-crm.vercel.app . The hostname checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md). This visit does not open GoDaddy and does not change a record.
- No SQL paste. Do not open the SQL editor from this page. Do not paste `supabase/owner-bootstrap.sql`. Do not paste steps 20 through 36. The steps paste, when Billy does it later, is [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md). The owner SQL waits until that Success and the Auth user exists.
- No Auth user create. Do not open Authentication → Users from this panel. That confirm is [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md). A yes there is not a yes for `OWNER_BOOTSTRAP_UI_ENABLED`.
- No other Phase 5 flag on this visit. Leave `HOME_CHAT_ENABLED`, `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, `CAMPAIGN_CSV_IMPORT_ENABLED`, `EMAIL_SMS_CONNECT_STUB_ENABLED`, `SOCIAL_DRAFTS_ENABLED`, `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`, `ZENTRIX_WORKSPACE_PACK_ENABLED`, `EAST_RAND_CAMPAIGN_SEED_ENABLED`, `PWA_INSTALL_SHELL_ENABLED`, `SETUP_WIZARD_ENABLED`, `MIGRATION_RUNNER_ENABLED`, `OPS_SECRETS_READY_ENABLED`, `GOLIVE_CHECKLIST_ENABLED`, `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset. The order stays on [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). `OWNER_BOOTSTRAP_UI_ENABLED` stays unset on this visit too.
- No cron registration. Leave `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, and `/api/cron/ai-replies` uncalled. The schedule paste stays on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md).
- No webhook.
- No secret, key, token, password, database URL, checksum, email list, merchant id, or service-role value in git, a pull request, chat, an issue, or this file. `SUPABASE_ACCESS_TOKEN` stays a chat note until a real `sbp_` token replaces it on its own checklist. This page does not paste that token.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).
- Gated Phase 5 command-centre panels stay paused.
- Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) until a Success from a previous visit is already logged. This page does not claim they are applied.
- Leave **Load sandbox seed**, **Dry run**, **Dry-load CSV**, **Record install intent**, **Record sandbox checklist event**, and **Record sandbox dry-run** untapped. Those visits are [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md), [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md), [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md), [`docs/phone-pwa-install.md`](phone-pwa-install.md), [`docs/phone-setup-wizard.md`](phone-setup-wizard.md), and [`docs/phone-migration-runner.md`](phone-migration-runner.md).

## Pass means

Signed out, https://ai-autotech-crm.vercel.app/command-centre , `/command-centre/setup`, `/command-centre/owner`, and `/agency` each answered 307 and the phone landed on `/login` with `next` set to the path you opened. You did not see the panel while signed out. If you signed in to read the page, the heading was **Owner bootstrap** on slug `ai-autotech`, the header chip read **Sending is off**, the documented owner line named `billyfaber06@gmail.com` and no other address, the fixture sentence was on screen, and the form ended `write: false`. **Record sandbox note** stayed untapped, or a tap while that fixture sentence was showing wrote nothing. You did not claim a bootstrap note was stored. You did not create an Auth user. You did not paste `supabase/owner-bootstrap.sql`. You did not copy the checksum. Nothing was sent. No DNS record was edited. No other Phase 5 flag was set. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset or `false`. `OWNER_BOOTSTRAP_UI_ENABLED` stayed unset.

A pass does not mean a bootstrap note was stored, step 34 was applied by this page, the flag was turned on, an Auth user was created, `supabase/owner-bootstrap.sql` was run, sending was turned on, or go-live was unblocked.
