# Phone checklist: Google Workspace SMTP App Password for `Willem@aiautotech.co.za`

Billy prepares Google Workspace SMTP so the CRM can later send as `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m). This is the `SMTP_*` path, the alternative to Resend. The Resend path is [`docs/phone-resend-willem.md`](phone-resend-willem.md). The channel key names are already listed in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Phone-first unblock, step 5). This page does not repeat that list.

Live MX for `aiautotech.co.za` is already Google: priority `1`, host `smtp.google.com`. Apex SPF is `v=spf1 include:_spf.google.com ~all`. That read-only lookup was 3 Oct 2026. DKIM at `google._domainkey` and DMARC at `_dmarc` were still missing (NXDOMAIN). Those two records stay on [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (step 14). This page does not edit DNS and does not claim those TXT records exist.

The From checklist is [`docs/phone-willem-send-from.md`](phone-willem-send-from.md) (step 12). The MX page is [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md) (step 13).

Writing this page does not save an environment value, does not send, and does not apply SQL. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The business From is `Willem@aiautotech.co.za`. `billyfaber06@gmail.com` is the agency owner login. It is never the From.

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `Willem@aiautotech.co.za` | The Google Account that owns the App Password. `SMTP_USER`, and the only From. Capital W. |
| `billyfaber06@gmail.com` | Agency owner login. `OWNER_EMAILS` in [`.env.example`](../.env.example) and Phone-first unblock, step 4. Never `SMTP_USER`, never a From. |
| `billy@aiautotech.co.za` | Old example. Do not use it. |

## Stop until these are true

1. You will sign in to the Google Account for `Willem@aiautotech.co.za`. You will stop when the account is `billyfaber06@gmail.com`.
2. You will store the App Password in a password manager only. You will not paste it into git, a pull request, chat, an issue, or this file.
3. You will leave every SMTP name unset until Billy says yes to that name. A yes for one name is not a yes for the others.
4. You will not send. Saving a name does not send and does not turn `sending_enabled` on.
5. You will not add or edit a DNS record. DKIM and DMARC stay on [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md).
6. 2-Step Verification has to be on before App passwords appear. When it is off, you will stop until Billy says yes to turn it on.

If any check is false, stop.

## 1. Open the Google Account for Willem@

On the phone:

1. Open https://myaccount.google.com
2. Sign in as `Willem@aiautotech.co.za`.
3. Pass: the account header shows that address.

Stop when the account is `billyfaber06@gmail.com` or any other address. Do not create an App Password on the wrong account. Do not send a message to prove the login.

## 2. Security → 2-Step Verification

On the phone:

1. Open Security: https://myaccount.google.com/security
2. Open 2-Step Verification: https://myaccount.google.com/signinoptions/two-step-verification
3. Read the status. Leave every other Security control closed.

When the status is on, continue at section 3.

When the status is off, stop. App passwords stay hidden until 2-Step Verification is on. Turn it on only when Billy says yes on this call. Use the prompts already on that screen. This page does not pick a phone number or a backup method for him. After the page shows on, continue at section 3.

A yes to turn on 2-Step Verification is not a yes to create an App Password, and it is not a yes to save an SMTP name.

## 3. App passwords

On the phone:

1. From 2-Step Verification, open App passwords. When that link is at the bottom of the 2-Step Verification page, use it. Direct link: https://myaccount.google.com/apppasswords
2. Sign in again as `Willem@aiautotech.co.za` when Google asks.
3. Stop when the page says App passwords are unavailable, an administrator has turned them off, or the account is in Advanced Protection. Write that sentence down. Leave `SMTP_PASS` unset. Do not put the Google account password in `SMTP_PASS`. Allowing App passwords in the Admin console is a later call. It is not this page.

When the page can create a password, stop until Billy says yes to create one labeled `AI AutoTech CRM SMTP`.

When he says yes:

1. When Google asks which app, choose the custom name control on the screen (often Other).
2. Type the label `AI AutoTech CRM SMTP`.
3. Create the password.
4. Google shows it once. Use the copy control on that screen when it is there. Store that string in the password manager under the same label. The spaces on the yellow card are grouping. When you type it yourself, store the 16 letters and numbers with no spaces.
5. Close the password screen. Do not screenshot it into chat, git, or this file.

When a password with that label already exists, leave it. Google does not show an old App Password again. Create another one only when Billy says yes on this call to replace it. Revoking the old one is that same yes.

## 4. Vercel Production SMTP names

The full channel list, including WhatsApp, SMS, social, and Vault names, is Phone-first unblock, step 5 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). This section sets the SMTP path only.

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row. Choose Production.

Leave each name unset until Billy says yes to that name. Mark the row Sensitive so the phone does not keep the value on screen after save. Add Preview only when he says yes to Preview.

When he says yes to a name, set that one value:

| Name | Production value |
| --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `Willem@aiautotech.co.za` |
| `SMTP_PASS` | The App Password from the password manager. It is not written in this file. |
| `SMTP_FROM` | `AI AutoTech <Willem@aiautotech.co.za>` |

Paste `SMTP_PASS` from the password manager at the moment you save that name. After save, do not paste it into git, a pull request, chat, an issue, or this file.

`587` is the SMTP port this CRM already reads. Leave the port at `587`.

This path is the alternative to Resend. When `RESEND_API_KEY` is set, the app uses Resend and leaves these SMTP names unused. Leave `RESEND_API_KEY` and `RESEND_FROM` as they already are. Do not delete them on this visit. Do not set the other channel names from step 5 on this visit.

Saving a name does not send mail. Saving a name does not turn `sending_enabled` on. `sending_enabled` stays false on every workspace. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A saved variable is read on the next deployment. This page does not ask for a redeploy.

## 5. First allowed use later: draft or outbox only

Skip this section on this visit. Run it only after both of these are true: the SMTP names Billy approved are saved, and he has said yes to a draft test. This page is not that yes.

When both are true:

1. Leave `sending_enabled` false on every workspace.
2. Leave `AUTOMATION_SEND_ENABLED` unset, or the string `false`. With that switch off, a follow-up stays in the Outbox and the app does not call Resend or SMTP.
3. Open a draft or an outbox row only. Confirm the From is `Willem@aiautotech.co.za`.
4. Stop. Outbox queued mail is still not a send.

Do not tap **Send now**, **Go live**, **Publish**, or **Post now**. Do not send a message to prove the App Password.

## DKIM and DMARC stay on the other page

Do not open GoDaddy on this visit. Do not add a TXT. On 3 Oct 2026, `google._domainkey.aiautotech.co.za` and `_dmarc.aiautotech.co.za` had no TXT (NXDOMAIN). MX was already `1 smtp.google.com`. SPF already included `_spf.google.com`. The phone checklist for DKIM and a monitor-only DMARC record is [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (step 14). Each DNS write on that page waits for Billy’s yes. This page does not publish those records.

## Stop rules

- No real send. No spend.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Saving env does not change either one.
- No DNS edits. DKIM (`google._domainkey`) and DMARC (`_dmarc`) stay on [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md). The 3 Oct 2026 lookup found neither TXT. This page does not claim they exist.
- No SQL. Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Steps 20 through 36 stay unapplied. Do not claim they are applied.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still not an `sbp_` token. The replace checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). This page does not paste a token.
- `CRON_SECRET` and the other outbound channel keys stay unset until Billy says yes. Names are Phone-first unblock, step 5. The schedule paste is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This page does not run that paste.
- Do not paste the App Password into git, a pull request, chat, an issue, or this file.
- Do not use `billyfaber06@gmail.com` as `SMTP_USER`, `SMTP_FROM`, or a From.
- Tracker item 6 (outbound channels) stays partial (4/8).
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Do not set a Phase 5 flag. Do not click Apply Education pack or the Zentrix pack.
- Do not set `NEXT_PUBLIC_SITE_URL` on this visit. That check is [`docs/phone-site-url-verify.md`](phone-site-url-verify.md).
- Do not call `store_channel_secret` and do not run `scripts/migrate-channel-credentials.mjs`.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Turn on 2-Step Verification, when section 2 showed it off.
- Create the App Password labeled `AI AutoTech CRM SMTP`.
- Each SMTP name, one yes per name: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- A draft or outbox test, with `sending_enabled` still false.
- Turn `sending_enabled` on. That yes is separate. The later gate is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). A yes for an SMTP name is not that yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Publish DKIM and a monitor-only DMARC TXT, only after an explicit yes on [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (step 14). The 3 Oct 2026 lookup found neither TXT.
- Apply SQL steps 20 through 36. They stay unapplied. The token on the box is still a chat note.
- Merge the website pull requests, spend, or post.

## Pass means

You signed in as `Willem@aiautotech.co.za`. 2-Step Verification was already on, or you stopped because it was off and Billy had not said yes. The App Password is in the password manager, or you stopped before creating it because he had not said yes. Each SMTP name on Vercel Production is still unset, or it is set only for a name he approved on this call, marked Sensitive. `SMTP_PASS` came from the password manager and is not in this file. Nothing was sent. `sending_enabled` is still false. DNS is unchanged.

A pass does not mean email is live, a message was sent, SQL steps 20 through 36 are applied, or DKIM and DMARC exist.
