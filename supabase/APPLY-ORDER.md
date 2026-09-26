# Migration apply order

Nothing in the unapplied list has been run on the live database.
Production still reports that `public.crm_lead_activity` is missing.
Paste each file into the Supabase SQL editor and run it once, in this order.
These files are additive. They do not delete existing leads.

## Already live

The public audit intake still writes to these. They are not pending.

1. `supabase/migrations/20260903000000_company_crm.sql`
2. `supabase/migrations/20260925000000_audit_leads.sql`
3. `supabase/migrations/20260925120000_contact_leads.sql`

## Unapplied, in exact order

Apply the first three now. They are on `main`.

1. `supabase/migrations/20260926160000_crm_automation.sql`
2. `supabase/migrations/20260926183000_outbound_channels.sql`
3. `supabase/migrations/20260926200000_send_compliance.sql`

`outbound_channels` requires `crm_automation`. `send_compliance` requires `outbound_channels`.

PR #3 ([Add agency workspaces, EASTC, and Zentrix Online](https://github.com/billyboy95/ai-autotech-/pull/3), branch `cursor/agency-multitenant-8ac1`) is still open and is not on `main`. Do not apply its files until that PR is merged. When it is merged, its phase 2a and brand migrations come after the three files above:

4. `supabase/migrations/20260926160000_agency_tenancy.sql`
5. `supabase/migrations/20260926180000_zentrix_shopify.sql`
6. `supabase/migrations/20260926200000_phase2a_access.sql` — phase 2a, after `send_compliance`
7. `supabase/migrations/20260926210000_agency_brand_offers.sql` — brand, after phase 2a
8. `supabase/migrations/20261015120000_org_scope_phase1_tables.sql`

Do not sort only by the timestamp prefix. Two PR #3 filenames collide with files that must run first:

- `20260926160000_agency_tenancy.sql` shares `20260926160000` with `crm_automation.sql`. Run `crm_automation.sql` first. Agency tenancy creates `organizations`, which phase 2a alters and which Zentrix inserts into.
- `20260926200000_phase2a_access.sql` shares `20260926200000` with `send_compliance.sql`. Run `send_compliance.sql` first. Phase 2a comes after it. Brand comes after phase 2a because it writes `organizations.branding`, the column phase 2a adds.

`org_scope_phase1_tables` requires agency tenancy. If the phase 1 tables are missing, that file is a no-op.
