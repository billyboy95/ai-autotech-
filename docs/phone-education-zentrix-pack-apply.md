# Phone checklist: Education pack, then Zentrix pack

Billy runs the schema reload, then the Education pack, then the Zentrix pack. This page is Phone-first unblock, step 8 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). It starts only after every paste for steps 20 through 36 has shown Success on [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md).

Writing this page does not run SQL, does not click a pack, and does not invent Success. Steps 20 through 36 stay unapplied until Billy has seen Success for every file from 20 through 36. Do not claim they are already applied. Do not claim either pack is already applied. Do not write `Success. No rows returned` or a green apply line unless the screen showed that line on this visit.

`SUPABASE_ACCESS_TOKEN` on the ops box may still be a chat note. A Personal Access Token starts with `sbp_`. This checklist does not replace that token and does not print one. The SQL editor reload does not need it. Do not run `scripts/apply-pending-migrations.mjs --apply` while the value is still a chat note.

`sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. No real send. No ad spend. No live PayFast charge. Gated Phase 5 command-centre panels stay paused. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The project ref is `fnysxlswzufdnlbhndxc`. The CRM project on Vercel is `ai-autotech-crm`. The CRM host on this visit is https://ai-autotech-crm.vercel.app . Leave `crm.aiautotech.co.za` on [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md). This page does not edit DNS.

Business email From stays `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m). `billyfaber06@gmail.com` is the agency owner login. It is never the From. This page does not send.

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `Willem@aiautotech.co.za` | The only From for AI AutoTech business email. Not used on this page. Do not send. |
| `billyfaber06@gmail.com` | Agency owner login. `OWNER_EMAILS` on step 4. Never a From. |
| `billy@aiautotech.co.za` | Old example. Do not use it. |

## Stop until these are true

This page starts only after every paste for steps 20 through 36 shows Success. If any check below is false, stop. Do not open a pack button.

1. You finished [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md). Every file from 20 through 36 showed `Success. No rows returned`, or the editor’s equivalent Success with no error, on that visit. A result grid is not required. Writing that page is not that Success. This page does not paste those files again.
2. The other path, only when `SUPABASE_ACCESS_TOKEN` already starts with `sbp_` and Billy already said yes to `--apply`, is the line `Success. Steps 20–36 applied.` from `scripts/apply-pending-migrations.mjs --apply`. If that line was not printed, the SQL editor path in check 1 is the one that has to be true. Do not invent either line.
3. Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). You will not paste them again.
4. You will run the schema reload in section 1 before any pack click. If that reload errors, you will stop. You will not click a pack.
5. You will click the Education pack before the Zentrix pack, and only when Billy says yes to that pack. A yes for the schema reload is not a yes for a pack. A yes for Education is not a yes for Zentrix.
6. You will not enable a gated Phase 5 command-centre panel. You will not spend, send, merge the website pull requests, edit DNS, or save a Vercel secret. `sending_enabled` stays false.

If any check is false, stop.

## 1. Schema reload

Do this in the Supabase SQL editor for project `fnysxlswzufdnlbhndxc` only. Phone steps:

1. Open https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new
2. If the session has expired, sign in again, then open that same address.
3. Read the address bar. The project ref in it is `fnysxlswzufdnlbhndxc`.
4. Open a new empty query. Do not leave a migration file in the editor.
5. Paste this one statement:

```sql
NOTIFY pgrst, 'reload schema';
```

6. Run that statement once.
7. Read the result. Pass is `Success. No rows returned`, or the editor’s equivalent Success with no error. A result grid is not required.

Stop, and close the tab, when the project ref is any other project.

On an error, stop. Do not click a pack. Do not paste steps 20 through 36 again from this page. Do not invent `Success. No rows returned`.

That statement refreshes the PostgREST schema cache. It does not apply another migration, does not send, and does not change `sending_enabled`. It does not apply the Education pack or the Zentrix pack.

After that Success, and before you sign in for a pack, the logged-out production smoke is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). Run it in a private tab, still logged out, when it has not been done. This page does not run that smoke. The Phase 5 flag order is [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This page does not set those flags and does not open a gated panel.

## 2. Education pack for EASTC

Only when Billy says yes to this pack. Only after section 1 showed Success. There is no env flag that applies this pack. Step 21 adds `apply_education_pack_to_eastc()` and does not apply the pack by itself. Writing this page does not click the button. The pack is not applied.

Agency owners and agency staff can use the button. A `client_admin` cannot. If Billy has not said yes, leave this button unclicked and leave the Zentrix button unclicked.

On the phone, the CRM host is https://ai-autotech-crm.vercel.app :

1. Open https://ai-autotech-crm.vercel.app/login?next=/agency and sign in as the agency owner. The documented address is `billyfaber06@gmail.com` when that Auth user exists (step 4). You should land on `/agency`.
2. If the screen says “Sign in to see client workspaces”, stop. Sign in. Do not tap Apply on a signed-out page.
3. If the amber line “Local preview of the agency layout” is on screen, stop. That preview does not store the pack.
4. Stay on https://ai-autotech-crm.vercel.app/agency and scroll to the heading **Education pack**. Or open https://ai-autotech-crm.vercel.app/agency/eastc/settings and scroll to the same heading. Both pages show **Apply Education pack to EASTC**. https://ai-autotech-crm.vercel.app/agency/zentrix/settings does not show this pack.
5. Do not open Setup wizard, Migration runner, Owner bootstrap, Ops secrets, Go-live checklist, Lead Agent, or Connect accounts from the agency header. Those panels stay paused.
6. Do not tick **Sending enabled** on the EASTC settings form.
7. Tap **Apply Education pack to EASTC**.
8. Read the confirm line: “Confirm this applies the Education pack to EASTC only. Nothing is sent and sending stays off.”
9. Tap **Confirm apply to EASTC**. While it runs, the label is **Applying…**. **Cancel** leaves the pack unclicked.

Success is a green line under the button. There is no separate toast. The line reads: `Education pack applied to EASTC. N new, M unchanged. Nothing was sent, and sending stays off.` `N` and `M` are counts the screen shows. A later click can show `0 new` and the rest unchanged. That is the same pack on the same EASTC workspace, slug `eastc`. It is not a second organisation.

Rose text is a failure. Stop. Do not tap again until Billy reads the line. A missing step 21, a signed-out session, or a `client_admin` session stops here. Do not invent the green line.

What the green line means, when the screen showed it:

- The same workspace, slug `eastc`. No second organisation.
- Admissions is the only default pipeline. The existing Enrolment pipeline stays.
- Contacts, messages, secrets, and outbox rows are not copied.
- `sending_enabled` stays false.

This page does not click the button. Until that green line is on the screen, the Education pack is not applied.

## 3. Zentrix pack after Education

This click comes after the Education green line. Only when Billy says yes to this pack. Only after step 29 has succeeded, which is inside the steps 20 through 36 Success that opened this page. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset until he says yes to that name. The store notes are [`docs/zentrix-workspace-pack.md`](zentrix-workspace-pack.md).

Pets and Kitchens are priority. Auto is QA / reference and is not an ad target. No ad spend. `sending_enabled` stays false. The pack does not call Shopify. Writing this page does not click the button. The pack is not applied.

| Store | Mark | Handle |
| --- | --- | --- |
| Pets | Priority | `w1y2f0-rk` |
| Kitchens | Priority | `desj1r-ic` |
| Auto | QA / reference | `80ce1e-p8` |

`pets.zentrixonline.co.za` and `kitchens.zentrixonline.co.za` are notes for later. Live DNS is not required. This page does not add a DNS record. Auto has no public host in this pack.

On the phone, when he says yes to the flag and then to the click:

1. Open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row. Choose Production.
2. Set the name `ZENTRIX_WORKSPACE_PACK_ENABLED` to the string `true` only after Billy says yes to that name. Add Preview only when he says yes to Preview. A yes for Education is not this yes. A yes for this name is not a yes for DNS, a secret, a channel key, `CRON_SECRET`, or a PayFast name.
3. Do not save any other Vercel name on this visit. Do not paste a token, a key, a passphrase, or a service-role value into git, a pull request, chat, or this file.
4. A saved variable is read on the next deployment. This page does not ask for a redeploy. If the amber line in step 6 is still on screen, stop. Do not tap Apply.
5. Open https://ai-autotech-crm.vercel.app/agency and scroll to the heading **Zentrix workspace pack**, or open https://ai-autotech-crm.vercel.app/agency/zentrix/settings . Same form on both. https://ai-autotech-crm.vercel.app/agency/eastc/settings does not show this pack.
6. If the amber line is still there — “Fixture only. These stubs are not stored until ZENTRIX_WORKSPACE_PACK_ENABLED is true and step 29 is applied. Nothing is sent.” — stop. The click does not store rows.
7. When the page says “Sandbox pack. Applying stores the three stubs. Nothing is sent.”, the list shows Pets (priority, `w1y2f0-rk`), Kitchens (priority, `desj1r-ic`), and Auto (QA / reference, `80ce1e-p8`).
8. Do not tap **Publish**, **Send**, or **Go live**. Those stay refused. Nothing is posted. No ad is bought.
9. Do not tick **Sending enabled**.
10. Tap **Apply Zentrix pack to Zentrix Online**.
11. Read the confirm line: “Confirm this applies the Zentrix pack to Zentrix Online only. Nothing is sent and sending stays off.”
12. Tap **Confirm apply to Zentrix Online**. While it runs, the label is **Applying…**. **Cancel** leaves the pack unclicked.

Success is a green line under the button. There is no separate toast. The line reads: `Zentrix pack applied to Zentrix Online. Pets and Kitchens are priority. Auto is QA / reference. Nothing was sent, nothing was charged, and sending stays off.`

Rose text is a failure. Stop. Nothing was stored. Do not invent the green line.

What the green line means, when the screen showed it:

- The same Zentrix workspace, slug `zentrix`. No second organisation.
- Three stub rows: Pets and Kitchens priority, Auto QA / reference and not an ad target. A later click updates those three rows. It does not add a fourth.
- No Shopify call runs. No Admin API token is stored.
- `sending_enabled` stays false.

This page does not click the button. Until that green line is on the screen, the Zentrix pack is not applied.

## 4. Refuse

This visit refuses all of the following. A Success line for the schema reload is not a yes for any line here. A green pack line is not a yes for any other line here.

- Enabling a gated Phase 5 command-centre panel. Do not set `HOME_CHAT_ENABLED`, `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, `CAMPAIGN_CSV_IMPORT_ENABLED`, `EMAIL_SMS_CONNECT_STUB_ENABLED`, `SOCIAL_DRAFTS_ENABLED`, `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`, `EAST_RAND_CAMPAIGN_SEED_ENABLED`, `PWA_INSTALL_SHELL_ENABLED`, `SETUP_WIZARD_ENABLED`, `MIGRATION_RUNNER_ENABLED`, `OWNER_BOOTSTRAP_UI_ENABLED`, `OPS_SECRETS_READY_ENABLED`, `GOLIVE_CHECKLIST_ENABLED`, `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, or `COMPUTER_PROVIDER_ENABLED`. Those names stay on [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md).
- Ad spend. No purchases. No store listing. Auto is QA only.
- Turning `sending_enabled` on. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. No real send. Do not tap **Send**, **Send now**, **Publish**, **Post now**, or **Go live**. When he later says yes to real outbound for one named workspace, the gate is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). A green pack line is not that yes.
- Merging [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). They stay open until Billy says yes to publish. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Inventing `Success. No rows returned`, `Success. Steps 20–36 applied.`, or either green pack line.
- Replacing `SUPABASE_ACCESS_TOKEN` here. It may still not start with `sbp_`. That checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md).
- Saving a Vercel secret, a channel key, `CRON_SECRET`, or a PayFast name. Billy’s yes comes before any DNS change and before any Vercel secret save. This page does not edit DNS.
- Pasting a token, a password, a merchant key, a passphrase, a service-role value, or a SQL secret into git, a pull request, chat, an issue, or this file.

## 5. Still blocked

These stay blocked after a pass on this page:

- Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) until every file from 20 through 36 has shown Success. Writing this page is not that Success. Do not change the Already live or Unapplied headers.
- Gated Phase 5 command-centre panels stay paused.
- `sending_enabled` stays false. No real send. No ad spend. No live PayFast charge.
- `SUPABASE_ACCESS_TOKEN` may still not be an `sbp_` token. This page does not paste a token.
- Website pull requests [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open.
- The Education pack stays unapplied until the green EASTC line is on the screen. The Zentrix pack stays unapplied until the green Zentrix line is on the screen. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset until Billy says yes to that name.

## 6. Next checklist

Stop on this page after the schema reload, and after any pack Billy said yes to. Do not open a gated panel from here.

These stay on their own pages. This page does not run them:

- Logged-out smoke, after the schema reload and before a pack click: [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md).
- Phase 5 flags, still paused: [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md).
- East Rand sandbox dry-load: [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md). Do not invent campaign rows. No real sends.
- Website publish: [`docs/website-publish-decision.md`](website-publish-decision.md).

## Stop rules

- This page starts only after every paste for steps 20 through 36 shows Success. Do not invent Success.
- Schema reload first: `NOTIFY pgrst, 'reload schema';` in project `fnysxlswzufdnlbhndxc`. Then Education. Then Zentrix.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Pets and Kitchens are priority. Auto is QA / reference. No ad spend.
- Gated Phase 5 command-centre panels stay paused.
- `SUPABASE_ACCESS_TOKEN` may still not be an `sbp_` token. Do not replace it here.
- Billy’s yes comes before any DNS change and before any Vercel secret save. The only Vercel name this page may set is `ZENTRIX_WORKSPACE_PACK_ENABLED` as the string `true`, and only after he says yes to that name.
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish.
- From stays `Willem@aiautotech.co.za`. Do not send from personal Gmail.
- Do not paste a token, a password, a merchant key, a passphrase, a service-role value, or a SQL secret into git, a pull request, chat, an issue, or this file.

## What still needs Billy’s yes

A yes for one line is not a yes for the others. A Success line in the editor is not a yes for any line here. A green pack line is not a yes for the next line.

- The schema reload, after steps 20 through 36 have shown Success.
- The Education pack, on `/agency` or `/agency/eastc/settings`.
- `ZENTRIX_WORKSPACE_PACK_ENABLED` as the string `true`, then the Zentrix pack on `/agency` or `/agency/zentrix/settings`.
- Any DNS change. Any other Vercel secret save.
- Every Phase 5 flag. `CRON_SECRET` and the channel keys.
- Turning `sending_enabled` on. Live charges. Spend. Send.
- Merge the website pull requests.
- Replace `SUPABASE_ACCESS_TOKEN` with an `sbp_` token. That is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md).

## Pass means

You opened this page only after every file from 20 through 36 had shown Success, or you stopped because that Success was missing. You ran `NOTIFY pgrst, 'reload schema';` in https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new and read the result, or you stopped on an error and did not click a pack. You left both pack buttons unclicked, or you clicked a pack only after Billy said yes to that pack and you read the green line or the rose line that was actually on the screen. `sending_enabled` is still false. Gated Phase 5 command-centre panels are still paused. Nothing was sent. No ad spend. No live charge. No DNS record was saved. No Vercel secret was saved. `SUPABASE_ACCESS_TOKEN` is still not an `sbp_` token unless Billy already replaced it elsewhere. [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) are still open.

A pass does not mean steps 20 through 36 are applied unless those pastes showed Success. A pass does not mean a pack is applied unless that pack’s green line was on the screen. Writing this page is not that Success and is not that green line.
