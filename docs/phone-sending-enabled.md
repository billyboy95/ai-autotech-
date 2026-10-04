# Phone checklist: enable sending for one named workspace

This is the later gate for real outbound. Open it only after Billy says yes to sending for one named workspace. A yes for keys, `CRON_SECRET`, PayFast sandbox, a pack, a website publish, or SQL is not that yes. Opening this page is not that yes.

Writing this page does not tick **Sending enabled**, does not set `AUTOMATION_SEND_ENABLED`, does not redeploy, does not send, and does not register a cron. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied until a Success from a previous visit is already written down. This page does not invent that Success. `sending_enabled` stays false on every workspace until the yes on this call. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`, until that same yes. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The production CRM is https://ai-autotech-crm.vercel.app . The Vercel project is `ai-autotech-crm`. The Supabase project ref is `fnysxlswzufdnlbhndxc`.

Two switches have to be on before a provider is called. Both stay off until he names one workspace and says yes to sending for that workspace only.

| Switch | Where it lives | Default |
| --- | --- | --- |
| `sending_enabled` | One workspace row. The checkbox **Sending enabled** on `/agency/<slug>/settings`. Only an agency owner can tick it. | false |
| `AUTOMATION_SEND_ENABLED` | Vercel Production on project `ai-autotech-crm`. The app treats the string `true` as on. Any other value, or a missing name, stays off. | unset |

`deliverMessage` in `src/lib/automation/send.ts` returns without calling Resend, SMTP, WhatsApp, SMS, or a social API while `AUTOMATION_SEND_ENABLED` is not the string `true`. The workspace checkbox is the per-workspace switch. The POPIA check in `src/lib/compliance/send-gate.ts` still blocks a workspace whose `sending_enabled` is false. Opt-in gating and STOP handling stay on after both switches are on.

The command-centre header badge **Sending is off** / **Sending is on** reads `AUTOMATION_SEND_ENABLED`, not the checkbox. A ticked checkbox with the badge still saying **Sending is off** means the env name is not on the running deployment yet.

## A yes for something else is not a yes to send

Say this out loud before any tap. If he has not said yes to sending for one named workspace on this call, stop. Leave both switches as they are.

These are not that yes:

- A yes to save `CRON_SECRET` ([`docs/phone-cron-secret.md`](phone-cron-secret.md)).
- A yes to save an email, WhatsApp, Meta, SMS, or LinkedIn name.
- A yes to PayFast sandbox, or to a live charge.
- A yes to **Apply Education pack to EASTC** or **Apply Zentrix pack to Zentrix Online**.
- A yes to publish [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).
- A yes to paste SQL, or a Success line from that paste.
- A yes to DKIM or DMARC.

## Stop until these are true

Names only. Do not read a secret value into chat, a note, or this file.

1. Schema Success is already logged from a previous visit. Either the CLI printed `Success. Steps 20–36 applied.` after `SUPABASE_ACCESS_TOKEN` was a real `sbp_` token ([`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md)), or the SQL editor showed `Success. No rows returned` for every file from 20 through 36, including step 36 ([`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md)). A token that starts with `sbp_` without that Success line is not enough. If neither Success is already written down, stop. This page does not apply SQL and does not invent Success. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) still lists steps 20 through 36 as unapplied until that logged Success exists. This page does not edit that header.
2. The name `CRON_SECRET` is already on Vercel Production for `ai-autotech-crm`. The generate-and-save page is [`docs/phone-cron-secret.md`](phone-cron-secret.md). If the name is missing, stop and do that page. Do not generate a secret here. Do not open the value.
3. At least one outbound path is already prepared. One is enough. If none of these names are saved, stop. This page does not create a key.
   - Email, Resend: [`docs/phone-resend-willem.md`](phone-resend-willem.md). From stays `Willem@aiautotech.co.za`.
   - Email, Google Workspace SMTP: [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). Same From.
   - WhatsApp and Meta Page: [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md).
   - SMS, one provider he already has: [`docs/phone-sms-provider-keys.md`](phone-sms-provider-keys.md).
   - LinkedIn, the account and Company Page he already uses: [`docs/phone-linkedin-keys.md`](phone-linkedin-keys.md).
4. DKIM and DMARC are optional on this visit. A missing TXT does not block this page, and publishing them is not a yes to send. The phone page is [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md). The 3 Oct 2026 lookup found no TXT at `google._domainkey` and no TXT at `_dmarc`. Leave DNS alone unless he already said yes on that page.
5. `sending_enabled` is false on every workspace you can open. The checkbox **Sending enabled** is unticked.
6. `AUTOMATION_SEND_ENABLED` is missing, or its value is the string `false`. It is not the string `true`.
7. He has named one workspace slug on this call, and he has said yes to sending for that slug only. The slugs already in the app are `ai-autotech`, `eastc`, and `zentrix`. Do not invent a slug. Do not enable a second workspace on this call.

If any check is false, stop.

## 1. Confirm both switches are still off

On the phone, sign in at https://ai-autotech-crm.vercel.app/login as the agency owner `billyfaber06@gmail.com`. Land on `/agency`.

Open each settings page and read the checkbox. Do not tick it yet.

- https://ai-autotech-crm.vercel.app/agency/ai-autotech/settings
- https://ai-autotech-crm.vercel.app/agency/eastc/settings
- https://ai-autotech-crm.vercel.app/agency/zentrix/settings

The heading is the workspace name plus `settings`. Under **Branding**, the checkbox label is **Sending enabled**. The line under it says sending is off by default and only an agency owner can turn it on. The checkbox is disabled for anyone who is not an agency owner. If it is greyed out, stop. Do not update `organizations.sending_enabled` in the SQL editor.

If any checkbox is already ticked, stop. Do not untick it and do not tick another one. This page does not change a switch that is already on.

Then open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row.

Read the name `AUTOMATION_SEND_ENABLED`. Leave the value closed when the row is Sensitive.

- Missing, or the value is the string `false`: leave it. That is still off.
- The value is the string `true`: stop. Do not edit it on this visit.
- Any other value: stop. Do not overwrite it until he says yes to replace that row with the string `true`.

Do not add the name in this section.

## 2. Outbox must be empty before the env name goes on

`vercel.json` already calls `/api/cron/automation` on `0 4 * * *`. This page does not add that job and does not call it. Once a Ready Production deployment has `AUTOMATION_SEND_ENABLED` as the string `true`, that existing job can deliver due outbox rows whose status is queued or approved, and it can publish due social posts. `flushOutbox` and `publishDuePosts` use that env name.

Before you set the name:

1. Open https://ai-autotech-crm.vercel.app/command-centre?org=<slug> for the slug he named. That visit stores the workspace cookie.
2. Open https://ai-autotech-crm.vercel.app/command-centre/outbox . The header should name that same workspace. If it names another one, open the `?org=` link again, then open the outbox again.
3. Read the first line. It shows a queued count. Read the social queue under **Social queue**.

Stop when the queued count is not 0, when any message is queued or approved, or when any social post is queued or approved. Do not tap **Approve draft**, **Approve**, **Open wa.me**, **Open email draft**, **Open SMS draft**, or **Copy & post**. Do not tap **Run automations** on Home. That button runs the same job. Do not send a row to empty the list.

An empty outbox (`No messages yet` and `No social posts queued`) is the only pass for this section.

## 3. Tick Sending enabled for the named workspace only

Go back to https://ai-autotech-crm.vercel.app/agency/<slug>/settings for the one slug he named.

1. Tick **Sending enabled**. Leave every other workspace unticked.
2. Do not change branding, channel placeholders, or Shopify fields on this visit. Do not paste a token into those fields.
3. Do not tap **Apply Education pack to EASTC** or **Apply Zentrix pack to Zentrix Online** if those headings are on the page. A pack yes is not this yes. Packs stay on [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md).
4. Tap **Save settings**.

Pass: the green line `Workspace settings saved.` Reload the same page. The checkbox is still ticked. Open the other two settings URLs. Their checkboxes are still unticked.

Stop when save fails, the checkbox is disabled, or a second workspace would be ticked. Do not retry by editing SQL.

Saving the checkbox does not set `AUTOMATION_SEND_ENABLED`. While that name is still unset or `false`, `deliverMessage` still does not call a provider.

## 4. Set `AUTOMATION_SEND_ENABLED` on Production

Do this only after section 3 passed for the one named slug, and only after he has said yes to the name `AUTOMATION_SEND_ENABLED` on this call. A yes to the checkbox is not a yes to this name until he says the name.

On Vercel → `ai-autotech-crm` → Settings → Environment Variables:

1. Add the name `AUTOMATION_SEND_ENABLED` when it is missing. When the row exists and the value is `false`, replace that value only after he says yes to replace it.
2. The value is the four letters `true`. Not `yes`, not `1`, not `on`.
3. Save it for Production. Mark it Sensitive if the UI allows.
4. Leave Preview off unless he says Preview too on this call. Leave Development off.
5. Do not add or edit any other name. Do not open `CRON_SECRET` or a channel key.

A saved variable is read on the next deployment. This page does not redeploy unless he says yes to a Production redeploy on this call. Without that redeploy, the running app still has the old value, the header badge stays **Sending is off**, and nothing is delivered. That is a valid stop. The checkbox can be on for the named workspace while the running app still does not send.

When he says yes to the redeploy:

1. Open Vercel → `ai-autotech-crm` → Deployments.
2. Open the latest Production deployment. Choose Redeploy. Leave the environment on Production. Do not edit variables on that screen.
3. Wait until the new deployment shows Ready.

Do not open Cron Jobs. Do not paste `cron.schedule`. The schedule paste stays on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This page does not run it.

## 5. Verify without sending

Do not tap **Send**, **Send now**, **Send test**, **Go live**, **Publish**, **Post now**, **Run automations**, or **Approve draft**.

When you did not redeploy, stop after the UI checks:

- The named workspace settings page still shows **Sending enabled** ticked after a reload.
- The other workspaces are still unticked.
- The Vercel list shows the name `AUTOMATION_SEND_ENABLED` on Production. Do not open the value when it is Sensitive. You typed `true`.
- The command-centre header still says **Sending is off**, because the running deployment has not read the new name.

That is the confirmation. Nothing was sent. Do not call a cron route to “see if it works”.

When the redeploy is Ready, one dry check is allowed. It does not send. `planCampaignAction` in `src/lib/campaigns/dry-run.ts` returns a report for **Dry run** and refuses **Send now** and **Go live**. It does not build an outbox row. The panel keeps the queued count at 0.

1. Open https://ai-autotech-crm.vercel.app/command-centre?org=<slug> for the same slug, so the next page uses that workspace.
2. Open https://ai-autotech-crm.vercel.app/command-centre/campaigns . Confirm the header names that workspace. If it names another one, open the `?org=` link again, then open campaigns again.
3. Tap **Dry run** only.
4. Pass: the status line contains `Nothing was queued` and `Outbox queued: 0`. Fixture-only text (`Fixture only. This report is not stored.`) is still a pass. `CAMPAIGN_DRY_RUN_ENABLED` stays unset. Step 26 stays unapplied until the logged Success in the prerequisites. This tap does not apply it.
5. Open https://ai-autotech-crm.vercel.app/command-centre/outbox and read the queued count. Leave every button on that page untapped.

Stop when the campaigns page errors, the status line does not say nothing was queued, or the outbox queued count is not 0. Do not tap another button. Do not invent a second test. The settings checkbox and the Vercel name are enough. There is no other safe check on this page.

## POPIA and STOP stay on

Ticking the checkbox does not turn consent off. Marketing still needs an opt-in, or an existing customer who has not opted out. A suppression or an opt-out blocks every purpose. STOP stays honoured. The dry-run breakdown still counts STOP. Every outbound message still carries the sender name and an opt-out (reply STOP, or the unsubscribe link on email). Do not clear a consent row. Do not turn `require_human_before_send` off. This page does not edit those settings.

## Refuse

- A real send, a test blast, a campaign send, or a social post.
- **Send now**, **Go live**, **Publish**, **Post now**, **Run automations**, **Approve draft**, **Open wa.me**, **Open email draft**, **Open SMS draft**.
- Webhook registration, including a Meta callback URL.
- Buying SMS credit, a phone number, a card charge, or any ad spend.
- Merging [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Applying SQL. Pasting `owner-bootstrap.sql`. Clicking a pack. Enabling a gated Phase 5 panel. Setting a Phase 5 flag.
- Registering a cron, or calling `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, or `/api/cron/ai-replies`.
- Pasting a secret into git, a pull request, chat, an issue, or this file. The word `true` is the only value this page tells you to type, and it is typed in the Vercel field only.

## Stop rules

- One workspace slug on this call. The other checkboxes stay unticked.
- Agency owner only. A greyed-out checkbox means stop. No SQL update of `sending_enabled`.
- `AUTOMATION_SEND_ENABLED` is the string `true` on Production only, unless he named Preview. Development stays off. Sensitive if the UI allows.
- No redeploy unless he says yes to that redeploy on this call.
- No send. The dry-run tap is the only button on the campaigns page. Skip it when you did not redeploy.
- Opt-in gating stays on. STOP handling stays on.
- DKIM and DMARC stay optional. This page does not edit DNS.
- No SQL. Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) until a Success from a previous visit is already logged. This page does not claim they are applied.
- No cron registration. No webhook. No spend. No pack click. No website merge.
- Gated Phase 5 command-centre panels stay paused.

## Pass means

He named one slug (`ai-autotech`, `eastc`, or `zentrix`) and said yes to sending for that workspace. The checkbox **Sending enabled** is ticked on that settings page after reload, and it is unticked on the others. Vercel Production on `ai-autotech-crm` shows the name `AUTOMATION_SEND_ENABLED`. You typed the string `true`. Preview was added only if he said Preview too. You either stopped before a redeploy, with the header still saying **Sending is off**, or the redeploy is Ready and **Dry run** reported that nothing was queued. The outbox was empty before the env name was saved, and it was not used to send. Nothing was posted. No cron was registered. No secret was copied into git, a pull request, chat, or this file.

A pass does not mean a message was delivered, a campaign was published, steps 20 through 36 were applied by this page, a pack was clicked, or the website pull requests were merged.
