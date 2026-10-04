# Phone checklist: production smoke after SQL steps 20–36

Run this on the phone after Supabase SQL steps 20 through 36 have shown Success and `NOTIFY pgrst, 'reload schema';` has shown Success. Run it before any Phase 5 flag is turned on and before Education or Zentrix pack clicks.

Writing this page does not apply SQL, does not set a flag, does not click a pack, and does not load a campaign. Steps 20 through 36 stay unapplied until Billy has seen that Success himself. Do not claim the SQL is applied. Do not claim a flag, a pack, or a campaign is live. These checks are HTTP statuses only. They do not read the database. Cron routes are a different checklist. After `CRON_SECRET` is saved, the phone paste is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This smoke does not call `/api/cron/*`.

## Hard preconditions

All of these are true before the first URL. If one is false, stop. Do not start the smoke. Do not enable a flag. Do not click a pack.

1. Steps 20 through 36 each showed Success. SQL editor: `Success. No rows returned`, or the editor’s equivalent success with no error. That paste is Phone-first unblock, step 7, in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). CLI, only once the token starts with `sbp_`: `Success. Steps 20–36 applied.` That command is Phone-first unblock, step 2. This page does not make either one true.
2. Schema reload has shown Success in the same SQL editor. That line is Phone-first unblock, step 8, item 2:

```sql
NOTIFY pgrst, 'reload schema';
```

It refreshes the PostgREST schema cache. It does not apply another migration and it does not send. If it errors, stop.

3. Steps 1 through 19 are already live. They were applied in production on 27 Sep 2026. They are under Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Do not paste them again.
4. `SUPABASE_ACCESS_TOKEN` may still be a chat note. That is OK for this smoke. This smoke does not run the apply script and does not need an `sbp_` token. Do not paste the token into git, a pull request, chat, or this file.
5. Phase 5 flags are still unset. Do not set one on this visit. The later order is [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This page does not open Vercel to change a name.
6. `sending_enabled` stays false on every workspace. This smoke does not sign in and does not turn sending on.
7. No ad spend. No purchases. No store listing.
8. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). They stay open until Billy says yes to publish. See [`docs/website-publish-decision.md`](website-publish-decision.md).

## Host

Every URL below is on `https://ai-autotech-crm.vercel.app`.

`crm.aiautotech.co.za` is the custom host in [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md). Do not move this smoke to that host until that page’s SSL Ready check has passed. If the custom host does not load, this Vercel hostname stays the smoke target.

Stay logged out. Use a private tab so an old session cookie is not treated as signed in. Do not sign in. Do not tap **Apply Education pack to EASTC**, **Apply Zentrix pack to Zentrix Online**, **Send now**, **Go live**, **Publish**, or **Post now**.

## Public pages

A phone browser shows the page when the status is 200.

| Open | Expected |
| --- | --- |
| https://ai-autotech-crm.vercel.app/login | 200. The sign-in page. You are not signed in. |
| https://ai-autotech-crm.vercel.app/automation | 200. The public Automation page. |
| https://ai-autotech-crm.vercel.app/book/demo | 200. The public booking page. |
| https://ai-autotech-crm.vercel.app/r/ai-autotech | 200. The public review page. |

`/book/demo` can show a booking form, a list of links, or the line that the booking link is not active. Any of those with status 200 is a pass. The wording is not proof that a demo booking row exists. Do not create a booking.

`/r/ai-autotech` can show a review form or the line that the review page is not active. Any of those with status 200 is a pass. The wording is not proof that a review is stored. Do not submit a review.

## Auth gate, logged out

These paths require a session on a production deploy. Logged out, the gate redirects to `/login`.

A phone browser follows that redirect, so the address bar will not show the number 307. Pass on the phone: you land on `/login`, and `next` is the path you opened. Example: `/command-centre` lands on `/login?next=%2Fcommand-centre`. You see the sign-in page. You do not see the command centre, the agency page, or a pack button.

A check that does not follow redirects reports **307** and a `Location` whose path is `/login` with that `next`. That is the same gate.

Open each of these while logged out:

- https://ai-autotech-crm.vercel.app/command-centre
- https://ai-autotech-crm.vercel.app/agency
- https://ai-autotech-crm.vercel.app/command-centre/campaigns
- https://ai-autotech-crm.vercel.app/command-centre/setup
- https://ai-autotech-crm.vercel.app/command-centre/migrations
- https://ai-autotech-crm.vercel.app/command-centre/go-live
- https://ai-autotech-crm.vercel.app/command-centre/owner
- https://ai-autotech-crm.vercel.app/command-centre/ops-secrets
- https://ai-autotech-crm.vercel.app/command-centre/install
- https://ai-autotech-crm.vercel.app/command-centre/social
- https://ai-autotech-crm.vercel.app/command-centre/assistant
- https://ai-autotech-crm.vercel.app/command-centre/ai-replies
- https://ai-autotech-crm.vercel.app/agency/eastc/settings
- https://ai-autotech-crm.vercel.app/agency/zentrix/settings

The same 307-to-login gate covers the other paths under `/command-centre/` and `/agency/`. A miss on any path you open is a fail. Do not sign in to finish the redirect.

`/command-centre/setup` on this smoke is the logged-out gate only. The signed-in fixture checklist is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md). This smoke does not sign in, does not set `SETUP_WIZARD_ENABLED`, and does not tap **Record sandbox checklist event**. A yes for this smoke is not a yes for that flag.

## Open audit intake still validates

Send this once. Stay logged out. Do not open `/audit` and do not submit the form. The body is `{}` only. Do not add a name, email, phone, or consent.

```
POST https://ai-autotech-crm.vercel.app/api/public/audit
Content-Type: application/json

{}
```

The phone address bar is a GET. That is not this check.

On the phone, use a shortcut or an HTTP client that can POST and show the status. iOS Shortcuts: Get Contents of URL, method POST, header `Content-Type` = `application/json`, body the text `{}`.

Expected status: **400**. The JSON has `ok` false and names a missing field. That 400 is validation of the empty object. It does not store a lead. It does not read campaign rows, pack rows, or flags.

Do not send a second body to “fix” the 400. A filled audit is a real intake. One POST of `{}` only. A 429 means stop. Do not retry in a loop.

## Pass means

Every public URL above returned 200. Every logged-out command-centre and agency URL above ended on `/login` (307 when the redirect is not followed). The one POST of `{}` returned 400.

Production answered those checks. A pass does not mean a flag is on, a pack was applied, a campaign row exists, a booking or review was stored, or sending is on. You did not change a flag, click a pack, send, or spend.

## Fail means

Any status differs. That includes a public URL that is not 200, a logged-out command-centre or agency URL that shows the app instead of `/login`, or an audit POST that is not 400.

Stop. Do not enable Phase 5 flags. Do not click the Education pack or the Zentrix pack. Do not open the East Rand dry-load. Do not merge aiautotech #4 or #5. Do not spend. Do not send.

## After a pass

A pass is not a yes for flags, the dry-load, or packs. Do these next, in this order:

1. Phase 5 flags, only the names Billy says yes to: [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This smoke does not set them.
2. East Rand dry-load, draft only: [`docs/phone-campaign-csv-load.md`](phone-campaign-csv-load.md). Nothing is queued. `sending_enabled` stays false.
3. Pack click order: [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md) (Phone-first unblock, step 8 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md)). Education, then Zentrix. Only when Billy says yes. This page does not click either pack. Packs are not applied.

The setup wizard phone checklist is [`docs/phone-setup-wizard.md`](phone-setup-wizard.md). It stays verify-only until step 32 has shown Success and Billy says yes to `SETUP_WIZARD_ENABLED`. This smoke does not open that wizard to store an event and does not set that flag.

This page does not claim steps 20 through 36 are applied, does not claim a flag is live, and does not claim a campaign was loaded.
