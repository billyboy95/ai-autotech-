# Go-live runbook

Phase 5 gated command-centre panels stay paused until production SQL steps 20 through 36 are applied. The blocker is the secret named `SUPABASE_ACCESS_TOKEN` on Billy's box and in Vercel. The stored value is a chat note. A Personal Access Token starts with `sbp_`, so `scripts/apply-pending-migrations.mjs` cannot apply SQL until that secret is replaced. This page does not contain a token, a database URL, a cron secret, a channel key, or a PayFast key. It does not turn sending on.

The only safe file order is the numbered list in `supabase/APPLY-ORDER.md`. Steps 20 through 36 are still unapplied. Do not claim this SQL is already applied. Do not sort the migrations folder by filename.

Steps 20 through 36 expect steps 1 through 19 to already be on the database. Those earlier files were applied in production on 27 Sep 2026. They are under Already live in `supabase/APPLY-ORDER.md`. Do not treat steps 1 through 19 as unapplied. Step 36 raises if phase 2a access is missing. If a file in steps 20 through 36 errors because a step 1 through 19 function or table is missing, stop. Do not skip ahead. Resume at the file that failed after that earlier object is present.

## Phone-first unblock

Do these in order. Each step can be started from a phone. The apply command runs on the box, in this repo, after `SUPABASE_ACCESS_TOKEN` in that shell is a real `sbp_` token. While that value is still a chat note, Phone-first unblock step 7 is the SQL editor path. It does not need the token. After step 7 (or the CLI in step 2) has shown success for every file from 20 through 36, step 8 is the pack click order: schema reload, then the Education pack, then the Zentrix pack. This page does not click either pack. Packs are not applied. Do not paste the token into git, a pull request, chat, or this file.

Owner Auth bootstrap does not wait on that SQL and does not wait on a real `sbp_` token. The phone checklist is [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md) (step 4 below). The only `OWNER_EMAILS` address is `billyfaber06@gmail.com`. When that name is unset or blank, the app already uses it. Confirming the Auth user, or saving that name after Billy says yes, does not apply SQL, does not unpause gated Phase 5 command-centre panels, does not send, and does not spend. Do not paste `supabase/owner-bootstrap.sql` on that visit. Steps 20 through 36 stay unapplied.

Attaching `crm.aiautotech.co.za` does not wait on that SQL. The phone checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md) (step 10 below). This page does not edit DNS.

Confirming the public website value of `NEXT_PUBLIC_SITE_URL` does not wait on that SQL. The phone checklist is [`docs/phone-site-url-verify.md`](phone-site-url-verify.md) (step 11 below). Production should be `https://aiautotech.co.za` (no hyphen). This page does not set that variable.

Confirming business email send-from does not wait on that SQL. The phone checklist is [`docs/phone-willem-send-from.md`](phone-willem-send-from.md) (step 12 below). The From address is `Willem@aiautotech.co.za`. This page does not send and does not change DNS.

Preparing the Google Workspace SMTP App Password, the `SMTP_*` path alternative to Resend, does not wait on that SQL. The phone checklist is [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). The From stays `Willem@aiautotech.co.za`. Each SMTP name waits for Billy’s yes. Saving a name does not send and does not turn `sending_enabled` on. This page does not edit DNS and does not paste the App Password.

Preparing the Resend API key, the Resend path alongside that SMTP page, does not wait on that SQL. The phone checklist is [`docs/phone-resend-willem.md`](phone-resend-willem.md). The From stays `Willem@aiautotech.co.za`. Each Resend name waits for Billy’s yes. Saving a name does not send and does not turn `sending_enabled` on. This page does not edit DNS and does not paste the API key.

Verifying MX for `aiautotech.co.za` does not wait on that SQL. The phone checklist is [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md) (step 13 below). A read-only lookup on 3 Oct 2026 already showed MX `1 smtp.google.com.` and SPF `v=spf1 include:_spf.google.com ~all`. Confirm that on the phone. Switch MX only if a new lookup shows Amazon SES, and only after Billy says yes. This page does not edit DNS and does not send.

Publishing DKIM and a monitor-only DMARC record for `aiautotech.co.za` does not wait on that SQL. The phone checklist is [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (step 14 below). The 3 Oct 2026 lookup found no TXT at `google._domainkey` and no TXT at `_dmarc`. Add each TXT only after Billy says yes on that call. MX is already Google, so this step does not switch MX. `sending_enabled` stays false. This page does not edit DNS and does not send.

### 1. Replace `SUPABASE_ACCESS_TOKEN`

The phone checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). On the phone, create a Personal Access Token at Account → Access Tokens, confirm it starts with `sbp_`, and save it under the name `SUPABASE_ACCESS_TOKEN` on the box and on Vercel. Reject a chat note and a JWT-looking string. Verify with `supabase projects list` or a Management API read of the project list. Dry-run on the box. Pass `--apply` only after that dry-run looks correct and Billy says yes on that call. If there is still no `sbp_` token, that page sends you to step 7. This runbook does not contain a token and does not invent Success.

1. On the phone, open Supabase → Account → Access Tokens: https://supabase.com/dashboard/account/tokens
2. Create a Personal Access Token. A real token starts with `sbp_`. Copy it once into a password manager. Supabase shows it only at creation.
3. Replace the secret named `SUPABASE_ACCESS_TOKEN` in both places that currently hold the chat note:
   - The box environment the apply script reads (the shell export, or the gitignored env file on the box). Unset the old value first. A leftover chat note makes the script exit non-zero and apply nothing, including on a dry-run.
   - Vercel → the CRM project → Settings → Environment Variables → `SUPABASE_ACCESS_TOKEN`. Replace the value and save. Saving it there does not run SQL. This apply does not need a redeploy.
4. Leave the token out of git, pull requests, issues, and docs.

The project ref is `fnysxlswzufdnlbhndxc`, the same ref as `docs/agency-owner-setup.md`.

### 2. Dry-run, then apply steps 20–36

The phone gates for this command are [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md) (step 1). `--apply` waits until that dry-run looks correct and Billy says yes on that call. A file list is not Success.

From the repo root on the box, with the new token already in the environment and the chat note unset:

```bash
export SUPABASE_PROJECT_REF='fnysxlswzufdnlbhndxc'
node scripts/apply-pending-migrations.mjs
```

Dry-run is the default. It lists steps 20 through 36 from `supabase/APPLY-ORDER.md` and sends no SQL. With a real token it prints `Token accepted (sbp_ prefix). The value is not shown.` and `Project ref: fnysxlswzufdnlbhndxc`. It does not print the token.

If the chat note is still set, the script prints `Fail. Need SUPABASE_ACCESS_TOKEN starting with sbp_. The current value is not an sbp_ token. Nothing was applied.` and exits non-zero. Stop. Return to step 1. Do not pass `--apply`.

When the dry-run accepts the token and Billy says yes on that call, apply. Do not pass `--apply` from a file list alone. The script stops on the first failure and prints `Success` or `Fail` for each step:

```bash
export SUPABASE_PROJECT_REF='fnysxlswzufdnlbhndxc'
node scripts/apply-pending-migrations.mjs --apply
```

`--project-ref fnysxlswzufdnlbhndxc` is the same ref. The default transport is the Supabase Management API, `POST /v1/projects/{ref}/database/query`. No database password and no `SUPABASE_DB_URL` are required for this path.

On `Fail step N`, stop. Later steps were not applied. Fix the cause, then resume at that step number (20 through 36):

```bash
node scripts/apply-pending-migrations.mjs --apply --from N
```

A finished run prints `Success. Steps 20–36 applied.`

This script does not turn `sending_enabled` on, does not schedule a cron, and does not call Apply Education pack or the Zentrix pack. While `SUPABASE_ACCESS_TOKEN` is still a chat note, use Phone-first unblock step 7 and paste one file at a time in the SQL editor, in the same order. That fallback is also on [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). If the box is unreachable after the token is a real `sbp_` token, use that same SQL editor path.

### 3. Phone-first: Vercel Environment Variables

Do this on the phone after the `sbp_` token step and the apply of steps 20–36 above. Stay on the Vercel session you already have. Do not sign out between names. Steps 20 through 36 are still unapplied until that apply prints `Success. Steps 20–36 applied.` Saving a variable does not apply SQL, does not send, and does not spend. This page lists names only. Do not paste a secret value into git, a pull request, chat, or this file.

Each name stays unset until Billy says yes to that name. A yes for one name is not a yes for the others.

1. On the phone, open Vercel → the CRM project → Settings → Environment Variables. This is the same screen as the `SUPABASE_ACCESS_TOKEN` row in step 1. Leave that token row as the `sbp_` value from step 1.
2. Add one name at a time. Save it for Production. Add Preview only when Billy says yes to Preview. Mark a secret Sensitive so the phone does not keep the value on screen after save.
3. A saved variable is read on the next deployment. This checklist does not ask for a redeploy, a cron registration, a purchase, or a send.

Owner auto-attach (PR #17). When `OWNER_EMAILS` is unset or blank, the app already uses this address. Set the variable when Billy says yes:

- `OWNER_EMAILS` = `billyfaber06@gmail.com`

Cron routes (`/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, `/api/cron/ai-replies`) read `CRON_SECRET`. Leave it unset until Billy says yes. How he generates and sets it on the phone is Phone-first unblock, step 5. This checklist does not register a cron:

- `CRON_SECRET`

Sandbox billing only. Leave these unset until Billy says yes to sandbox billing. Checkout stays closed unless `BILLING_SANDBOX` is the string `true`. The only merchant id the app accepts is PayFast’s published sandbox merchant `10000100`. Any other id is refused. Leave live PayFast off until Billy says yes to live charges. Do not put a live merchant id in the environment. Do not invent a merchant key, a passphrase, or a service-role key. How he copies them on the phone and sets the names on Vercel is Phone-first unblock, step 6. No charge is sent from this checklist:

- `BILLING_SANDBOX`
- `PAYFAST_MERCHANT_ID` = `10000100`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; owner auto-attach also uses it)

Outbound channel keys are required before a real send. Saving a key leaves `sending_enabled` false. `sending_enabled` stays false on every workspace until Billy says yes. The full name list, including Vault connection names, is Phone-first unblock, step 5:

- Email: `RESEND_API_KEY`, or `SMTP_HOST` with `SMTP_USER` and `SMTP_PASS`
- WhatsApp: `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`
- Meta: `META_PAGE_ACCESS_TOKEN` with `META_PAGE_ID` or `META_IG_USER_ID`
- SMS: one of `SMSPORTAL_CLIENT_ID` plus `SMSPORTAL_API_SECRET`, `BULKSMS_TOKEN_ID` plus `BULKSMS_TOKEN_SECRET`, `CLICKATELL_API_KEY`, or `TWILIO_ACCOUNT_SID` plus `TWILIO_AUTH_TOKEN` plus `TWILIO_FROM_NUMBER`

Phase 5 feature flags stay unset until the SQL step that introduces them has been applied. The names are in section 3 below (Leave flags unset until their SQL is applied). Unset, blank, or any value other than the string `true` keeps that page fixture-only. Setting a flag stores a sandbox note only. It does not apply SQL and it does not send. Gated command-centre panels stay paused until steps 20 through 36 are applied. Also leave `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset.

Website pull requests on `billyboy95/aiautotech` stay open until Billy says yes to publish. Do not merge them from this agent. This checklist does not publish the site:

- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) — Publish week-1 guide topics as on-site resource articles
- [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) — Align public prices with the 27 Sep 2026 AIOS sheet

The phone decision card is [`docs/website-publish-decision.md`](website-publish-decision.md).

### 4. Phone-first: Owner Auth bootstrap

The phone checklist is [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md). This is a phone verification for `OWNER_EMAILS` and the agency owner Auth user. Do it on the phone now. It does not wait on a real `sbp_` token and it does not wait on steps 20 through 36. Confirming the user and the env name does not apply SQL, does not unpause gated Phase 5 command-centre panels, does not send, and does not spend. This page names the address only. Do not paste a password, a token, a key, a passphrase, or a service-role value into git, a pull request, chat, or this file.

The agency owner address is `billyfaber06@gmail.com`. That is the `OWNER_EMAILS` value Billy typed on 27 Sep 2026, and the default in `.env.example`. When `OWNER_EMAILS` is unset or blank, the app already uses this address. Do not invent another email. See `docs/agency-owner-setup.md` and `docs/phase-5m-owner-bootstrap.md`.

#### Auth user

1. On the phone, open Supabase → the project → Authentication → Users: https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/auth/users
   The project ref is `fnysxlswzufdnlbhndxc`.
2. Confirm `billyfaber06@gmail.com` is already in the list. If it is, leave that user as it is. Do not add a second user for the same address.
3. If it is missing, stop. Create the user only when Billy says yes. When he says yes, choose Add user. Use that email. Set the password in the dashboard and keep it in a password manager. Turn on Auto Confirm so sign-in does not wait on a mailbox. This page does not contain a password.
4. A row in Authentication → Users is not a membership by itself. The Auth user has to exist before any owner SQL.

#### `OWNER_EMAILS` on Vercel

Stay on the Vercel session from step 3. Open Vercel → the CRM project → Settings → Environment Variables. Confirm the name only. Do not paste a secret value into git, a pull request, chat, or this file.

1. Look for the name `OWNER_EMAILS` on Production.
2. If the name is present, confirm the Production value is `billyfaber06@gmail.com`. That is the only address this checklist names.
3. If the name is unset or blank, the app already defaults to `billyfaber06@gmail.com`. Leave it unset until Billy says yes. When he says yes, add that one address on Production. Mark it Sensitive if the UI allows. Add Preview only when he says yes to Preview. Do not add a second address. The phone steps are [`docs/phone-owner-auth-bootstrap.md`](phone-owner-auth-bootstrap.md).
4. Saving the name, or leaving it unset, does not apply SQL, does not create the Auth user, and does not send.

#### Do not paste owner SQL yet

`supabase/owner-bootstrap.sql` is the existing manual membership file. It is not a migration. Do not invent another SQL filename. `supabase/APPLY-ORDER.md` (Not part of this apply) says to run it only after steps 20 through 36 have succeeded, and only after the agency owner exists in Supabase Auth. Do not paste `supabase/owner-bootstrap.sql` until both are true. Steps 20 through 36 are still unapplied. Do not claim that SQL is already applied.

When step 2 has printed `Success. Steps 20–36 applied.`, or Phone-first unblock step 7 has run step 36 in the SQL editor without error, and the Auth user `billyfaber06@gmail.com` is in the list:

1. Open the project SQL editor, the same editor as step 7: https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new
2. Paste `supabase/owner-bootstrap.sql` once. It attaches `billyfaber06@gmail.com` as `agency_owner` of the organisation with slug `ai-autotech`. It does not delete anything.
3. If the service role key is missing, first-login auto-attach is skipped and this same file remains the manual path (`supabase/APPLY-ORDER.md`, Owner login without a manual membership insert). This checklist does not set `SUPABASE_SERVICE_ROLE_KEY`.

The panel at `/command-centre/owner` shows that file and does not create the Auth user and does not run that SQL. Leave `OWNER_BOOTSTRAP_UI_ENABLED` unset until step 34 is applied. Step 34 is the existing file `supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql`. It stores a sandbox note. It does not insert into `auth.users` and it does not execute `supabase/owner-bootstrap.sql`. Gated Phase 5 panels stay paused until steps 20 through 36 are applied. Setting a flag does not apply SQL.

This checklist does not apply the Education pack and does not apply the Zentrix pack. No ad spend. `sending_enabled` stays false on every workspace.

After this verification, the next phone checklists stay in this order. This verification does not claim steps 20 through 36 are applied:

- Step 5: `CRON_SECRET` and the outbound channel key names. Leave every name unset until Billy says yes.
- Step 6: PayFast sandbox and billing readiness. Leave those names unset until Billy says yes to sandbox billing. Live PayFast stays off until he says yes to live charges.
- Step 7: the SQL editor paste of steps 20 through 36. Those files are still unapplied.

These still need Billy’s explicit yes before live use. A yes for the Auth user is not a yes for any of them. Do not merge the website pull requests from this agent:

- `CRON_SECRET` (readiness is step 5; leave it unset until Billy says yes)
- Outbound channel keys (email, WhatsApp, SMS, and social), named in step 5. `sending_enabled` stays false until he says yes
- `BILLING_SANDBOX` and the PayFast sandbox names (readiness is step 6; leave them unset until Billy says yes to sandbox billing). Leave live PayFast off until he says yes to live charges. Do not put a live merchant id in the environment.
- Publishing [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5)

### 5. Phone-first: `CRON_SECRET` and outbound channel keys

Do this on the phone after Owner Auth bootstrap (step 4). It is a names checklist. Leave every name unset until Billy says yes to that name. A yes for the Auth user is not a yes for `CRON_SECRET` or for any channel key. A yes for one name is not a yes for the others. Steps 20 through 36 are still unapplied. The secret named `SUPABASE_ACCESS_TOKEN` is still not an `sbp_` token. This checklist does not apply SQL and does not claim that apply is done. Gated Phase 5 command-centre panels stay paused. Saving a name does not send, does not spend, and does not register a cron. `sending_enabled` stays false on every workspace until Billy says yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. This page lists names only. Do not paste a secret value into git, a pull request, chat, or this file.

#### `CRON_SECRET`

The cron routes `/api/cron/automation`, `/api/cron/workflows`, `/api/cron/billing`, and `/api/cron/ai-replies` read the name `CRON_SECRET`. The inbound route `/api/automation/inbound` reads `AUTOMATION_WEBHOOK_SECRET` and, when that name is unset, the same `CRON_SECRET`. This checklist does not set `AUTOMATION_WEBHOOK_SECRET`.

When Billy says yes to the name `CRON_SECRET`:

1. On the phone, generate a new long random password in the password manager. Keep it there. This page does not contain a value. The text `generate-a-long-random-string` in `.env.example` is a placeholder. Do not save that placeholder as the secret.
2. Stay on the Vercel session from step 3. Open Vercel → the CRM project → Settings → Environment Variables.
3. Add the name `CRON_SECRET`. Paste the generated value. Save it for Production. Mark it Sensitive so the phone does not keep the value on screen after save. Add Preview only when Billy says yes to Preview.
4. Leave the value out of git, pull requests, issues, and docs.

A saved variable is read on the next deployment. This checklist does not ask for a redeploy. It does not register a cron. The ops panel lists the job names `automation`, `workflow-engine`, `billing-cycle`, and `ai-reply-drafts` and does not register them. Leave `AI_REPLY_CRON_ENABLED` unset. Leave `OPS_SECRETS_READY_ENABLED` unset until step 35 is applied. Setting `CRON_SECRET` does not turn `sending_enabled` on. `sending_enabled` stays false until Billy says yes. After `CRON_SECRET` is saved on Production, the redeploy and the Supabase schedule paste are [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This step does not run that paste.

#### Outbound channel keys

These are the env names the send path and `scripts/migrate-channel-credentials.mjs` already read, plus the Vault connection names `store_channel_secret` already writes. A real send stays blocked while `sending_enabled` is false, and while `AUTOMATION_SEND_ENABLED` is unset or any value other than the string `true`. This checklist leaves both as they are. `sending_enabled` stays false until Billy says yes. This checklist does not run `scripts/migrate-channel-credentials.mjs` and does not call `store_channel_secret`.

Email:

- `RESEND_API_KEY` and `RESEND_FROM`
- or `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` (`SMTP_PORT` is the port name that path reads)

The phone steps for the Resend path are [`docs/phone-resend-willem.md`](phone-resend-willem.md). On the phone, open Resend, create an API key only after Billy says yes, and store it in a password manager. Read the sending-domain status for `aiautotech.co.za`. Do not write DNS from this repo. Set `RESEND_API_KEY` on the CRM project Production only after he says yes, and confirm `RESEND_FROM` is `AI AutoTech <Willem@aiautotech.co.za>`. Each name waits for his yes. Saving a name does not send and does not turn `sending_enabled` on. Do not paste the API key into git, a pull request, chat, or this file.

The phone steps for that SMTP path are [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). That page is the Google Workspace App Password alternative to Resend, for `Willem@aiautotech.co.za`. Each SMTP name waits for Billy’s yes. Saving a name does not send and does not turn `sending_enabled` on. Do not paste the App Password into git, a pull request, chat, or this file.

The business From checklist is [`docs/phone-willem-send-from.md`](phone-willem-send-from.md) (step 12). The example address is `Willem@aiautotech.co.za`. This step does not set that name and does not send.

Inbound mail for `aiautotech.co.za` is [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md) (step 13). That page verifies Google MX and SPF so `Willem@aiautotech.co.za` can receive. It does not set these channel names, does not turn `sending_enabled` on, and does not send.

DKIM and a monitor-only DMARC record are [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (step 14). That page publishes them only after Billy says yes. It does not set these channel names, does not turn `sending_enabled` on, and does not send. MX is already Google. An SES switch is not part of that page.

WhatsApp:

- `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET` and `WHATSAPP_VERIFY_TOKEN` are copied into the connection secret only when they are already set

SMS, one provider:

- `SMSPORTAL_CLIENT_ID` and `SMSPORTAL_API_SECRET` (`SMSPORTAL_SENDER_ID` and `SMSPORTAL_WEBHOOK_SECRET` when they are set)
- or `BULKSMS_TOKEN_ID` and `BULKSMS_TOKEN_SECRET`, or `BULKSMS_USERNAME` and `BULKSMS_PASSWORD` (`BULKSMS_SENDER_ID` when it is set)
- or `CLICKATELL_API_KEY` (`CLICKATELL_FROM` when it is set)
- or `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`

Social:

- Facebook and Instagram: `META_PAGE_ACCESS_TOKEN` with `META_PAGE_ID` or `META_IG_USER_ID` (`META_APP_SECRET` when it is set)
- LinkedIn: `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN`
- TikTok has no provider env name in this repo. Leave `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED` unset until step 28 is applied. That flag is not a send key.

Vault, from `store_channel_secret` in `supabase/migrations/20261015140000_phase2b_channels_popia.sql` and the providers in `src/app/actions/channels.ts`:

- The Vault secret name is `channel:` plus the connection id. `vault.create_secret` stores it with the description `channel connection`. When Vault is absent, `private.channel_secrets.name` uses that same name.
- Providers already in the app: `resend`, `smtp`, `meta_cloud`, `smsportal`, `bulksms`, `clickatell`, `meta`.
- Channels those providers use: `email`, `whatsapp`, `sms`, `facebook`, `instagram`.
- LinkedIn stays on the env names above. TikTok is not a Vault provider in this repo.

Set a Vercel name the same way as step 3: one name at a time, Production, Sensitive, and only after Billy says yes to that name. A saved key leaves `sending_enabled` false.

This checklist does not apply the Education pack and does not apply the Zentrix pack. No ad spend. Website pull requests [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open. Do not merge them from this agent. The next phone checklist is step 6: PayFast sandbox and billing readiness. Leave those names unset until Billy says yes to sandbox billing. Live PayFast stays off until he says yes to live charges.

### 6. Phone-first: PayFast sandbox and billing readiness

Do this on the phone after `CRON_SECRET` and the outbound channel keys (step 5). It is a names checklist so `/command-centre/billing` can prepare a PayFast sandbox checkout later. Leave every name unset until Billy says yes to sandbox billing. A yes for `CRON_SECRET` or a channel key is not a yes for sandbox billing. A yes for sandbox billing is not a yes for live charges. Steps 20 through 36 are still unapplied. The secret named `SUPABASE_ACCESS_TOKEN` is still not an `sbp_` token. This checklist does not apply SQL and does not claim that apply is done. Gated Phase 5 command-centre panels stay paused. Saving a name does not send, does not spend, does not charge a card, and does not submit the PayFast form. `sending_enabled` stays false on every workspace until Billy says yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. This page lists names only. Do not paste a merchant key, a passphrase, or a service-role value into git, a pull request, chat, or this file.

The billing page and `/api/webhooks/payfast` already read these names. Checkout stays closed unless `BILLING_SANDBOX` is the string `true`. The only merchant id the app accepts is PayFast’s published sandbox merchant `10000100` (`PAYFAST_SANDBOX_MERCHANT_ID` in `src/lib/billing/flag.ts`). Any other id is refused. The checkout form posts only to `https://sandbox.payfast.co.za/eng/process`. A live PayFast host is refused. No charge is sent from this checklist.

#### Where the values come from

`BILLING_SANDBOX` is a switch. When Billy says yes to sandbox billing, the value is the string `true`. It is not a key.

PayFast sandbox merchant id, key, and passphrase. On the phone, open the PayFast sandbox only: https://sandbox.payfast.co.za . Leave the live PayFast site closed. Leave live PayFast off until Billy says yes to live charges.

1. Sign in to the sandbox account.
2. Merchant id and merchant key are on the sandbox dashboard: Account → Personal Information, or Settings → Integrations → Merchant Identifiers. The app accepts merchant id `10000100` only. If the signed-in sandbox account shows a different id, leave that id out of Vercel. Copy the merchant key that belongs to sandbox merchant `10000100` into a password manager. This page does not contain that key.
3. The passphrase is the sandbox Salt Passphrase. On the sandbox site, open Settings and edit Salt Passphrase. Subscription checkout signs with `PAYFAST_PASSPHRASE`, so the salt on the sandbox account and the env value have to be the same. Copy the salt into the password manager. If the salt is empty, set one on the sandbox account and keep that same value for the env name. Do not invent a second passphrase. Do not use a live PayFast passphrase.

`SUPABASE_SERVICE_ROLE_KEY` is the server key the PayFast ITN webhook uses. `/api/webhooks/payfast` calls `apply_billing_event` with the service role. Without this name, the ITN is not stored. Owner auto-attach also reads this name. This checklist does not create the Auth user and does not run `supabase/owner-bootstrap.sql`.

1. On the phone, open Supabase → the project → Project Settings → API Keys: https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/settings/api-keys
2. Reveal the legacy `service_role` secret. Copy it once into a password manager. Do not copy the `anon` key. Do not copy a publishable key. This page does not contain the value.
3. The env name on Vercel is `SUPABASE_SERVICE_ROLE_KEY`. Leave it out of git, pull requests, issues, and docs.

#### Set the names on Vercel

When Billy says yes to sandbox billing:

1. Stay on the Vercel session from step 3. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add one name at a time. Save it for Production. Add Preview only when Billy says yes to Preview. Mark `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, and `SUPABASE_SERVICE_ROLE_KEY` Sensitive so the phone does not keep the value on screen after save.
3. Set these names:
   - `BILLING_SANDBOX` = `true`
   - `PAYFAST_MERCHANT_ID` = `10000100`
   - `PAYFAST_MERCHANT_KEY` (the sandbox merchant key from the password manager)
   - `PAYFAST_PASSPHRASE` (the sandbox Salt Passphrase from the password manager)
   - `SUPABASE_SERVICE_ROLE_KEY` (the `service_role` secret from Project Settings → API Keys)
4. Leave `BILLING_ALLOW_MOCK_ITN` unset. On a production deploy the mock ITN control stays off unless that name is the string `true`. This checklist does not set it.
5. Leave the values out of git, pull requests, issues, and docs.

A saved variable is read on the next deployment. This checklist does not ask for a redeploy. It does not open `/command-centre/billing` and it does not press Prepare PayFast sandbox checkout. It does not register the billing cron. It does not call PayFast, Paystack, or Yoco. There is no Paystack env name and no Yoco env name on this checklist. The Yoco control on that page saves a sandbox draft and does not call Yoco. That draft still needs the billing SQL, which is still unapplied.

#### Still blocked

These stay blocked. A yes for the sandbox billing names is not a yes for any of them:

- SQL steps 20 through 36 are still unapplied. Do not claim this SQL is already applied.
- `SUPABASE_ACCESS_TOKEN` on the box and in Vercel is still not an `sbp_` token.
- `OWNER_EMAILS` and the Owner Auth bootstrap stay on step 4. This checklist does not create the Auth user `billyfaber06@gmail.com` and does not paste `supabase/owner-bootstrap.sql`.
- `CRON_SECRET` and the outbound channel keys (step 5) stay unset until Billy says yes. `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Website pull requests [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them from this agent.
- Live PayFast stays off until Billy says yes to live charges. Do not put a live merchant id, a live merchant key, or a live passphrase in the environment.
- This checklist does not apply the Education pack and does not apply the Zentrix pack. No ad spend. Gated Phase 5 command-centre panels stay paused.

The next phone checklist is step 7: paste steps 20 through 36 in the Supabase SQL editor. `scripts/apply-pending-migrations.mjs` still cannot run until `SUPABASE_ACCESS_TOKEN` is a real `sbp_` token. Step 7 does not claim those steps are already applied.

### 7. Phone-first: SQL editor for steps 20–36

Do this on the phone after PayFast sandbox and billing readiness (step 6). The CLI in step 2 still cannot apply SQL. The secret named `SUPABASE_ACCESS_TOKEN` on the ops box is a chat note. A Personal Access Token starts with `sbp_`. Until Billy pastes a real `sbp_` token into that shell, `scripts/apply-pending-migrations.mjs` applies nothing. This checklist does not replace that token and does not print one. The SQL editor does not need it. When there is still no `sbp_` token, [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md) (step 1) sends you here. This step is that fallback.

This page does not claim steps 20 through 36 are applied. They stay unapplied until each file below has been run and the editor shows success. Steps 1 through 19 stay as they are. Paste steps 20 through 36 only, in this order. Stop on the first failure. Do not skip ahead. Do not sort the migrations folder by filename.

1. On the phone, stay signed in to Supabase. Open a new query: https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new . The project SQL Editor is the same place: https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql . The project ref is `fnysxlswzufdnlbhndxc`.
2. For one step at a time, paste the full SQL from the matching file under `supabase/migrations`. The same text also lives on the ops box as `/workspace/supabase-apply/NN-*.sql`, where `NN` is the step number from 20 through 36. Use either copy of that one step. Do not paste a file from steps 1 through 19.
3. Run the query. Expect `Success. No rows returned`, or the editor’s equivalent success with no error. A result grid is not required. On an error, stop. Later steps were not applied. Fix the cause, then resume at the step that failed. Do not skip ahead.
4. A phone SQL editor can cut a long paste short. Compare the pasted length with the file size below before Run. When the paste is shorter than the file, stop and paste the whole file from a desktop. Paste the file whole. Do not split it into pieces. A shorter paste is a different statement. Do not invent a shorter version.

Files, in order. The ops-box name is the copy under `/workspace/supabase-apply/`:

20. `supabase/migrations/20261026120000_phase4c_aios_pricing.sql` — `/workspace/supabase-apply/20-*.sql` — about 12 KB (12,497 bytes)
21. `supabase/migrations/20261027120000_phase4d_eastc_education.sql` — `/workspace/supabase-apply/21-*.sql`
22. `supabase/migrations/20261028120000_phase5a_agent_computers.sql` — `/workspace/supabase-apply/22-*.sql`
23. `supabase/migrations/20261029120000_phase5b_lead_onboarding.sql` — `/workspace/supabase-apply/23-*.sql`
24. `supabase/migrations/20261030120000_phase5c_connect_import.sql` — `/workspace/supabase-apply/24-*.sql`
25. `supabase/migrations/20261031120000_phase5d_home_chat.sql` — `/workspace/supabase-apply/25-*.sql`
26. `supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql` — `/workspace/supabase-apply/26-*.sql` — about 14 KB (14,479 bytes)
27. `supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql` — `/workspace/supabase-apply/27-*.sql` — about 20 KB (20,759 bytes). This is the campaign CSV file. It is the paste most likely to truncate on a phone.
28. `supabase/migrations/20261103120000_phase5g_social_drafts.sql` — `/workspace/supabase-apply/28-*.sql` — about 12 KB (12,708 bytes)
29. `supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql` — `/workspace/supabase-apply/29-*.sql` — about 15 KB (15,089 bytes)
30. `supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql` — `/workspace/supabase-apply/30-*.sql`
31. `supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql` — `/workspace/supabase-apply/31-*.sql`
32. `supabase/migrations/20261107120000_phase5k_setup_wizard.sql` — `/workspace/supabase-apply/32-*.sql`
33. `supabase/migrations/20261108120000_phase5l_migration_runner.sql` — `/workspace/supabase-apply/33-*.sql`
34. `supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql` — `/workspace/supabase-apply/34-*.sql`
35. `supabase/migrations/20261110120000_phase5n_ops_secrets_ready.sql` — `/workspace/supabase-apply/35-*.sql`
36. `supabase/migrations/20261111120000_phase5o_golive_checklist.sql` — `/workspace/supabase-apply/36-*.sql`

Watch the paste on a phone for step 20 (about 12 KB), step 26 (about 14 KB), step 27 (about 20 KB), step 28 (about 12 KB), and step 29 (about 15 KB). Prefer a desktop paste for those five when the phone editor truncates. Step 27 is the one to treat first. The same rule applies to any later file if the phone cuts it. Paste the file whole.

After step 36 shows success, stop on this step. Do not click a pack here. The next phone checklist is step 8. That is the click order: schema reload, then the Education pack, then the Zentrix pack. This checklist does not click either pack. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset.

Leave these flags unset. Unset, blank, or any value other than the string `true` keeps that page fixture-only. Setting a flag stores a sandbox note only. It does not apply SQL and it does not send. This checklist does not set them:

- `HOME_CHAT_ENABLED` (step 25)
- `CAMPAIGN_DRY_RUN_ENABLED` and `META_CONNECT_STUB_ENABLED` (step 26)
- `CAMPAIGN_CSV_IMPORT_ENABLED` and `EMAIL_SMS_CONNECT_STUB_ENABLED` (step 27)
- `SOCIAL_DRAFTS_ENABLED` and `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED` (step 28)
- `ZENTRIX_WORKSPACE_PACK_ENABLED` (step 29)
- `EAST_RAND_CAMPAIGN_SEED_ENABLED` (step 30)
- `PWA_INSTALL_SHELL_ENABLED` (step 31)
- `SETUP_WIZARD_ENABLED` (step 32)
- `MIGRATION_RUNNER_ENABLED` (step 33)
- `OWNER_BOOTSTRAP_UI_ENABLED` (step 34)
- `OPS_SECRETS_READY_ENABLED` (step 35)
- `GOLIVE_CHECKLIST_ENABLED` (step 36)
- `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED`

#### Still separate

Writing this page does not run SQL. Steps 20 through 36 stay unapplied until the editor has shown success for each file above. `sending_enabled` stays false on every workspace. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. No ad spend. Gated Phase 5 command-centre panels stay paused. This checklist adds no page under `/command-centre` or `/agency`.

These stay on their own steps. A success in the SQL editor is not a yes for any of them:

- `OWNER_EMAILS` and the Owner Auth bootstrap stay on step 4. This checklist does not create the Auth user `billyfaber06@gmail.com` and does not paste `supabase/owner-bootstrap.sql`.
- `CRON_SECRET` and the outbound channel keys stay on step 5. Leave them unset until Billy says yes.
- PayFast sandbox names stay on step 6. Leave them unset until Billy says yes to sandbox billing. Live PayFast stays off until he says yes to live charges. Do not put a live merchant id in the environment.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. The replace checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). This checklist does not paste a token.
- Website pull requests [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them from this agent.
- This checklist does not click Apply Education pack and does not click the Zentrix pack. The click order is step 8, and only after this step has shown success. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset. No secret value is in this file.

The next phone checklist is step 8.

### 8. Phone-first: Education pack, then Zentrix pack

Do this on the phone or on a desktop only after SQL Success. Step 7 is the SQL editor paste. The CLI in step 2 is the other path, and only once `SUPABASE_ACCESS_TOKEN` is a real `sbp_` token. Packs are not applied. This checklist does not click either button. It does not set a flag. It does not add a page under `/command-centre` or `/agency`.

Stop if an earlier item on this list is not done. Do not skip ahead.

#### 1. SQL Success first

One of these is true before anything else on this step:

- SQL editor: every file from step 20 through step 36 has shown `Success. No rows returned`, or the editor’s equivalent success with no error. A result grid is not required.
- CLI, once the token starts with `sbp_`: the apply prints `Success. Steps 20–36 applied.`

Until one of those is true, steps 20 through 36 stay unapplied. Do not open a pack button. Do not claim the SQL is applied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note until Billy replaces it.

#### 2. Schema reload

In the same SQL editor, after step 36, run this once:

```sql
NOTIFY pgrst, 'reload schema';
```

Success is `Success. No rows returned`, or the editor’s equivalent success with no error. No result grid is required.

That refreshes the PostgREST schema cache. It does not apply another migration, does not send, and does not change `sending_enabled`. If it errors, stop. Do not click a pack. After that Success, and before Phase 5 flags or pack clicks, the logged-out production smoke is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). After that Success, the phone checklist for Phase 5 flags on Vercel Production is [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This step does not set those flags.

#### 3. Education pack for EASTC

Only when Billy says yes. Only after step 21 has succeeded and the schema reload above has succeeded. Sign in as an agency owner. Agency staff can use the same button. A `client_admin` cannot. There is no env flag that applies this pack. Step 21 adds `apply_education_pack_to_eastc()` and does not apply the pack by itself. If Billy has not said yes, leave this button unclicked and leave the Zentrix button unclicked.

On the phone or a desktop:

1. Open `/login` and sign in as the agency owner. The documented address is `billyfaber06@gmail.com` when that Auth user exists (step 4). You should land on `/agency`.
2. Stay on `/agency` and scroll to the heading **Education pack**. Or open `/agency/eastc/settings` and scroll to the same heading. Both pages show **Apply Education pack to EASTC**. `/agency/zentrix/settings` does not show this pack.
3. Tap **Apply Education pack to EASTC**.
4. Read the confirm line: “Confirm this applies the Education pack to EASTC only. Nothing is sent and sending stays off.”
5. Tap **Confirm apply to EASTC**. While it runs, the label is **Applying…**.

Success is a green line under the button. There is no separate toast. The line reads: `Education pack applied to EASTC. N new, M unchanged. Nothing was sent, and sending stays off.` `N` and `M` are counts. A later click can show `0 new` and the rest unchanged. That is the same pack on the same EASTC workspace, not a second organisation.

Rose text is a failure. Stop. Do not tap again until Billy reads the line. A missing step 21, a signed-out session, or a `client_admin` session stops here.

What you should see on EASTC after the green line:

- The same workspace, slug `eastc`. No second organisation.
- Admissions (`pipeline:admissions`) is the only default pipeline. Stages: Enquiry, Application Started, Docs Submitted, Accepted, Registered, Lost.
- The existing Enrolment pipeline stays.
- Templates, sequences, custom fields, and the inactive admissions workflow are updated by asset key. Contacts, messages, secrets, and outbox rows are not copied.
- `sending_enabled` stays false. Do not tick Sending enabled.

Optional phone check: open the EASTC CRM and see Admissions as the default pipeline. The green line is the success signal. This checklist does not click the button.

#### 4. Zentrix pack

This is the next click after the Education green line. Only after step 29 has succeeded, only once `ZENTRIX_WORKSPACE_PACK_ENABLED` is the string `true`, and only when Billy says yes. Leave that flag unset until he says yes. Unset, blank, or any other value keeps the button fixture-only. This checklist does not set the flag.

On the phone or a desktop, when he says yes:

1. On Vercel, open the CRM project → Settings → Environment Variables. Set the name `ZENTRIX_WORKSPACE_PACK_ENABLED` to the string `true`. A saved variable is read on the next deployment. Do not paste the value into git, a pull request, or this file.
2. Open `/agency` and scroll to the heading **Zentrix workspace pack**, or open `/agency/zentrix/settings`. Same form on both. `/agency/eastc/settings` does not show this pack.
3. If the amber line is still there — “Fixture only. These stubs are not stored until ZENTRIX_WORKSPACE_PACK_ENABLED is true and step 29 is applied. Nothing is sent.” — stop. The click does not store rows. Wait until that line is gone.
4. When the page says “Sandbox pack. Applying stores the three stubs. Nothing is sent.”, the list shows Pets (priority, `w1y2f0-rk`), Kitchens (priority, `desj1r-ic`), and Auto (QA / reference, `80ce1e-p8`).
5. Tap **Apply Zentrix pack to Zentrix Online**.
6. Read the confirm line: “Confirm this applies the Zentrix pack to Zentrix Online only. Nothing is sent and sending stays off.”
7. Tap **Confirm apply to Zentrix Online**. While it runs, the label is **Applying…**.

Success is a green line under the button. There is no separate toast. The line reads: `Zentrix pack applied to Zentrix Online. Pets and Kitchens are priority. Auto is QA / reference. Nothing was sent, nothing was charged, and sending stays off.`

Rose text is a failure. Stop. Nothing was stored.

What you should see after the green line:

- The same Zentrix workspace, slug `zentrix`. No second organisation.
- Three stub rows: Pets (`w1y2f0-rk`, priority), Kitchens (`desj1r-ic`, priority), and Auto (`80ce1e-p8`, QA / reference, not an ad target). A later click updates those three rows. It does not add a fourth.
- The older Shopify catalogue row count stays the same. No Shopify call runs. No Admin API token is stored.
- `sending_enabled` stays false. Do not tap **Publish**, **Send**, or **Go live**. Those stay refused.

The store list on the page is the same before and after the click. The green line is the success signal. This checklist does not click the button. The pack does not turn sending on.

#### Still blocked

- No secret value is in this file. Do not paste a token, a key, a passphrase, or a service-role value.
- `sending_enabled` stays false on every workspace.
- No new `/command-centre` or `/agency` page. Gated Phase 5 panels stay paused. This checklist does not open them to apply a pack.
- Website pull requests [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open. Do not merge them from this agent.
- No ad spend.
- Steps 20 through 36 stay unapplied until Billy re-authenticates the SQL editor or provides an `sbp_` token and the apply prints Success. Writing this page does not apply them. Neither pack is applied.

Tracker item 8 (prospect list and the first campaign) is a sandbox dry-load only. After SQL steps 20 through 36 show Success and `NOTIFY pgrst, 'reload schema';` has succeeded, the phone checklist is [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md). Do not invent campaign rows in production until that page’s SQL and flag checks are true. No real sends.

### 9. Wait for an explicit yes

No ad spend, no purchases, no live charges, and no outbound sends unless Billy explicitly says yes. `sending_enabled` stays false on every workspace until he says yes. Do not register a cron that sends. Do not create a paid developer account and do not submit a store listing. The step 5 names, including `CRON_SECRET` and the outbound channel keys, stay unset until that yes. The step 6 names stay unset until Billy says yes to sandbox billing. Live PayFast stays off until he says yes to live charges. The SQL editor paste in step 7 leaves `sending_enabled` false. Education pack and Zentrix pack stay unclicked until step 8 and until Billy says yes to that pack. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset until he says yes. Website pull requests [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them from this agent. This runbook does not publish the site.

### 10. Phone-first: CRM hostname `crm.aiautotech.co.za`

This step does not wait on steps 20 through 36. The app already answers on `https://ai-autotech-crm.vercel.app`. Overnight checks sometimes find `crm.aiautotech.co.za` unreachable while that Vercel hostname still loads. The phone checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md).

Billy adds `crm.aiautotech.co.za` on Vercel → the CRM project `ai-autotech-crm` → Settings → Domains, Production only. He then copies the DNS card into GoDaddy for the zone `aiautotech.co.za`. The record type and value come from that card. This page does not edit DNS, does not buy a domain, and does not spend.

`sending_enabled` stays false. Steps 1 through 19 stay Already live. Steps 20 through 36 stay unapplied. Website pull requests [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them from this agent. Cron URLs stay on `https://ai-autotech-crm.vercel.app` ([`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md)).

### 11. Phone-first: public website `NEXT_PUBLIC_SITE_URL`

This step does not wait on steps 20 through 36. It does not attach DNS and it does not replace the CRM hostname.

The phone checklist is [`docs/phone-site-url-verify.md`](phone-site-url-verify.md). On Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables, the Production value of `NEXT_PUBLIC_SITE_URL` should be `https://aiautotech.co.za` (no hyphen). If that value still uses `ai-autotech.co.za`, change only that host. Do not store `https://ai-autotech-crm.vercel.app` or `https://crm.aiautotech.co.za` in this variable.

`sending_enabled` stays false. Steps 1 through 19 stay Already live. Steps 20 through 36 stay unapplied. This page does not set the variable, does not redeploy, and does not spend.

### 12. Phone-first: business email from `Willem@aiautotech.co.za`

This step does not wait on steps 20 through 36. It does not turn sending on and it does not change DNS.

The phone checklist is [`docs/phone-willem-send-from.md`](phone-willem-send-from.md). Confirm the Google Workspace login for `Willem@aiautotech.co.za` (W-i-l-l-e-m). Note which email channel names from step 5 are present. Look up the MX for `aiautotech.co.za` and write down Google or Amazon SES. Leave the records as they are. Never send AI AutoTech mail from `billyfaber06@gmail.com`.

The SMTP alternative to Resend is [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). On the phone, open the Google Account for `Willem@aiautotech.co.za`, confirm 2-Step Verification is on, and create an App Password labeled `AI AutoTech CRM SMTP` only after Billy says yes. Store it in a password manager. Set the SMTP names on Vercel Production only after he says yes to each name. That page does not send and does not edit DNS.

The Resend path is [`docs/phone-resend-willem.md`](phone-resend-willem.md). Create the API key and confirm `RESEND_FROM` only after Billy says yes to that name. That page does not send and does not edit DNS.

`sending_enabled` stays false. The first test, after the keys exist and Billy says yes, is a draft or outbox row only. Email is not live. Steps 1 through 19 stay Already live. Steps 20 through 36 stay unapplied. Tracker item 6 (outbound channels) stays partial (4/8). `CRON_SECRET` and the channel keys still need Billy’s yes. This page does not set them, does not redeploy, and does not spend.

### 13. Phone-first: MX for `aiautotech.co.za`

This step does not wait on steps 20 through 36. It does not turn sending on.

The phone checklist is [`docs/phone-mx-dns-decision.md`](phone-mx-dns-decision.md). On the phone, read the MX and the apex SPF for `aiautotech.co.za`. A read-only DNS-over-HTTPS lookup on 3 Oct 2026 already returned MX `1 smtp.google.com.` and SPF `v=spf1 include:_spf.google.com ~all`. When the phone lookup matches that, leave the records. Open the Google Workspace inbox for `Willem@aiautotech.co.za` (W-i-l-l-e-m). Do not send a message. Do not use `billyfaber06@gmail.com` as a From.

Open the SES fallback only when that phone lookup shows Amazon SES (`amazonaws.com`). Switch the MX to priority `1` and host `smtp.google.com` at GoDaddy only after Billy says yes on that call. Leave SPF, DKIM, and DMARC unless he already said yes to those records in the same breath. DKIM (`google._domainkey`) and DMARC (`_dmarc`) had no TXT on that 3 Oct lookup. The next phone checklist is [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md) (step 14). This step leaves those records.

`sending_enabled` stays false until a separate yes. Steps 1 through 19 stay Already live. Steps 20 through 36 stay unapplied. This page does not edit DNS, does not set a channel key, does not redeploy, and does not spend.

### 14. Phone-first: DKIM and DMARC for `aiautotech.co.za`

This step does not wait on steps 20 through 36. It does not turn sending on. It follows step 13.

The phone checklist is [`docs/phone-dkim-dmarc.md`](phone-dkim-dmarc.md). On the phone, open Google Admin → Gmail → Authenticate email and generate DKIM for `aiautotech.co.za` only after Billy says yes. Add the TXT at the host Admin shows (usually `google._domainkey`) in GoDaddy. Then, after a separate yes, add a monitor-only DMARC TXT at `_dmarc`: `v=DMARC1; p=none; rua=mailto:Willem@aiautotech.co.za` (or the `rua` he names on that call). Leave `p=none` until he says tighten. Verify both names with a phone DNS lookup. The 3 Oct 2026 lookup found neither TXT. MX was already `1 smtp.google.com.`, so this step does not switch SES to Google.

`sending_enabled` stays false until a separate yes. The From, when a send is allowed later, is `Willem@aiautotech.co.za` (W-i-l-l-e-m). Do not use `billyfaber06@gmail.com` as a From or as the DMARC `rua`. Steps 1 through 19 stay Already live. Steps 20 through 36 stay unapplied. This page does not edit DNS, does not set a channel key, does not redeploy, and does not spend.

## 1. Apply SQL steps 20 through 36

Run one file at a time, in this order:

20. `supabase/migrations/20261026120000_phase4c_aios_pricing.sql`
21. `supabase/migrations/20261027120000_phase4d_eastc_education.sql`
22. `supabase/migrations/20261028120000_phase5a_agent_computers.sql`
23. `supabase/migrations/20261029120000_phase5b_lead_onboarding.sql`
24. `supabase/migrations/20261030120000_phase5c_connect_import.sql`
25. `supabase/migrations/20261031120000_phase5d_home_chat.sql`
26. `supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql`
27. `supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql`
28. `supabase/migrations/20261103120000_phase5g_social_drafts.sql`
29. `supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql`
30. `supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql`
31. `supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql`
32. `supabase/migrations/20261107120000_phase5k_setup_wizard.sql`
33. `supabase/migrations/20261108120000_phase5l_migration_runner.sql`
34. `supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql`
35. `supabase/migrations/20261110120000_phase5n_ops_secrets_ready.sql`
36. `supabase/migrations/20261111120000_phase5o_golive_checklist.sql`

SQL editor: sign in again, open the project SQL editor, and paste each file once. The phone checklist is Phone-first unblock, step 7: https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new . The project ref already used in `docs/agency-owner-setup.md` is `fnysxlswzufdnlbhndxc`.

CLI: follow Phone-first unblock step 1 and [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). `scripts/apply-pending-migrations.mjs` reads `SUPABASE_ACCESS_TOKEN` from the box environment. That value is a Personal Access Token from the Supabase account page (Access Tokens). A real token starts with `sbp_`. The value currently stored on the box and in Vercel is a chat note. Replace it before the dry-run. Do not commit it, and do not invent one. If the token is not available, use the SQL editor instead (step 7).

Do not push the whole migrations folder. A database URL Billy provides can be used with `psql` and `ON_ERROR_STOP`, one file at a time, in the order above. This page does not include either secret.

### Phone or box

The ordered phone steps are Phone-first unblock, above. The token replace is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md) (step 1). While the token is a chat note, step 7 is the SQL editor paste. `scripts/apply-pending-migrations.mjs` applies steps 20 through 36 from this repo. It does not add a page under `/command-centre` or `/agency`. Dry-run is the default and sends no SQL. The token is never printed.

`--project-ref` overrides `SUPABASE_PROJECT_REF`. `SUPABASE_PROJECT_ID` is also accepted, as is `NEXT_PUBLIC_SUPABASE_URL` when it is exactly `https://<ref>.supabase.co`. With no token, the dry-run lists steps 20–36, prints that `--apply` needs a token starting with `sbp_`, and exits 0. Any other value, including the chat note, exits non-zero and applies nothing.

`--via cli` runs `supabase db query --linked --file` when that command is on `PATH`. `--via auto` uses the CLI when `supabase db query` exists, and the Management API otherwise. The default is `api`. Resume a failed step with `--from` and the failed step number, then run the schema reload in section 2.

This script does not turn `sending_enabled` on, does not schedule a cron, and does not call Apply Education pack or the Zentrix pack.

## 2. Reload the API schema

After step 36 succeeds, run this once in the SQL editor:

```sql
NOTIFY pgrst, 'reload schema';
```

That refreshes the PostgREST schema cache so the new tables and functions are visible to the API. It does not apply another migration, does not send, and does not change `sending_enabled`. The phone click order that includes this reload is Phone-first unblock, step 8. Run it only after every file from 20 through 36 has shown success.

## 3. Leave flags unset until their SQL is applied

Leave these unset until the step that introduces them has been applied. Unset, blank, or any value other than the string `true` keeps that page fixture-only. Setting a flag stores a sandbox note only. It does not apply SQL and it does not send.

- `GOLIVE_CHECKLIST_ENABLED` until step 36
- `MIGRATION_RUNNER_ENABLED` until step 33
- `SETUP_WIZARD_ENABLED` until step 32
- `OWNER_BOOTSTRAP_UI_ENABLED` until step 34
- `OPS_SECRETS_READY_ENABLED` until step 35

Leave the earlier phase 5 flags unset until their own SQL is applied:

- `HOME_CHAT_ENABLED` (step 25)
- `CAMPAIGN_DRY_RUN_ENABLED` and `META_CONNECT_STUB_ENABLED` (step 26)
- `CAMPAIGN_CSV_IMPORT_ENABLED` and `EMAIL_SMS_CONNECT_STUB_ENABLED` (step 27)
- `SOCIAL_DRAFTS_ENABLED` and `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED` (step 28)
- `ZENTRIX_WORKSPACE_PACK_ENABLED` (step 29)
- `EAST_RAND_CAMPAIGN_SEED_ENABLED` (step 30)
- `PWA_INSTALL_SHELL_ENABLED` (step 31)

Also leave `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset. PWA install is optional and is not a go-live blocker. The header notes are the table in `supabase/APPLY-ORDER.md`.

## 4. Apply the Education pack

After the SQL above is applied, the phone click order is Phone-first unblock, step 8. Sign in as an agency owner and use **Apply Education pack to EASTC**, then **Confirm apply to EASTC**, on `/agency` or `/agency/eastc/settings`. Success is the green line `Education pack applied to EASTC. N new, M unchanged. Nothing was sent, and sending stays off.` There is no env flag that applies this pack. The SQL editor paste is step 7. The Auth user is step 4. `CRON_SECRET` and outbound channel keys are step 5 and stay unset until Billy says yes. PayFast sandbox names are step 6 and stay unset until Billy says yes to sandbox billing. Live PayFast stays off until he says yes to live charges. `sending_enabled` stays false until he says yes. This agent does not click that pack. The pack is not applied. Step 21 adds the function and does not apply the pack by itself. A `client_admin` cannot call it. Contacts, messages, secrets, and outbox rows are not copied.

## 5. Zentrix pack

Apply the Zentrix Online pack only after the Education green line in Phone-first unblock, step 8, only after `ZENTRIX_WORKSPACE_PACK_ENABLED` is the string `true`, and only after step 29 is applied. The button is **Apply Zentrix pack to Zentrix Online**, then **Confirm apply to Zentrix Online**, on `/agency` or `/agency/zentrix/settings`. Success is the green line `Zentrix pack applied to Zentrix Online. Pets and Kitchens are priority. Auto is QA / reference. Nothing was sent, nothing was charged, and sending stays off.` Step 7 leaves the flag unset. This agent does not click that pack. The pack is not applied. While that flag is unset, the amber fixture line stays and the button does not store stubs. The pack does not call Shopify and does not turn sending on. This runbook does not set the flag. `sending_enabled` stays false.

## 6. Owner Auth user, then owner SQL

The phone verification is Phone-first unblock, step 4. Confirm the Auth user `billyfaber06@gmail.com` for project `fnysxlswzufdnlbhndxc`, or create that user only when Billy says yes. Confirm the Vercel Production name `OWNER_EMAILS` is that same address, or leave it unset or blank because that already defaults to it. That is the address Billy typed on 27 Sep 2026. Paste `supabase/owner-bootstrap.sql` only when `supabase/APPLY-ORDER.md` (Not part of this apply) says it is safe: after steps 20 through 36 have succeeded, and only after that Auth user exists. That file is not a migration. The panel at `/command-centre/owner` does not create the Auth user and does not run that SQL. `OWNER_BOOTSTRAP_UI_ENABLED` stays unset until step 34 is applied. See `docs/phase-5m-owner-bootstrap.md` and `docs/agency-owner-setup.md`. The next phone checklist is step 5: `CRON_SECRET` and the outbound channel key names. Leave those names unset until Billy says yes. After step 5, PayFast sandbox billing readiness is step 6. Leave those names unset until Billy says yes to sandbox billing. Live PayFast stays off until he says yes to live charges. After step 6, the phone SQL editor paste of steps 20 through 36 is step 7. That checklist does not claim the SQL is already applied. After SQL Success, the pack click order is step 8. `sending_enabled` stays false until he says yes. This agent does not apply the Education pack or the Zentrix pack. Neither pack is applied.

## 7. Blockers Billy decides

Names only. The phone checklist for Vercel names is Phone-first unblock, step 3 (Vercel → the CRM project → Settings → Environment Variables). The Owner Auth user is step 4. `CRON_SECRET` generation and the outbound channel key names are step 5. PayFast sandbox and billing readiness is step 6. The phone SQL editor paste of steps 20 through 36 is step 7. It does not set the names below, does not claim the SQL is applied, and does not open gated Phase 5 panels. The pack click order after SQL Success is step 8. Neither pack is applied. Creating the Auth user does not set the names below. Each name needs Billy’s yes before live use. This runbook does not supply secret values. `sending_enabled` stays false until he says yes. Live PayFast stays off until he says yes to live charges.

- `OWNER_EMAILS` = `billyfaber06@gmail.com` (owner auto-attach, PR #17)
- `CRON_SECRET` (step 5; generate it in a password manager and set the name on Vercel only after Billy says yes; leave it unset until then)
- Sandbox billing only (step 6): `BILLING_SANDBOX` = `true`, `PAYFAST_MERCHANT_ID` = `10000100` (PayFast’s published sandbox merchant), `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, and `SUPABASE_SERVICE_ROLE_KEY`. Leave them unset until Billy says yes to sandbox billing. Do not invent the key, the passphrase, or the service-role key. Do not put a live merchant id in the environment. Leave `BILLING_ALLOW_MOCK_ITN` unset. Leave live PayFast off until he says yes to live charges.
- Outbound channel keys (step 5) are required before a real send. `sending_enabled` stays false until Billy says yes.
- Gated Phase 5 flags stay unset until their SQL is applied (section 3, Leave flags unset until their SQL is applied). Command-centre panels stay paused until then. `ZENTRIX_WORKSPACE_PACK_ENABLED` stays unset until Billy says yes on step 8.
- Education pack and Zentrix pack stay unclicked until step 8. There is no env flag that applies the Education pack. No ad spend.
- Website publish: [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) wait for Billy’s explicit yes. Do not merge them from this agent. This runbook does not publish the site.

## 8. Sending stays off

`sending_enabled` stays false on every workspace. Do not turn it on while applying this backlog. Do not register a cron that sends. The phone paste that schedules the cron routes while sending stays off, after `CRON_SECRET` is saved, is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). Do not create a paid developer account and do not submit a store listing.
