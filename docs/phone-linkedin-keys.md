# Phone checklist: LinkedIn keys

Billy collects LinkedIn keys for the LinkedIn account and Company Page he already uses for AI AutoTech, so those names can be saved later. This page is still Phone-first unblock, step 5 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). It comes after [`docs/phone-sms-provider-keys.md`](phone-sms-provider-keys.md). The next checklist is [`docs/phone-payfast-sandbox.md`](phone-payfast-sandbox.md) (step 6).

Email stays on [`docs/phone-resend-willem.md`](phone-resend-willem.md) and [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). WhatsApp and the Meta Page stay on [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md). SMS stays on [`docs/phone-sms-provider-keys.md`](phone-sms-provider-keys.md). This page does not set those names.

Writing this page does not create a LinkedIn account, a Company Page, or a LinkedIn app. It does not buy anything, save an environment value, post, or apply SQL. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Gated Phase 5 command-centre panels stay paused. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The production CRM is https://ai-autotech-crm.vercel.app . It is auth-gated. This page does not sign in and does not post from it. The Vercel project is `ai-autotech-crm`. The Supabase project ref is `fnysxlswzufdnlbhndxc`. This page does not open the SQL editor.

TikTok has no provider env name in this repo. `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED` is a flag, not a send key. Leave it unset. Section 7.

## Names on this page

Document only. No token and no organization id are written in this file.

| Name | What to store, after his explicit LinkedIn yes to that name |
| --- | --- |
| `LINKEDIN_ACCESS_TOKEN` | The access token from the password manager. It is not a Client ID and it is not a Client Secret. |
| `LINKEDIN_AUTHOR_URN` | The Company Page author value from the password manager. The number in it comes from the address bar in section 2. |

Leave these unset on this visit:

| Name | Why it stays unset |
| --- | --- |
| `LINKEDIN_VERSION` | The send path in `src/lib/automation/social.ts` already uses `202502` when this name is unset. Do not type a different version. |
| `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED` | A flag for the step 28 stub. Not a TikTok key. TikTok has no provider env in this repo. |
| `SOCIAL_DRAFTS_ENABLED` | A flag for step 28. This page does not store a draft. |

A yes for WhatsApp, a Meta Page, SMS, email, or `CRON_SECRET` is not a LinkedIn yes. A yes for one LinkedIn name is not a yes for the other. Saving a name does not send.

There is no `LINKEDIN_CLIENT_ID` and no `LINKEDIN_CLIENT_SECRET` in this repo. Do not invent those names on Vercel. Sign In with LinkedIn (`linkedin_oidc`) is a login button in [`docs/agency-owner-setup.md`](agency-owner-setup.md). This page does not turn that on and does not set `NEXT_PUBLIC_AUTH_PROVIDERS`.

LinkedIn is not a Vault provider here. This page does not call `store_channel_secret` and does not run `scripts/migrate-channel-credentials.mjs`.

## Stop until these are true

1. You will use the LinkedIn account he already uses for AI AutoTech. You will not create a LinkedIn account.
2. You will open the Company Page he already uses. You will not create a Company Page.
3. You will not create a LinkedIn app. You will not open https://www.linkedin.com/developers/apps/new . You will not open https://www.linkedin.com/company/setup/new .
4. You will not buy LinkedIn Premium, Sales Navigator, InMail, ads, or a boost. You will not add a card.
5. You will store the token and the author value in a password manager only. You will not paste them into git, a pull request, chat, an issue, or this file.
6. You will leave `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN` unset until Billy says yes to that LinkedIn name. A yes for WhatsApp, a Meta Page, SMS, email, or `CRON_SECRET` is not that yes.
7. You will not turn `sending_enabled` on. You will not publish a test post, a campaign post, or a live post. You will not call `https://api.linkedin.com`.

If any check is false, stop.

## 1. Open the account he already uses

On the phone browser, not the LinkedIn app. The address bar is the check later.

1. Open https://www.linkedin.com/
2. Sign in with the account he already uses for AI AutoTech.
3. Pass: that account’s home is on screen.

Stop when you cannot tell which account is the business account. Do not create an account to find out. Do not post, comment, or react to prove the login.

## 2. Company Page and `LINKEDIN_AUTHOR_URN`

On that same account:

1. Open the Company Page he already uses for AI AutoTech. He names the page. Do not pick a page from search. When he does not name one, stop. Do not tap Create, Create a Page, or any setup link.
2. Open the admin view of that page. On a narrow screen the control is often Admin view, or behind the page menu. When admin view is not on the screen, stop. Do not create a page to get an admin view.
3. Read the address bar. The path contains `/company/` and then either a number or a name.

When the piece immediately after `/company/` is only digits, that number is the organization id. In the password manager, under the name `LINKEDIN_AUTHOR_URN`, store `urn:li:organization:` immediately followed by that number. No spaces. Do not write the number in this file, in git, in a pull request, or in chat.

When that piece is a name, stop. Do not turn the name into a number. Do not call `https://api.linkedin.com`. Do not create an app to look up an id. A vanity name is not `LINKEDIN_AUTHOR_URN`.

When he posts as the member and not as that Company Page, stop. A person id is not in the profile URL. This page does not call LinkedIn to look one up. Do not invent a value that starts with `urn:li:person:`.

Storing the author value in the password manager is not a yes to save it on Vercel, and it is not a yes to post.

## 3. Existing app only

A token needs an app he already has. This page does not create one.

On the phone:

1. Open https://www.linkedin.com/developers/apps
2. Stay on the same LinkedIn account as section 1. Stop when the account differs.
3. Read the app list. Leave every app closed until he names the one he already uses for this Company Page.
4. When the list is empty, or he does not name an app, stop. Do not tap Create app. Do not open https://www.linkedin.com/developers/apps/new . Close the tab.

When he names an existing app, open that one:

1. Read the products already on it. Do not tap Request access or Add product.
2. Do not request Community Management, Share on LinkedIn, Advertising, or Marketing Developer Platform. If the app has no product that can issue a token, stop. This page does not apply for a product.
3. On the Auth tab, Client ID and Client Secret stay on that screen. They are not `LINKEDIN_ACCESS_TOKEN`. Do not copy them into the password manager under that name. Do not generate a new Client Secret.

A yes to look at the app is not a yes to generate a token, save a Vercel name, or post.

## 4. `LINKEDIN_ACCESS_TOKEN`

Use the token already in the password manager when he says that token belongs to the app from section 3. That value is `LINKEDIN_ACCESS_TOKEN` after he says yes to that name. Do not generate a second token.

Generate a token only when no token is already stored, the app from section 3 is open, and he says yes on this call to generate a LinkedIn token. A yes for WhatsApp, a Meta Page, SMS, email, or `CRON_SECRET` is not that yes. A yes to save the author value is not that yes.

When he says yes to generate:

1. Open https://www.linkedin.com/developers/tools/oauth/token-generator
2. Select only the app he named in section 3. When the screen says create an app, stop. Do not create one.
3. When the generator asks you to type a redirect URL, stop. Do not type one. Do not paste a URL from this repo, a Vercel URL, or a webhook URL. When the generator cannot run unless you type a URL, stop.
4. Use only scopes the screen already lists for that app. Do not request a new product to unlock a scope.
5. When a token is shown, copy it once into the password manager under `LINKEDIN_ACCESS_TOKEN`. Write the date next to it. LinkedIn access tokens expire. Close the screen.

The generator’s consent screen is not a post. Do not tap Post, Share, or Publish on it. Do not type post copy.

## 5. Vercel Production names

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row. Choose Production.

Leave each name unset until Billy says yes to that LinkedIn name. A yes for `WHATSAPP_TOKEN`, `META_PAGE_ACCESS_TOKEN`, an SMS name, `RESEND_API_KEY`, `SMTP_PASS`, or `CRON_SECRET` is not a LinkedIn yes. Mark the row Sensitive so the phone does not keep the value on screen after save. Add Preview only when he says yes to Preview.

Paste from the password manager at the moment you save that name.

| Name | Set it only when |
| --- | --- |
| `LINKEDIN_ACCESS_TOKEN` | He said yes to this LinkedIn name, and the token is in the password manager. |
| `LINKEDIN_AUTHOR_URN` | He said yes to this LinkedIn name, and section 2 stored the Company Page value. |

Leave `LINKEDIN_VERSION` unset. Leave `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED` and `SOCIAL_DRAFTS_ENABLED` unset. Leave `RESEND_API_KEY`, `RESEND_FROM`, the SMTP names, the WhatsApp names, the Meta names, `CRON_SECRET`, and the SMS names as they already are. Do not delete a name on this visit.

After save, do not paste the token or the author value into git, a pull request, chat, an issue, or this file.

Saving a name does not send. Saving a name does not turn `sending_enabled` on. `sending_enabled` stays false on every workspace, including https://ai-autotech-crm.vercel.app . `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. The publish path reads these names and does not post while that switch is unset or any value other than the string `true`. A saved variable is read on the next deployment. This page does not ask for a redeploy.

This page does not call `store_channel_secret` and does not run `scripts/migrate-channel-credentials.mjs`.

## 6. Refuse test posts, campaign posts, and live sends

Do not post. Do not tap Start a post, Post, Share, Repost, Comment, Publish, or Boost on LinkedIn. Do not publish a test post. Do not publish a campaign post. Do not publish a live post as the Page or as the member. Do not type post copy into LinkedIn to see if the token works.

Do not open Campaign Manager. Do not open LinkedIn ads. Do not sponsor, promote, or boost a post. Do not buy Premium, Sales Navigator, or InMail. Do not add a card. You may see a Premium or ads offer on a screen you already opened. Close it. Do not read a price into chat.

Do not call `https://api.linkedin.com`, including `https://api.linkedin.com/rest/posts`. Do not use the token to send a request. A yes to generate a token is not a yes to post.

In the CRM, do not open `/command-centre/social` or `/command-centre/connect-accounts/linkedin` to post. Do not tap **Send now**, **Go live**, **Publish**, or **Post now**. This page does not sign in to https://ai-autotech-crm.vercel.app .

Do not turn `sending_enabled` on. A yes to save a name is not that yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.

Do not register a webhook. Do not type a callback URL. LinkedIn has no webhook name on this page.

## 7. TikTok stub stays unset

TikTok has no provider env name in this repo. There is no TikTok token name and no TikTok author name to collect. Do not invent one. Do not create a TikTok app. Do not buy TikTok ads.

`TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED` stays unset until step 28 is applied, and it stays unset on this visit even then unless a later checklist says otherwise. That flag is not a send key. `SOCIAL_DRAFTS_ENABLED` stays unset. The stub pages are described in [`docs/social-drafts.md`](social-drafts.md) and [`docs/connect-import.md`](connect-import.md). This page does not open them and does not save a stub.

## 8. Steps 20 through 36 stay unapplied

Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Do not paste them again. Steps 20 through 36 stay unapplied. Do not paste them on this visit. Do not claim Success for them. Do not invent `Success. No rows returned` or `Success. Steps 20–36 applied.` The headers Already live and Unapplied stay as they are. Do not sort migrations by filename. The order in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) is the order.

`SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. It is not an `sbp_` token. The replace checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). This page does not paste a token.

Gated Phase 5 command-centre panels stay paused. Do not set a Phase 5 flag. Do not open a gated panel to prove a key. Do not click Apply Education pack or the Zentrix pack. The pack click order, after SQL Success, is [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md). Packs are not applied. This page does not claim that Success.

## Next

The previous phone checklist is [`docs/phone-sms-provider-keys.md`](phone-sms-provider-keys.md). A yes on that page is not a yes for a LinkedIn name. WhatsApp and Meta are [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md), before the SMS page. A yes on that page is not a LinkedIn yes either.

The next phone checklist is [`docs/phone-payfast-sandbox.md`](phone-payfast-sandbox.md) (Phone-first unblock, step 6): PayFast sandbox and billing readiness. Leave `BILLING_SANDBOX`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, and `SUPABASE_SERVICE_ROLE_KEY` unset until Billy says yes to sandbox billing. A yes for a LinkedIn name is not that yes. This page does not charge and does not open PayFast.

SQL steps 20 through 36 are still unapplied. The SQL editor page is [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md) (step 7). This page does not open it.

## Stop rules

- No test post. No campaign post. No live social send. No comment and no boost.
- No new LinkedIn app. No new Company Page. No new LinkedIn account.
- No spend. No Premium. No Sales Navigator. No InMail. No ads. No card.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Saving env does not change either one.
- No call to `https://api.linkedin.com`.
- No webhook URL. No typed redirect URL.
- No DNS edits.
- No SQL. Steps 1 through 19 stay Already live. Steps 20 through 36 stay unapplied. Do not claim they are applied.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still not an `sbp_` token.
- Do not paste a token, a Client Secret, or an organization id into git, a pull request, chat, an issue, or this file.
- Leave `LINKEDIN_VERSION`, `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`, and `SOCIAL_DRAFTS_ENABLED` unset.
- TikTok has no provider env. Do not invent one.
- Tracker item 6 (outbound channels) stays partial (4/8).
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Do not set a Phase 5 flag. Gated command-centre panels stay paused. Do not click a pack.
- Do not set `NEXT_PUBLIC_SITE_URL` on this visit. That check is [`docs/phone-site-url-verify.md`](phone-site-url-verify.md).
- Do not call `store_channel_secret` and do not run `scripts/migrate-channel-credentials.mjs`.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Which existing Company Page is the AI AutoTech page. Do not create one.
- Which existing LinkedIn app to open. Do not create one. Never invent an app.
- Generate a token, when the password manager does not already have one for that app.
- Request a LinkedIn product. This page refuses that.
- Each Vercel name, one LinkedIn yes per name: `LINKEDIN_ACCESS_TOKEN`, then `LINKEDIN_AUTHOR_URN`.
- A test post, a campaign post, or a live post. This page refuses those.
- Turn `sending_enabled` on. That yes is separate. The later gate is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). A yes for a LinkedIn name is not that yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Set `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`. Leave it unset. It is not a send key.
- Apply SQL steps 20 through 36. They stay unapplied. The token on the box is still a chat note.
- PayFast sandbox. That is the next page. A LinkedIn yes is not that yes.
- Merge the website pull requests, spend, or post.

## Pass means

You opened the LinkedIn account he already uses, or you stopped because you could not tell which account it was. The Company Page author value is in the password manager, or you stopped because the address bar showed a name instead of a number, or because he had not named a page. You did not create an app. The access token is in the password manager, or you stopped before generating one because he had not said yes, or because no existing app could issue a token. Each Vercel Production name is still unset, or it is set only for a LinkedIn name he approved on this call, marked Sensitive. Nothing was posted. Nothing was bought. `sending_enabled` is still false. `AUTOMATION_SEND_ENABLED` is still unset, or still the string `false`. `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED` is still unset. Steps 20 through 36 are still unapplied. Gated Phase 5 command-centre panels are still paused.

A pass does not mean LinkedIn is live, a post was published, a token was tested against the API, TikTok is connected, or SQL steps 20 through 36 are applied.
