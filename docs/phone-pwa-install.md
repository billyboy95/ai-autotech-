# Phone checklist: PWA install shell (optional, no send)

Billy runs this on a phone in South Africa (Safari or Chrome). It is the tap path for the optional PWA install shell after step 31 (`phase5j_pwa_mobile_shell`). The desktop notes stay in [`docs/phase-5j-pwa-mobile-shell.md`](phase-5j-pwa-mobile-shell.md). The later wrap notes stay in [`mobile/README.md`](../mobile/README.md). PWA install is optional and is not a go-live blocker ([`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md), step 31).

Writing this page does not apply SQL, does not set a flag, does not send, and does not spend. Steps 20 through 36 stay unapplied until a Success from a previous visit is already written down. This page does not invent that Success. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This page does not paste a token. Gated Phase 5 command-centre panels stay paused until that SQL and Billy’s yes to the matching flag.

The production CRM is https://ai-autotech-crm.vercel.app . The manifest is already live at https://ai-autotech-crm.vercel.app/manifest.webmanifest . The workspace for a signed-in look is slug `ai-autotech`.

Until `PWA_INSTALL_SHELL_ENABLED` is the string `true` on the running deployment, and only after step 31 has shown Success and Billy has said yes to that flag, this visit is verify-only. Open the manifest and read the Add to Home Screen notes. Do not claim the install shell UI is live.

## Preconditions

All of these stay true on this visit. If one is false, stop.

1. Steps 20 through 36 are still unapplied. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) and [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) still say so. A phone verify of the live manifest is allowed before that Success. This page does not paste SQL and does not claim Success.
2. Step 31 is `supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql` (`phase5j_pwa_mobile_shell`). A stored `install_intent` waits until that file has shown Success (`Success. No rows returned` in the SQL editor, or `Success. Steps 20–36 applied.` from the CLI). Until that Success is already logged, the install page stays fixture-only and writes nothing.
3. Leave `PWA_INSTALL_SHELL_ENABLED` unset until step 31 has succeeded and Billy says yes to that flag on a later call. Unset, blank, or any value other than the string `true` keeps the page fixture-only. Fixture mode is the phone verify on this visit. Setting the flag does not apply SQL, does not send, and does not spend.
4. A yes for Dry run, the East Rand seed, a channel key, `CRON_SECRET`, the Education pack, the Zentrix pack, a website publish, or SQL is not a yes for `PWA_INSTALL_SHELL_ENABLED` and is not a yes to send. The East Rand tap is [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md). Dry run is [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md).
5. `sending_enabled` stays false on every workspace. The checkbox **Sending enabled** stays unticked.
6. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A yes to this install verify is not a yes to either switch. The only later yes is one named workspace on [`docs/phone-sending-enabled.md`](phone-sending-enabled.md).
7. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). See [`docs/website-publish-decision.md`](website-publish-decision.md).

The logged-out production smoke, after SQL Success, is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). This page does not replace that smoke, and that smoke does not replace this tap. The Phase 5 flag order is [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This page does not set a name on that list.

There is no `docs/phone-go-live.md` yet. The go-live phone checklist is later. The desktop notes are [`docs/phase-5o-golive-checklist.md`](phase-5o-golive-checklist.md). This visit does not open `/command-centre/go-live` and does not set `GOLIVE_CHECKLIST_ENABLED`. The PWA row on that page is flag status only. It does not write an install intent.

The next phone companion is the setup / go-live wizard, step 32. The checklist is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md). This visit does not open `/command-centre/setup` to record a checklist event and does not set `SETUP_WIZARD_ENABLED`. A yes for the PWA verify is not that yes. Signed out, `/command-centre/setup` answers 307 and lands on `/login`.

## 1. Open the live manifest

Stay logged out for this step. The manifest is public. It does not need the flag.

1. Open https://ai-autotech-crm.vercel.app in Safari or Chrome.
2. Open https://ai-autotech-crm.vercel.app/manifest.webmanifest in the same browser.
3. Read the JSON. Pass when these fields match:

| Field | Pass value |
| --- | --- |
| `name` | `AI AutoTech / AIOS` |
| `short_name` | `AIOS` |
| `start_url` | `/command-centre` |
| `display` | `standalone` |
| `theme_color` | `#0B1F3A` |
| `prefer_related_applications` | `false` |

The description says the command centre installs from the phone browser and that no store listing is live. `related_applications` is absent. The icon list names `/icons/aios-192.png`, `/icons/aios-512.png`, `/icons/aios-maskable-512.png`, and `/icons/aios.svg`. You do not have to download the icons for the pass.

A matching manifest is the verify-only pass. It does not mean `PWA_INSTALL_SHELL_ENABLED` is set. It does not mean step 31 is applied. It does not mean the install shell UI is live.

Stop when the manifest is missing, the name is something else, `start_url` is not `/command-centre`, or `prefer_related_applications` is true.

## 2. Add to Home Screen notes

These are the phone browser’s own menu. They are notes on this visit. They are not a button inside the CRM, and they do not set the flag.

Read the note that matches the phone. You do not have to finish the add for the pass.

- iOS Safari: open https://ai-autotech-crm.vercel.app in Safari, tap Share, then **Add to Home Screen**.
- Android Chrome: open the same origin in Chrome, open the menu, then **Install app** or **Add to Home screen**.

The Windows card on the install page is a note for Edge or Chrome on a computer (the browser install icon or the Apps menu). This visit is the phone. Leave that card unread as a task.

If the home-screen icon is added, the start URL is still `/command-centre`. That path asks for a sign-in on production. The icon does not prove the flag is on, does not write `install_events`, and does not buy a store listing. Google Play, the Apple App Store, and the Microsoft Store have no listing. Do not create a paid developer account.

## 3. Install page, fixture versus flag-on

The install shell is `/command-centre/install`. On this visit, with the flag unset, do not claim that shell is live. Signed out, production answers 307 and the phone lands on `/login`. `next` is `/command-centre/install` (and includes `org=ai-autotech` when you used that link). Landing on login is a pass for the gate. It is not the shell storing an intent.

A signed-in look is allowed so you can read the fixture banner. It is still verify-only.

1. Open https://ai-autotech-crm.vercel.app/command-centre/install?org=ai-autotech
2. Sign in as the agency owner when the phone is on `/login`. The documented address is `billyfaber06@gmail.com` when that Auth user exists ([`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md), Phone-first unblock, step 4).
3. After sign-in, open the same install URL again if the app landed on `/agency`.
4. Pass for the look: the eyebrow is **Browser install**. The heading is **Install AIOS on your phone**. The slug is `ai-autotech`. If the header names EASTC or Zentrix, open the `?org=ai-autotech` link again.

The page says no store listing is live, names the three browser steps (iOS Safari, Android Chrome, Windows), and says `sending_enabled` stays false. The same page says it does not call a store, an ad network, or an analytics vendor.

Read the banner under the steps.

- Amber: `Fixture only. This page does not write an install event until PWA_INSTALL_SHELL_ENABLED is true and step 31 is applied.` That line is the pass for this visit. The form says `Recording stays off while the flag is unset.` Leave **Record install intent** untapped.
- Slate: `PWA_INSTALL_SHELL_ENABLED is the string true. A sandbox install intent can be stored after step 31 is applied. Nothing is sent.` That line means step 31 has succeeded and the flag is the string `true` on the running deployment, after Billy’s yes to that flag. This visit does not create that line. If the slate line is on screen before that Success is already written down, stop.

Settings has the same notes under **Install AIOS on your phone**, marked **Optional**, with **Open install steps**. Open https://ai-autotech-crm.vercel.app/command-centre/settings?org=ai-autotech only to read that card. Leave every other control on settings untapped.

Ops readiness on `/agency` and `/command-centre` lists PWA install as **Optional**. That row is not a go-live blocker. This visit does not open a gated panel to change a flag.

## 4. Record install intent, only when the slate line was already honest

On the verify-only visit, skip this section. Leave **Record install intent** untapped.

If the amber banner is on screen and the button is tapped anyway, the status stays the fixture sentence and nothing is written. That tap is not required for the pass. Do not tap it a second time.

When the slate line was already honest (step 31 Success already logged, and Billy already said yes to `PWA_INSTALL_SHELL_ENABLED`), one tap can store a sandbox row:

1. Under **This phone**, leave the select on the phone you are holding. The choices are **iOS Safari**, **Android Chrome**, and **Windows**. The default is Android Chrome.
2. Tap **Record install intent** once.
3. Pass: `Sandbox install intent stored. Nothing is sent. No store was contacted.`

`intent` stays `install_intent`. `surface` stays `browser`. `sandbox` stays true. `charged` stays false. `sending_enabled` stays false. The row is not a store install and it is not a charge. This page does not turn the flag on to reach that line.

Stop on any other status. These lines mean stop:

- `Apply step 31 before an install intent is stored. Nothing was written.` The flag is on and the schema is missing step 31. Leave `PWA_INSTALL_SHELL_ENABLED` unset until step 31 has succeeded. Do not paste SQL on this visit.
- `The install intent was not stored. Nothing was written.`
- `The install intent was refused. Nothing was written.`
- `Choose iOS, Android, or Windows. Nothing was written.`
- `Nothing was written.` when you expected the slate store line. The flag is not the string `true` for this signed-in workspace, or the header is another workspace. Re-open `?org=ai-autotech`. Do not set the flag on this visit.

## Stop rules

- No spend. No purchase. No paid developer account. No store listing. No ad.
- No real send. Leave **Send now**, **Go live**, **Send test**, **Publish**, and **Post now** untapped. This page has none of those buttons. Do not go looking for them.
- No DNS edit. Stay on https://ai-autotech-crm.vercel.app . The hostname checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md). This visit does not open GoDaddy and does not change a record.
- No other Phase 5 flag on this visit. Leave `HOME_CHAT_ENABLED`, `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, `CAMPAIGN_CSV_IMPORT_ENABLED`, `EMAIL_SMS_CONNECT_STUB_ENABLED`, `SOCIAL_DRAFTS_ENABLED`, `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`, `ZENTRIX_WORKSPACE_PACK_ENABLED`, `EAST_RAND_CAMPAIGN_SEED_ENABLED`, `SETUP_WIZARD_ENABLED`, `MIGRATION_RUNNER_ENABLED`, `OWNER_BOOTSTRAP_UI_ENABLED`, `OPS_SECRETS_READY_ENABLED`, `GOLIVE_CHECKLIST_ENABLED`, `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset. The order stays on [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). `PWA_INSTALL_SHELL_ENABLED` stays unset on this visit too.
- No cron registration. Leave `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, and `/api/cron/ai-replies` uncalled.
- No webhook.
- No secret, key, token, password, or service-role value in git, a pull request, chat, an issue, or this file.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).
- Gated Phase 5 command-centre panels stay paused.
- Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) until a Success from a previous visit is already logged. This page does not claim they are applied.
- Leave **Load sandbox seed**, **Dry run**, and **Dry-load CSV** untapped. Those visits are [`docs/phone-east-rand-seed.md`](phone-east-rand-seed.md), [`docs/phone-campaign-dry-run.md`](phone-campaign-dry-run.md), and [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md).
- Do not open the setup wizard to tap **Record sandbox checklist event**. That visit is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md). Leave `SETUP_WIZARD_ENABLED` unset. A yes for this install verify is not that yes.

## Pass means

You opened https://ai-autotech-crm.vercel.app/manifest.webmanifest on the phone. The name was AI AutoTech / AIOS, the short name was AIOS, the start URL was `/command-centre`, display was standalone, and `prefer_related_applications` was false. You read the Safari or Chrome Add to Home Screen note and left the flag unset. You did not claim the install shell UI is live. If you opened `/command-centre/install` while signed in, the amber fixture line was on screen and **Record install intent** stayed untapped, or a tap while that amber line was showing wrote nothing. No store was contacted. Nothing was spent. Nothing was sent. No DNS record was edited. No other Phase 5 flag was set. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset or `false`. `PWA_INSTALL_SHELL_ENABLED` stayed unset.

A pass does not mean an install intent was stored, step 31 was applied by this page, the flag was turned on, a home-screen icon was required, or go-live was unblocked. PWA install stays optional.
