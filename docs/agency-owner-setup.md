# Agency owner setup

AI AutoTech Pty Ltd is the parent agency. EASTC (East Sea Technocentric Varsity, Kempton Park) is the first client workspace. Existing CRM rows stay in the agency workspace. Nothing in the migration deletes data.

The company CRM at `/command-centre` stays open on the **agency workspace only**. That is the owner path, so the current book of leads is not locked behind a password. Client workspaces, including EASTC, require a Supabase Auth login and a membership.

## 1. Apply the migrations

In the Supabase SQL editor, run these files in order if they are not already applied:

1. `supabase/migrations/20260903000000_company_crm.sql` (already live if the CRM is storing leads)
2. `supabase/migrations/20260925000000_audit_leads.sql`
3. `supabase/migrations/20260925120000_contact_leads.sql`
4. `supabase/migrations/20260926160000_agency_tenancy.sql`
5. `supabase/migrations/20260926180000_zentrix_shopify.sql` (Zentrix Online, 10 stores, Shopify tables)
6. `supabase/migrations/20260926200000_phase2a_access.sql` (send switch default off, POPIA tables, staff limits, legacy Admin bypass closed)
7. `supabase/migrations/20261015120000_org_scope_phase1_tables.sql` (no-op until the pipeline engine tables exist, then it adds `org_id` and RLS)

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
