# Phone checklist: setup / go-live wizard (no send)

Billy runs this on a phone in South Africa (Safari or Chrome). It is the tap path for the setup / go-live wizard on `/command-centre/setup` after step 32 (`phase5k_setup_wizard`). The desktop notes stay in [`docs/phase-5k-setup-wizard.md`](phase-5k-setup-wizard.md). The previous phone companion is the optional PWA install shell ([`docs/phone-pwa-install.md`](phone-pwa-install.md), step 31). This page is step 32 in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). The flag is `SETUP_WIZARD_ENABLED`.

Writing this page does not apply SQL, does not set a flag, does not send, and does not spend. Steps 20 through 36 stay unapplied until a Success from a previous visit is already written down. This page does not invent that Success. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This page does not paste a token. Gated Phase 5 command-centre panels stay paused until that SQL and Billy’s yes to the matching flag. Opening the setup page in fixture mode does not unpause them.

The production CRM is https://ai-autotech-crm.vercel.app . The workspace for a signed-in look is slug `ai-autotech`. The documented owner email is `billyfaber06@gmail.com` when that Auth user exists.

Until `SETUP_WIZARD_ENABLED` is the string `true` on the running deployment, and only after step 32 has shown Success and Billy has said yes to that flag, this visit is verify-only. Read the amber fixture copy. `write` stays false. Do not claim a checklist event is stored.

## Preconditions

All of these stay true on this visit. If one is false, stop.

1. Steps 20 through 36 are still unapplied. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) and [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) still say so. A phone verify in fixture mode is allowed before that Success. This page does not paste SQL and does not claim Success.
2. Step 32 is `supabase/migrations/20261107120000_phase5k_setup_wizard.sql` (`phase5k_setup_wizard`). A stored `setup_checklist_events` row waits until that file has shown Success (`Success. No rows returned` in the SQL editor, or `Success. Steps 20–36 applied.` from the CLI). Until that Success is already logged, the wizard stays fixture-only and writes nothing. Step 32 comes after step 31. This page does not skip ahead.
3. Leave `SETUP_WIZARD_ENABLED` unset until step 32 has succeeded and Billy says yes to that flag on a later call. Unset, blank, or any value other than the string `true` keeps the page fixture-only. Fixture mode is the phone verify on this visit. `write` stays false. Setting the flag does not apply SQL, does not send, and does not spend.
4. A yes for Dry run, the East Rand seed, the PWA install verify, a channel key, `CRON_SECRET`, the Education pack, the Zentrix pack, a website publish, or SQL is not a yes for `SETUP_WIZARD_ENABLED` and is not a yes to send. Dry run is [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md). The East Rand tap is [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md). The PWA verify is [`docs/phone-pwa-install.md`](phone-pwa-install.md).
5. `sending_enabled` stays false on every workspace. The checkbox **Sending enabled** stays unticked.
6. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A yes to this wizard verify is not a yes to either switch. The only later yes is one named workspace on [`docs/phone-sending-enabled.md`](phone-sending-enabled.md).
7. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). See [`docs/website-publish-decision.md`](website-publish-decision.md).

The logged-out production smoke, after SQL Success, is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). This page does not replace that smoke, and that smoke does not replace this tap. The Phase 5 flag order is [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This page does not set a name on that list.

The next phone companion is the pending-SQL migration runner, step 33. The checklist is [`docs/phone-migration-runner.md`](phone-migration-runner.md). This visit does not open `/command-centre/migrations` to record a dry-run and does not set `MIGRATION_RUNNER_ENABLED`. A yes for the setup wizard is not that yes. Signed out, `/command-centre`, `/command-centre/migrations`, and `/agency` answer 307 and land on `/login`. With the flag unset, `write` stays false. The runner does not execute migration SQL. The owner bootstrap panel checklist is [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md) (step 34). This visit does not open `/command-centre/owner` to record a note and does not set `OWNER_BOOTSTRAP_UI_ENABLED`. A yes for the setup wizard is not that yes. Signed out, `/command-centre`, `/command-centre/setup`, `/command-centre/owner`, and `/agency` answer 307 and land on `/login`. With the flag unset, `write` stays false. The panel does not create an Auth user and does not run `supabase/owner-bootstrap.sql`. The ops secrets panel checklist is [`docs/phone-ops-secrets.md`](phone-ops-secrets.md) (step 35). This visit does not open `/command-centre/ops-secrets` to record a note and does not set `OPS_SECRETS_READY_ENABLED`. A yes for the setup wizard is not that yes. Signed out, `/command-centre`, `/command-centre/ops-secrets`, `/command-centre/setup`, and `/agency` answer 307 and land on `/login`. With the flag unset, `write` stays false. The panel stores presence only. It does not register a cron and it does not put a live Meta, SMS, email, or PayFast key in the database. There is no `docs/phone-go-live.md` yet. That visit is later. It is step 36 (`GOLIVE_CHECKLIST_ENABLED`). The desktop notes are [`docs/phase-5l-migration-runner.md`](phase-5l-migration-runner.md), [`docs/phase-5m-owner-bootstrap.md`](phase-5m-owner-bootstrap.md), [`docs/phase-5n-ops-secrets.md`](phase-5n-ops-secrets.md), and [`docs/phase-5o-golive-checklist.md`](phase-5o-golive-checklist.md). This visit does not set `GOLIVE_CHECKLIST_ENABLED`.

## 1. Signed-out gate

Stay logged out for this step. Use a private tab so an old session cookie is not treated as signed in.

1. Open https://ai-autotech-crm.vercel.app/command-centre/setup
2. Production answers 307 and the phone lands on `/login`. `next` is `/command-centre/setup`.
3. A phone browser follows that redirect, so the address bar shows the sign-in page and does not show the number 307. A check that does not follow redirects reports **307** and a `Location` whose path is `/login` with that `next`. That is the same gate.

Pass: you see the sign-in page. You do not see **Setup / go-live wizard**, **Record sandbox checklist event**, or a pack button. Landing on `/login` is a pass for the gate. It is not the wizard storing an event.

The same gate with `?org=ai-autotech` puts `org=ai-autotech` on `next`. That link also 307s to `/login` while signed out.

## 2. Read the wizard, fixture only

A signed-in look is allowed so you can read the amber banner. It is still verify-only. Do not set `SETUP_WIZARD_ENABLED` to reach it.

1. Open https://ai-autotech-crm.vercel.app/command-centre/setup?org=ai-autotech
2. Sign in as the agency owner when the phone is on `/login`. The documented address is `billyfaber06@gmail.com` when that Auth user exists ([`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md), Phone-first unblock, step 4).
3. After sign-in, open the same setup URL again if the app landed on `/agency`.
4. Pass for the look: the eyebrow is **Go-live**. The heading is **Setup / go-live wizard**. The slug is `ai-autotech`. The header names AI AutoTech. The organisation row is AI AutoTech Pty Ltd, so that legal name on the same workspace is still a pass. If the header names EASTC or Zentrix, open the `?org=ai-autotech` link again.

The intro says this is an ordered checklist for the remaining production blockers, `sending_enabled` stays false, nothing is sent and nothing is spent, `AI_REPLY_CRON_ENABLED` stays unset, and this page does not schedule a cron. If the page says sending is on, stop.

Read the banner under that intro.

- Amber: `Fixture only. This wizard writes nothing until SETUP_WIZARD_ENABLED is true and step 32 is applied.` That line is the pass for this visit. `write` stays false. The form under **Sandbox note** says `Recording stays off while SETUP_WIZARD_ENABLED is unset. write: false.` Leave **Record sandbox checklist event** untapped.
- Slate: `SETUP_WIZARD_ENABLED is the string true. A sandbox checklist event can be stored after step 32 is applied. No secret is stored.` That line means step 32 has succeeded and the flag is the string `true` on the running deployment, after Billy’s yes to that flag. This visit does not create that line. If the slate line is on screen before that Success is already written down, stop.

**Copy helper** says to re-authenticate the Supabase SQL editor and paste steps 20 through 31 from `supabase/APPLY-ORDER.md` in that order, and that this page does not apply the SQL and does not ask for a database URL. Read that sentence. Do not paste SQL on this visit. Do not open the SQL editor from this page. The paste, when Billy does it later, is [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md). The same card says step 32 is also unapplied, and it says to leave the East Rand seed, the Zentrix pack, and the PWA write flag off. It also says step 33, step 34, and step 35 are unapplied, and it names `MIGRATION_RUNNER_ENABLED`, `OWNER_BOOTSTRAP_UI_ENABLED`, and `OPS_SECRETS_READY_ENABLED` as unset. Leave **Open ops secrets** untapped.

The ordered list under the copy helper is the wizard. On this visit every SQL line stays pending. The page does not claim the SQL is applied.

| Step | Label | Pass on this visit |
| --- | --- | --- |
| 1 | Supabase SQL steps 20–31 | **Pending**. Each file from 20 through 31 ends with `Pending. Do not claim applied.` Step 32 is also named unapplied. |
| 2 | Agency owner first login | Names `billyfaber06@gmail.com`. No other address. **Missing** or **Configured**. The list of addresses is not shown. |
| 3 | CRON_SECRET | **Missing** or **Configured**. The value is not shown. `AI_REPLY_CRON_ENABLED` stays unset. No cron is scheduled. |
| 4 | Email | **Not connected**, or **Connected** only when a sandbox row is already present. No secret is read. |
| 5 | WhatsApp (Meta) | Same as Email. Nothing is sent. |
| 6 | SMS | Same as Email. Nothing is sent. |
| 7 | PayFast / BILLING_SANDBOX | **Missing** or **Configured**. A merchant id is not shown. No charge is sent. |
| 8 | Phase 5 flags | **Leave unset**. `SETUP_WIZARD_ENABLED · unset · step 32 · This setup wizard. Leave unset.` |

The SQL names on step 1, in order, are `phase4c_aios_pricing`, `phase4d_eastc_education`, `phase5a_agent_computers`, `phase5b_lead_onboarding`, `phase5c_connect_import`, `phase5d_home_chat`, `phase5e_campaign_dry_run`, `phase5f_campaign_csv_channels`, `phase5g_social_drafts`, `phase5h_zentrix_workspace_pack`, `phase5i_campaign_seed_ops`, and `phase5j_pwa_mobile_shell`. If any of those lines says applied, stop. Do not claim Success.

`CRON_SECRET` as **Configured** is a previous yes to that name. It is not a yes for `SETUP_WIZARD_ENABLED`. Do not copy the value. It is not on screen.

A channel row that says **Connected** is a sandbox stub already stored. No secret is read. Do not send from it. Leave the link untapped. The link labels are **Not connected** or **Connected**. They go to the connect-accounts stubs. This visit does not paste a key.

PayFast on step 7 does not show a merchant id. `charged` stays false. If a rand amount appears, it is not a charge from this wizard.

Step 8 lists the Phase 5 names and does not set them. `SETUP_WIZARD_ENABLED` must read `unset` on this visit. If that line reads `set` before step 32 Success is already written down and Billy has said yes to that flag, stop. A different flag that already reads `set` is a previous visit. Leave it. Do not add a name in Vercel from this page.

**Sandbox note** says the note stores org, step, and status only, `sandbox` stays true, `charged` stays false, and a secret field is refused. The select **Checklist step** defaults to **Supabase SQL steps 20–31**. There is no secret field and no status field. Leave the button untapped.

Leave these alone on the same page. They are other visits:

- The card **Go-live checklist**. It links to `/command-centre/go-live`. There is no phone checklist for that page yet.
- **Owner bootstrap** and its **Record sandbox note**. That visit is [`docs/phone-owner-bootstrap-ui.md`](phone-owner-bootstrap-ui.md). Leave `OWNER_BOOTSTRAP_UI_ENABLED` unset.
- **Ops secrets** and its **Record sandbox note**. That visit is [`docs/phone-ops-secrets.md`](phone-ops-secrets.md). Leave `OPS_SECRETS_READY_ENABLED` unset.
- **Lead Agent** under the wizard. Leave **Continue** and **Pay in the sandbox** untapped. A budget chip is not a charge. Do not pay.
- **Open owner bootstrap** on step 2.

Ops readiness on `/command-centre` and `/agency` links here with **Open setup wizard** or **Setup wizard**. This visit opens the setup URL above. It does not change a flag from those panels.

## 3. Record sandbox checklist event, only when the slate line was already honest

On the verify-only visit, skip this section. Leave **Record sandbox checklist event** untapped.

If the amber banner is on screen and the button is tapped anyway, the status becomes `Fixture only. This wizard writes nothing until SETUP_WIZARD_ENABLED is true and step 32 is applied.` Nothing is written. `write` stays false. That tap is not required for the pass. Do not tap it a second time. Do not claim a checklist event was stored.

When the slate line was already honest (step 32 Success already logged, and Billy already said yes to `SETUP_WIZARD_ENABLED`), one tap can store a sandbox row:

1. Leave **Checklist step** on **Supabase SQL steps 20–31**, or choose one of the eight labels. The choices are Supabase SQL steps 20–31, Agency owner first login, CRON_SECRET, Email, WhatsApp (Meta), SMS, PayFast / BILLING_SANDBOX, and Phase 5 flags.
2. Tap **Record sandbox checklist event** once.
3. Pass: `Sandbox checklist event stored. No secret was stored. Nothing is sent.`

The row is `org_id`, `step_key`, and `status` for the signed-in workspace. `sandbox` stays true. `charged` stays false. The function is `record_setup_checklist_event`. The row has no secret column. `sending_enabled` stays false. This page does not turn the flag on to reach that line.

Stop on any other status. These lines mean stop:

- `Apply step 32 before a checklist event is stored. Nothing was written.` The flag is on and the schema is missing step 32. Leave `SETUP_WIZARD_ENABLED` unset until step 32 has succeeded. Do not paste SQL on this visit.
- `The checklist event was not stored. Nothing was written.`
- `The checklist event was refused. Nothing was written.`
- `Secrets are not stored. Nothing was written.` A secret field was refused. Do not paste a key, a token, a merchant id, or an email list into the form.
- `Choose a checklist step. Nothing was written.`
- `Nothing was written.` when you expected the slate store line. The flag is not the string `true` for this signed-in workspace, or the header is another workspace. Re-open `?org=ai-autotech`. Do not set the flag on this visit.

## Stop rules

- No real send. Leave **Send now**, **Go live**, **Send test**, **Publish**, and **Post now** untapped. This wizard has none of those buttons. Do not go looking for them.
- No spend. No purchase. No card charge. No ad. No SMS credit. No phone-number purchase. Leave **Pay in the sandbox** untapped.
- No DNS edit. Stay on https://ai-autotech-crm.vercel.app . The hostname checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md). This visit does not open GoDaddy and does not change a record.
- No paid developer account. No store listing.
- No other Phase 5 flag on this visit. Leave `HOME_CHAT_ENABLED`, `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, `CAMPAIGN_CSV_IMPORT_ENABLED`, `EMAIL_SMS_CONNECT_STUB_ENABLED`, `SOCIAL_DRAFTS_ENABLED`, `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`, `ZENTRIX_WORKSPACE_PACK_ENABLED`, `EAST_RAND_CAMPAIGN_SEED_ENABLED`, `PWA_INSTALL_SHELL_ENABLED`, `MIGRATION_RUNNER_ENABLED`, `OWNER_BOOTSTRAP_UI_ENABLED`, `OPS_SECRETS_READY_ENABLED`, `GOLIVE_CHECKLIST_ENABLED`, `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset. The order stays on [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). `SETUP_WIZARD_ENABLED` stays unset on this visit too.
- No cron registration. Leave `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, and `/api/cron/ai-replies` uncalled. The schedule paste stays on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md).
- No webhook. No SQL paste. Do not run `supabase/owner-bootstrap.sql` from this page.
- No secret, key, token, password, merchant id, or service-role value in git, a pull request, chat, an issue, or this file. `SUPABASE_ACCESS_TOKEN` stays a chat note until a real `sbp_` token replaces it on its own checklist. This page does not paste that token.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).
- Gated Phase 5 command-centre panels stay paused.
- Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) until a Success from a previous visit is already logged. This page does not claim they are applied.
- Leave **Load sandbox seed**, **Dry run**, **Dry-load CSV**, and **Record install intent** untapped. Those visits are [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md), [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md), [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md), and [`docs/phone-pwa-install.md`](phone-pwa-install.md).
- Do not open the migration runner to tap **Record sandbox dry-run**. That visit is [`docs/phone-migration-runner.md`](phone-migration-runner.md). Leave `MIGRATION_RUNNER_ENABLED` unset. A yes for this wizard verify is not that yes. The runner does not execute migration SQL.

## Pass means

Signed out, https://ai-autotech-crm.vercel.app/command-centre/setup answered 307 and the phone landed on `/login` with `next` set to `/command-centre/setup`. You did not see the wizard while signed out. If you signed in to read the page, the heading was **Setup / go-live wizard** on slug `ai-autotech`, the amber fixture line was on screen, and the form said recording stays off while `SETUP_WIZARD_ENABLED` is unset and `write: false`. **Record sandbox checklist event** stayed untapped, or a tap while that amber line was showing wrote nothing. You did not claim a checklist event was stored. Steps 20 through 31 still read pending. The owner line named `billyfaber06@gmail.com` and no other address. No merchant id was shown. No charge was made. Nothing was sent. No DNS record was edited. No other Phase 5 flag was set. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset or `false`. `SETUP_WIZARD_ENABLED` stayed unset.

A pass does not mean a checklist event was stored, step 32 was applied by this page, the flag was turned on, sending was turned on, or go-live was unblocked.
