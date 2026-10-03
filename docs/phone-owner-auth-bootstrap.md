# Phone checklist: Owner Auth bootstrap and `OWNER_EMAILS`

Billy confirms the agency owner in Supabase Auth, then checks the name `OWNER_EMAILS` on the CRM project. The only address is `billyfaber06@gmail.com`. Billy typed that for `OWNER_EMAILS` on 27 Sep 2026. It is the default in [`.env.example`](../.env.example). When `OWNER_EMAILS` is unset or blank, the app already uses that address. Do not invent another email.

This page is Phone-first unblock, step 4 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). Do it on the phone now. It does not wait on a real `sbp_` token and it does not wait on steps 20 through 36.

Writing this page does not create a user, does not write an environment value, and does not apply SQL. Confirming the Auth user, or saving `OWNER_EMAILS`, does not apply steps 20 through 36, does not unpause gated Phase 5 command-centre panels, does not send, and does not spend. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The project ref is `fnysxlswzufdnlbhndxc`. The CRM project on Vercel is `ai-autotech-crm`. Business email From stays `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m) on the other phone pages. This page does not send and does not use personal Gmail as that From.

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `billyfaber06@gmail.com` | Agency owner login. The only `OWNER_EMAILS` value. Never a From, a reply-to, or a test sender. |
| `Willem@aiautotech.co.za` | The only From for AI AutoTech business email. Not used on this page. Do not send. |
| `billy@aiautotech.co.za` | Old example. Do not use it. |

## Stop until these are true

1. You are signed in to the Supabase account that owns project `fnysxlswzufdnlbhndxc`, and to the Vercel account that owns `ai-autotech-crm`.
2. You will create the Auth user only when Billy says yes on this call. A password goes in a password manager only. You will not paste it into git, a pull request, chat, an issue, or this file.
3. You will add `OWNER_EMAILS` only when Billy says yes. A yes to read the screen is not that yes.
4. You will not paste `supabase/owner-bootstrap.sql` on this visit. Steps 20 through 36 have not shown Success.
5. You will not send, spend, edit DNS, register a cron, or click a pack.

If any check is false, stop.

## 1. Open Authentication → Users

On the phone, open Supabase → project `fnysxlswzufdnlbhndxc` → Authentication → Users:

https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/auth/users

This is the Users list, not Account → Access Tokens, and not Project Settings → API Keys.

1. Look for `billyfaber06@gmail.com`.
2. When that row is already there, leave the user as it is. Do not add a second user for the same address. Continue at section 3.
3. When it is missing, stop. Section 2 is the only create path, and only after Billy says yes.

A row in Authentication → Users is not a membership by itself. This page does not attach `agency_owner`. It does not set `SUPABASE_SERVICE_ROLE_KEY`. That name stays on step 6, and only when Billy says yes to sandbox billing.

## 2. Create the Auth user only after Billy says yes

Skip this section when section 1 already showed `billyfaber06@gmail.com`.

Stop on the Users list until Billy says yes to create that one user on this call, while he is watching. A note that the row is missing is not that yes.

When he says yes:

1. Stay on the same Users page. Choose Add user.
2. Email: `billyfaber06@gmail.com`. No other address.
3. Set the password in the dashboard. Copy it once into the password manager. This page does not contain a password.
4. Turn on Auto Confirm so sign-in does not wait on a mailbox.
5. Save that one user. Do not add a second user.

Leave the password out of git, pull requests, issues, docs, and chat. Do not read it aloud into chat. Do not photograph it into the repo.

## 3. `OWNER_EMAILS` on Vercel Production

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row. Choose Production.

Look for the name `OWNER_EMAILS`. Confirm the name only until Billy says yes to add or replace it.

1. When the name is present and the Production value is `billyfaber06@gmail.com`, leave the row. That is the only address this checklist names. Do not add a second address.
2. When the name is present and the value is any other address, or a list with more than that one address, stop. Write down that it differs. Do not edit it until Billy says yes on this call to replace it with `billyfaber06@gmail.com` alone.
3. When the name is missing, or the Production value is blank, leave it unset until Billy says yes. The app already defaults to `billyfaber06@gmail.com`. Record that default. Do not invent another email.

When he says yes to add or replace the name:

1. Set `OWNER_EMAILS` to `billyfaber06@gmail.com`. One address. No comma, no second address.
2. Save it for Production. Add Preview only when he says yes to Preview.
3. Mark the row Sensitive if the UI allows, so the phone does not keep the value on screen after save.

Saving this name does not create the Auth user. Leaving it unset does not delete the Auth user. A saved variable is read on the next deployment. This page does not ask for a redeploy.

## 4. This visit does not apply SQL, unpause, send, or spend

Confirming the Auth user does not apply SQL. Saving `OWNER_EMAILS`, or leaving it unset, does not apply SQL.

- Steps 20 through 36 stay unapplied. Do not claim Success. Do not invent a Success line.
- Gated Phase 5 command-centre panels stay paused. Leave `OWNER_BOOTSTRAP_UI_ENABLED` unset until step 34 is applied. Setting a flag does not apply SQL. The panel at `/command-centre/owner` does not create the Auth user and does not run SQL.
- `sending_enabled` stays false on every workspace. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Do not send.
- No spend. No charge. No DNS edit. No cron registration. No pack click.

## 5. Do not paste owner SQL yet

`supabase/owner-bootstrap.sql` is the existing manual membership file. It is not a migration. Do not invent another SQL filename. Do not paste it on this visit.

[`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) (Not part of this apply) says to run it only after steps 20 through 36 have succeeded, and only after `billyfaber06@gmail.com` exists in Supabase Auth. Steps 1 through 19 being Already live is not that success. This page does not copy that file.

The later paste is Phone-first unblock, step 7 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md), in the same SQL editor:

https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new

Open that paste only after Phone-first unblock step 2 has printed `Success. Steps 20–36 applied.`, or Phone-first unblock step 7 has run step 36 in the SQL editor without error, and the Auth user is in the list. Until then, leave the editor closed. This page is not that yes.

## Still blocked

A pass on this page leaves these blocked. A yes for the Auth user, or for `OWNER_EMAILS`, is not a yes for any line below.

- `SUPABASE_ACCESS_TOKEN` is still a chat note, not an `sbp_` token. SQL steps 20 through 36 stay unapplied. The token checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md) (step 1). The SQL editor paste is step 7.
- `CRON_SECRET` and the outbound channel key names. Those stay on step 5. Leave every name unset until Billy says yes.
- PayFast sandbox. That stays on step 6. Leave those names unset until Billy says yes to sandbox billing. Live PayFast stays off.
- DKIM and a monitor-only DMARC record. Those stay on [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (step 14). This page does not edit DNS.
- `crm.aiautotech.co.za` DNS. The attach checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md) (step 10). This page does not edit DNS.
- Website publish for [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). Those stay open. See [`docs/website-publish-decision.md`](website-publish-decision.md).

## Next phone checklists

After this verification, the next phone checklists are:

1. Step 5: `CRON_SECRET` and the outbound channel key names, in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). Leave every name unset until Billy says yes. `sending_enabled` stays false.
2. Step 6: PayFast sandbox and billing readiness, in the same runbook. Leave those names unset until Billy says yes to sandbox billing.

Step 7 (the SQL editor paste of steps 20 through 36) stays after those, and it stays blocked until Billy is on that checklist. This page does not start it.

## Stop rules

- Do not invent Success. Steps 20 through 36 stay unapplied in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Steps 1 through 19 stay Already live. Do not paste them again.
- Do not paste `supabase/owner-bootstrap.sql` until steps 20 through 36 have shown Success and the Auth user exists.
- Do not create the Auth user, and do not save `OWNER_EMAILS`, until Billy says yes on this call.
- Do not put a password, a token, a key, a passphrase, or a service-role value into git, a pull request, chat, or this file.
- `sending_enabled` stays false. No send. No spend. No DNS edit. No cron registration. No pack click.
- Gated Phase 5 command-centre panels stay paused. Leave `OWNER_BOOTSTRAP_UI_ENABLED` unset.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still not an `sbp_` token.
- Do not use `billyfaber06@gmail.com` as a From. Business From is `Willem@aiautotech.co.za` on [`docs/phone-willem-send-from.md`](phone-willem-send-from.md).
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Create the Auth user `billyfaber06@gmail.com`, when section 1 showed it missing.
- Add or replace `OWNER_EMAILS` on Production, when the name is missing, blank, or a different address. Preview is a separate yes.
- `CRON_SECRET` and each outbound channel key. Those are step 5.
- PayFast sandbox names. Those are step 6. Live charges are a later yes.
- Paste steps 20 through 36, then `supabase/owner-bootstrap.sql`. The SQL paste is step 7 and [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md).
- Turning `sending_enabled` on.
- Publishing [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

## Pass means

You opened Authentication → Users for project `fnysxlswzufdnlbhndxc` and wrote down whether `billyfaber06@gmail.com` is there. You created that user only if Billy said yes on this call, and the password is in the password manager only. On Vercel Production, `OWNER_EMAILS` is `billyfaber06@gmail.com`, or it is still unset or blank because he had not said yes and the app already defaults to that address. Nothing was pasted into the SQL editor. `sending_enabled` is still false. Nothing was sent. Nothing was spent.

A pass does not mean steps 20 through 36 are applied, the owner membership exists, a Phase 5 panel is unpaused, or email is live.
