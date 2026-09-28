# Sandbox Zentrix Online workspace pack

`/agency` and `/agency/zentrix/settings` can apply a sandbox pack onto the existing Zentrix Online client. The pack stores three Shopify store stubs. It does not create a second organisation. Nothing is posted, nothing is charged, no ad is bought, and `sending_enabled` stays false.

The older ten-niche catalogue from the Zentrix Shopify migration stays in place. This pack does not replace it and does not call Shopify.

## Store stubs

| Store | Mark | Handle | Storefront placeholder | Public host later |
| --- | --- | --- | --- | --- |
| Pets | Priority | `w1y2f0-rk` | `https://w1y2f0-rk.myshopify.com` | `pets.zentrixonline.co.za` |
| Kitchens | Priority | `desj1r-ic` | `https://desj1r-ic.myshopify.com` | `kitchens.zentrixonline.co.za` |
| Auto | QA / reference | `80ce1e-p8` | `https://80ce1e-p8.myshopify.com` | none in this pack |

Pets and Kitchens are the priority stores. Auto is QA / reference and is not an ad target. The public hosts are notes for later. Live DNS is not required, and this pack does not check DNS.

Each stub is `sandbox` true and `charged` false. No Shopify Admin API token, client secret, or OAuth token is stored. `provider_keys_present` stays false.

When the older `workspace_shopify_stores` rows already exist, apply rewrites the Pets, Kitchens, and Auto myshopify domains to these handles. It does not add or remove catalogue rows, and it does not mark a store connected.

## Apply

Apply Zentrix pack to Zentrix Online is on `/agency` and on `/agency/zentrix/settings`. Agency owners and agency staff can run it. A client admin cannot. Running it again updates the same three rows.

The button does not store anything while the flag is unset. With Supabase keys empty, the page is fixture-only.

## Refusals

Publish, Send, and Go live are refused. Billy must approve sends. Ad spend is refused. The refuse path writes nothing to the outbox. No provider is called.

## Feature flag

Leave this unset until step 29 is applied. Unset, blank, or any value other than `true` keeps the pack visible and fixture-only. Nothing is written.

- `ZENTRIX_WORKSPACE_PACK_ENABLED=true` stores the three sandbox stubs on the existing Zentrix workspace.

`SOCIAL_DRAFTS_ENABLED`, `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`, `CAMPAIGN_CSV_IMPORT_ENABLED`, `EMAIL_SMS_CONNECT_STUB_ENABLED`, `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, and `HOME_CHAT_ENABLED` are unchanged.

Leave these unset:

- `CRON_SECRET`
- `E2B_API_KEY`
- `BROWSERBASE_API_KEY`
- `COMPUTER_PROVIDER_ENABLED`
- `AI_REPLY_CRON_ENABLED`

Do not put a Shopify Admin API token, a Shopify client secret, or a live Meta, SMS, or PayFast key in the environment for this step.

## Apply the migration

This is step 29 in `supabase/APPLY-ORDER.md`, after step 28:

`supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql`

Steps 20 through 29 are still unapplied. After Billy re-authenticates Supabase, run steps 20 through 28, then step 29. Do not claim this SQL is already applied. Then sign in as an agency owner and use Apply Education pack to EASTC. Apply this Zentrix pack later, after `ZENTRIX_WORKSPACE_PACK_ENABLED` is the string `true`.

Apply it after step 28. Do not run it until `SUPABASE_DB_URL` is available. It does not turn sending on. It does not schedule a cron. It does not call Shopify.

## Fixture check

With Supabase keys empty, open `/agency` and `/agency/zentrix/settings`. Both show Apply Zentrix pack to Zentrix Online, Pets and Kitchens as priority, and Auto as QA / reference. The page names `ZENTRIX_WORKSPACE_PACK_ENABLED` and says the stubs are not stored. Publish, Send, and Go live are refused. Nothing is posted.

`/agency/eastc/settings` does not show the Zentrix pack.

With Supabase keys set and no session, `/command-centre`, `/agency`, and `/agency/zentrix/settings` redirect to `/login`.
