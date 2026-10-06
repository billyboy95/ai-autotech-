# Phone check: duplicate a workspace (fixture)

Production: https://ai-autotech-crm.vercel.app/agency/duplicate

The flag is `WORKSPACE_TEMPLATES_ENABLED`. Leave it unset. Sending stays off. This page does not apply SQL and does not create a workspace while the flag is off.

## Signed out

1. Open `/agency` and `/agency/duplicate` in a private tab.
2. Production answers 307 and lands on `/login`.

## Signed in, flag unset

1. Sign in as an agency owner or staff member.
2. Open `/agency`. Tap **Duplicate workspace**.
3. The amber line reads: Fixture only. `WORKSPACE_TEMPLATES_ENABLED` is not the string true, so nothing is created. Sending stays off. Nothing is charged.
4. Two cards are on the page: **Burger Barn** and **Second Joint**. They share the restaurant stages. The menus differ when the second card lists Smash burger.
5. Each card says the workflows are inactive drafts and **Sending is off**.
6. The form is filled with Second Joint. Tap **Preview duplicate**.
7. The result repeats the fixture line. No new workspace appears under Agency.

`?fixture=1` keeps the same fixture screen even if the flag is later set to `true`.

Apply `supabase/migrations/20261112120000_phase5p_workspace_templates.sql` in the SQL editor only after the earlier migrations are already in place, and only when you say yes. Do not use `supabase db push`. Do not set the flag in the same step.
