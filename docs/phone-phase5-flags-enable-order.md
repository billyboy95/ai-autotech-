# Phone checklist: Phase 5 flags after SQL Success

Turn Phase 5 feature flags on in Vercel Production only after Billy has seen SQL Success for steps 20 through 36 and `NOTIFY pgrst, 'reload schema';` has shown Success. Writing this page does not apply SQL, does not set a flag, and does not load a campaign. Steps 20 through 36 stay unapplied until Billy has seen that Success. Do not claim the SQL is applied. Do not claim a flag is already live.

The East Rand list stays a sandbox draft. After the flags below, the click path is [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md). Education and Zentrix pack clicks stay in [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md) (Phone-first unblock, step 8 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md)). This page does not click either pack. Website publish for aiautotech #4 and #5 is [`docs/website-publish-decision.md`](website-publish-decision.md). Do not merge those pull requests from this agent.

## Stop until these are true

1. SQL Success. One of these is true. This page does not make either true.
   - SQL editor: every file from step 20 through step 36 has shown `Success. No rows returned`, or the editor’s equivalent success with no error. That paste is Phone-first unblock, step 7.
   - CLI, once the token starts with `sbp_`: the apply prints `Success. Steps 20–36 applied.` That command is Phone-first unblock, step 2.
2. Schema reload. After step 36, this has shown success in the same SQL editor:

```sql
NOTIFY pgrst, 'reload schema';
```

That line is Phone-first unblock, step 8, item 2. It refreshes the PostgREST schema cache. It does not apply another migration and it does not send. If it errors, stop. Do not set a flag.

3. Owner can log in. Open `/login` and sign in. A valid agency-owner session lands on `/agency`. The documented address is `billyfaber06@gmail.com` when that Auth user exists (runbook step 4). If sign-in fails, stop. Do not set a flag.
4. `sending_enabled` stays false on every workspace. If any workspace shows sending on, stop. This page does not turn it on.

If any check is false, stop.

## How to set a name

On the phone, after the checks above:

1. Open Vercel → the CRM project → Settings → Environment Variables. Same screen as runbook step 3.
2. Add one name at a time. Save it for Production. Add Preview only when Billy says yes to Preview.
3. The value is the string `true`. Unset, blank, or any other value keeps that page fixture-only.
4. A yes for one name is not a yes for the next name. Skip a name Billy has not approved. Leave it unset.
5. A saved variable is read on the next deployment. This page does not ask for a redeploy, a cron, a purchase, or a send. Setting a flag does not apply SQL and does not send.
6. Do not paste a secret value into git, a pull request, chat, or this file.

## Order

Set these in this order, and only the names Billy says yes to. The order follows the SQL step that introduces each name (`supabase/APPLY-ORDER.md`, Flags left unset, and `docs/GO-LIVE-RUNBOOK.md` section 3). The name the East Rand dry-load needs is `CAMPAIGN_CSV_IMPORT_ENABLED`.

1. `HOME_CHAT_ENABLED` = `true` after step 25. Stores sandbox drafts on the home assistant. Drafts stay drafts. See `docs/home-chat.md`.
2. `CAMPAIGN_DRY_RUN_ENABLED` = `true` after step 26. Stores a sandbox dry-run report. **Send now** and **Go live** stay refused. See `docs/campaign-dry-run.md`.
3. `META_CONNECT_STUB_ENABLED` = `true` after step 26 only when Billy says yes to the stub. This stores a WhatsApp and Facebook / Instagram stub status. It is not a live connect. No OAuth runs and no key is stored. Live Meta and WhatsApp stay on runbook step 5 and need Billy’s keys plus his yes. Leave this unset until that yes.
4. `CAMPAIGN_CSV_IMPORT_ENABLED` = `true` after step 27. This stores the East Rand dry-load as a draft. See `docs/campaign-csv-import.md`.
5. `EMAIL_SMS_CONNECT_STUB_ENABLED` = `true` after step 27 only when Billy says yes to the email and SMS stub. The East Rand dry-load does not need it. Leave it unset on that visit. It is not a live email or SMS connect. Send test stays refused while provider keys are missing.
6. `SOCIAL_DRAFTS_ENABLED` = `true` after step 28. Stores sandbox social drafts. **Publish**, **Post now**, and **Go live** stay refused. See `docs/social-drafts.md`.
7. `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED` = `true` after step 28 only when Billy says yes to that stub. It is not a send key. TikTok has no provider env name in this repo.
8. `ZENTRIX_WORKSPACE_PACK_ENABLED` = `true` after step 29, and only when Billy says yes to the Zentrix pack. Until then leave it unset. The pack click is the runbook step below. See `docs/zentrix-workspace-pack.md`.
9. `EAST_RAND_CAMPAIGN_SEED_ENABLED` stays unset for the consent CSV. Step 30 stores the fake in-repo fixture `data/campaigns/east-rand-sandbox.csv`, not the box file. Set this name to `true` only when Billy says yes to that fake seed. See `docs/phase-5i-sandbox-readiness.md`.
10. `PWA_INSTALL_SHELL_ENABLED` = `true` after step 31 only when Billy says yes. Optional. Not a go-live blocker. The phone verify before that yes is [`docs/phone-pwa-install.md`](phone-pwa-install.md). It does not claim the install shell UI is live. A yes for Dry run, the East Rand seed, keys, `CRON_SECRET`, packs, a website publish, or SQL is not that yes. See `docs/phase-5j-pwa-mobile-shell.md`.
11. `SETUP_WIZARD_ENABLED` = `true` after step 32 only when Billy says yes. Stores a sandbox checklist event. No secret is stored. The phone verify before that yes is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md). Signed out, `/command-centre/setup` answers 307 to `/login`. With the flag unset, `write` stays false. Do not claim a checklist event is stored. A yes for Dry run, the East Rand seed, the PWA install verify, keys, `CRON_SECRET`, packs, a website publish, or SQL is not that yes. See `docs/phase-5k-setup-wizard.md`.
12. `MIGRATION_RUNNER_ENABLED` = `true` after step 33. Stores a sandbox dry-run checklist. It does not apply SQL. See `docs/phase-5l-migration-runner.md`.
13. `OWNER_BOOTSTRAP_UI_ENABLED` = `true` after step 34. Stores a sandbox note. It does not create an Auth user and it does not run `supabase/owner-bootstrap.sql`. See `docs/phase-5m-owner-bootstrap.md`.
14. `OPS_SECRETS_READY_ENABLED` = `true` after step 35. Stores presence only. It does not register a cron. Secret values are not stored. See `docs/phase-5n-ops-secrets.md`.
15. `GOLIVE_CHECKLIST_ENABLED` = `true` after step 36. Stores a sandbox note (`pending`, `ready`, `blocked`, or `fixture`). Sending stays blocked. This name is the checklist on `/command-centre/go-live`. It is not the **Go live** button and it is not **Send now**. See `docs/phase-5o-golive-checklist.md`.

Lead Agent. `docs/lead-onboarding.md` names no enable flag for `/command-centre/lead-agent`. Confirm the name on `/command-centre/go-live` or `/command-centre/ops-secrets`. Do not invent one. Leave `E2B_API_KEY`, `BROWSERBASE_API_KEY`, `COMPUTER_PROVIDER_ENABLED`, and `AI_REPLY_CRON_ENABLED` unset.

## Leave these off

- `sending_enabled` stays false on every workspace.
- `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` stay unset.
- `CRON_SECRET` and the outbound channel keys stay on runbook step 5. Leave them unset until Billy says yes. A flag on this page is not that yes. Once `CRON_SECRET` is saved, the schedule paste is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This page does not run that paste.
- PayFast names stay on runbook step 6. Live PayFast stays off.
- There is no env flag that applies the Education pack.

## Hard refuse

- No real sends. No outbound under Billy’s name.
- Do not tap **Go live**. Do not tap **Send now**. Do not tap **Publish** or **Post now**.
- No ad spend. No purchases. No store listing.
- No Meta or WhatsApp live connect without Billy’s keys and his yes. A stub flag is not that connect.
- Do not invent database rows. Do not insert campaign rows by hand or by SQL. Do not tap **Load sandbox seed** on this visit.
- Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

## After the flags

1. East Rand dry-load, draft only. Open [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md). The store needs `CAMPAIGN_CSV_IMPORT_ENABLED` as the string `true` on a deployment whose **Sandbox CSV import** banner is the slate store line. Leave `EAST_RAND_CAMPAIGN_SEED_ENABLED` unset for that load. Nothing is queued. `sending_enabled` stays false.
2. Then the Education pack, then the Zentrix pack. The click order is [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md) (Phone-first unblock, step 8 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md)) and [`docs/zentrix-workspace-pack.md`](zentrix-workspace-pack.md). Education has no env flag. Zentrix stores stubs only once `ZENTRIX_WORKSPACE_PACK_ENABLED` is the string `true` and Billy says yes. This page does not click either pack. Packs are not applied.

This page does not claim steps 20 through 36 are applied, does not claim a flag is live, and does not claim a campaign was loaded.
