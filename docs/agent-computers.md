# Agent computers

Each agent can have its own cloud computer. This phase is sandbox only. The default provider is a fixture. It does not call E2B or Browserbase, and it does not spend.

## What you can do now

Open an agent in the command centre and choose **View computer**. The page shows a placeholder stream and an hours meter. **View only** is the default. **Take over** stays on the same placeholder.

The allowance comes from `src/lib/pricing/price-sheet.ts`:

| Plan | Allowance |
|---|---|
| Platform pool (Lead Agent, included) | 2h |
| Starter | 5h |
| Pro | 12h |
| Always-On | 40h |

**Add a fixture minute** moves the meter by 60 seconds. When used time is over the allowance, the computer status becomes `paused`. That is a soft pause. It does not charge a card, it does not call a desktop API, and `sending_enabled` stays false. `price_placeholder` stays true.

Without Supabase keys, the command centre renders this in fixture mode so CI can open the page.

## Environment

Leave these unset:

- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`

Without `E2B_API_KEY`, the app uses `FixtureComputerProvider`.

`COMPUTER_PROVIDER_ENABLED` has to be the string `true` before `E2BDesktopProvider` is selected. With the flag off, a key in the environment is ignored. `BROWSERBASE_API_KEY` does not select a provider in this phase.

The E2B class is a stub. It does not send an HTTP request, even when the flag and the key are both set. The live view stays on the sandbox placeholder. The raw live-view token is not stored. The table keeps a SHA-256 hash, or stays empty.

## Enabling E2B later

Billy has to approve any paid plan before a real desktop is created.

E2B Hobby includes free credits. Those credits can run out. A paid plan is a separate decision. Do not put a live key in the repo. When that approval exists:

1. Apply migration step 22 (`supabase/migrations/20261028120000_phase5a_agent_computers.sql`) if it is not already applied. See `supabase/APPLY-ORDER.md`.
2. Set `E2B_API_KEY` in the server environment only.
3. Set `COMPUTER_PROVIDER_ENABLED` to `true` only after the HTTP client is added and the plan is approved.
4. Leave `BROWSERBASE_API_KEY` unset until a browser provider is in scope.

Until that approval, leave the flag unset. The fixture is the provider.
