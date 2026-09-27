# Home assistant

The command-centre home has a chat that carries out CRM tasks you type. The same chat is at `/command-centre/assistant`. Both stay behind the existing login: with Supabase keys set and no session, the URL redirects to `/login`. Fixture mode, with those keys empty, renders the page for smoke tests.

## What it can do

- Look up a lead or contact already in the workspace.
- Summarise the pipeline in one reply.
- Leave a follow-up in the outbox as a draft. It is never sent.
- Open a task draft.
- Open one existing page: Lead Agent, Connect accounts, Import contacts, Agent store, or Billing.

Each reply has one next step. The Lead Agent still recommends the full team for a business. Budget does not drop agents.

With Supabase keys empty, lookups use a small fixture (Ayesha Patel, Johan Botha, Thabo Ndlovu) so the chat can be tried before any migration. A signed-in workspace uses that workspace’s leads and contacts, not the fixture.

## Feature flag

`HOME_CHAT_ENABLED` unset, blank, or anything other than `true` is fixture-only. The chat still answers. Drafts are shown and are not stored.

Set `HOME_CHAT_ENABLED=true` only after step 25 is applied, and only to store sandbox drafts for a signed-in agency owner, agency staff member, or client admin. A preview render stays fixture-only. `sending_enabled` stays false. Nothing is charged.

Leave these unset:

- `CRON_SECRET`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a live Meta, SMS, or PayFast key in the environment for this step.

## Apply the migration

This is step 25 in `supabase/APPLY-ORDER.md`, after step 24:

`supabase/migrations/20261031120000_phase5d_home_chat.sql`

Apply it after step 24. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. A follow-up is copied to `crm_outbox` only when that table already allows `draft` and the lead row exists. The outbox status is `draft`.

## Fixture check

With Supabase keys empty, open `/command-centre`. The page should load the assistant, say fixture only, and offer one next step. Open `/command-centre/assistant`. Ask it to summarise the pipeline or draft a follow-up. The reply says nothing is sent.

With Supabase keys set and no session, both URLs redirect to `/login`.
