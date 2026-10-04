# Phone checklist: DKIM and DMARC for `aiautotech.co.za`

Billy publishes Google Workspace DKIM, then a monitor-only DMARC record, so `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m) can send with authentication later. MX is already Google. This page does not switch MX from Amazon SES.

On 3 Oct 2026 a read-only DNS-over-HTTPS lookup (Cloudflare and Google) returned:

- MX: `1 smtp.google.com.`
- Apex TXT (SPF): `v=spf1 include:_spf.google.com ~all`
- `google._domainkey.aiautotech.co.za`: no TXT (NXDOMAIN / empty)
- `_dmarc.aiautotech.co.za`: no TXT

Leave MX and SPF as they are. The previous phone checklist is [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md) (Phone-first unblock, step 13). The From checklist is [`docs/phone-willem-send-from.md`](phone-willem-send-from.md) (step 12).

Writing this page does not edit DNS, does not send, and does not apply SQL. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `Willem@aiautotech.co.za` | The only From for AI AutoTech business email, and the starter DMARC `rua`. |
| `billyfaber06@gmail.com` | Agency owner login. Never a From, a reply-to, a test sender, or a DMARC `rua`. |
| `billy@aiautotech.co.za` | Old example. Do not use it. |

## Stop until these are true

1. You will read MX before any Save. When the phone lookup is Amazon SES, you will stop and open the MX page. You will not add DKIM or DMARC on top of an SES MX.
2. You will open the zone `aiautotech.co.za` (no hyphen). If the only domain in the account is `ai-autotech.co.za`, stop.
3. You will copy the DKIM host and TXT from Google Admin. You will not type a key from memory. You will not paste that value into git, a pull request, chat, or this file.
4. You will wait for Billy’s yes on this call before each DNS Save. A yes to read is not a yes to write.
5. You will not send. `sending_enabled` stays false until a separate yes.

If any check is false, stop.

## 1. Confirm MX is still Google (read only)

On the phone, open https://www.whatsmydns.net/#MX/aiautotech.co.za

Google: the host is `smtp.google.com` (priority 1), or another host that contains `google.com` or `googlemail.com`. Continue at section 2. Leave the MX row. An SES-to-Google switch is not this page. The 3 Oct 2026 lookup was already `1 smtp.google.com.`

Amazon SES: the host contains `amazonaws.com`. Stop. Open [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md). Do not add a TXT on this visit.

Other, or the public lookup and GoDaddy disagree: write the host down and stop.

## 2. Open Authenticate email (read only)

On the phone:

1. Open https://admin.google.com/ac/apps/gmail/authenticateemail
2. Sign in as the Google Workspace admin for `aiautotech.co.za`.
3. Stop when the account is `billyfaber06@gmail.com`.
4. When a domain list is shown, choose `aiautotech.co.za` (no hyphen).
5. Write down the status and the DNS host name (the selector). Leave **Generate new record** and **Start authentication** closed.

When the direct link misses, use the menu: Apps → Google Workspace → Gmail → Authenticate email.

## 3. Read the TXT names (read only)

On the phone:

1. Open https://www.whatsmydns.net/#TXT/google._domainkey.aiautotech.co.za
2. Open https://www.whatsmydns.net/#TXT/_dmarc.aiautotech.co.za
3. When section 2 showed a selector other than `google`, also open `https://www.whatsmydns.net/#TXT/<selector>._domainkey.aiautotech.co.za`
4. To compare with the registrar, open GoDaddy → My Products → Domains → `aiautotech.co.za` → DNS. Read the TXT rows. Leave Add, Edit, and Delete closed.

Write two lines: DKIM missing or present, and DMARC missing or the exact TXT. The 3 Oct 2026 lookup found neither TXT.

## 4. DKIM TXT — only after Billy says yes

Stop on the read-only screens until Billy says yes to the DKIM TXT on this call, while he is watching. A note that DKIM is missing is not that yes.

When he says yes:

1. Stay on Authenticate email for `aiautotech.co.za`.
2. When a DKIM record is already shown, keep that selector. Copy its host name and TXT value. Do not tap **Generate new record** again.
3. When no record is shown, tap **Generate new record**. If Admin asks for a selector prefix, use `google`. If Admin asks for a key length, leave the choice already on the screen.
4. Copy the DNS host name and the TXT value from Admin. The value starts with `v=DKIM1`. Do not invent a `p=` string.
5. GoDaddy → the same zone → DNS → Add. One row:
   - Type: TXT
   - Name: the host Admin shows, without `.aiautotech.co.za`. When the selector is `google`, the name is `google._domainkey`.
   - Value: the TXT copied from Admin, as one value.
   - TTL: leave the GoDaddy default.
6. Save that row. Leave MX, the apex SPF TXT, `@`, `www`, `crm`, and nameservers alone.
7. When a TXT already exists at that host, do not add a second one. Write the existing value down and stop.

**Start authentication** waits for section 6. That click is still this yes. It does not send mail.

## 5. DMARC TXT — only after Billy says yes

A yes for DKIM is not a yes for DMARC. Stop until Billy says yes to the DMARC TXT on this call.

When he says yes:

1. GoDaddy → the same zone → DNS → Add. One row:
   - Type: TXT
   - Name: `_dmarc`
   - Value: `v=DMARC1; p=none; rua=mailto:Willem@aiautotech.co.za`
   - TTL: leave the GoDaddy default.
2. `p=none` is monitor-only. Receivers may send reports to the `rua`. They are not asked to quarantine or reject. Leave `p=none` until Billy says tighten on a later call.
3. When he names a different report address on this call, put that address in `rua`. Keep `billyfaber06@gmail.com` out of `rua`.
4. Save that row. When a `_dmarc` TXT already exists, do not add a second one. Write the existing value down and stop.

## 6. Verify with a phone DNS lookup

On the phone:

1. Open the DKIM TXT lookup again. When the selector is `google`: https://www.whatsmydns.net/#TXT/google._domainkey.aiautotech.co.za
2. Open https://www.whatsmydns.net/#TXT/_dmarc.aiautotech.co.za

DKIM pass: a TXT is present and starts with `v=DKIM1`.

DMARC pass: the TXT contains `v=DMARC1` and `p=none`, and the `rua` is `mailto:Willem@aiautotech.co.za` or the address he named on this call.

When a lookup is empty just after Save, wait and check again. Do not add a duplicate row.

Then return to Authenticate email and tap **Start authentication**, only when the DKIM lookup shows the TXT and the section 4 yes is still the one he gave on this call. The status should move to authenticating. That click does not send mail.

## 7. Outbound stays off

`sending_enabled` stays false on every workspace until Billy gives a separate yes. This page is not that yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.

Do not compose, forward, or reply. Do not send a message to prove DKIM. Leave `RESEND_API_KEY`, `RESEND_FROM`, and the SMTP names unset on this visit. Those names are Phone-first unblock, step 5.

When a send is allowed later, the From is `Willem@aiautotech.co.za`. The example line is `AI AutoTech <Willem@aiautotech.co.za>`. `billyfaber06@gmail.com` stays the owner login.

## SES switch is not this step

Leave MX at `smtp.google.com`. Leave SPF at `v=spf1 include:_spf.google.com ~all`. Do not add a second MX. The SES-to-Google fallback lives only on [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md), and only when section 1 of this page wrote Amazon SES.

## Stop rules

- No DNS Save until Billy’s explicit yes for that row, on this call, while he is watching.
- No outbound send. A yes to publish DKIM or DMARC is not a yes to send.
- No SES-to-Google MX edit. MX on 3 Oct 2026 was already Google.
- No second TXT at the same host. No edit to SPF, MX, `@`, `www`, `crm`, or nameservers. No domain purchase, transfer, or nameserver move. No spend.
- No SQL. Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Steps 20 through 36 stay unapplied.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- `CRON_SECRET` and the outbound channel keys stay unset until Billy says yes. Names are Phone-first unblock, step 5.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still not an `sbp_` token.
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Do not set a Phase 5 flag, PayFast, or `NEXT_PUBLIC_SITE_URL` on this visit.
- Do not paste the DKIM TXT value into git, a pull request, chat, or this file.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Publish the DKIM TXT at the host Admin shows (usually `google._domainkey`), then tap **Start authentication** after the phone lookup shows `v=DKIM1`.
- Publish the monitor-only DMARC TXT at `_dmarc`: `v=DMARC1; p=none; rua=mailto:Willem@aiautotech.co.za`, or his preferred `rua` on this call.
- Tighten DMARC later (`p=quarantine` or `p=reject`). This page leaves `p=none`.
- One outbound message, and turning `sending_enabled` on. The later gate is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). A yes to publish DKIM or DMARC is not that yes. The From is `Willem@aiautotech.co.za`. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Save the email channel names. Those stay on step 5.

## Pass means

Either DNS is unchanged because Billy had not said yes, or he said yes and the phone lookup shows the DKIM TXT plus the monitor-only DMARC TXT. MX is still Google (`smtp.google.com`). SPF is still the Google include line. Nothing was sent. `sending_enabled` is still false. Personal Gmail was not used.

A pass does not mean email is live, tracker item 6 is complete, DMARC is enforcing, or SQL steps 20 through 36 are applied.
