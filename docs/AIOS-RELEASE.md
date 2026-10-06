# AIOS release

One paste turns on the sales funnel, workspace templates, the public free trial, salesperson commissions, and the sales and onboarding agents. This page does not apply that SQL, does not set a flag, does not provision a workspace, and does not send.

The combined paste is [`docs/aios-release.sql`](aios-release.sql). Paste that file. Do not paste this markdown into the SQL editor. The verification queries below are a second paste, after the apply has shown Success.

`supabase/APPLY-ORDER.md` is unchanged. Steps 20 through 36 stay as they are. This release starts after those steps.

## Apply order

Production does not have `20261112120000_phase5p_sales_funnel.sql` yet. That file is already on main from the sales funnel. The four files after it are new. Apply them in this order, in one paste:

1. `supabase/migrations/20261112120000_phase5p_sales_funnel.sql` — owner alerts, audit report drafts, results-call calendar. Flag: `SALES_FUNNEL_ENABLED`.
2. `supabase/migrations/20261112120100_phase5p_workspace_templates.sql` — duplicate a template and swap the client details. Flag: `WORKSPACE_TEMPLATES_ENABLED`.
3. `supabase/migrations/20261112120200_phase5p_free_trial.sql` — public free trial at `/start`. Flag: `FREE_TRIAL_ENABLED`.
4. `supabase/migrations/20261112120500_phase5p_salesperson_commissions.sql` — commission ledger. Flag: `COMMISSIONS_ENABLED`.
5. `supabase/migrations/20261112140000_phase5q_sales_agents.sql` — sales and onboarding drafts. Flag: `SALES_AGENTS_ENABLED`.

Each later file expects the earlier one. Do not skip the funnel file. Do not reorder them.

Stop if steps 20 through 36 have not already shown Success. The paste checks for organisations, snapshots, calendars, and the access helpers, and it raises if they are missing.

## Paste

1. Open the Supabase SQL editor for the CRM project.
2. Open `docs/aios-release.sql` and paste the whole file.
3. Run it once. Wait for Success. A second run of the same paste is safe: the statements replace functions and add missing tables. It does not delete rows and it does not turn `sending_enabled` on.
4. In a new query, run:

```sql
NOTIFY pgrst, 'reload schema';
```

That refreshes the API schema cache. It does not send.

## Verify

Run this after the notify. Nine names should come back:

```sql
select proname
from pg_proc
join pg_namespace n on n.oid = pronamespace
where n.nspname = 'public'
  and proname in (
    'duplicate_workspace',
    'start_free_trial',
    'save_commission_salesperson',
    'attribute_commission',
    'record_commission_receipt',
    'save_sales_agent_batch',
    'record_owner_notification',
    'ensure_results_call_calendar',
    'save_audit_report_draft'
  )
order by proname;
```

These five tables should all be non-null:

```sql
select to_regclass('public.crm_audit_reports') as reports,
       to_regclass('public.workspace_duplicates') as duplicates,
       to_regclass('public.workspace_trials') as trials,
       to_regclass('public.commission_ledger') as ledger,
       to_regclass('public.crm_sales_drafts') as drafts;
```

Sending stays off. `sending_on` must be 0:

```sql
select count(*) as sending_on
from public.organizations
where sending_enabled is distinct from false;
```

If a name is missing, or `sending_on` is not 0, stop. Do not set a flag.

## Flag order

Leave every name unset until the SQL above has shown Success and you say yes to that one name. Unset, blank, or any value other than the string `true` keeps the feature off. A yes for one name is not a yes for the next. Set them in Vercel Production, one at a time, then redeploy. Preview only if you say yes to Preview.

1. `SALES_FUNNEL_ENABLED` = `true`. In-app owner alerts and audit report drafts. Leave `OWNER_ALERT_EMAIL_PROVIDER` empty so no alert email goes out.
2. `WORKSPACE_TEMPLATES_ENABLED` = `true`. Duplicate-and-swap. The copy keeps sending off.
3. `FREE_TRIAL_ENABLED` = `true`. `/start` can create a sandbox workspace. `FREE_TRIAL_DAYS` can stay empty (14 days).
4. `COMMISSIONS_ENABLED` = `true`. Staff can record a ledger row. No payment provider is called.
5. `SALES_AGENTS_ENABLED` = `true`. Follow-up and welcome drafts wait in `/command-centre/approvals`. Approving a draft queues `crm_outbox`. It does not send while `sending_enabled` is false.

Leave these off:

- `sending_enabled` stays false on every workspace.
- `AUTOMATION_SEND_ENABLED` stays unset.
- Resend, SMS, WhatsApp, and Meta keys stay unset.
- `OWNER_ALERT_EMAIL_PROVIDER` stays empty.

## Phone go-live

1. SQL editor. Paste `docs/aios-release.sql`. Wait for Success.
2. New query: `NOTIFY pgrst, 'reload schema';`
3. Run the three verify queries above. Nine functions. Five tables. `sending_on` is 0.
4. Do not set a flag on this visit unless you are saying yes to the next name in the list.
5. Vercel → CRM project → Settings → Environment Variables. Add one name. Value is the string `true`. Save for Production. Redeploy before the next name.
6. Order: funnel, templates, trial, commissions, sales agents.
7. Open `/start` before the trial flag. It should say the trial is not available.
8. Open `/command-centre/approvals` before the sales-agent flag. It should stay on fixture drafts.
9. Sending chip stays off. Do not tap Send, Go live, or Publish.
10. AI AutoTech as customer 1 is the provision script below. Dry-run first. `--apply` only with the confirm string, after this SQL has succeeded.

## AI AutoTech as customer 1

`scripts/provision-ai-autotech.mjs` creates or updates the client workspace from the agency template.

- Business name: AI AutoTech
- Website: https://aiautotech.co.za
- Booking link: https://aiautotech.co.za/book
- Sender: Willem@aiautotech.co.za
- Slug: `aiautotech`
- Template: agency snapshot `a2c00000-0000-4000-8000-000000000001`
- `sending_enabled` stays false

Until that workspace exists and `settings.public_intake` is `aiautotech`, the public audit and guide forms stay on the agency workspace `ai-autotech`. After the script runs, those forms land on the AI AutoTech pipeline. The guide form is the contact route when the page path contains `/guide`.

Dry-run (prints the plan, sends nothing):

```bash
node scripts/provision-ai-autotech.mjs
```

Apply, only on a non-production project, after you set the confirm string. The token must start with `sbp_`.

```bash
AI_AUTOTECH_PROVISION_CONFIRM=yes-provision-ai-autotech \
  node scripts/provision-ai-autotech.mjs --apply --project-ref <ref>
```

The production project ref `fnysxlswzufdnlbhndxc` is refused unless the confirm string is `yes-provision-ai-autotech-production`. CI refuses `--apply`. A second run updates the same slug. It does not create a second workspace and it does not send.

This repository change does not run that script.
