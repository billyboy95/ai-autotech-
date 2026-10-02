# Phone checklist: attach `crm.aiautotech.co.za`

Billy adds the CRM hostname on Vercel Production, then confirms the matching DNS record at GoDaddy. This page does not log in, does not edit DNS, does not buy a domain, and does not spend.

Writing this page does not apply SQL, does not set an environment variable, and does not redeploy. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

## Which hostname

Use `crm.aiautotech.co.za`.

That is the CRM brand host. Overnight checks sometimes find it unreachable while `https://ai-autotech-crm.vercel.app` still loads. The Vercel project name in this repo is `ai-autotech-crm`. Client preview hosts in the repo use the same shape (`crm.eastc.test`, `crm.zentrix.test` in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md), White-label host). Those two names are local stubs. They are not this production host.

What the repo already names, and what this page leaves alone:

| Name | Role |
| --- | --- |
| `ai-autotech-crm.vercel.app` | Live app hostname. Logged-out smoke stays here until the SSL check below passes. See [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). Cron job URLs stay on this host. See [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). |
| `aiautotech.co.za` and `www.aiautotech.co.za` | Public website zone. `src/lib/brand/host.ts` treats both as platform hosts. DNS for this checklist is a `crm` record in that zone. Do not add the apex or `www` to the CRM project. |
| `NEXT_PUBLIC_SITE_URL=https://ai-autotech.co.za` | Public-link example in `.env.example` (hyphen in `ai-autotech`). It is not the CRM login host. Do not change that variable on this visit. |

Add only `crm.aiautotech.co.za`. Production only.

## Stop until these are true

1. You are signed in to the Vercel account that owns project `ai-autotech-crm`.
2. You can open GoDaddy for the domain `aiautotech.co.za` (no hyphen). If the only domain in the account is the hyphenated `ai-autotech.co.za`, stop. Do not create a record on the wrong zone.
3. You will copy the DNS value from the Vercel card. You will not type an IP from memory.

If any check is false, stop.

## 1. Vercel: add the hostname to Production

On the phone:

1. Open Vercel and the project `ai-autotech-crm`.
2. Open Settings. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row.
3. Open Domains.
4. In the add field, type `crm.aiautotech.co.za`. Tap Add.
5. When Vercel asks for an environment, choose Production. Leave Preview off.
6. If Vercel offers to add `aiautotech.co.za`, `www.aiautotech.co.za`, `www.crm.aiautotech.co.za`, or a redirect from another host, decline. This visit adds one hostname.
7. If Vercel offers to buy the domain, transfer it, or switch the nameservers to Vercel, stop. Close that offer. Nameservers stay where they are.

Leave the new domain row on screen. The DNS card under it is the record you will copy. A saved domain row does not apply SQL and does not send.

## 2. DNS at GoDaddy

The agent does not edit this zone. Billy compares or creates one record.

1. Open GoDaddy → My Products → Domains → `aiautotech.co.za` → DNS.
2. Read the existing rows before you add one. Look for a row whose name is `crm`.
3. Read the Vercel DNS card for `crm.aiautotech.co.za`. Copy its type, name, and value. The card is the source. If the card and this page disagree, follow the card.

For this subdomain the card is a CNAME unless Vercel prints A.

| Vercel card | GoDaddy field |
| --- | --- |
| Type `CNAME` | Type `CNAME`. Do not also add an A record for `crm`. |
| Type `A` | Type `A`. Paste the IP from the card. Do not also add a CNAME for `crm`. Do not type an IP from memory. |
| Name `crm` or `crm.aiautotech.co.za` | Name `crm`. GoDaddy appends `aiautotech.co.za`. |
| Value | Paste the value from the card. A CNAME value is a hostname. Vercel often shows `cname.vercel-dns.com`. If the card shows a different hostname, paste that hostname. |

TTL: leave GoDaddy’s default.

If a `crm` row is already present and its type and value already match the card, do not add a second row.

If a `crm` row is present and does not match the card, edit that one row so type and value match the card. Leave every other row. Do not delete or edit `@`, `www`, MX, or TXT.

If GoDaddy rejects a CNAME value that ends with a dot, remove only that trailing dot and save again.

Do not turn on forwarding, parking, or a website builder for `crm`. Do not change nameservers.

After Save, return to Vercel → Settings → Domains and refresh. Propagation can take a few minutes. Wait and refresh. Do not add a second `crm` record while you wait.

## 3. SSL Ready, then the two HTTP checks

Stay on Vercel → the CRM project `ai-autotech-crm` → Settings → Domains.

Pass on that screen:

- The row `crm.aiautotech.co.za` shows a valid configuration.
- The certificate line is ready. The screen may say the certificate is ready, or show a lock next to the hostname. Refresh until it does. A few minutes after DNS matches is normal.

Stop on that screen:

- The row still says the configuration is invalid. The `crm` record does not match the card yet. Do not buy a certificate.
- Vercel asks you to pay, move nameservers, or add another hostname. Decline.

Then, in a private browser tab, stay logged out.

1. Open `https://crm.aiautotech.co.za/login`.
   Pass: the address bar shows a lock, the sign-in page is on screen, and you are not signed in. That is HTTP 200.
2. Open `https://crm.aiautotech.co.za/command-centre`.
   Pass: the address bar ends on `/login?next=%2Fcommand-centre`. You see the sign-in page. You do not see the command centre. A phone browser follows the redirect, so the address bar will not show the number 307. A check that does not follow redirects reports **307** and a `Location` whose path is `/login` with that `next`. That is the same auth gate as `https://ai-autotech-crm.vercel.app`.

Opening `https://crm.aiautotech.co.za/` can also land on `/login`. The host is not the public marketing site. The two checks above are the ones that decide this visit.

If `crm.aiautotech.co.za` does not load, open `https://ai-autotech-crm.vercel.app/login` in the same private tab.

- Vercel hostname loads and the custom host does not: the app is up. The miss is DNS or SSL for `crm`. Stay on sections 2 and 3. Do not change SQL, flags, or website pull requests.
- Both hosts fail: stop. Do not edit DNS a second time on this visit. Do not apply SQL to “fix” it.

Do not sign in to finish the redirect. Do not tap **Apply Education pack to EASTC**, **Apply Zentrix pack to Zentrix Online**, **Send now**, **Go live**, **Publish**, or **Post now**.

## 4. After both checks pass

These are not required for the 200 and 307 checks. Do them only after SSL is ready and both URLs above passed.

1. Supabase → project `fnysxlswzufdnlbhndxc` → Authentication → URL Configuration: https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/auth/url-configuration
   Add `https://crm.aiautotech.co.za/auth/callback` to Redirect URLs. Leave every existing callback in the list, including one for `https://ai-autotech-crm.vercel.app/auth/callback` if it is already there. Do not delete a callback on this visit. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) (Owner login) already asks for `https://<your-host>/auth/callback`.
2. Leave `organizations.custom_domain` unset from this page. Do not paste SQL. Do not open workspace settings to save a domain. Login and the 307 gate use the `Host` header. They do not need that write. The white-label note in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) is a later step.
3. Leave cron URLs on `https://ai-autotech-crm.vercel.app`. Do not rewrite them to `crm.aiautotech.co.za`. The schedule paste is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md).

## Stop rules

- No DNS edits by the agent. Billy is the only person who saves the GoDaddy row.
- No domain purchase, transfer, or nameserver move. No spend.
- Do not touch SQL steps 20 through 36. Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Steps 20 through 36 stay unapplied. Do not claim they are applied.
- `sending_enabled` stays false on every workspace.
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Do not set a Phase 5 flag, `CRON_SECRET`, a channel key, PayFast, or `OWNER_EMAILS` on this visit. Those checklists stay in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Phone-first unblock).
- Do not change `NEXT_PUBLIC_SITE_URL`.
- No new command-centre panel.

## Pass means

Vercel shows `crm.aiautotech.co.za` on Production with a valid configuration and a ready certificate. `https://crm.aiautotech.co.za/login` is the sign-in page (200). Logged-out `https://crm.aiautotech.co.za/command-centre` ends on `/login?next=%2Fcommand-centre` (307 when the redirect is not followed).

A pass does not mean SQL steps 20 through 36 are applied, a flag is on, a pack was clicked, or sending is on.
