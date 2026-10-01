# Go-live runbook

Phase 5 gated command-centre panels stay paused until production SQL steps 20 through 36 are applied. The blocker is the secret named `SUPABASE_ACCESS_TOKEN` on Billy's box and in Vercel. The stored value is a chat note. A Personal Access Token starts with `sbp_`, so `scripts/apply-pending-migrations.mjs` cannot apply SQL until that secret is replaced. This page does not contain a token, a database URL, a cron secret, a channel key, or a PayFast key. It does not turn sending on.

The only safe file order is the numbered list in `supabase/APPLY-ORDER.md`. Steps 20 through 36 are still unapplied. Do not claim this SQL is already applied. Do not sort the migrations folder by filename.

Steps 20 through 36 expect steps 1 through 19 to already be on the database. Step 36 raises if phase 2a access is missing. If a file errors because an earlier function or table is missing, stop, apply that earlier file from the unapplied list, then resume at the file that failed.

## Phone-first unblock

Do these in order. Each step can be started from a phone. The apply command runs on the box, in this repo, after `SUPABASE_ACCESS_TOKEN` in that shell is a real `sbp_` token. Do not paste the token into git, a pull request, chat, or this file.

### 1. Replace `SUPABASE_ACCESS_TOKEN`

1. On the phone, open Supabase → Account → Access Tokens: https://supabase.com/dashboard/account/tokens
2. Create a Personal Access Token. A real token starts with `sbp_`. Copy it once into a password manager. Supabase shows it only at creation.
3. Replace the secret named `SUPABASE_ACCESS_TOKEN` in both places that currently hold the chat note:
   - The box environment the apply script reads (the shell export, or the gitignored env file on the box). Unset the old value first. A leftover chat note makes the script exit non-zero and apply nothing, including on a dry-run.
   - Vercel → the CRM project → Settings → Environment Variables → `SUPABASE_ACCESS_TOKEN`. Replace the value and save. Saving it there does not run SQL. This apply does not need a redeploy.
4. Leave the token out of git, pull requests, issues, and docs.

The project ref is `fnysxlswzufdnlbhndxc`, the same ref as `docs/agency-owner-setup.md`.

### 2. Dry-run, then apply steps 20–36

From the repo root on the box, with the new token already in the environment and the chat note unset:

```bash
export SUPABASE_PROJECT_REF='fnysxlswzufdnlbhndxc'
node scripts/apply-pending-migrations.mjs
```

Dry-run is the default. It lists steps 20 through 36 from `supabase/APPLY-ORDER.md` and sends no SQL. With a real token it prints `Token accepted (sbp_ prefix). The value is not shown.` and `Project ref: fnysxlswzufdnlbhndxc`. It does not print the token.

If the chat note is still set, the script prints `Fail. Need SUPABASE_ACCESS_TOKEN starting with sbp_. The current value is not an sbp_ token. Nothing was applied.` and exits non-zero. Stop. Return to step 1. Do not pass `--apply`.

When the dry-run accepts the token, apply. The script stops on the first failure and prints `Success` or `Fail` for each step:

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

This script does not turn `sending_enabled` on, does not schedule a cron, and does not call Apply Education pack or the Zentrix pack. If the box is unreachable, use the SQL editor in section 1 and paste one file at a time, in the same order.

### 3. After SQL Success

Only after the apply prints `Success. Steps 20–36 applied.`, or after the SQL editor has run step 36 without error:

1. Reload the API schema. In the SQL editor, run this once:

```sql
NOTIFY pgrst, 'reload schema';
```

That refreshes the PostgREST schema cache. It does not apply another migration, does not send, and does not change `sending_enabled`.

2. Sign in as an agency owner and use Apply Education pack to EASTC on `/agency`. Step 21 adds the function and does not apply the pack by itself. A `client_admin` cannot call it. Contacts, messages, secrets, and outbox rows are not copied.

3. Leave the Zentrix Online pack unclicked until `ZENTRIX_WORKSPACE_PACK_ENABLED` is the string `true`, and only after step 29 is applied. While that flag is unset, the button stays fixture-only and does not store stubs. The pack does not call Shopify and does not turn sending on. This checklist does not set the flag.

### 4. Secrets still needed (names only)

Set these on the box and in Vercel when Billy has the values. This page does not supply the values. Do not paste a value into git, a pull request, or chat.

- `CRON_SECRET`
- `OWNER_EMAILS` = `billyfaber06@gmail.com` (the documented agency owner, and the default in `.env.example`)
- Outbound channel keys, one provider per channel when Billy is ready to connect it: email `RESEND_API_KEY`, or `SMTP_HOST` with `SMTP_USER` and `SMTP_PASS`; WhatsApp `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`; Meta `META_PAGE_ACCESS_TOKEN` with `META_PAGE_ID` or `META_IG_USER_ID`; SMS one of `SMSPORTAL_CLIENT_ID` plus `SMSPORTAL_API_SECRET`, `BULKSMS_TOKEN_ID` plus `BULKSMS_TOKEN_SECRET`, `CLICKATELL_API_KEY`, or `TWILIO_ACCOUNT_SID` plus `TWILIO_AUTH_TOKEN` plus `TWILIO_FROM_NUMBER`
- PayFast sandbox only: `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, and `BILLING_SANDBOX`. Do not put a live merchant id in the environment. Also `SUPABASE_SERVICE_ROLE_KEY` (server only)

Gated Phase 5 flags stay unset until their own SQL is applied and Billy is ready to store a sandbox note. Unset, blank, or any value other than the string `true` keeps that page fixture-only. Setting a flag stores a sandbox note only. It does not apply SQL and it does not send. The names are in section 3. Also leave `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset.

### 5. Wait for an explicit yes

No ad spend, no purchases, and no outbound sends unless Billy explicitly says yes. `sending_enabled` stays false on every workspace. Do not register a cron that sends. Do not create a paid developer account and do not submit a store listing.

Website pull requests stay unpublished until Billy says yes to publish:

- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) — Publish week-1 guide topics as on-site resource articles
- [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) — Align public prices with the 27 Sep 2026 AIOS sheet

This runbook does not publish the site.

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

SQL editor: sign in again, open the project SQL editor, and paste each file once. The project ref already used in `docs/agency-owner-setup.md` is `fnysxlswzufdnlbhndxc`.

CLI: follow Phone-first unblock above. `scripts/apply-pending-migrations.mjs` reads `SUPABASE_ACCESS_TOKEN` from the box environment. That value is a Personal Access Token from the Supabase account page (Access Tokens). A real token starts with `sbp_`. The value currently stored on the box and in Vercel is a chat note. Replace it before the dry-run. Do not commit it, and do not invent one. If the token is not available, use the SQL editor instead.

Do not push the whole migrations folder. A database URL Billy provides can be used with `psql` and `ON_ERROR_STOP`, one file at a time, in the order above. This page does not include either secret.

### Phone or box

The ordered phone steps are Phone-first unblock, above. `scripts/apply-pending-migrations.mjs` applies steps 20 through 36 from this repo. It does not add a page under `/command-centre` or `/agency`. Dry-run is the default and sends no SQL. The token is never printed.

`--project-ref` overrides `SUPABASE_PROJECT_REF`. `SUPABASE_PROJECT_ID` is also accepted, as is `NEXT_PUBLIC_SUPABASE_URL` when it is exactly `https://<ref>.supabase.co`. With no token, the dry-run lists steps 20–36, prints that `--apply` needs a token starting with `sbp_`, and exits 0. Any other value, including the chat note, exits non-zero and applies nothing.

`--via cli` runs `supabase db query --linked --file` when that command is on `PATH`. `--via auto` uses the CLI when `supabase db query` exists, and the Management API otherwise. The default is `api`. Resume a failed step with `--from` and the failed step number, then run the schema reload in section 2.

This script does not turn `sending_enabled` on, does not schedule a cron, and does not call Apply Education pack or the Zentrix pack.

## 2. Reload the API schema

After step 36 succeeds, run this once in the SQL editor:

```sql
NOTIFY pgrst, 'reload schema';
```

That refreshes the PostgREST schema cache so the new tables and functions are visible to the API. It does not apply another migration, does not send, and does not change `sending_enabled`.

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

After the SQL above is applied, sign in as an agency owner and use Apply Education pack to EASTC on `/agency`. That is step 3 of Phone-first unblock. Step 21 adds the function and does not apply the pack by itself. A `client_admin` cannot call it. Contacts, messages, secrets, and outbox rows are not copied.

## 5. Zentrix pack

Apply the Zentrix Online pack only after `ZENTRIX_WORKSPACE_PACK_ENABLED=true`, and only after step 29 is applied. That is step 3 of Phone-first unblock. While that flag is unset, the button stays fixture-only and does not store stubs. The pack does not call Shopify and does not turn sending on. This runbook does not set the flag.

## 6. Owner Auth user, then owner SQL

Create the Auth user in the Supabase dashboard first (Authentication → Users). The documented address is `billyfaber06@gmail.com`, the `OWNER_EMAILS` default in `.env.example`. Then paste `supabase/owner-bootstrap.sql`. That file is not a migration. The panel at `/command-centre/owner` does not create the Auth user and does not run that SQL. `OWNER_BOOTSTRAP_UI_ENABLED` stays unset until step 34 is applied.

## 7. Blockers Billy decides

Names only. The ordered list is Phone-first unblock, step 4. This runbook does not supply the values.

- `CRON_SECRET`
- `OWNER_EMAILS` = `billyfaber06@gmail.com`
- Outbound channel keys: email (`RESEND_API_KEY` or SMTP), WhatsApp / Meta, and SMS
- PayFast sandbox: `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, and `BILLING_SANDBOX`. Do not put a live merchant id in the environment. Also `SUPABASE_SERVICE_ROLE_KEY`
- Gated Phase 5 flags stay unset until their SQL is applied and Billy is ready (section 3)
- Website publish: [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) wait for Billy's explicit yes. This runbook does not publish the site.

## 8. Sending stays off

`sending_enabled` stays false on every workspace. Do not turn it on while applying this backlog. Do not register a cron that sends. Do not create a paid developer account and do not submit a store listing.
