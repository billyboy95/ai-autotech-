# Mobile shell stubs

This folder is a later wrap for the command centre. It is not a store submission.

The app name is **AI AutoTech / AIOS**. The package id is `za.co.aiautotech.aios`. The Windows identity stub is `AIAutoTech.AIOS`. The start URL is `/command-centre`. The web manifest is `/manifest.webmanifest`.

`capacitor.config.json` is a Capacitor stub. `pwabuilder.json` is a PWABuilder stub. Neither file contains a secret, a store token, or a live `server.url`.

## How to wrap later

Wait until Billy explicitly says yes to a paid developer account. Then:

1. Apply migration step 31 if install intents should be stored. Leave `PWA_INSTALL_SHELL_ENABLED` unset until that file is applied. Set it to the string `true` only after that.
2. Install Capacitor or open PWABuilder against the deployed site. Point the wrapper at the existing Next app. The start URL stays `/command-centre`.
3. For Capacitor, set `server.url` to the deployed command centre only after Billy approves that host. Do not commit a production URL in this stub.
4. Generate signing material on Billy's machine. Do not commit keystores, certificates, or API keys.

## Do not do this in this phase

- Do not create a Google Play, Apple Developer, or Microsoft Store account.
- Do not submit a listing.
- Do not buy a developer seat, a domain, or an ad.
- Do not run a paid CLI that opens an account.
- Do not turn `sending_enabled` on.
- Do not set `AI_REPLY_CRON_ENABLED`.

Google Play, the Apple App Store, and the Microsoft Store do not have a listing. The phone path today is the browser: iOS Safari Add to Home Screen, Android Chrome Install, and the Windows browser install icon. The steps are on `/command-centre/install`.
