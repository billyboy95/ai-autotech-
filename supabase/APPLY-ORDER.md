# Migration apply order

Nothing below the “Already live” list has been run on the production database.
The command centre still reports that `public.crm_lead_activity` is missing.
Paste each file into the Supabase SQL editor and run it once, in this order only.
Do not sort the folder by filename. Two timestamps are shared, and filename order applies `phase2a_access` before `send_compliance` and `agency_tenancy` before `crm_automation`.

These files are additive. They do not delete existing leads. Do not turn sending on while applying them.

## Already live

The public audit intake still writes to these. They are done.

1. `supabase/migrations/20260903000000_company_crm.sql`
2. `supabase/migrations/20260925000000_audit_leads.sql`
3. `supabase/migrations/20260925120000_contact_leads.sql`

## Unapplied, in the only safe order

PR #3 is merged. Its files are on `main` and are still unapplied. Run them after the automation and compliance files.

1. `supabase/migrations/20260926160000_crm_automation.sql`
2. `supabase/migrations/20260926183000_outbound_channels.sql`
3. `supabase/migrations/20260926200000_send_compliance.sql`
4. `supabase/migrations/20260926160000_agency_tenancy.sql`
5. `supabase/migrations/20260926180000_zentrix_shopify.sql`
6. `supabase/migrations/20260926200000_phase2a_access.sql`
7. `supabase/migrations/20260926210000_agency_brand_offers.sql`
8. `supabase/migrations/20261015120000_org_scope_phase1_tables.sql`

Why this order:

- `outbound_channels` alters `crm_outbox` and creates `crm_prospects`. Those come from `crm_automation`.
- `send_compliance` adds consent and cost columns on `crm_leads`, `crm_prospects`, and `crm_outbox`, and replaces the outbox status check so `blocked` is allowed. It has to follow `outbound_channels`.
- `agency_tenancy` creates `organizations`, `memberships`, and `attach_org_tenancy`. It attaches `org_id` to company CRM tables that already exist (`crm_leads`, `crm_clients`, `crm_jobs`, `crm_invoices`, `crm_audit_leads`, `crm_contact_leads`).
- `zentrix_shopify` inserts the Zentrix organisation and calls `attach_org_tenancy` on the Shopify tables. It requires `agency_tenancy`. It does not require phase 2a.
- `phase2a_access` adds `organizations.branding`, `sending_enabled` (default false), and the other workspace columns. It requires `organizations` from `agency_tenancy`.
- `agency_brand_offers` writes `organizations.branding` and the deck colours. It requires phase 2a. It also widens the `crm_jobs.kind` check. `crm_jobs` is already live.
- `org_scope_phase1_tables` calls `attach_org_tenancy` on the automation tables (`crm_lead_activity`, `crm_outbox`, `crm_prospects`, `crm_suppressions`, and the rest of that list). It no-ops for any table that is not there yet, and it returns without changes if `attach_org_tenancy` is missing. Run it last so those tables already exist.

## Shared timestamps

Do not apply by filename sort.

| Timestamp | Run first | Run later |
|---|---|---|
| `20260926160000` | `20260926160000_crm_automation.sql` (step 1) | `20260926160000_agency_tenancy.sql` (step 4) |
| `20260926200000` | `20260926200000_send_compliance.sql` (step 3) | `20260926200000_phase2a_access.sql` (step 6) |

Filename sort also places `20260926180000_zentrix_shopify.sql` before `outbound_channels` and `agency_tenancy`. Zentrix needs `organizations`, so it stays at step 5.

## Not part of this apply

`supabase/owner-bootstrap.sql` is not a migration. Run it only after these eight files, and only after the agency owner exists in Supabase Auth. `supabase/schema.sql` is the classic Command Centre baseline, not one of these pending files.
