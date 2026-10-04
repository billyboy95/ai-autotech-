# Phone checklist: PayFast sandbox and billing readiness

Billy prepares sandbox billing names so `/command-centre/billing` can use a PayFast sandbox checkout later. This page is Phone-first unblock, step 6 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). It comes after `CRON_SECRET` and the outbound channel keys (step 5). It does not wait on SQL steps 20 through 36.

Writing this page does not save an environment value, does not charge a card, and does not apply SQL. Steps 1 through 19 are already live (27 Sep 2026), including step 13 (`phase2f_billing`). Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token and does not replace it. `sending_enabled` stays false. Gated Phase 5 command-centre panels stay paused. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The project ref is `fnysxlswzufdnlbhndxc`. The CRM project on Vercel is `ai-autotech-crm`. The only PayFast site on this visit is https://sandbox.payfast.co.za . Leave the live PayFast site closed.

Business email From stays `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m). `billyfaber06@gmail.com` is the agency owner login. It is never the From. This page does not send.

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `Willem@aiautotech.co.za` | The only From for AI AutoTech business email. Not used on this page. Do not send. |
| `billyfaber06@gmail.com` | Agency owner login. `OWNER_EMAILS` on step 4. Never a From. |
| `billy@aiautotech.co.za` | Old example. Do not use it. |

## Stop until these are true

1. You will open the PayFast sandbox only: https://sandbox.payfast.co.za . If the address bar does not start with that host, close the tab. You will not open the live PayFast site.
2. You will not create a PayFast account, a sandbox merchant, or a live merchant on this visit. If there is no sandbox login, stop.
3. You will store the merchant key, the Salt Passphrase, and the `service_role` secret in a password manager first. You will not paste them into git, a pull request, chat, an issue, or this file.
4. You will leave every billing name unset until Billy says yes to sandbox billing. A yes for `CRON_SECRET` or a channel key is not a yes for sandbox billing. A yes for one billing name is not a yes for the others.
5. A yes for sandbox billing is not a yes for live charges. You will not put a live merchant id, a live merchant key, or a live passphrase in the environment.
6. You will not charge a card, submit the PayFast form, turn `sending_enabled` on, apply SQL steps 20 through 36, click the Education pack or the Zentrix pack, or merge the website pull requests.

If any check is false, stop.

## Names on this page

Document only. The two literals below are the only values written in this file. The other three values stay in the password manager.

| Name | What to store, after his yes to that name |
| --- | --- |
| `BILLING_SANDBOX` | The string `true`. Not a key. Checkout stays closed unless this name is that string. The line `BILLING_SANDBOX=false` in [`.env.example`](../.env.example) is an example. It is not the live Vercel value. |
| `PAYFAST_MERCHANT_ID` | `10000100`. That is PayFast’s published sandbox merchant id. It is the only id the app accepts. Any other id is refused. |
| `PAYFAST_MERCHANT_KEY` | The sandbox merchant key from the password manager. It is not written in this file. It is not `10000100`. |
| `PAYFAST_PASSPHRASE` | The sandbox Salt Passphrase from the password manager. It has to match sandbox Settings. It is not written in this file. |
| `SUPABASE_SERVICE_ROLE_KEY` | The legacy `service_role` secret from Supabase → Project Settings → API Keys. The ITN webhook `/api/webhooks/payfast` calls `apply_billing_event` with this key. Without it, the ITN is not stored. It is not written in this file. |

Leave `BILLING_ALLOW_MOCK_ITN` unset. On a production deploy the mock ITN control stays off unless that name is the string `true`. This page does not set it.

`SUPABASE_SERVICE_ROLE_KEY` is not `SUPABASE_ACCESS_TOKEN`. The access token, when Billy replaces the chat note, starts with `sbp_`. A `service_role` secret is a different value. Do not put one into the other’s name.

## 1. Open the PayFast sandbox only

On the phone:

1. Open https://sandbox.payfast.co.za
2. Read the address bar. It has to start with `https://sandbox.payfast.co.za`.
3. Sign in to the sandbox account that already exists.

Stop, and close the tab, when any of these are true:

- The host is not `sandbox.payfast.co.za`. That includes the live PayFast site. Do not sign in there. Do not create a live merchant.
- The screen asks you to create an account. This page does not create one.
- The screen asks for a card, a bank account, or a payout. Close that screen.

Do not open `https://sandbox.payfast.co.za/eng/process`. The app posts a checkout form to that sandbox path later, and only when `BILLING_SANDBOX` is the string `true` and the merchant id is `10000100`. A live PayFast host is refused. This visit does not open that path and does not submit the form.

## 2. Merchant id and merchant key

On the sandbox dashboard, open Account → Personal Information, or Settings → Integrations → Merchant Identifiers.

1. Read the merchant id on that screen.
2. When it is `10000100`, continue. That is the only id this checklist will put in `PAYFAST_MERCHANT_ID`.
3. When it is any other id, leave that id out of Vercel. Do not type it. Do not invent `10000100` on an account that shows a different id. Stop and tell Billy what you saw was not `10000100`. Do not read the other id into chat.
4. Copy the merchant key that belongs to sandbox merchant `10000100` into the password manager, under the label `PAYFAST_MERCHANT_KEY`. Use the copy control on that screen when it is there.
5. Close the key. Do not screenshot it into chat, git, or this file.

A copied key is not a yes to save it on Vercel, and it is not a yes to charge.

## 3. Salt Passphrase

Subscription checkout signs with `PAYFAST_PASSPHRASE`. The salt on the sandbox account and the env value have to be the same.

On the phone, stay on https://sandbox.payfast.co.za :

1. Open Settings.
2. Open Salt Passphrase. Read it. Do not read it aloud into chat.
3. When a salt is already set, copy that value into the password manager under `PAYFAST_PASSPHRASE`. Do not invent a second passphrase. Do not use a live PayFast passphrase.
4. When the salt is empty, stop. Set one on the sandbox account only when Billy says yes on this call to set a sandbox Salt Passphrase. A yes for sandbox billing names on Vercel is not that yes unless he included the salt in the same breath.

When he says yes to set an empty salt:

1. Set one salt on the sandbox account. Keep that same value.
2. Copy it into the password manager under `PAYFAST_PASSPHRASE`.
3. Do not type a second, different passphrase into Vercel.

Setting the salt does not charge a card and does not submit a payment form.

## 4. `SUPABASE_SERVICE_ROLE_KEY`

This is the server key the PayFast ITN webhook uses. `/api/webhooks/payfast` calls `apply_billing_event` with the service role. This page does not call that webhook and does not send an ITN.

On the phone:

1. Open Supabase → project `fnysxlswzufdnlbhndxc` → Project Settings → API Keys: https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/settings/api-keys
2. This is not Account → Access Tokens. A Personal Access Token (`sbp_`) does not belong in this name. The replace checklist for `SUPABASE_ACCESS_TOKEN` is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). The value on the ops box is still a chat note. This page does not replace it.
3. Reveal the legacy `service_role` secret. Copy it once into the password manager under `SUPABASE_SERVICE_ROLE_KEY`.
4. Do not copy the `anon` key. Do not copy a publishable key.
5. Close the reveal. Do not screenshot it into chat, git, or this file.

This checklist does not create the Auth user `billyfaber06@gmail.com` and does not run `supabase/owner-bootstrap.sql`. Owner auto-attach also reads this name. That work stays on step 4.

## 5. Vercel Production, one name at a time

Leave every name unset until Billy says yes to sandbox billing. Then set one name at a time, and only after he says yes to that name. A yes for `CRON_SECRET`, WhatsApp, Meta, Resend, or SMTP is not a yes for sandbox billing. A yes for sandbox billing is not a yes for live charges.

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row. Choose Production.

Add Preview only when he says yes to Preview. Mark the row Sensitive so the phone does not keep the value on screen after save.

When he says yes to a name, set that one value:

| Name | Production value |
| --- | --- |
| `BILLING_SANDBOX` | The string `true` |
| `PAYFAST_MERCHANT_ID` | `10000100` |
| `PAYFAST_MERCHANT_KEY` | Paste from the password manager at the moment you save. Not in this file. |
| `PAYFAST_PASSPHRASE` | The sandbox Salt Passphrase from the password manager. It matches sandbox Settings. Not in this file. |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role` secret from the password manager. Not in this file. |

After each save, do not paste the value into git, a pull request, chat, an issue, or this file.

Leave `BILLING_ALLOW_MOCK_ITN` unset. Do not type a live merchant id, a live merchant key, or a live passphrase. If a row already holds something other than `10000100` for `PAYFAST_MERCHANT_ID`, stop. Do not overwrite it with a live id. Replace it with `10000100` only when Billy says yes to that name and section 2 showed sandbox merchant `10000100`.

Do not change `NEXT_PUBLIC_SITE_URL` on this visit. PayFast return URLs read that name only after sandbox billing is on. The phone checklist is [`docs/phone-site-url-verify.md`](phone-site-url-verify.md).

Saving a name does not charge, does not send, and does not turn `sending_enabled` on. `sending_enabled` stays false on every workspace. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A saved variable is read on the next deployment. This page does not ask for a redeploy.

This page does not open `/command-centre/billing`. It does not press Prepare PayFast sandbox checkout. It does not register the billing cron. It does not call PayFast, Paystack, or Yoco. There is no Paystack env name and no Yoco env name on this checklist.

## 6. Refuse

This visit refuses all of the following. A yes for a sandbox billing name is not a yes for any line here.

- Charging a card. No live PayFast charge. No sandbox card payment.
- Submitting the PayFast form, including Pay, Buy, Subscribe, or the sandbox process page.
- Opening live PayFast. The only site is https://sandbox.payfast.co.za .
- Turning `sending_enabled` on. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. No real send.
- Applying SQL steps 20 through 36. Do not paste those files. Do not invent Success. Do not invent `Success. No rows returned` or `Success. Steps 20–36 applied.`
- Clicking Apply Education pack or the Zentrix pack. No ad spend.
- Merging [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). They stay open until Billy says yes to publish. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Putting a live merchant id, a live merchant key, or a live passphrase in the environment.
- Setting `BILLING_ALLOW_MOCK_ITN`.

## 7. Still blocked

These stay blocked after a pass on this page:

- Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Do not paste them again. Steps 20 through 36 stay unapplied. Do not claim this SQL is already applied. The headers Already live and Unapplied stay as they are.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note, not an `sbp_` token, until Billy replaces it. The checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). This page does not paste a token.
- Gated Phase 5 command-centre panels stay paused. Do not set a Phase 5 flag.
- `sending_enabled` stays false. No real send. No ad spend. No live charge. When he later says yes to real outbound for one named workspace, the gate is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). A yes for sandbox billing is not that yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Website pull requests [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open.

## 8. Next checklist

The next phone checklist is [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md) (Phone-first unblock, step 7 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md)): paste steps 20 through 36 in the Supabase SQL editor. The editor is https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new . This page does not open it and does not paste SQL.

`scripts/apply-pending-migrations.mjs` still cannot run until `SUPABASE_ACCESS_TOKEN` is a real `sbp_` token. While that value is a chat note, [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md) is the fallback, and it sends you to that same SQL editor. Step 7 does not claim those steps are already applied. Do not invent Success.

## Stop rules

- No card. No PayFast form. No live PayFast site. No live charge.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- No SQL. Steps 20 through 36 stay unapplied. Do not invent Success.
- `SUPABASE_ACCESS_TOKEN` stays a chat note until Billy replaces it with an `sbp_` token. Do not put the `service_role` secret in that name.
- Gated Phase 5 command-centre panels stay paused. Do not click a pack.
- Do not paste a merchant key, a passphrase, a service-role value, a token, or a password into git, a pull request, chat, an issue, or this file.
- Leave `BILLING_ALLOW_MOCK_ITN` unset.
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish.
- From stays `Willem@aiautotech.co.za`. Do not send from personal Gmail.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Sandbox billing, before any of the five names.
- Each name, one yes per name: `BILLING_SANDBOX`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `SUPABASE_SERVICE_ROLE_KEY`.
- Set a sandbox Salt Passphrase when Settings shows the salt empty.
- Preview, only if he says yes to Preview.
- Live charges. That yes is separate, and it is not this page.
- Turn `sending_enabled` on. That yes is separate. The later gate is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). A yes for sandbox billing is not that yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Apply SQL steps 20 through 36. They stay unapplied. The token on the box is still a chat note.
- Merge the website pull requests, spend, or post.

## Pass means

You opened https://sandbox.payfast.co.za , or you stopped because the sandbox login was missing. The merchant key and the Salt Passphrase are in the password manager, or you stopped before copying them because he had not said yes. The `service_role` secret is in the password manager, or you left `SUPABASE_SERVICE_ROLE_KEY` unset. Each Vercel Production name is still unset, or it is set only for a name he approved on this call, marked Sensitive. `BILLING_SANDBOX`, when set, is the string `true`. `PAYFAST_MERCHANT_ID`, when set, is `10000100`. `BILLING_ALLOW_MOCK_ITN` is still unset. Nothing was charged. The PayFast form was not submitted. Live PayFast stayed closed. `sending_enabled` is still false. Steps 20 through 36 are still unapplied. Gated Phase 5 command-centre panels are still paused. `SUPABASE_ACCESS_TOKEN` is still not an `sbp_` token.

A pass does not mean a card was charged, a checkout was submitted, live PayFast is on, or SQL steps 20 through 36 are applied.
