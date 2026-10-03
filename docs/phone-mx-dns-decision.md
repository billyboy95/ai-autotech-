# Phone checklist: MX for `aiautotech.co.za`

Billy verifies that mail for `aiautotech.co.za` already lands on Google Workspace, so `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m) can receive. The primary path is a read of MX and SPF. A switch from Amazon SES to Google is a fallback, and only when a phone lookup shows SES again.

On 3 Oct 2026 a read-only DNS-over-HTTPS lookup (Cloudflare and Google) returned:

- MX: `1 smtp.google.com.`
- Apex TXT (SPF): `v=spf1 include:_spf.google.com ~all`

That is already Google Workspace. An older note that MX pointed at Amazon SES in `eu-west-1` (`inbound-smtp.eu-west-1.amazonaws.com`) is outdated unless the phone lookup below shows SES again. The same lookup found no TXT at `google._domainkey.aiautotech.co.za` and no TXT at `_dmarc.aiautotech.co.za`. The next phone checklist for those two records is [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (Phone-first unblock, step 14). This page leaves them.

Writing this page does not edit DNS, does not send, and does not apply SQL. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The From checklist is [`docs/phone-willem-send-from.md`](phone-willem-send-from.md) (Phone-first unblock, step 12). After this MX page, DKIM and a monitor-only DMARC record are [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (step 14). Channel key names stay on step 5 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md).

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `Willem@aiautotech.co.za` | The inbox that should receive, and the only From for AI AutoTech business email. |
| `billyfaber06@gmail.com` | Agency owner login. Never a From, a reply-to, or a test sender. |
| `billy@aiautotech.co.za` | Old example. Do not use it. |

## Stop until these are true

1. You will read MX and SPF before any Save.
2. You will open the zone `aiautotech.co.za` (no hyphen). If the only domain in the account is `ai-autotech.co.za`, stop.
3. You will leave SPF, DKIM, and DMARC as they are unless Billy has already said yes to those records in the same breath. The default on this visit is to leave them.

If any check is false, stop.

## 1. Look up MX (read only)

On the phone:

1. Open https://www.whatsmydns.net/#MX/aiautotech.co.za
2. Read the mail host and the priority.
3. To compare with the registrar, open GoDaddy → My Products → Domains → `aiautotech.co.za` → DNS. Read the MX rows. Leave Add, Edit, and Delete closed.

Write one line:

- Google, when the host is `smtp.google.com` (priority 1), or another host that contains `google.com` or `googlemail.com`.
- Amazon SES, when the host contains `amazonaws.com`. The old host was `inbound-smtp.eu-west-1.amazonaws.com`.
- Other. Copy the host exactly.

If the public lookup and GoDaddy disagree, write both hosts and stop. Do not edit.

Google: continue at section 2. Skip section 6.
Amazon SES: skip sections 2 through 5 and open section 6. Do not switch until Billy says yes on this call.
Other: stop. Do not edit.

## 2. Verify SPF (read only)

Stay on the same GoDaddy DNS screen, or open https://www.whatsmydns.net/#TXT/aiautotech.co.za

Pass: the apex TXT is `v=spf1 include:_spf.google.com ~all`.

When it matches, leave the TXT row. Do not tap Edit.

When it does not match, write the value down and stop. Changing SPF needs Billy’s yes in the same breath. This visit’s default is to leave SPF.

## 3. Willem inbox

On the phone:

1. Open https://mail.google.com
2. Sign in as `Willem@aiautotech.co.za`.
3. Pass: that inbox opens.

Stop when sign-in fails or lands in `billyfaber06@gmail.com`.

This page does not send a message. Do not compose, forward, or reply from personal Gmail. An empty inbox with Google MX and the Google SPF line is still a pass for this checklist. A message sent to `Willem@aiautotech.co.za` to prove delivery waits for a separate yes. It is not this page.

## 4. Outbound stays off

`sending_enabled` stays false on every workspace until Billy gives a separate yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.

Leave `RESEND_API_KEY`, `RESEND_FROM`, and the SMTP names unset on this visit. Those names are Phone-first unblock, step 5. When a From is saved later, it is `Willem@aiautotech.co.za`. The example line is `AI AutoTech <Willem@aiautotech.co.za>`.

## 5. DKIM and DMARC, next page

Do not add or edit these on this visit. The default is to leave them. A verify pass on this page does not require either record.

The next phone checklist is [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (Phone-first unblock, step 14). That page opens Google Admin → Gmail → Authenticate email, generates DKIM for `aiautotech.co.za`, and adds the TXT at the selector Admin shows (usually `google._domainkey`). It then adds a monitor-only DMARC TXT at `_dmarc` (`v=DMARC1; p=none; rua=mailto:Willem@aiautotech.co.za`). Each DNS write waits for Billy’s yes on that call. `sending_enabled` stays false. This MX page does not open that write. MX is already Google, so that page does not switch SES to Google.

## 6. Fallback: SES back to Google

Skip this whole section when section 1 wrote Google. The 3 Oct 2026 lookup wrote Google. Open this section only when the phone lookup wrote Amazon SES.

Billy switches the MX at GoDaddy only after an explicit yes on this call, while he is watching. A note that MX is SES is not that yes. If he has not said yes, stop on the read-only screen.

When he says yes:

1. Stay on GoDaddy → `aiautotech.co.za` → DNS. Confirm the zone has no hyphen.
2. On each MX row whose host contains `amazonaws.com`, remove that row. Do not leave an SES MX next to a Google MX. Split MX sends some mail to SES.
3. Add one MX if `smtp.google.com` is missing:
   - Type: MX
   - Name: `@`
   - Priority: `1`
   - Host: `smtp.google.com`
4. If GoDaddy rejects a host that ends with a dot, remove only that trailing dot and save again.
5. Leave every other row. Do not edit `@` or `www` website records, the `crm` record, or nameservers. Do not turn on forwarding or a website builder.
6. Leave SPF, DKIM, and DMARC unless Billy already said yes to those records in the same breath. When SPF is already `v=spf1 include:_spf.google.com ~all`, leave it.
7. Open https://www.whatsmydns.net/#MX/aiautotech.co.za again. Pass: the host is `smtp.google.com`.

Then return to section 2.

## Stop rules

- On the verify path, no DNS edits. No domain purchase, transfer, or nameserver move. No spend.
- The SES fallback runs only after Billy’s explicit yes on this call, and only when section 1 wrote Amazon SES.
- SPF, DKIM, and DMARC stay as they are unless he already said yes to those records in the same breath.
- No SQL. Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Steps 20 through 36 stay unapplied.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Nothing is sent.
- `CRON_SECRET` and the outbound channel keys stay unset until Billy says yes. Names are Phone-first unblock, step 5.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still not an `sbp_` token.
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Do not set a Phase 5 flag, PayFast, or `NEXT_PUBLIC_SITE_URL` on this visit.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Publish DKIM at `google._domainkey` (or the selector Admin shows). The steps are [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (step 14).
- Publish a monitor-only DMARC TXT at `_dmarc` (`v=DMARC1; p=none; rua=mailto:Willem@aiautotech.co.za`). Same page. Tightening `p=` waits for a later yes.
- Change SPF, only when the live TXT is not `v=spf1 include:_spf.google.com ~all`.
- Switch MX from SES to `smtp.google.com`, only when a phone lookup shows SES again.
- One message to `Willem@aiautotech.co.za` to prove the inbox received it.
- Save the email channel names. The From is `Willem@aiautotech.co.za`.
- Turn `sending_enabled` on.

## Pass means

The phone lookup shows Google MX (`smtp.google.com`) and the Google SPF line. The Willem Workspace inbox opened, or you stopped because that login failed. DNS is unchanged. Nothing was sent. `sending_enabled` is still false. Personal Gmail was not used.

A pass does not mean DKIM or DMARC is published, email is live, tracker item 6 is complete, or SQL steps 20 through 36 are applied.

When section 6 ran, pass also means Billy said yes on this call and the MX host is `smtp.google.com`. This page does not run that fallback by itself.
