# Phone checklist: pending-SQL migration runner (no send)

Billy runs this on a phone in South Africa (Safari or Chrome). It is the tap path for the pending-SQL migration runner on `/command-centre`, `/command-centre/migrations`, and `/agency` after step 33 (`phase5l_migration_runner`). The desktop notes stay in [`docs/phase-5l-migration-runner.md`](phase-5l-migration-runner.md). The previous phone companion is the setup / go-live wizard ([`docs/phone-setup-wizard.md`](phone-setup-wizard.md), step 32). This page is step 33 in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). The flag is `MIGRATION_RUNNER_ENABLED`.

Writing this page does not apply SQL, does not set a flag, does not send, and does not spend. Steps 20 through 36 stay unapplied until a Success from a previous visit is already written down. This page does not invent that Success. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This page does not paste a token. Gated Phase 5 command-centre panels stay paused until that SQL and Billy’s yes to the matching flag. Opening the runner in fixture mode does not unpause them.

The production CRM is https://ai-autotech-crm.vercel.app . The workspace for a signed-in look is slug `ai-autotech`. The documented owner email is `billyfaber06@gmail.com` when that Auth user exists.

Until `MIGRATION_RUNNER_ENABLED` is the string `true` on the running deployment, and only after step 33 has shown Success and Billy has said yes to that flag, this visit is verify-only. Read the fixture sentence. `write` stays false. Do not claim a dry-run is stored. The runner does not execute migration SQL and does not mark a step applied.

## Preconditions

All of these stay true on this visit. If one is false, stop.

1. Steps 20 through 36 are still unapplied. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) and [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) still say so. A phone verify in fixture mode is allowed before that Success. This page does not paste SQL and does not claim Success.
2. Step 33 is `supabase/migrations/20261108120000_phase5l_migration_runner.sql` (`phase5l_migration_runner`). A stored `migration_runner_events` row waits until that file has shown Success (`Success. No rows returned` in the SQL editor, or `Success. Steps 20–36 applied.` from the CLI). Until that Success is already logged, the runner stays fixture-only and writes nothing. Step 33 comes after step 32. This page does not skip ahead.
3. Leave `MIGRATION_RUNNER_ENABLED` unset until step 33 has succeeded and Billy says yes to that flag on a later call. Unset, blank, or any value other than the string `true` keeps `write` false. Fixture mode is the phone verify on this visit. Setting the flag does not apply SQL, does not send, and does not spend. Without `SUPABASE_DB_URL`, the panels write nothing even when the flag is the string `true`.
4. A yes for Dry run, the East Rand seed, the PWA install verify, the setup wizard, a channel key, `CRON_SECRET`, the Education pack, the Zentrix pack, a website publish, or SQL is not a yes for `MIGRATION_RUNNER_ENABLED` and is not a yes to send. Dry run is [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md). The East Rand tap is [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md). The PWA verify is [`docs/phone-pwa-install.md`](phone-pwa-install.md). The setup wizard is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md).
5. `sending_enabled` stays false on every workspace. The checkbox **Sending enabled** stays unticked. The header chip on the command centre reads **Sending is off**.
6. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A yes to this runner verify is not a yes to either switch. The only later yes is one named workspace on [`docs/phone-sending-enabled.md`](phone-sending-enabled.md).
7. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). See [`docs/website-publish-decision.md`](website-publish-decision.md).

The logged-out production smoke, after SQL Success, is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). This page does not replace that smoke, and that smoke does not replace this tap. The Phase 5 flag order is [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This page does not set a name on that list.

The next phone companion is the owner bootstrap panel, step 34. The checklist is [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md). This visit does not open `/command-centre/owner` to record a note and does not set `OWNER_BOOTSTRAP_UI_ENABLED`. A yes for the migration runner is not that yes. Signed out, `/command-centre`, `/command-centre/setup`, `/command-centre/owner`, and `/agency` answer 307 and land on `/login`. With the flag unset, `write` stays false. The panel does not create an Auth user and does not run `supabase/owner-bootstrap.sql`. The ops secrets panel checklist is [`docs/phone-ops-secrets.md`](phone-ops-secrets.md) (step 35). This visit does not open `/command-centre/ops-secrets` to record a note and does not set `OPS_SECRETS_READY_ENABLED`. A yes for the migration runner is not that yes. Signed out, `/command-centre`, `/command-centre/ops-secrets`, `/command-centre/setup`, and `/agency` answer 307 and land on `/login`. With the flag unset, `write` stays false. The panel stores presence only. It does not register a cron and it does not put a live Meta, SMS, email, or PayFast key in the database. There is no `docs/phone-go-live.md` yet. That visit is later. It is step 36 (`GOLIVE_CHECKLIST_ENABLED`). The desktop notes are [`docs/phase-5m-owner-bootstrap.md`](phase-5m-owner-bootstrap.md), [`docs/phase-5n-ops-secrets.md`](phase-5n-ops-secrets.md), and [`docs/phase-5o-golive-checklist.md`](phase-5o-golive-checklist.md). This visit does not set `GOLIVE_CHECKLIST_ENABLED`.

## 1. Signed-out gate

Stay logged out for this step. Use a private tab so an old session cookie is not treated as signed in.

Open each URL. Production answers 307 and the phone lands on `/login`. `next` is the path you opened.

| Open | `next` |
| --- | --- |
| https://ai-autotech-crm.vercel.app/command-centre | `/command-centre` |
| https://ai-autotech-crm.vercel.app/command-centre/migrations | `/command-centre/migrations` |
| https://ai-autotech-crm.vercel.app/agency | `/agency` |

A phone browser follows that redirect, so the address bar shows the sign-in page and does not show the number 307. A check that does not follow redirects reports **307** and a `Location` whose path is `/login` with that `next`. That is the same gate.

Pass: you see the sign-in page. You do not see **Migration runner**, **Record sandbox dry-run**, or a pack button. Landing on `/login` is a pass for the gate. It is not the runner storing a dry-run.

The same gate with `?org=ai-autotech` puts `org=ai-autotech` on `next`. That link also 307s to `/login` while signed out.

## 2. Read the runner, fixture only

A signed-in look is allowed so you can read the fixture sentence. It is still verify-only. Do not set `MIGRATION_RUNNER_ENABLED` to reach it.

1. Open https://ai-autotech-crm.vercel.app/command-centre/migrations?org=ai-autotech
2. Sign in as the agency owner when the phone is on `/login`. The documented address is `billyfaber06@gmail.com` when that Auth user exists ([`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md), Phone-first unblock, step 4).
3. After sign-in, open the same migrations URL again if the app landed on `/agency`.
4. Pass for the look: the eyebrow is **Pending SQL**. The heading is **Migration runner**. The slug is `ai-autotech`. The header chip reads **Sending is off**. That chip is the sending switch. It is a small amber pill. It is not the fixture sentence. If the chip reads **Sending is on**, stop. If the header names EASTC or Zentrix, open the `?org=ai-autotech` link again.

The same panel is on https://ai-autotech-crm.vercel.app/command-centre?org=ai-autotech and on https://ai-autotech-crm.vercel.app/agency . Scroll to **Migration runner** on each. Ops readiness names the link **Open migration runner**. The agency header names the link **Migration runner**. Either link opens `/command-centre/migrations`. This visit uses the migrations URL above. It does not change a flag from those panels.

Read the lines under the heading. They are slate body text. This panel has no yellow banner. The fixture sentence is the words. Previous phone checklists call that sentence the amber pass. Match the words.

These lines are on screen together:

- `Steps 20 through 33 are pending until verified. Do not claim applied. SQL is not applied. Step 34 is also unapplied and is not part of this dry-run. Step 35 is also unapplied and is not part of this dry-run.`
- `sending_enabled stays false. Nothing is sent. Nothing is spent.`
- `SUPABASE_DB_URL is missing. The value is not shown.` or `SUPABASE_DB_URL is configured. The value is not shown.` Either line is a pass on this visit. The value is not on screen. Do not go looking for a database URL.
- `MIGRATION_RUNNER_ENABLED is unset. Leave it unset until step 33 is applied. This page does not turn it on.` If this line says the flag is set before step 33 Success is already written down and Billy has said yes to that flag, stop.
- `Fixture. Every step is pending.` or `Checklist source is the workspace session. Every unverified step stays pending.` The second line can appear when you are signed in and `SUPABASE_DB_URL` is configured. It is still a pass while the fixture sentence below is on screen and `write` stays false. That source line does not mean the flag is on.

Fixture sentence (the amber pass for this visit):

`Fixture only. This runner writes nothing until MIGRATION_RUNNER_ENABLED is the string true, step 33 is applied, and SUPABASE_DB_URL is configured. SQL is not applied.`

That sentence is the last line under the heading, and the form under **Sandbox dry-run** repeats it and ends `write: false`. The form line is:

`Fixture only. This runner writes nothing until MIGRATION_RUNNER_ENABLED is the string true, step 33 is applied, and SUPABASE_DB_URL is configured. SQL is not applied. write: false.`

`write` stays false. Leave **Record sandbox dry-run** untapped.

Flag-on sentence (the slate line). This visit does not create it. Do not set the flag to see it.

`A sandbox dry-run can be stored. charged stays false. SQL is not applied. Status stays pending until verified.`

That line would mean step 33 has succeeded, `MIGRATION_RUNNER_ENABLED` is the string `true` on the running deployment after Billy’s yes, you are signed in on a member workspace, and `SUPABASE_DB_URL` is configured. The form would then end `write: true`. The flag line would read `MIGRATION_RUNNER_ENABLED is set. SQL is not applied. Status stays pending until verified.` If that ready line is on screen before that Success is already written down, stop. A flag that is set while `SUPABASE_DB_URL` is missing shows `SUPABASE_DB_URL is missing. Nothing was written. SQL was not applied.` and `write` stays false. That is not the slate store line, and this visit does not create it either.

**Sandbox dry-run** says the dry-run stores the step, filename, and checksum for this list, `charged` stays false, and it does not apply SQL. There is no secret field on the form. Leave the button untapped.

The ordered list is steps 20 through 33. Fourteen rows. Each row shows the step number, the short name, the filename, a 64-character sha256, and `Pending. Do not claim applied.` Do not copy a checksum into chat, git, a pull request, or this file. The hash is not a token. This page still does not paste it.

| Step | Name | Pass on this visit |
| --- | --- | --- |
| 20 | `phase4c_aios_pricing` | **Pending**. `Pending. Do not claim applied.` |
| 21 | `phase4d_eastc_education` | **Pending** |
| 22 | `phase5a_agent_computers` | **Pending** |
| 23 | `phase5b_lead_onboarding` | **Pending** |
| 24 | `phase5c_connect_import` | **Pending** |
| 25 | `phase5d_home_chat` | **Pending** |
| 26 | `phase5e_campaign_dry_run` | **Pending** |
| 27 | `phase5f_campaign_csv_channels` | **Pending** |
| 28 | `phase5g_social_drafts` | **Pending** |
| 29 | `phase5h_zentrix_workspace_pack` | **Pending** |
| 30 | `phase5i_campaign_seed_ops` | **Pending** |
| 31 | `phase5j_pwa_mobile_shell` | **Pending** |
| 32 | `phase5k_setup_wizard` | **Pending** |
| 33 | `phase5l_migration_runner` | **Pending**. This row is the runner’s own file. It stays pending. |

If any row says `Applied`, stop. This page does not verify a step as applied. Steps 20 through 33 stay pending until a later verification that this visit does not perform. Step 34 and step 35 stay outside this list. Step 36 stays outside this list too.

Leave these alone on the same screens. They are other visits:

- **Setup wizard**, **Ops secrets**, and **Go-live checklist** cards on `/command-centre`.
- **Run automations** under Advanced.
- **Record sandbox checklist event** on `/command-centre/setup`.
- **Record sandbox note** on owner bootstrap and on ops secrets.
- **Apply Education pack to EASTC** and **Apply Zentrix pack to Zentrix Online** on `/agency`.
- **Create client workspace**.

## 3. Record sandbox dry-run, only when the slate line was already honest

On the verify-only visit, skip this section. Leave **Record sandbox dry-run** untapped.

If the fixture sentence is on screen and the button is tapped anyway, the status becomes `Fixture only. This runner writes nothing until MIGRATION_RUNNER_ENABLED is the string true, step 33 is applied, and SUPABASE_DB_URL is configured. SQL is not applied.` Nothing is written. `write` stays false. SQL was not applied. That tap is not required for the pass. Do not tap it a second time. Do not claim a dry-run was stored. Do not claim a step was marked applied.

When the slate line was already honest (step 33 Success already logged, Billy already said yes to `MIGRATION_RUNNER_ENABLED`, and `SUPABASE_DB_URL` is configured), one tap can store a sandbox checklist:

1. Stay on https://ai-autotech-crm.vercel.app/command-centre/migrations?org=ai-autotech
2. Tap **Record sandbox dry-run** once.
3. Pass: `Sandbox dry-run stored. Status stays pending. No secret was stored. SQL was not applied. Nothing is sent.`

The function is `record_migration_dry_run`. It stores one `migration_runner_events` row per step from 20 through 33: step number, filename, and sha256. That is fourteen rows. `status` stays `pending`. `sandbox` stays true. `charged` stays false. The row has no secret column, no database URL, and no token. The function does not execute the migration files and does not mark a step applied. `sending_enabled` stays false. This page does not turn the flag on to reach that line.

Stop on any other status. These lines mean stop:

- `Apply step 33 before a dry-run is stored. Nothing was written. SQL was not applied.` The flag is on and the schema is missing step 33. Leave `MIGRATION_RUNNER_ENABLED` unset until step 33 has succeeded. Do not paste SQL on this visit.
- `SUPABASE_DB_URL is missing. Nothing was written. SQL was not applied.` The flag may be on and the database URL is missing. `write` stays false. Do not paste a database URL on this visit.
- `The dry-run was not stored. Nothing was written. SQL was not applied.`
- `The dry-run was refused. Nothing was written. SQL was not applied.`
- `Secrets are not stored. Nothing was written. SQL was not applied.` A secret field was refused. Do not paste a key, a token, a database URL, or a checksum into the form.
- `Nothing was written. SQL was not applied.` when you expected the slate store line. The flag is not the string `true` for this signed-in workspace, the role cannot store the note, or the header is another workspace. Re-open `?org=ai-autotech`. Do not set the flag on this visit.

## Stop rules

- No real send. Leave **Send now**, **Go live**, **Send test**, **Publish**, and **Post now** untapped. This runner has none of those buttons. Do not go looking for them.
- No spend. No purchase. No card charge. No ad. No SMS credit. No phone-number purchase. No store listing. No paid developer account.
- No DNS edit. Stay on https://ai-autotech-crm.vercel.app . The hostname checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md). This visit does not open GoDaddy and does not change a record.
- No SQL paste. Do not open the SQL editor from this page. The paste, when Billy does it later, is [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md). The runner does not execute migration SQL and does not mark a step applied.
- No other Phase 5 flag on this visit. Leave `HOME_CHAT_ENABLED`, `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, `CAMPAIGN_CSV_IMPORT_ENABLED`, `EMAIL_SMS_CONNECT_STUB_ENABLED`, `SOCIAL_DRAFTS_ENABLED`, `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`, `ZENTRIX_WORKSPACE_PACK_ENABLED`, `EAST_RAND_CAMPAIGN_SEED_ENABLED`, `PWA_INSTALL_SHELL_ENABLED`, `SETUP_WIZARD_ENABLED`, `OWNER_BOOTSTRAP_UI_ENABLED`, `OPS_SECRETS_READY_ENABLED`, `GOLIVE_CHECKLIST_ENABLED`, `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset. The order stays on [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). `MIGRATION_RUNNER_ENABLED` stays unset on this visit too.
- No cron registration. Leave `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, and `/api/cron/ai-replies` uncalled. The schedule paste stays on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md).
- No webhook. Do not run `supabase/owner-bootstrap.sql` from this page.
- No secret, key, token, password, database URL, checksum, merchant id, or service-role value in git, a pull request, chat, an issue, or this file. `SUPABASE_ACCESS_TOKEN` stays a chat note until a real `sbp_` token replaces it on its own checklist. This page does not paste that token.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).
- Gated Phase 5 command-centre panels stay paused.
- Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) until a Success from a previous visit is already logged. This page does not claim they are applied.
- Leave **Load sandbox seed**, **Dry run**, **Dry-load CSV**, **Record install intent**, and **Record sandbox checklist event** untapped. Those visits are [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md), [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md), [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md), [`docs/phone-pwa-install.md`](phone-pwa-install.md), and [`docs/phone-setup-wizard.md`](phone-setup-wizard.md).
- Do not open the owner bootstrap panel to tap **Record sandbox note**. That visit is [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md). Leave `OWNER_BOOTSTRAP_UI_ENABLED` unset. A yes for this runner verify is not that yes. The panel does not create an Auth user and does not run `supabase/owner-bootstrap.sql`.

## Pass means

Signed out, https://ai-autotech-crm.vercel.app/command-centre , `/command-centre/migrations`, and `/agency` each answered 307 and the phone landed on `/login` with `next` set to the path you opened. You did not see the runner while signed out. If you signed in to read the page, the heading was **Migration runner** on slug `ai-autotech`, the header chip read **Sending is off**, the fixture sentence was on screen, and the form ended `write: false`. **Record sandbox dry-run** stayed untapped, or a tap while that fixture sentence was showing wrote nothing. You did not claim a dry-run was stored. Steps 20 through 33 still read `Pending. Do not claim applied.` The runner did not execute migration SQL and did not mark a step applied. No database URL was shown. No checksum was copied out. Nothing was sent. No DNS record was edited. No other Phase 5 flag was set. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset or `false`. `MIGRATION_RUNNER_ENABLED` stayed unset.

A pass does not mean a dry-run was stored, step 33 was applied by this page, the flag was turned on, a step was marked applied, sending was turned on, or go-live was unblocked.
