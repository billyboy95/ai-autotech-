# Agency owner setup

AI AutoTech Pty Ltd is the parent agency. EASTC (East Sea Technocentric Varsity, Kempton Park) is the first client workspace. Existing CRM rows stay in the agency workspace. Nothing in the migration deletes data.

`/command-centre` and `/agency` require a Supabase Auth session. The signed-in user must have a membership in the organisation on screen. Row level security applies because those pages use the user session, not the service role. Client workspaces, including EASTC, stay isolated the same way.

## 1. Apply the migrations

The only safe order for files that are still unapplied is `supabase/APPLY-ORDER.md`. Steps 20 through 29 are still waiting. After Billy re-authenticates Supabase, run step 20, then 21, and on through step 28, then step 29 (`supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql`). Do not claim that SQL is already applied. Then sign in as an agency owner and use Apply Education pack to EASTC. Apply the Zentrix Online pack later, after `ZENTRIX_WORKSPACE_PACK_ENABLED` is the string `true`. Do not turn sending on. See `docs/zentrix-workspace-pack.md`. Step 30 (`supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql`) is also unapplied. The East Rand sandbox seed stays fixture-only until `EAST_RAND_CAMPAIGN_SEED_ENABLED` is the string `true`. See `docs/phase-5i-sandbox-readiness.md`. Step 31 (`supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql`) is also unapplied. PWA install is optional and is not a go-live blocker. Leave `PWA_INSTALL_SHELL_ENABLED` unset. See `docs/phase-5j-pwa-mobile-shell.md`. Step 32 (`supabase/migrations/20261107120000_phase5k_setup_wizard.sql`) is also unapplied. The setup wizard at `/command-centre/setup` stays fixture-only until `SETUP_WIZARD_ENABLED` is the string `true`. See `docs/phase-5k-setup-wizard.md`. Step 33 (`supabase/migrations/20261108120000_phase5l_migration_runner.sql`) is also unapplied. The migration runner on `/command-centre`, `/command-centre/migrations`, and `/agency` lists steps 20 through 33 as pending until verified. Leave `MIGRATION_RUNNER_ENABLED` unset. It does not apply SQL. See `docs/phase-5l-migration-runner.md`.

In the Supabase SQL editor, run these files in order if they are not already applied:

1. `supabase/migrations/20260903000000_company_crm.sql` (already live if the CRM is storing leads)
2. `supabase/migrations/20260925000000_audit_leads.sql`
3. `supabase/migrations/20260925120000_contact_leads.sql`
4. `supabase/migrations/20260926160000_agency_tenancy.sql`
5. `supabase/migrations/20260926160000_crm_automation.sql` (pipeline, outbox, handover)
6. `supabase/migrations/20260926180000_zentrix_shopify.sql` (Zentrix Online, 10 stores, Shopify tables)
7. `supabase/migrations/20260926183000_outbound_channels.sql` (SMS, social queue, campaigns)
8. `supabase/migrations/20260926200000_phase2a_access.sql` (send switch default off, POPIA tables, staff limits, legacy Admin bypass closed)
9. `supabase/migrations/20260926200000_send_compliance.sql` (marketing opt-in, suppressions, per-send cost)
10. `supabase/migrations/20260926210000_agency_brand_offers.sql` (agency colours from the deck, sourced service and package names on jobs)
11. `supabase/migrations/20261015120000_org_scope_phase1_tables.sql` (adds `org_id` and RLS to pipeline tables that already exist; skips any that do not)
12. `supabase/migrations/20261015140000_phase2b_channels_popia.sql` (channel connections, vault secret RPCs, POPIA contacts, rate cards, usage ledger)

A signed-in user still reaches the command centre if the agency migrations are not applied yet. Customer rows are not loaded with the service role in that case, so the book stays hidden until `organizations` and a membership exist. Client workspaces appear after `20260926160000_agency_tenancy.sql` is applied.

## 1b. Phase 2b channels and POPIA

After migration 12:

- Workspace settings (`/agency/<slug>/settings`) can connect WhatsApp, SMS, email, Facebook, and Instagram. Secrets are stored by `store_channel_secret` (Vault when the extension is present). `read_channel_secret` is executable by the service role only.
- Send test queues a held dry-run outbox row and a `usage_ledger` cost. It does not call a provider.
- Inbound provider posts go to `/api/webhooks/{provider}/{connection_id}`. STOP, UNSUBSCRIBE, OPT OUT, and STOPALL write a suppression and an opted-out consent, then queue an acknowledgement. Nothing is delivered while `sending_enabled` is false.
- CSV campaign import needs a `consent_basis` column. A row without consent gets at most one consent request.
- `/command-centre/campaigns` on the AI AutoTech workspace can load `data/campaigns/ai-autotech-east-rand-prospects.csv` as a draft. Prospects stay `not contacted`. No outbox rows are created.
- Contacts support Download my data (JSON) and Erase (anonymise plus suppress). Public intake and the website lead form store the consent checkbox text.

When provider keys exist in the environment, run `node scripts/migrate-channel-credentials.mjs`. It writes AI AutoTech connection rows only, prints identifiers, and does not turn sending on.

Still needed from Billy before any live send:

- `SUPABASE_DB_URL` so the unapplied migrations, including phase 2b, can be run on the project.
- Provider API keys (Meta Cloud, SMSPortal or BulkSMS or Clickatell, Resend or SMTP, Facebook/Instagram) entered in Settings or present in the environment for the migration script.
- `CRON_SECRET` so `/api/cron/automation` can run the outbox worker.
- Leave `sending_enabled` false until a workspace has its own connection and a consent check has been reviewed.

## 2. Environment variables

Already required for the live CRM:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Sign-in uses Supabase Auth: email and password, an email magic link, and social buttons. Password reset is `/login/forgot`. Social buttons come from `NEXT_PUBLIC_AUTH_PROVIDERS` (a comma-separated list). A button is shown only when that id is in the list and the provider is enabled in Supabase. If the list is blank, or the provider check fails, every social button stays hidden and email sign-in still works. Google is always first. No provider client secret belongs in this app's env file.

Enable providers at https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/auth/providers. Each provider app must allow the callback shown there, `https://fnysxlswzufdnlbhndxc.supabase.co/auth/v1/callback`, and must be allowed to share the user's email so the owner address can be matched.

| Button | Env id | App the owner creates |
| --- | --- | --- |
| Continue with Google | `google` | Google Cloud OAuth client (Web) |
| Continue with Facebook | `facebook` | Meta app with Facebook Login |
| Continue with GitHub | `github` | GitHub OAuth App |
| Continue with Apple | `apple` | Apple Services ID with Sign in with Apple, plus the key |
| Continue with Microsoft | `azure` | Microsoft Entra app registration |
| Continue with LinkedIn | `linkedin_oidc` | LinkedIn app using Sign In with LinkedIn (OpenID Connect), not the legacy LinkedIn provider |
| Continue with X | `x` | X Developer app with OAuth 2.0. Use the OAuth 2.0 client id and secret, and turn on "Request email from users". This is not the legacy Twitter OAuth 1.0a provider. |
| Continue with Discord | `discord` | Discord application with OAuth2 |

`OWNER_EMAILS` is server-side. It is a comma-separated list. The default, and the value in `.env.example`, is `billyfaber06@gmail.com`. On first login, an address in that list with no membership is attached as `agency_owner` of the AI AutoTech organisation. If the variable is unset or blank, that same address is used. The attach is idempotent and does not change a membership that already exists. `supabase/owner-bootstrap.sql` remains the manual path. Do not put a live provider key in this variable.

In Supabase Authentication → URL configuration, allow `https://<your-host>/auth/callback` so the magic link, social sign-in, and the reset link can finish signing in and return to the page that was requested.

## 3. Create the agency owner login

1. Supabase Dashboard → Authentication → Users → Add user.
2. Use the email and password you want for yourself. Turn on "Auto Confirm" so you can sign in immediately.
3. Or skip the SQL and sign in as `billyfaber06@gmail.com` (the `OWNER_EMAILS` default). To attach a different address by hand, run `supabase/owner-bootstrap.sql` after replacing that email.

That inserts one `memberships` row: your user, the AI AutoTech organisation, role `agency_owner`.

4. Open `/login` and sign in. You should land on `/agency`.
5. EASTC is already there, with enrolment stages: Enquiry, Contacted, Campus visit booked, Application, Enrolled, Lost.
6. Zentrix Online is the second workspace: Pets, Auto, Kitchens, Camping, Holidays, Home, Beauty, Baby, Fitness, and Tools. Its pipeline is Visitor/lead, Subscriber, Cart abandoned, Customer, Repeat customer, Lost. The sandbox pack on `/agency` and `/agency/zentrix/settings` is separate. After step 29 and `ZENTRIX_WORKSPACE_PACK_ENABLED=true`, it stores three stubs on this same workspace: Pets (`w1y2f0-rk`) and Kitchens (`desj1r-ic`) as priority, and Auto (`80ce1e-p8`) as QA / reference. It does not store a Shopify Admin API token, it does not call Shopify, and it does not turn sending on.
7. Shopify is not called. On `/agency/zentrix/settings`, paste the Admin API token and webhook secret when you have them. In Shopify admin, send orders, customers, and checkouts to `POST /api/shopify/webhook`. Paid orders then show as revenue on `/agency`. Until the secret is saved, the webhook refuses the request and writes nothing. The Phase 5h pack on that page does not write those secrets.
8. Sending is off for every workspace until you, as agency owner, tick "Sending enabled" on that workspace's settings. Marketing still needs a consent record or an existing-customer basis, and every outbound message adds the sender name plus an opt-out. Opt-outs land on the workspace suppression list.

## 4. What stays public

- `/login`, `/login/forgot`, and `/auth/callback` are the sign-in flow. After login the app returns to the requested page.
- `/command-centre` and `/agency` redirect to `/login` when nobody is signed in.
- A member of one organisation cannot open another organisation's records.
- `/api/public/audit` still writes into the AI AutoTech workspace.
- `/audit`, `/book/*`, `/r/*`, `/team/*`, and other `/api/public/*` routes stay public.
- Each workspace has a form key. EASTC intake is `POST /api/public/intake/eastc` and the form is `/intake/eastc`. Zentrix intake is `/intake/zentrix`.

## 5. Add a client user

Create their user in Authentication → Users, then on `/agency/eastc/settings` add that email as Client admin or Client user. They only see EASTC.
