# Phone checklist: Resend API key for `Willem@aiautotech.co.za`

Billy prepares Resend so the CRM can later send as `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m). This is the Resend path. The Google Workspace SMTP App Password path is the alternative, on [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). The channel key names are already listed in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Phone-first unblock, step 5). This page does not repeat the WhatsApp, SMS, or Meta names.

The From checklist is [`docs/phone-willem-send-from.md`](phone-willem-send-from.md) (step 12). Inbound MX is [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md) (step 13). Google Workspace DKIM and a monitor-only DMARC record are [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (step 14). Those records are a different set from anything Resend shows. This page does not edit DNS and does not claim a Resend domain is verified.

Writing this page does not save an environment value, does not send, and does not apply SQL. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The business From is `Willem@aiautotech.co.za`. `billyfaber06@gmail.com` is the agency owner login. It is never the From.

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `Willem@aiautotech.co.za` | The only From. Capital W. The Resend sending domain, when one is added, is `aiautotech.co.za` (no hyphen). |
| `AI AutoTech <Willem@aiautotech.co.za>` | The `RESEND_FROM` value. The example is already in [`.env.example`](../.env.example). This page does not treat that example as the live Vercel value. |
| `billyfaber06@gmail.com` | Agency owner login. `OWNER_EMAILS` in [`.env.example`](../.env.example) and Phone-first unblock, step 4. Never a From. |
| `billy@aiautotech.co.za` | Old example. Do not use it. |
| `onboarding@resend.dev` | Resend’s own sandbox sender. Do not use it as `RESEND_FROM`. |

## Stop until these are true

1. You will sign in to an existing Resend account. You will not create a Resend account on this visit. Creating one is a separate yes, and it is not this page.
2. You will store the API key in a password manager only. You will not paste it into git, a pull request, chat, an issue, or this file.
3. You will leave `RESEND_API_KEY` and `RESEND_FROM` unset, or unchanged, until Billy says yes to that name. A yes for one name is not a yes for the other.
4. You will not send. Saving a name does not send and does not turn `sending_enabled` on. You will not tap a send, test, or compose control on the Resend site.
5. You will not add or edit a DNS record. You will not type a DNS value from memory. You will not open GoDaddy to save a row.
6. You will not add a card, upgrade a plan, or buy sending credits.

If any check is false, stop.

## 1. Open Resend and create the API key

On the phone:

1. Open https://resend.com/login
2. Sign in to the existing Resend account.
3. Open API Keys: https://resend.com/api-keys
4. Read the list. Leave every existing key closed. Do not reveal a key. Do not delete a key.

When a key labeled `AI AutoTech CRM` is already in the list, leave it. Resend does not show an old key again. Create another one only when Billy says yes on this call to replace it. Revoking the old one is that same yes.

When the list has no key for this CRM, stop until Billy says yes to create one labeled `AI AutoTech CRM`.

When he says yes:

1. Tap the create control on that screen (Create API Key, or the same words Resend uses).
2. Name it `AI AutoTech CRM`.
3. When the screen asks for a permission, choose Sending access. Full access is more than this CRM needs. When those words are not on the screen, write down the choices and stop. This page does not pick a permission it does not name.
4. When the screen offers to limit the key to a domain, choose `aiautotech.co.za` only if that name is already in the list. When it is not listed, leave the limit unset. Do not type `ai-autotech.co.za`. That hyphenated name is the wrong zone.
5. Create the key.
6. Resend shows it once. A Resend key starts with `re_`. Use the copy control on that screen when it is there. Store that string in the password manager under the same label.
7. Close the key screen. Do not screenshot it into chat, git, or this file.

A yes to create the key is not a yes to save it on Vercel, and it is not a yes to send.

## 2. Domain `aiautotech.co.za` (status only)

On the phone:

1. Open https://resend.com/domains
2. Look for `aiautotech.co.za` (no hyphen).
3. Write down the status word on that row. Use the word Resend shows. Do not invent Verified.

When the only domain in the account is `ai-autotech.co.za`, stop. That is the wrong name.

When the status word is Verified, continue at section 3. Leave the records closed. Do not open GoDaddy.

When `aiautotech.co.za` is not in the list, stop until Billy says yes to add that domain name in Resend. When he says yes:

1. Tap Add Domain (or the same words Resend uses).
2. Type `aiautotech.co.za`.
3. When Resend asks for a region, write the choices down and stop. This page does not pick a region.
4. Create the domain in Resend. That tap does not write DNS at GoDaddy.

When the status is anything other than Verified, including just added:

1. Read the status word. Write it down.
2. Leave the DNS rows on the screen. Do not copy them into git, a pull request, chat, an issue, or this file.
3. Do not open GoDaddy. Do not tap Add, Edit, or Delete on a DNS record.
4. Do not replace MX. Inbound mail stays on Google (`1 smtp.google.com` on the 3 Oct 2026 lookup). If the Resend screen shows an MX row, do not copy it and do not publish it.
5. Do not change the apex SPF (`v=spf1 include:_spf.google.com ~all` on that same lookup).

A later DNS write, if Billy says yes on that later call, copies the rows from the Resend screen on that call. This file does not contain those rows. Google Workspace DKIM (`google._domainkey`) and DMARC (`_dmarc`) stay on [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md). This page does not publish them.

An unverified domain does not change the From. Do not switch `RESEND_FROM` to `onboarding@resend.dev` or any other address to “make a test work.” There is no test on this visit.

## 3. Vercel Production: `RESEND_API_KEY` and `RESEND_FROM`

The full channel list, including WhatsApp, SMS, social, and Vault names, is Phone-first unblock, step 5 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). This section sets the Resend path only.

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row. Choose Production.

Leave each name unset until Billy says yes to that name. Mark the row Sensitive so the phone does not keep the value on screen after save. Add Preview only when he says yes to Preview.

When he says yes to a name, set that one value:

| Name | Production value |
| --- | --- |
| `RESEND_API_KEY` | The key from the password manager. It starts with `re_`. It is not written in this file. |
| `RESEND_FROM` | `AI AutoTech <Willem@aiautotech.co.za>` |

Paste `RESEND_API_KEY` from the password manager at the moment you save that name. After save, do not paste it into git, a pull request, chat, an issue, or this file.

For `RESEND_FROM`, read the Production value before you type:

- Already `AI AutoTech <Willem@aiautotech.co.za>`: leave it. A yes is not required to leave a correct value.
- Missing: set that exact value only after Billy says yes to the name `RESEND_FROM`. The line in `.env.example` is the example. It is not the live Vercel value.
- `billy@aiautotech.co.za`, `billyfaber06@gmail.com`, `onboarding@resend.dev`, or any other address: stop. Write down the address you saw. Do not save it again. Replace it only when Billy says yes to replace that row with `AI AutoTech <Willem@aiautotech.co.za>`.

This path is the Resend path. When `RESEND_API_KEY` is set, and no workspace email connection is selected, the app uses Resend and leaves the SMTP names unused. Leave `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` as they already are. Do not delete them on this visit. The SMTP steps stay on [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). Do not set the other channel names from step 5 on this visit.

Saving a name does not send mail. Saving a name does not turn `sending_enabled` on. `sending_enabled` stays false on every workspace. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A saved variable is read on the next deployment. This page does not ask for a redeploy.

## 4. Still blocked

These stay blocked after a pass on this page:

- SQL steps 20 through 36 are unapplied. Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Do not claim Success. Do not invent `Success. No rows returned` or `Success. Steps 20–36 applied.`
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- No real send. Do not tap Send, Send test, Compose, or the equivalent on Resend. Do not tap **Send now**, **Go live**, **Publish**, or **Post now** in the CRM.
- The SMTP path is the alternative. It is [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). This visit does not create the App Password and does not save the SMTP names.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note, not an `sbp_` token. Gated Phase 5 command-centre panels stay paused.
- Tracker item 6 (outbound channels) stays partial (4/8).
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open.

## 5. Next checklists

The rest of Phone-first unblock, step 5, stays in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md): `CRON_SECRET`, then WhatsApp (`WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`), one SMS provider, and the Meta and LinkedIn names. Each of those names waits for Billy’s yes. This page does not set them. After `CRON_SECRET` is saved, the schedule paste is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This page does not run that paste.

The next phone checklist after step 5 is step 6 in that same runbook: PayFast sandbox and billing readiness. Leave `BILLING_SANDBOX`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, and `SUPABASE_SERVICE_ROLE_KEY` unset until Billy says yes to sandbox billing. A yes for `RESEND_API_KEY` is not that yes. This page does not charge and does not open PayFast.

## Stop rules

- No real send. No spend. No card. No plan upgrade.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Saving env does not change either one.
- No DNS edits. Do not copy Resend’s DNS rows into this file. DKIM (`google._domainkey`) and DMARC (`_dmarc`) stay on [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md). MX stays Google unless a later page says otherwise.
- No SQL. Steps 1 through 19 stay Already live. Steps 20 through 36 stay unapplied. Do not claim they are applied.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still not an `sbp_` token. The replace checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). This page does not paste a token.
- Do not paste the API key into git, a pull request, chat, an issue, or this file.
- Do not use `billyfaber06@gmail.com`, `billy@aiautotech.co.za`, or `onboarding@resend.dev` as `RESEND_FROM`.
- Do not create a Resend account on this visit.
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Do not set a Phase 5 flag. Do not click Apply Education pack or the Zentrix pack.
- Do not set `NEXT_PUBLIC_SITE_URL` on this visit. That check is [`docs/phone-site-url-verify.md`](phone-site-url-verify.md).
- Do not call `store_channel_secret` and do not run `scripts/migrate-channel-credentials.mjs`.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Create the Resend API key labeled `AI AutoTech CRM`.
- Add the domain name `aiautotech.co.za` in Resend, when section 2 did not already list it. That yes is not a DNS write.
- A later DNS write, copied from the Resend screen on that later call, and only for the rows he names. This page is not that yes.
- Each Resend name, one yes per name: `RESEND_API_KEY`, then `RESEND_FROM` when the Production value is not already `AI AutoTech <Willem@aiautotech.co.za>`.
- The rest of step 5 (WhatsApp, SMS, Meta, and `CRON_SECRET`), then step 6 PayFast sandbox.
- Turn `sending_enabled` on. That yes is separate, and it is not this page.
- Apply SQL steps 20 through 36. They stay unapplied. The token on the box is still a chat note.
- Merge the website pull requests, spend, or post.

## Pass means

You signed in to an existing Resend account, or you stopped because there was no account and Billy had not said yes to create one. The API key is in the password manager, or you stopped before creating it because he had not said yes. You wrote down the sending-domain status word for `aiautotech.co.za`, or you stopped before adding the domain. DNS is unchanged. Each Resend name on Vercel Production is still unset, or it is set only for a name he approved on this call, marked Sensitive. `RESEND_FROM`, when set, is `AI AutoTech <Willem@aiautotech.co.za>`. `RESEND_API_KEY` came from the password manager and is not in this file. Nothing was sent. `sending_enabled` is still false.

A pass does not mean email is live, a message was sent, the Resend domain is verified, SQL steps 20 through 36 are applied, or DKIM and DMARC exist.
