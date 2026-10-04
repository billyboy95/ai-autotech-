# Phone checklist: WhatsApp Cloud API and Meta Page keys

Billy collects WhatsApp Cloud API and Meta (Facebook Page, and Instagram only when he already uses it) so the CRM can hold those names later. This page deepens those two channels only. The rest of the channel-key names stay in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Phone-first unblock, step 5). There is no separate `docs/phone-cron-channel-keys.md`. Generating and saving `CRON_SECRET` is [`docs/phone-cron-secret.md`](phone-cron-secret.md). This page does not generate that secret and does not claim it is already set. The schedule paste after that save is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md).

Email send-from is already documented. Resend is [`docs/phone-resend-willem.md`](phone-resend-willem.md). The Google Workspace SMTP App Password path is [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). The From address is `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m). `billyfaber06@gmail.com` is the agency owner login. It is never the From. This page does not set an email name.

Writing this page does not create a Meta account, an app, a token, or a Vercel variable. It does not save an environment value, does not send, and does not apply SQL. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. Gated Phase 5 command-centre panels stay paused. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

## Stop until these are true

1. You will open Meta Developer on the phone. You will not create a Meta account, a Facebook account, a Facebook Page, or an Instagram account on this visit.
2. You will create or reuse an app only after Billy says yes. You will not invent an app id.
3. You will store tokens and ids in a password manager only. You will not paste them into git, a pull request, chat, an issue, or this file.
4. You will leave every WhatsApp and Meta name unset until Billy says yes to that name. A yes for one name is not a yes for the others.
5. You will not turn `sending_enabled` on. You will not send a test. You will not register a webhook URL unless he says yes on this call. This page is not that yes.
6. You will collect `META_IG_USER_ID` only when he already uses Instagram for the business.

If any check is false, stop.

## 1. Open Meta Developer on the phone

On the phone:

1. Open https://developers.facebook.com/apps
2. Sign in with the Meta account he already uses for the business.
3. Pass: the apps list for that account is on screen.

Stop when you cannot tell which account is the business account. Do not create an account to find out. Do not send a message to prove the login.

## 2. Create or reuse an app only after Billy says yes

On that apps list:

1. Read the app names. Leave every app closed until he names one.
2. When he names an existing app, reuse that one. Write the app name in the password manager note. The app id Meta shows stays in that note. It is not an environment name. Do not copy it into git, a pull request, chat, an issue, or this file. Do not invent an app id.
3. When he does not name an existing app, stop. Create an app only when he says yes on this call to create one.

When he says yes to create:

1. Use the create control on that apps page.
2. Use only the app name he says.
3. When the screen lists a WhatsApp use case, choose that one. When it does not, stop and read the list to him. Do not choose an ads use case.
4. Do not add a payment method. Do not open Ads Manager.
5. After the app exists, Meta assigns an app id. Store the app name, and that id, in the password manager note only.

A yes to create the app is not a yes to generate a token, save a Vercel name, send a test, or register a webhook.

## 3. Collect `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`

Stay inside the app from section 2. On the phone:

1. Open WhatsApp in that app. On a narrow screen the product list is often behind a menu icon.
2. When WhatsApp is not on the app, stop. Add the WhatsApp product only when he says yes on this call to add it. A yes to create the app is not that yes, unless he included it in the same yes.
3. Open the API setup screen that shows a phone number id and an access token. When that screen is missing, stop.
4. Read the value labeled Phone number ID. That value is `WHATSAPP_PHONE_NUMBER_ID`. It is the id on that screen. It is not the public WhatsApp number, and it is not a number copied from this repo.
5. Leave Add phone number closed. Adding a number sends a code to a handset and starts display-name review. That is a separate yes, and it is not this page.
6. Read the access token already on that screen. That value is `WHATSAPP_TOKEN`. When the label says temporary, write "temporary" and the date in the password manager. A temporary token expires.
7. Do not tap Generate, or any control that creates a new token, until he says yes on this call to generate one. A system-user token is that same yes. It is separate from a yes to copy the token already on screen.

When he says yes to generate a token:

1. Generate it for the WhatsApp account already on the screen.
2. Leave every ads permission off. Do not add a card.
3. Copy the token once. Close the screen.

Store both values in the password manager under `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. Do not screenshot the token into chat, git, or this file.

On that same API setup screen, do not type a recipient and do not tap Send message or Send.

## 4. Meta Page: `META_PAGE_ACCESS_TOKEN` and `META_PAGE_ID`

On the phone:

1. Open https://business.facebook.com
2. Stay on the same Meta account as section 1. Stop when the account differs.
3. Open the Facebook Page he already uses for the business. When you cannot tell which Page that is, stop. Do not create a Page.
4. Find the number labeled Page ID. It is on the Page’s About or Page transparency, or in that Page’s settings in Meta Business Suite. When no control is labeled Page ID, stop. Do not guess an id from a web address.
5. Store that number in the password manager under `META_PAGE_ID`.

`META_PAGE_ACCESS_TOKEN` waits for his yes to generate a Page token. Storing the Page ID is not that yes.

When he says yes to the Page token:

1. Stay on the app from section 2.
2. Generate a token for that Page only.
3. Leave ads permissions off, including `ads_management` and `ads_read`. Do not open Ads Manager. Do not add a payment method.
4. When the generate control is not on the screen, stop.
5. Copy the token once into the password manager under `META_PAGE_ACCESS_TOKEN`. Close the screen.

## 5. Instagram only when he already uses it

On the phone:

1. When he does not already use Instagram for the business, leave `META_IG_USER_ID` unset. Do not create an Instagram account. Do not convert a personal account. Do not link an account on this visit.
2. When he does, the value is the numeric Instagram account id linked to that Page. It is not the @handle. Read it where the Page shows the linked Instagram account, or in Meta Business Suite under Instagram accounts. When the id is not labeled, stop. Do not invent an id.
3. Store it in the password manager under `META_IG_USER_ID`. The token stays the `META_PAGE_ACCESS_TOKEN` from section 4. Do not create a second token unless he says yes to that second token.

## 6. Vercel Production names

The full channel list, including email, SMS, LinkedIn, and Vault names, is Phone-first unblock, step 5 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). This section sets the WhatsApp and Meta names only.

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row. Choose Production.

Leave each name unset until Billy says yes to that name. Mark the row Sensitive so the phone does not keep the value on screen after save. Add Preview only when he says yes to Preview.

When he says yes to a name, set that one value from the password manager:

| Name | Production value |
| --- | --- |
| `WHATSAPP_TOKEN` | The token from the password manager. It is not written in this file. |
| `WHATSAPP_PHONE_NUMBER_ID` | The Phone number ID from the password manager. |
| `META_PAGE_ACCESS_TOKEN` | The Page token from the password manager. Skip this row until he says yes to this name. |
| `META_PAGE_ID` | The Page ID he confirmed. Skip this row until he says yes to this name. |
| `META_IG_USER_ID` | The Instagram account id, only when he already uses Instagram and says yes to this name. |

Leave these unset on this visit: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_VERSION`, `META_APP_SECRET`, `META_GRAPH_VERSION`. The send path already uses Graph `v21.0` when those version names are unset. Leave `RESEND_API_KEY`, `RESEND_FROM`, and the SMTP names as they already are. Leave `CRON_SECRET`, the SMS names, and the LinkedIn names unset unless a different checklist already saved them. The SMS names are collected on [`docs/phone-sms-provider-keys.md`](phone-sms-provider-keys.md), after this page. The LinkedIn names are collected on [`docs/phone-linkedin-keys.md`](phone-linkedin-keys.md), after that SMS page. This visit does not set them. Do not delete a name on this visit.

Paste a token from the password manager at the moment you save that name. After save, do not paste it into git, a pull request, chat, an issue, or this file.

Saving a name does not send. Saving a name does not turn `sending_enabled` on. `sending_enabled` stays false on every workspace. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A saved variable is read on the next deployment. This page does not ask for a redeploy.

This page does not call `store_channel_secret` and does not run `scripts/migrate-channel-credentials.mjs`.

## 7. Refuse sending, test sends, and webhook registration

Do not turn `sending_enabled` on. A yes to save a name is not that yes. A yes to create an app is not that yes. This page refuses that switch. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.

Do not send a test. On the WhatsApp API setup screen, do not type a phone number and do not tap Send message. Do not send a template. Do not post to the Facebook Page. Do not publish an Instagram post. Do not tap **Send now**, **Go live**, **Publish**, or **Post now** in the CRM.

Webhook registration is a separate gate. The CRM route that would receive a Meta callback is `/api/webhooks/<provider>/<connectionId>` (`src/app/api/webhooks/[provider]/[connectionId]/route.ts`). The connection id is a database row. This page does not have one and does not invent one.

Registering a callback URL in Meta starts production delivery. That includes WhatsApp Configuration → Webhook, a Page webhook, pasting a callback URL, saving a verify token, and subscribing to `messages` or any other field. Do not do that unless Billy says yes on this call to that registration.

This page is not that yes. Leave `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, and `META_APP_SECRET` unset. When he says yes on this call, stop before any URL is pasted. This page still has no connection id and no verify token to type. Write down that he said yes, then stop. Do not invent the URL. A webhook yes does not turn `sending_enabled` on and does not allow a test send.

## 8. Steps 20 through 36 and gated panels stay paused

Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Do not paste them again. Steps 20 through 36 stay unapplied. Do not paste them on this visit. Do not claim Success for them. The headers Already live and Unapplied stay as they are.

`SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. It is not an `sbp_` token. The replace checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). This page does not paste a token.

Gated Phase 5 command-centre panels stay paused. Do not set a Phase 5 flag. Do not open a gated panel to prove a key. Do not click Apply Education pack or the Zentrix pack.

## Stop rules

- No real send. No test send. No spend, no purchases, and no ads.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Saving env does not change either one.
- No webhook URL registration unless he says yes on this call. Even then, stop before a URL is pasted. This page has no connection id and no verify token.
- No DNS edits.
- No SQL. Steps 1 through 19 stay Already live. Steps 20 through 36 stay unapplied. Do not claim they are applied.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still not an `sbp_` token.
- Do not paste a token, an app id, or a phone number id into git, a pull request, chat, an issue, or this file.
- Do not use `billyfaber06@gmail.com` as a From. Email names stay on the Resend and SMTP pages.
- Tracker item 6 (outbound channels) stays partial (4/8).
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Do not set a Phase 5 flag. Gated command-centre panels stay paused.
- Do not set `NEXT_PUBLIC_SITE_URL` on this visit. That check is [`docs/phone-site-url-verify.md`](phone-site-url-verify.md).
- Do not call `store_channel_secret` and do not run `scripts/migrate-channel-credentials.mjs`.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Which existing app to reuse, or a yes to create an app. Never invent an app id.
- Add the WhatsApp product, when section 3 showed it was missing.
- Generate a token, when the API setup screen did not already show one.
- Add a phone number. This page does not do that.
- Each Vercel name, one yes per name: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, and `META_IG_USER_ID` only when he already uses Instagram.
- Generate the Page token.
- Webhook registration. A yes on this call still stops before a URL is pasted.
- A test send. This page refuses it.
- Turn `sending_enabled` on. That yes is separate, and it is not this page.
- Apply SQL steps 20 through 36. They stay unapplied. The token on the box is still a chat note.
- Merge the website pull requests, spend, or post.

## Pass means

You opened Meta Developer on the phone. You did not create an app unless he said yes, and you did not invent an app id. `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are in the password manager, or you stopped before collecting them because he had not said yes. Page and Instagram values are in the password manager only for the names he approved, or you left them unset. Each Vercel Production name is still unset, or it is set only for a name he approved on this call, marked Sensitive. Nothing was sent. `sending_enabled` is still false. No webhook URL was registered. Steps 20 through 36 are still unapplied. Gated Phase 5 command-centre panels are still paused.

A pass does not mean WhatsApp or Meta is live, a message was sent, a webhook is receiving production messages, or SQL steps 20 through 36 are applied.

## Next

The next phone checklist is [`docs/phone-sms-provider-keys.md`](phone-sms-provider-keys.md): one SMS provider (SMSPortal, BulkSMS, Clickatell, or Twilio). It is still Phone-first unblock, step 5. A yes on this page is not a yes for an SMS name. That page does not send, does not buy credit, and does not register a webhook.

After that SMS page, LinkedIn keys are [`docs/phone-linkedin-keys.md`](phone-linkedin-keys.md): `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN`. It is still step 5. A yes on this page, or on the SMS page, is not a yes for a LinkedIn name. That page does not create a LinkedIn app, does not post, and does not buy anything.

After that LinkedIn page, PayFast sandbox is [`docs/phone-payfast-sandbox.md`](phone-payfast-sandbox.md) (step 6). This page does not open an SMS provider, does not open LinkedIn, and does not open PayFast. SQL steps 20 through 36 stay unapplied.
