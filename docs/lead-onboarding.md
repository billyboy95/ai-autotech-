# Lead Agent onboarding

The Lead Agent chat lives at `/command-centre/lead-agent`. `/command-centre/onboarding` redirects there. The command centre still requires a login when Supabase keys are set. Fixture mode, with those keys empty, renders the page for smoke tests.

## What it asks

1. Niche, goals, channels, working hours, and tools already in use.
2. The full industry template from the Bot Store catalogue. Budget does not drop agents.
3. Each agent's setup questions, including knowledge, hours, FAQs, calendar, and WhatsApp number intent where that agent needs them. The next agent waits until you continue.
4. The monthly estimate: platform fee plus every agent, minus the team discount. ZAR, excluding VAT. Placeholder.

Team discounts match `src/lib/pricing/price-sheet.ts`: 10% from 3 agents, 15% from 5, and 20% from 10. The Lead Agent is included in the platform fee.

## Start this team

The button calls `record_lead_onboarding_trial`, which stores one draft on `lead_onboarding_drafts` and then calls `start_recommended_sandbox_team` for every agent on that template. A shorter list is refused.

No card is charged. `sending_enabled` stays false. `price_placeholder` stays true. After the trial, connect accounts and import contacts. Those pages are sandbox stubs until provider keys exist. See `docs/connect-import.md`. Nothing is sent.

## Environment

Leave these unset:

- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a live PayFast key in the environment for this step.

## Apply the migration

This is step 23 in `supabase/APPLY-ORDER.md`:

`supabase/migrations/20261029120000_phase5b_lead_onboarding.sql`

Apply it after step 22. Do not run it until `SUPABASE_DB_URL` is available.

## Fixture check

With Supabase keys empty, open `/command-centre/lead-agent`. The page should load and describe the full team, the sandbox trial, and ZAR excluding VAT. With Supabase keys set and no session, `/command-centre/lead-agent` redirects to `/login`.
