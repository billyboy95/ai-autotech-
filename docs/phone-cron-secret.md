# Phone checklist: generate and save `CRON_SECRET`

Billy generates one long random value, stores it in a password manager, and saves the Vercel Production name `CRON_SECRET` on the CRM project `ai-autotech-crm` only after he says yes to that name. This page is Phone-first unblock, step 5 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). It is the generate-and-save checklist. Channel keys stay on the other step 5 pages. There is no separate `docs/phone-cron-channel-keys.md`.

The previous checklist is Owner Auth, [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md) (step 4). A yes for the Auth user, or for `OWNER_EMAILS`, is not a yes for `CRON_SECRET`.

The next page, after this name is saved, is the schedule paste [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This page does not open that paste. This page does not claim `CRON_SECRET` is already set.

Writing this page does not generate a secret, does not write an environment value, does not redeploy, and does not register a cron. It does not apply SQL. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Gated Phase 5 command-centre panels stay paused. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The production CRM is https://ai-autotech-crm.vercel.app . It is auth-gated. This page does not sign in and does not call a cron route. The Vercel project is `ai-autotech-crm`. The Supabase project ref is `fnysxlswzufdnlbhndxc`. This page does not open the SQL editor.

## Name on this page

Document only. No secret value is written in this file.

| Name | What to store, after his explicit yes to this name |
| --- | --- |
| `CRON_SECRET` | One long random value from the password manager. It is not a channel key and it is not a PayFast passphrase. |

The cron routes `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, and `/api/cron/ai-replies` read that name. They compare `Authorization: Bearer` to the whole value. A space or a line break in the saved value makes a later call fail.

Leave these unset on this visit:

| Name | Why it stays unset |
| --- | --- |
| `AUTOMATION_WEBHOOK_SECRET` | `/api/automation/inbound` reads this name and, when it is unset, the same `CRON_SECRET`. This page does not set a second secret and does not call that route. |
| `AI_REPLY_CRON_ENABLED` | A flag. Leave it unset. This page does not turn the ai-reply job on. |
| `WORKFLOW_ENGINE_ENABLED` | A flag. Leave it unset. |
| `AUTOMATION_SEND_ENABLED` | Stays unset, or stays the string `false`. |
| `OPS_SECRETS_READY_ENABLED` | Leave it unset until step 35 is applied. The presence panel is [`docs/phone-ops-secrets.md`](phone-ops-secrets.md). Saving this name is not a yes for that flag. |

A yes for WhatsApp, Meta, SMS, LinkedIn, email, or PayFast is not a yes for `CRON_SECRET`. A yes for one of those names is not a yes to paste this value into that name. Saving `CRON_SECRET` does not send.

The text `generate-a-long-random-string` in `.env.example` is a placeholder. Do not save that placeholder as the secret.

## Stop until these are true

1. You will generate one new long random value, or you will stop because the Production name is already present. You will not type a word, a date, a business name, or an email.
2. You will store that value in a password manager only. You will not paste it into git, a pull request, chat, an issue, a screenshot, or this file.
3. You will leave `CRON_SECRET` unset until Billy says yes to that name. A yes for WhatsApp, Meta, SMS, LinkedIn, email, or PayFast is not that yes. A yes for the Auth user is not that yes.
4. You will save it on Vercel project `ai-autotech-crm`, Production only, unless he says Preview too. You will mark it Sensitive if the UI allows.
5. You will not redeploy. You will not register a cron. You will not turn `sending_enabled` on. You will not call `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, `/api/cron/ai-replies`, or `/api/automation/inbound`.

If any check is false, stop.

## 1. Generate a long random value

On the phone, use the password manager. Choose its random generator. Do not choose a memorable or pronounceable mode. Do not type the value yourself.

When a computer is available, this command prints one line. Copy that line once. Do not write it to a file in the repo. Do not add the line to git, a pull request, chat, an issue, or this file.

```bash
openssl rand -base64 32
```

A similar local generator is fine when it prints one long random string and does not save that string into the repo. Do not invent a sample in this file. Do not reuse a value from chat.

Stop, and do not save it, when any of these are true:

- The value is the placeholder `generate-a-long-random-string`.
- The value is a word, a date, a business name, an email, or a short passphrase.
- The value is copied from another name: `RESEND_API_KEY`, `SMTP_PASS`, `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `META_APP_SECRET`, an SMS secret, `LINKEDIN_ACCESS_TOKEN`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_ACCESS_TOKEN`.
- The generator output is wrapped onto more than one line and you cannot copy it as one line. Stop. Do not stitch it by hand.

Generating the value is not a yes to save it on Vercel.

## 2. Store it in the password manager

1. Create one password-manager entry. The label is the name `CRON_SECRET`. Note the project `ai-autotech-crm` and the environment Production.
2. Paste the generated value once, as one line, with no space before it and no space after it.
3. Close the generator screen. Do not leave the value in a notes app, a chat draft, or a photo.

Vercel hides a Sensitive value after save. The password manager is the only copy. If this copy is lost later, stop. Do not invent a replacement on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md).

Storing the value is not a yes to save it on Vercel, and it is not a yes to register a cron.

## 3. Vercel Production, only after an explicit `CRON_SECRET` yes

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row.

Read the list first.

When a row named `CRON_SECRET` is already on Production, stop. Do not generate a second value. Do not edit that row. Do not replace it. This page does not prove the stored value matches the password manager. When the password manager has no entry for that name, stop. Do not invent a replacement. This page does not claim the existing row was saved by these steps.

When the name is missing, leave it missing until Billy says yes to the name `CRON_SECRET`. A yes for WhatsApp, Meta, SMS, LinkedIn, email, or PayFast is not that yes. A yes for `RESEND_API_KEY`, `SMTP_PASS`, `WHATSAPP_TOKEN`, `META_PAGE_ACCESS_TOKEN`, `LINKEDIN_ACCESS_TOKEN`, `BILLING_SANDBOX`, or `PAYFAST_PASSPHRASE` is not that yes.

When he says yes to `CRON_SECRET`:

1. Add one variable. The name is `CRON_SECRET`. Paste from the password manager at the moment you save. One line. No spaces at either end.
2. Save it for Production. Mark it Sensitive if the UI allows, so the phone does not keep the value on screen after save.
3. Leave Preview off unless he says Preview too on this call. Leave Development off.
4. Do not add any other name on this visit. Do not delete a name.

After save, confirm the list shows the name `CRON_SECRET` on Production. Do not open the value. Do not read it into chat.

Leave the value out of git, pull requests, issues, and docs.

Saving the name does not send. Saving the name does not turn `sending_enabled` on. `sending_enabled` stays false on every workspace. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A saved variable is read on the next deployment. This page does not ask for a redeploy.

## 4. Do not redeploy and do not register a cron

The ops panel lists the job names `automation`, `workflow-engine`, `billing-cycle`, and `ai-reply-drafts`. This page does not register them.

`vercel.json` already has one daily path, `/api/cron/automation`. Do not open Cron Jobs to add a path. Do not edit `vercel.json` from the phone.

Do not enable `pg_cron` or `pg_net`. Do not paste `cron.schedule`. That paste is the next page, and only after this name is saved.

Do not call the cron routes to test the value. Do not send `Authorization: Bearer` from the phone. A yes to save the name is not a yes to run a job.

Leave `AI_REPLY_CRON_ENABLED` and `WORKFLOW_ENGINE_ENABLED` unset. Leave `AUTOMATION_WEBHOOK_SECRET` unset. Do not register a webhook. Do not edit DNS.

## 5. Steps 20 through 36 stay unapplied

Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Do not paste them again. Steps 20 through 36 stay unapplied. Do not paste them on this visit. Do not claim Success for them. Do not invent `Success. No rows returned` or `Success. Steps 20–36 applied.` The headers Already live and Unapplied stay as they are.

`SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. It is not an `sbp_` token. The replace checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). This page does not paste a token.

Gated Phase 5 command-centre panels stay paused. Do not set a Phase 5 flag. Do not click Apply Education pack or the Zentrix pack. Packs are not applied.

## Next

The previous phone checklist is [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md) (step 4). A yes on that page is not a yes for `CRON_SECRET`.

The next page is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). Open it only after `CRON_SECRET` is saved on Vercel Production and the password manager still has that same value. That page is the redeploy and the Supabase schedule paste. This page does not run that paste. If he has not said yes to `CRON_SECRET`, stop. Do not generate the secret on the schedule page.

The ops secrets panel lists whether `CRON_SECRET` is present. It does not show the value and it does not save the name. The phone checklist is [`docs/phone-ops-secrets.md`](phone-ops-secrets.md) (APPLY-ORDER step 35). This page is not that visit. A yes to save `CRON_SECRET` is not a yes for `OPS_SECRETS_READY_ENABLED`. Leave that flag unset. Signed out, `/command-centre`, `/command-centre/ops-secrets`, `/command-centre/setup`, and `/agency` answer 307 and land on `/login`. With the flag unset, `write` stays false. The panel stores presence only. It does not register a cron and it does not put a live key in the database. This page does not open that panel to tap **Record sandbox note**.

Channel keys stay separate. WhatsApp and Meta are [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md). SMS is [`docs/phone-sms-provider-keys.md`](phone-sms-provider-keys.md). LinkedIn is [`docs/phone-linkedin-keys.md`](phone-linkedin-keys.md). Email is [`docs/phone-resend-willem.md`](phone-resend-willem.md) and [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). A yes on any of those pages is not a yes for `CRON_SECRET`. This page does not set those names.

PayFast sandbox is [`docs/phone-payfast-sandbox.md`](phone-payfast-sandbox.md) (step 6). A yes for `CRON_SECRET` is not a yes for sandbox billing. This page does not charge and does not open PayFast.

SQL steps 20 through 36 are still unapplied. The SQL editor page is [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md) (step 7). This page does not open it.

## Stop rules

- No sample secret in this file. No secret in git, a pull request, chat, an issue, or a screenshot.
- Do not save the placeholder `generate-a-long-random-string`.
- Do not reuse a channel key, a PayFast passphrase, or `SUPABASE_ACCESS_TOKEN`.
- No second secret when the Production name is already present. No invented replacement.
- Production only, unless he says Preview too. Development stays off.
- Sensitive if the UI allows.
- No redeploy. No cron registration. No `cron.schedule` paste. No call to a cron route.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- `AUTOMATION_WEBHOOK_SECRET`, `AI_REPLY_CRON_ENABLED`, and `WORKFLOW_ENGINE_ENABLED` stay unset.
- No webhook registration. No DNS edits. No Vercel writes for any other name.
- No SQL. Steps 1 through 19 stay Already live. Steps 20 through 36 stay unapplied. Do not claim they are applied.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still not an `sbp_` token.
- No send, no spend, no ads.
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Do not set a Phase 5 flag. Gated command-centre panels stay paused. Do not click a pack.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Generate `CRON_SECRET`, when the password manager does not already have one and the Production name is missing.
- Save the name `CRON_SECRET` on Vercel Production. A yes for WhatsApp, Meta, SMS, LinkedIn, email, or PayFast is not that yes.
- Add Preview. Leave it off unless he says Preview too.
- Redeploy Production, then paste the schedules. That is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md), after the save. This page is not that yes.
- Turn `sending_enabled` on. That yes is separate. The later gate is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). A yes for `CRON_SECRET` is not that yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Set `AUTOMATION_WEBHOOK_SECRET`, `AI_REPLY_CRON_ENABLED`, or `WORKFLOW_ENGINE_ENABLED`. Leave them unset.
- Apply SQL steps 20 through 36. They stay unapplied. The token on the box is still a chat note.
- PayFast sandbox, channel keys, spend, or a website merge.

## Pass means

You generated one long random value and stored it in the password manager under the name `CRON_SECRET`, or you stopped before generating because the Production name was already present, or because he had not said yes. When the name was missing and he said yes to `CRON_SECRET`, Vercel Production on project `ai-autotech-crm` shows that name, marked Sensitive if the UI allowed it. Preview was added only if he said Preview too. The value is not in this file. Nothing was redeployed. No cron was registered. `sending_enabled` is still false. `AUTOMATION_SEND_ENABLED` is still unset, or still the string `false`. Steps 20 through 36 are still unapplied. Gated Phase 5 command-centre panels are still paused.

A pass does not mean `CRON_SECRET` was already set before this visit, a cron has run, a message was sent, or SQL steps 20 through 36 are applied.
