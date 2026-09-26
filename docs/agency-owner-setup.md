# Agency owner setup

AI AutoTech Pty Ltd is the parent agency. EASTC (East Sea Technocentric Varsity, Kempton Park) is the first client workspace. Existing CRM rows stay in the agency workspace. Nothing in the migration deletes data.

The company CRM at `/command-centre` stays open on the **agency workspace only**. That is the owner path, so the current book of leads is not locked behind a password. Client workspaces, including EASTC, require a Supabase Auth login and a membership.

## 1. Apply the migrations

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

The command centre still opens if the agency migrations are not applied yet. It reads the existing CRM as one agency book and does not crash when `organizations` or `org_id` is missing. Client workspaces appear after `20260926160000_agency_tenancy.sql` is applied.

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

No new variable is required. Sign-in uses Supabase Auth.

## 3. Create the agency owner login

1. Supabase Dashboard → Authentication → Users → Add user.
2. Use the email and password you want for yourself. Turn on "Auto Confirm" so you can sign in immediately.
3. Run `supabase/owner-bootstrap.sql` after replacing `you@aiautotech.co.za` with that email.

That inserts one `memberships` row: your user, the AI AutoTech organisation, role `agency_owner`.

4. Open `/login` and sign in. You should land on `/agency`.
5. EASTC is already there, with enrolment stages: Enquiry, Contacted, Campus visit booked, Application, Enrolled, Lost.
6. Zentrix Online is the second workspace: Pets, Auto, Kitchens, Camping, Holidays, Home, Beauty, Baby, Fitness, and Tools. Its pipeline is Visitor/lead, Subscriber, Cart abandoned, Customer, Repeat customer, Lost.
7. Shopify is not called. On `/agency/zentrix/settings`, paste the Admin API token and webhook secret when you have them. In Shopify admin, send orders, customers, and checkouts to `POST /api/shopify/webhook`. Paid orders then show as revenue on `/agency`. Until the secret is saved, the webhook refuses the request and writes nothing.
8. Sending is off for every workspace until you, as agency owner, tick "Sending enabled" on that workspace's settings. Marketing still needs a consent record or an existing-customer basis, and every outbound message adds the sender name plus an opt-out. Opt-outs land on the workspace suppression list.

## 4. What stays open

- `/command-centre` with no login shows only AI AutoTech's own CRM (the rows migrated into the agency org).
- `/command-centre?org=eastc` and `/command-centre?org=zentrix` send you to `/login`.
- `/api/public/audit` still writes into the AI AutoTech workspace.
- Each workspace has a form key. EASTC intake is `POST /api/public/intake/eastc` and the form is `/intake/eastc`. Zentrix intake is `/intake/zentrix`.

## 5. Add a client user

Create their user in Authentication → Users, then on `/agency/eastc/settings` add that email as Client admin or Client user. They only see EASTC.
