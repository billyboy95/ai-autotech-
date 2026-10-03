# Phone checklist: `NEXT_PUBLIC_SITE_URL`

Billy confirms the Vercel Production value of `NEXT_PUBLIC_SITE_URL` is the public website `https://aiautotech.co.za` (no hyphen). If the host still has a hyphen (`ai-autotech.co.za`), he changes that Production value. This page does not log in as an agent, does not set the variable from the repo, and does not redeploy.

Writing this page does not apply SQL, does not edit DNS, does not buy a domain, and does not spend. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `sending_enabled` stays false. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

## Which host is which

| Host | Role on this visit |
| --- | --- |
| `https://aiautotech.co.za` | Public website. This is the Production value for `NEXT_PUBLIC_SITE_URL`. `www.aiautotech.co.za` is the same site. The example uses the apex, without `www`. |
| `https://ai-autotech.co.za` | Wrong host. The hyphen is not the public website. Change a Production value that uses this host. |
| `https://ai-autotech-crm.vercel.app` | Live CRM app. Leave this hostname on the project. Do not store it in `NEXT_PUBLIC_SITE_URL`. Smoke and cron stay here. See [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md) and [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). |
| `https://crm.aiautotech.co.za` | Planned CRM custom host. Docs only until Billy attaches DNS. Do not store it in `NEXT_PUBLIC_SITE_URL`. The attach checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md). That page does not change this variable. |

`.env.example` uses `NEXT_PUBLIC_SITE_URL=https://aiautotech.co.za`. Open Graph on the CRM app is the same apex in `src/app/layout.tsx`. That card does not read the environment variable.

## What the variable prefixes

When Production has `https://aiautotech.co.za`, the app prints that origin on:

- Referral share links (`/audit?ref=...`), including WhatsApp, Facebook, X, and LinkedIn share URLs built from that link.
- Review copy links (`/r/...`).
- Booking copy links (`/book/...`).
- Social tracked clicks (`/api/public/go`). If the name is unset, those clicks stay on `https://ai-autotech-crm.vercel.app`.
- A relative public redirect such as `/audit`. If the name is unset, that redirect already uses `https://aiautotech.co.za`.

Sign-in follows the host in the browser. It uses `NEXT_PUBLIC_SITE_URL` only when the request has no host. PayFast return URLs also read this name, and only after sandbox billing is turned on. This visit does not turn billing on. `BILLING_SANDBOX` stays unset.

## Stop until these are true

1. You are signed in to the Vercel account that owns project `ai-autotech-crm`.
2. You will edit Environment Variables only. You will not open Domains, and you will not open GoDaddy.
3. You will not paste a secret value into git, a pull request, chat, or this file. `NEXT_PUBLIC_SITE_URL` is a public origin. It is not a key.

If any check is false, stop.

## 1. Read the Production value

On the phone:

1. Open Vercel and the project `ai-autotech-crm`.
2. Open Settings. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row.
3. Open Environment Variables.
4. Find `NEXT_PUBLIC_SITE_URL`. Read the Production row. Ignore a Preview-only row for the pass below.

Pass on that screen: the Production value is `https://aiautotech.co.za`. No hyphen. No path. `https` only. A single trailing slash is stripped by the app. Prefer the value with no slash so the row matches `.env.example`.

Stop and use section 2 when the Production host is any of these:

- `ai-autotech.co.za` or `www.ai-autotech.co.za` (hyphen)
- `http://` instead of `https://`
- `ai-autotech-crm.vercel.app`
- `crm.aiautotech.co.za`
- `www.aiautotech.co.za` (real site, but this checklist uses the apex)

If the name is missing on Production, the hyphen is not set. Absolute booking and review links stay path-only until the name exists. Add it in section 2.

A saved variable is read on the next Production deployment. `NEXT_PUBLIC_*` is baked in at build. This checklist does not ask for a redeploy. Saving does not apply SQL, does not send, and does not spend.

## 2. Change only the public website host

Do this when section 1 did not pass.

1. Stay on Vercel → `ai-autotech-crm` → Settings → Environment Variables.
2. Edit the Production value of `NEXT_PUBLIC_SITE_URL`. If the name is missing, add it for Production.
3. Set the value to `https://aiautotech.co.za`.
4. Leave Preview unchanged unless you want Preview to use the same origin. A yes for Production is not a yes for Preview.
5. Save.

Do not change these on this visit:

- `NEXT_PUBLIC_CALENDLY_URL`. A path such as `calendly.com/ai-autotech/discovery` is a Calendly slug. It is not the website host.
- `NEXT_PUBLIC_SUPABASE_URL`. That is the Supabase project.
- `OWNER_EMAILS`, `CRON_SECRET`, channel keys, PayFast names, and every Phase 5 flag. Those stay in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Phone-first unblock).

If some other Production value uses the host `ai-autotech.co.za` (hyphen in the website host), replace only that host with `aiautotech.co.za`. Leave every other host as it is.

## 3. Confirm the public site in the browser

In a private tab:

1. Open `https://aiautotech.co.za`. Pass: the public website loads. You do not need to sign in.
2. Do not use `https://ai-autotech.co.za` as the website. A hyphen in that host is the mistake this page corrects.
3. CRM login stays `https://ai-autotech-crm.vercel.app/login` until [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md) shows SSL Ready. This page does not move login.

Do not tap **Apply Education pack to EASTC**, **Apply Zentrix pack to Zentrix Online**, **Send now**, **Go live**, **Publish**, or **Post now**.

## Stop rules

- No DNS edits. No domain purchase, transfer, or nameserver move. No spend.
- Do not put `https://crm.aiautotech.co.za` or `https://ai-autotech-crm.vercel.app` into `NEXT_PUBLIC_SITE_URL`.
- Do not touch SQL steps 20 through 36. Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Steps 20 through 36 stay unapplied. Do not claim they are applied.
- `sending_enabled` stays false on every workspace.
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Do not set a Phase 5 flag, `CRON_SECRET`, a channel key, PayFast, or `OWNER_EMAILS` on this visit.
- No new command-centre panel. This page does not redeploy.

## Pass means

Vercel Production `NEXT_PUBLIC_SITE_URL` is `https://aiautotech.co.za`. The public website opens at that origin. The CRM app hostname is still `https://ai-autotech-crm.vercel.app`.

A pass does not mean SQL steps 20 through 36 are applied, a flag is on, a pack was clicked, DNS for `crm.aiautotech.co.za` is attached, or sending is on.
