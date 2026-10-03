# Phone checklist: send from `Willem@aiautotech.co.za`

Billy confirms the Google Workspace login for `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m), notes which CRM email names exist, and notes where `aiautotech.co.za` mail exchange (MX) points. This page does not send, does not set a key, and does not change DNS. The verify path for that MX, and the fallback if a new lookup shows Amazon SES, is [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md) (Phone-first unblock, step 13).

Writing this page does not apply SQL, does not redeploy, and does not spend. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. Email is not live. Tracker item 6 (outbound channels) stays partial (4/8) until the channel keys exist and a send path has been verified. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `Willem@aiautotech.co.za` | The only From for AI AutoTech business email. Google Workspace account, created about 30 Jul 2026. Capital W. |
| `billyfaber06@gmail.com` | Agency owner login. `OWNER_EMAILS` in [`.env.example`](../.env.example) and Phone-first unblock, step 4. Never a From address. |
| `billy@aiautotech.co.za` | Old example. Do not use it. The example in `.env.example` is now `AI AutoTech <Willem@aiautotech.co.za>`. |

This page does not write that example onto Vercel.

## Stop until these are true

1. You can open Gmail or Google sign-in on the phone.
2. You will read Environment Variable names only. You will not copy a key, a token, or a password into git, a pull request, chat, or this file.
3. You will read MX. You will not add, edit, or delete a DNS record on this visit.

If any check is false, stop.

## 1. Workspace login

On the phone:

1. Open https://mail.google.com
2. Sign in as `Willem@aiautotech.co.za`.
3. Pass: the inbox for that address opens.

Stop when sign-in fails, asks for a different account, or lands in `billyfaber06@gmail.com`. Do not send a message to prove the login. An empty inbox can mean MX still points at Amazon SES. That is section 3. Leave MX as it is on this visit.

## 2. Which email channel the CRM uses

Names are already listed in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Phone-first unblock, step 5). Read that list. This section only notes which names are present.

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row.

Note the email names. Leave every value closed.

- Resend path: `RESEND_API_KEY` and `RESEND_FROM`
- SMTP path: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` (`SMTP_PORT` is the port name)

When a workspace connection is the email path, the Vault secret name is `channel:` plus the connection id. Email providers already in the app are `resend` and `smtp`. The channel name is `email`. Step 5 has that Vault sentence. This page does not call `store_channel_secret` and does not run `scripts/migrate-channel-credentials.mjs`.

Once a send is allowed later, and only when no workspace connection is selected, the app uses `RESEND_API_KEY` when that name is set, and otherwise `SMTP_HOST` when that name is set. This visit does not save either name.

`CRON_SECRET` and these channel keys still need Billy’s yes. A yes to read the names is not that yes. Saving a key later still leaves `sending_enabled` false.

The From value, when Billy later says yes to the name, is `Willem@aiautotech.co.za`. The example line is `AI AutoTech <Willem@aiautotech.co.za>`.

## 3. MX check (read only)

On 3 Oct 2026 a read-only DNS-over-HTTPS lookup for `aiautotech.co.za` returned MX `1 smtp.google.com.` and apex SPF `v=spf1 include:_spf.google.com ~all`. That is Google Workspace. An older note that MX pointed at Amazon SES in `eu-west-1` is outdated unless a new lookup shows SES again.

On the phone, open https://www.whatsmydns.net/#MX/aiautotech.co.za and read the mail host. To confirm in the registrar, open GoDaddy → My Products → Domains → `aiautotech.co.za` (no hyphen) → DNS, and read the MX rows. If the only domain in the account is the hyphenated `ai-autotech.co.za`, stop. That is the wrong zone.

Write down one line:

- Google, when the host contains `google.com` or `googlemail.com`. The host already seen is `smtp.google.com`.
- Amazon SES, when the host contains `amazonaws.com`. The old host was `inbound-smtp.eu-west-1.amazonaws.com`.
- Other. Copy the host exactly.

If the public lookup and GoDaddy disagree, write both hosts and stop.

Stop on this screen. Do not tap Add, Edit, or Delete. Do not change nameservers. This page does not switch MX. When the line is Google, the next page verifies SPF and the Willem inbox and skips the SES fallback. When the line is Amazon SES, that same page is the decision card, and the switch waits for Billy’s explicit yes on that call. The page is [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md) (Phone-first unblock, step 13).

## 4. Never send from personal Gmail

AI AutoTech business email goes from `Willem@aiautotech.co.za`.

`billyfaber06@gmail.com` stays the owner login. It is not a From address, a reply-to for a customer, or a test sender. Do not compose, forward, or reply to AI AutoTech mail from that Gmail account.

## 5. First test, later: draft or outbox only

Skip this section on this visit. Run it only after both of these are true: the email key names from section 2 are saved, and Billy has said yes to a draft test. This page is not that yes.

When both are true:

1. Leave `sending_enabled` false on every workspace.
2. Leave `AUTOMATION_SEND_ENABLED` unset, or the string `false`. With that switch off, a follow-up stays in the Outbox and the app does not call Resend or SMTP.
3. Open a draft or an outbox row only. Confirm the From is `Willem@aiautotech.co.za`.
4. Stop. Outbox queued mail is still not a send.

Do not tap **Send now**, **Go live**, **Publish**, or **Post now**.

## Stop rules

- No DNS edits, including MX. No domain purchase, transfer, or nameserver move. No spend.
- No SQL. Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Steps 20 through 36 stay unapplied. Do not claim they are applied.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Email is not live.
- `CRON_SECRET` and the outbound channel keys stay unset until Billy says yes. Names are Phone-first unblock, step 5. The schedule paste is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This page does not run that paste.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still not an `sbp_` token.
- Tracker item 6 stays partial (4/8).
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- No new command-centre panel. No posts under Billy’s name. No ad spend and no purchases.
- Do not set `NEXT_PUBLIC_SITE_URL` on this visit. That check is [`docs/phone-site-url-verify.md`](phone-site-url-verify.md).

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Save `CRON_SECRET`.
- Save the email channel names (`RESEND_API_KEY` and `RESEND_FROM`, or the SMTP names). The From is `Willem@aiautotech.co.za`.
- A draft or outbox test, with `sending_enabled` still false.
- Turn `sending_enabled` on. That yes is separate, and it is not this page.
- Switch MX to Google at GoDaddy, only when a phone lookup shows Amazon SES again, and only after an explicit yes on [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md) (step 13). The 3 Oct 2026 lookup was already Google. Skip the switch when the phone lookup is Google.
- Apply SQL steps 20 through 36.
- Merge the website pull requests, spend, or post.

## Pass means

The Workspace inbox for `Willem@aiautotech.co.za` opened, or you stopped because that login failed. You wrote down which email env names exist, without copying a value. You wrote down whether MX is Google, Amazon SES, or another host. DNS is unchanged. No key was saved. Nothing was sent.

A pass does not mean email is live, tracker item 6 is complete, SQL steps 20 through 36 are applied, or MX was switched.
