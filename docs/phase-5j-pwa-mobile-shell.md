# Phase 5j sandbox PWA install and mobile shell stubs

Browser install prep for the command centre. Nothing is bought, nothing is submitted to a store, and nothing is sent. `sending_enabled` stays false.

The marketing pages share the same web manifest from the root layout, so a phone browser can install this origin. The start URL is `/command-centre`, which stays behind login. The marketing pages do not claim a store listing.

## Install surface

`/command-centre/install` explains how to install AIOS from the browser:

- iOS Safari: Share, then Add to Home Screen.
- Android Chrome: Install app or Add to Home screen.
- Windows: the browser install icon or the Apps menu.

Settings links to the same steps. The command-centre shell registers a local service worker that does not cache CRM data and does not call out.

Google Play, the Apple App Store, and the Microsoft Store do not have a listing. Paid developer accounts need Billy's explicit yes.

With Supabase keys set and no session, `/command-centre/install` redirects to `/login` (307).

## Feature flag

Leave this unset until step 31 is applied. Unset, blank, or any value other than `true` keeps the install page on fixture copy. Nothing is written.

- `PWA_INSTALL_SHELL_ENABLED=true` may store a sandbox `install_intent` for the signed-in workspace.

The event stays in `install_events`. `surface` is `browser`. `sandbox` stays true. `charged` stays false. No analytics vendor is called. No store API is called.

`EAST_RAND_CAMPAIGN_SEED_ENABLED` and the earlier flags are unchanged.

Leave these unset:

- `CRON_SECRET`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a live email, SMS, Meta, or PayFast key in the environment for this step.

## Mobile stubs

`mobile/capacitor.config.json` and `mobile/pwabuilder.json` name the app **AI AutoTech / AIOS**, the package id `za.co.aiautotech.aios`, and the start URL `/command-centre`. See `mobile/README.md` for how to wrap later.

## Ops readiness

`/agency` and `/command-centre` list PWA install as optional. It is not a go-live blocker and it does not say needs Billy. The checklist still says steps 20 through 29 are unapplied, step 30 is unapplied, and step 31 is unapplied. It does not claim the SQL is applied. `sending_enabled` stays false. `CRON_SECRET` and the channel keys stay as they were.

## Apply the migration

This is step 31 in `supabase/APPLY-ORDER.md`, after step 30:

`supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql`

Steps 20 through 30 are still unapplied. Step 31 is also unapplied. After Billy re-authenticates Supabase, run steps 20 through 30, then step 31. Do not claim this SQL is already applied.

Apply it after step 30. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not schedule a cron.

## Hard limits

- No ad spend, no purchases, and no paid developer accounts.
- No store submissions and no store CLI account creation.
- No secrets in the repo, the migration, or the mobile stubs.
- `sending_enabled` stays false. Do not send.
- Do not set `AI_REPLY_CRON_ENABLED`.
- No provider OAuth.
- No ads.
- East Rand seed and campaigns stay gated. Send now and Go live stay refused.

## Fixture check

With Supabase keys empty, open `/command-centre/install`. The page shows iOS Safari, Android Chrome, and Windows steps, says no store listing is live, and names `PWA_INSTALL_SHELL_ENABLED`. Record install intent does not write.

Open `/command-centre/settings`. The card says Install AIOS on your phone and links to the install page.

Open `/manifest.webmanifest`. The name is AI AutoTech / AIOS and the start URL is `/command-centre`.

Open `/agency` and `/command-centre`. Ops readiness includes PWA install as Optional.

With Supabase keys set and no session, `/command-centre/install` redirects to `/login`.
