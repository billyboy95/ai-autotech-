# Go-live runbook

Apply the unapplied backlog after Billy re-authenticates Supabase, or after he provides a real Personal Access Token. This page does not contain a token, a database URL, a cron secret, a channel key, or a PayFast key. It does not turn sending on.

The only safe file order is the numbered list in `supabase/APPLY-ORDER.md`. Steps 20 through 36 are still unapplied. Do not claim this SQL is already applied. Do not sort the migrations folder by filename.

Steps 20 through 36 expect steps 1 through 19 to already be on the database. Step 36 raises if phase 2a access is missing. If a file errors because an earlier function or table is missing, stop, apply that earlier file from the unapplied list, then resume at the file that failed.

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

CLI: the Supabase CLI reads `SUPABASE_ACCESS_TOKEN`. That value is a Personal Access Token from the Supabase account page (Access Tokens). A real token starts with `sbp_`. Billy supplies it. Do not commit it, and do not invent one. If the token is not available, use the SQL editor instead.

Link the existing project, then run `db query` with the file flag once per file, in the order above. Do not push the whole migrations folder. A database URL Billy provides can be used the same way with `psql` and `ON_ERROR_STOP`. This page does not include either secret.

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

After the SQL above is applied, sign in as an agency owner and use Apply Education pack to EASTC on `/agency`. Step 21 adds the function and does not apply the pack by itself. A `client_admin` cannot call it. Contacts, messages, secrets, and outbox rows are not copied.

## 5. Zentrix pack

Apply the Zentrix Online pack only after `ZENTRIX_WORKSPACE_PACK_ENABLED=true`, and only after step 29 is applied. While that flag is unset, the button stays fixture-only and does not store stubs. The pack does not call Shopify and does not turn sending on.

## 6. Owner Auth user, then owner SQL

Create the Auth user in the Supabase dashboard first (Authentication → Users). The documented address is `billyfaber06@gmail.com`, the `OWNER_EMAILS` default in `.env.example`. Then paste `supabase/owner-bootstrap.sql`. That file is not a migration. The panel at `/command-centre/owner` does not create the Auth user and does not run that SQL. `OWNER_BOOTSTRAP_UI_ENABLED` stays unset until step 34 is applied.

## 7. Blockers Billy decides

These stay empty until Billy chooses the values. This runbook does not supply them.

- `CRON_SECRET`
- Channel keys: email (Resend or SMTP), WhatsApp / Meta, and SMS
- PayFast sandbox merchant id and key. Do not put a live merchant id in the environment.
- Website publish: yes or no. This runbook does not publish the site.

## 8. Sending stays off

`sending_enabled` stays false on every workspace. Do not turn it on while applying this backlog. Do not register a cron that sends. Do not create a paid developer account and do not submit a store listing.
