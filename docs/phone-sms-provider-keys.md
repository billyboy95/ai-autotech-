# Phone checklist: SMS provider keys

Billy collects keys for one SMS provider the CRM already supports, so those names can be saved later. This page is still Phone-first unblock, step 5 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). It comes after [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md). The next checklist is [`docs/phone-payfast-sandbox.md`](phone-payfast-sandbox.md) (step 6).

Email stays on [`docs/phone-resend-willem.md`](phone-resend-willem.md) and [`docs/phone-willem-smtp-app-password.md`](phone-willem-smtp-app-password.md). The From address is `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m). `billyfaber06@gmail.com` is the agency owner login. This page does not set an email name and does not use that Gmail address as an SMS sender.

Writing this page does not create an SMS account, buy credit, save an environment value, send a message, or apply SQL. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Gated Phase 5 command-centre panels stay paused. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The production CRM is https://ai-autotech-crm.vercel.app . It is auth-gated. This page does not sign in and does not send from it. The Vercel project is `ai-autotech-crm`. The Supabase project ref is `fnysxlswzufdnlbhndxc`. This page does not open the SQL editor.

## Choose one provider

Pick the provider he already uses. One only. Leave the other providers’ names unset.

For a South African number, SMSPortal and BulkSMS are the usual providers already in the app. Clickatell is also supported. Use Twilio when he already has a Twilio account and names it in section 1. This page does not pick an account for him. Do not invent an account id, a client id, a token, or a phone number.

| Provider | Names, after his yes to that name | Leave unset unless he names a value already on the account |
| --- | --- | --- |
| SMSPortal | `SMSPORTAL_CLIENT_ID` and `SMSPORTAL_API_SECRET` | `SMSPORTAL_SENDER_ID`. Leave `SMSPORTAL_WEBHOOK_SECRET` unset on this visit. |
| BulkSMS | `BULKSMS_TOKEN_ID` and `BULKSMS_TOKEN_SECRET`, or the older pair `BULKSMS_USERNAME` and `BULKSMS_PASSWORD` | `BULKSMS_SENDER_ID` |
| Clickatell | `CLICKATELL_API_KEY` | `CLICKATELL_FROM` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` | No extra Twilio name on this page |

A yes for WhatsApp, Meta, email, or `CRON_SECRET` is not a yes for SMS. A yes for one SMS name is not a yes for the others. A yes for one provider is not a yes to fill a second provider.

The SMS connection form in the app lists SMSPortal, BulkSMS, and Clickatell. Twilio is an environment fallback. When no connection is selected, the send path tries BulkSMS, then Clickatell, then Twilio. SMSPortal env names are copied into a connection later by `scripts/migrate-channel-credentials.mjs`. This page does not run that script and does not call `store_channel_secret`. Saving a name does not send.

## Stop until these are true

1. You will open only the provider he already uses. You will not create an account, start a free trial, or sign up.
2. You will not buy credits, a bundle, or a phone number. You will not add a card or a bank account.
3. You will store secrets in a password manager only. You will not paste them into git, a pull request, chat, an issue, or this file.
4. You will leave every SMS name unset until Billy says yes to that name. A yes for WhatsApp, email, or `CRON_SECRET` is not that yes.
5. You will not turn `sending_enabled` on. You will not send a test, a single SMS, or a campaign. You will not register a webhook on this visit.
6. You will not invent an account id, a client id, a token, a sender id, or a From number.

If any check is false, stop.

## 1. Decide which account already exists

On the phone, ask which provider the business already logs into. Write that one name in the password manager note. Do not open the other three sites.

Stop when he does not name an existing account. Do not tap Sign up, Try for free, Start your free trial, or Register. Creating an account on this visit can ask for a card. This page is not that yes.

Do not open https://ai-autotech-crm.vercel.app to guess the provider. The command centre is auth-gated, and this page does not sign in.

## 2. SMSPortal

Use this section only when section 1 named SMSPortal. Otherwise leave every `SMSPORTAL_` name unset and skip to the provider he named.

On the phone:

1. Open https://cp.smsportal.com/app/#/login
2. Sign in to the account he already uses. Read the address bar. The host is `cp.smsportal.com`.
3. Stop when the screen is Sign up, a free trial, or a payment page. Close that screen. Do not create an account.

Client id and API secret:

1. Open the Profile icon at the top right, then API Keys. On a narrow screen that icon is the account menu. When Profile → API Keys is not on the screen, stop. Do not open billing to hunt for it.
2. Read the list. Look for a REST key. Leave FTP, HTTP, Web Service, and Email keys closed. The app calls `https://rest.smsportal.com/v3/BulkMessages` with the REST client id and API secret. This page does not call that URL.
3. When a REST key is already there, read the Client ID. That value is `SMSPORTAL_CLIENT_ID`. Store it in the password manager. The API secret is shown when the key is created. If the secret is not on screen, stop. Do not tap Change Credentials, and do not create a second key, until he says yes on this call to create a REST key.
4. When no REST key is on the list, stop. Create one only when he says yes on this call to create a REST API key.

When he says yes to create a REST key:

1. Use Create API Key. Choose REST. Leave FTP, HTTP, Web Service, and Email unselected.
2. Let the panel generate the credentials, or type only the values he says. Do not invent a client id.
3. Copy the Client ID and the API Secret once into the password manager, under `SMSPORTAL_CLIENT_ID` and `SMSPORTAL_API_SECRET`. The secret is shown once. Close the screen.
4. Do not add a card. Do not buy credit.

`SMSPORTAL_SENDER_ID` stays unset unless the control panel already shows a sender id and he names that one on this call. Read that label. Do not invent a sender id. Do not register a new sender id on this visit.

`SMSPORTAL_WEBHOOK_SECRET` stays unset. Section 7 covers webhooks. Do not open webhook settings on this visit.

On that control panel, do not open a compose box, a campaign, or test mode. Do not type a handset number. Do not tap Send.

## 3. BulkSMS

Use this section only when section 1 named BulkSMS. Otherwise leave every `BULKSMS_` name unset.

On the phone:

1. Open https://www.bulksms.com and use that site’s Login. Sign in to the account he already uses. Stay on a `bulksms.com` host.
2. Stop when the screen asks you to register, add a card, or buy credits. Close that screen.

Prefer an API token when he says yes to a token. The older username and password pair is only when he already uses that pair and says yes to those two names. Do not save both pairs.

Token pair:

1. Open Settings → Advanced → API Tokens. When the menu says Developer Settings → API Tokens, that is the same list. When neither label is there, stop and read the menu to him. Do not guess a different screen.
2. When a token is already listed and the secret is not on screen, stop. The secret is shown once, at creation. Do not create a replacement token until he says yes on this call to create one.
3. When he says yes to create one, use Create Token. Use only the token name he says. Copy the Token ID and the Token Secret once into the password manager, under `BULKSMS_TOKEN_ID` and `BULKSMS_TOKEN_SECRET`. Close the screen.
4. Do not buy credits on that screen.

Username and password, only when he says yes to that older pair and you are not saving the token pair:

1. The username is the one he uses to sign in. Store it under `BULKSMS_USERNAME`.
2. Store the password in the password manager under `BULKSMS_PASSWORD`. Do not type it into chat. Do not reset the password on this visit. A reset waits for a separate yes, and this page is not that yes. Stop if the password is not already in the password manager.

`BULKSMS_SENDER_ID` stays unset unless the account already shows a sender id and he names that one. Do not invent one. Do not register a new sender on this visit.

Do not open Send message, Compose, or a campaign. The app would later call `https://api.bulksms.com/v1/messages`. This page does not call it.

## 4. Clickatell

Use this section only when section 1 named Clickatell. Otherwise leave `CLICKATELL_API_KEY` and `CLICKATELL_FROM` unset.

On the phone:

1. Open https://www.clickatell.com/sign-in
2. When the screen asks which account, use SMS Platform for an account created after November 2016, or Developer Central for an account created before November 2016. When you cannot tell which one he uses, stop. Do not tap Register.
3. Sign in to the account he already uses.
4. Open My Workspace → API Integrations. When that menu is missing, stop.
5. When an SMS integration is already in the list, open it. The value labeled API Key is `CLICKATELL_API_KEY`. Copy it once into the password manager. Do not tap Generate New Key. That rotates the key. Generate a new key only when he says yes on this call to rotate it.
6. When the list has no SMS integration, stop. Do not create an integration on this visit. Creating one can be a paid package. This page does not buy a package.

`CLICKATELL_FROM` stays unset unless that integration already shows a from value and he names it. Do not invent one.

Do not open a test send, a broadcast, or Communicator to send a campaign. The app would later call `https://platform.clickatell.com/messages`. This page does not call it.

## 5. Twilio

Use this section only when section 1 named Twilio. For South Africa, sections 2 and 3 are the usual path when he already has SMSPortal or BulkSMS. Otherwise leave every `TWILIO_` name unset.

On the phone:

1. Open https://console.twilio.com and sign in to the account he already uses.
2. Stop when the screen is a sign-up, a trial upgrade, or a payment page. Do not create an account. Do not add a card. Do not upgrade.
3. On the console home, read Account SID. That value is `TWILIO_ACCOUNT_SID`. Store it in the password manager. Do not paste it into chat.
4. Read Auth Token. That value is `TWILIO_AUTH_TOKEN`. Copy it once into the password manager. Close the reveal. Do not rotate the token unless he says yes on this call to rotate it.
5. Open Phone Numbers → Manage → Active numbers. When that menu is not on the screen, stop. Do not search for a buy button. `TWILIO_FROM_NUMBER` is a number already on that list, in E.164 form, the number he names. When the list is empty, stop. Do not buy a number. Buying a number spends money.

Do not open Messaging → Try it out. Do not send an SMS from the console.

## 6. Vercel Production names

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row. Choose Production.

Leave each name unset until Billy says yes to that name. A yes for `WHATSAPP_TOKEN`, `RESEND_API_KEY`, `SMTP_PASS`, or `CRON_SECRET` is not a yes for an SMS name. Mark the row Sensitive so the phone does not keep the value on screen after save. Add Preview only when he says yes to Preview.

Set only the names for the one provider from section 1. Skip every other row. Paste from the password manager at the moment you save that name.

| Name | Set it only when |
| --- | --- |
| `SMSPORTAL_CLIENT_ID` | He chose SMSPortal and said yes to this name. |
| `SMSPORTAL_API_SECRET` | He chose SMSPortal and said yes to this name. |
| `SMSPORTAL_SENDER_ID` | He chose SMSPortal, the control panel already shows that sender id, and he said yes to this name. Otherwise leave unset. |
| `SMSPORTAL_WEBHOOK_SECRET` | Leave unset. Section 7. |
| `BULKSMS_TOKEN_ID` | He chose BulkSMS, you stored a token, and he said yes to this name. |
| `BULKSMS_TOKEN_SECRET` | Same token yes. Leave the username pair unset. |
| `BULKSMS_USERNAME` | He chose the older BulkSMS pair and said yes to this name. Leave the token pair unset. |
| `BULKSMS_PASSWORD` | Same older-pair yes. |
| `BULKSMS_SENDER_ID` | He chose BulkSMS, the account already shows that sender id, and he said yes to this name. Otherwise leave unset. |
| `CLICKATELL_API_KEY` | He chose Clickatell and said yes to this name. |
| `CLICKATELL_FROM` | He chose Clickatell, the integration already shows that from value, and he said yes to this name. Otherwise leave unset. |
| `TWILIO_ACCOUNT_SID` | He chose Twilio and said yes to this name. |
| `TWILIO_AUTH_TOKEN` | He chose Twilio and said yes to this name. |
| `TWILIO_FROM_NUMBER` | He chose Twilio, the number is already on the account, and he said yes to this name. |

Leave `RESEND_API_KEY`, `RESEND_FROM`, the SMTP names, the WhatsApp names, the Meta names, `CRON_SECRET`, and the LinkedIn names as they already are. Do not delete a name on this visit.

After save, do not paste a secret into git, a pull request, chat, an issue, or this file.

Saving a name does not send. Saving a name does not turn `sending_enabled` on. `sending_enabled` stays false on every workspace, including https://ai-autotech-crm.vercel.app . `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. A saved variable is read on the next deployment. This page does not ask for a redeploy.

This page does not call `store_channel_secret` and does not run `scripts/migrate-channel-credentials.mjs`.

## 7. Refuse spend, sends, and webhook registration

Do not buy credits, SMS bundles, or a phone number. Do not add a card, a bank account, or a payment method. Do not start a free trial. Do not tap Top up, Buy, Add funds, or Upgrade. You may see a balance on a screen you already opened. Do not read that balance into chat. A low balance is not a yes to buy credit.

Do not send. Do not type a handset number into a send box. Do not send a test, a single SMS, or a campaign. Do not use SMSPortal test mode. Do not tap Send, Send message, Send test, Compose, Broadcast, or Campaign on the provider site. In the CRM, do not tap **Send now**, **Go live**, **Publish**, or **Post now**.

Do not turn `sending_enabled` on. A yes to save a name is not that yes. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.

Webhook registration is a future optional step. It is not this visit. Billy has to say yes on a later call before anyone registers a callback URL. This page is not that yes. A yes to save a key is not a webhook yes. If he says yes to a webhook on this call, stop. Do not paste a URL. Do not open webhook, callback, delivery-report, or status-callback settings to save one. Leave `SMSPORTAL_WEBHOOK_SECRET` unset.

The CRM route that would receive a callback is `/api/webhooks/<provider>/<connectionId>` (`src/app/api/webhooks/[provider]/[connectionId]/route.ts`). The connection id is a database row. This page does not have one and does not invent one. There is no Twilio webhook name on this page.

## 8. Steps 20 through 36 stay unapplied

Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Do not paste them again. Steps 20 through 36 stay unapplied. Do not paste them on this visit. Do not claim Success for them. Do not invent `Success. No rows returned` or `Success. Steps 20–36 applied.` The headers Already live and Unapplied stay as they are. Do not sort migrations by filename. The order in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) is the order.

`SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. It is not an `sbp_` token. The replace checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). This page does not paste a token.

Gated Phase 5 command-centre panels stay paused. Do not set a Phase 5 flag. Do not open a gated panel to prove a key. Do not click Apply Education pack or the Zentrix pack. The pack click order, after SQL Success, is [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md). Packs are not applied. This page does not claim that Success.

## Next

The previous phone checklist is [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md). A yes on that page is not a yes for an SMS name.

The next phone checklist is [`docs/phone-payfast-sandbox.md`](phone-payfast-sandbox.md) (Phone-first unblock, step 6): PayFast sandbox and billing readiness. Leave `BILLING_SANDBOX`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, and `SUPABASE_SERVICE_ROLE_KEY` unset until Billy says yes to sandbox billing. A yes for an SMS name is not that yes. This page does not charge and does not open PayFast.

SQL steps 20 through 36 are still unapplied. The SQL editor page is [`docs/phone-sql-editor-20-36.md`](phone-sql-editor-20-36.md) (step 7). This page does not open it.

## Stop rules

- No real send. No test send. No campaign. No SMSPortal test mode.
- No spend. No credits. No phone-number purchase. No card. No free-trial signup.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Saving env does not change either one.
- No webhook URL registration on this visit. A later optional step waits for Billy’s yes on a later call. Even then, stop before a URL is pasted. This page does not register one.
- No DNS edits.
- No SQL. Steps 1 through 19 stay Already live. Steps 20 through 36 stay unapplied. Do not claim they are applied.
- `SUPABASE_ACCESS_TOKEN` on the ops box is still not an `sbp_` token.
- Do not paste a secret, a token, a client id, or a phone number into git, a pull request, chat, an issue, or this file.
- One provider only. Leave the other providers’ names unset.
- Do not use `billyfaber06@gmail.com` as a sender. Email names stay on the Resend and SMTP pages.
- Tracker item 6 (outbound channels) stays partial (4/8).
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Do not set a Phase 5 flag. Gated command-centre panels stay paused. Do not click a pack.
- Do not set `NEXT_PUBLIC_SITE_URL` on this visit. That check is [`docs/phone-site-url-verify.md`](phone-site-url-verify.md).
- Do not call `store_channel_secret` and do not run `scripts/migrate-channel-credentials.mjs`.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Which one existing provider to use. Do not invent an account.
- Create a REST API key, a BulkSMS token, or rotate a Clickatell or Twilio secret, when the secret was not already on screen.
- Each Vercel name for that one provider, one yes per name.
- A sender id or From number, only when the account already shows it.
- Buy credit, add a card, or buy a Twilio number. This page refuses those.
- A test send or a campaign send. This page refuses those.
- Turn `sending_enabled` on. That yes is separate, and it is not this page.
- Webhook registration. That is a later call. A yes then still comes before any URL is pasted. This page does not register one.
- Apply SQL steps 20 through 36. They stay unapplied. The token on the box is still a chat note.
- PayFast sandbox. That is the next page. An SMS yes is not that yes.
- Merge the website pull requests, spend, or post.

## Pass means

You named one existing provider, or you stopped because he does not already have an account. The required values for that one provider are in the password manager, or you stopped before creating or rotating a secret because he had not said yes. The other providers’ names are unset. Each Vercel Production name is still unset, or it is set only for a name he approved on this call, marked Sensitive. Nothing was sent. No credit was bought. No card was added. No webhook URL was registered. `sending_enabled` is still false. `AUTOMATION_SEND_ENABLED` is still unset, or still the string `false`. Steps 20 through 36 are still unapplied. Gated Phase 5 command-centre panels are still paused.

A pass does not mean SMS is live, a message was sent, credit was bought, a webhook is receiving delivery reports, or SQL steps 20 through 36 are applied.
