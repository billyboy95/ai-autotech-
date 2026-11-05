# Phone checklist: WhatsApp Embedded Signup stub (draft, flag off)

Billy reviews the draft panel for Meta Embedded Signup and coexistence. Staff can see how an official WhatsApp Cloud API connect would look. Coexistence means the WhatsApp Business app stays on the same number. This page does not start that connect.

Writing this page does not merge a pull request, does not set a flag, does not send, and does not apply SQL. There is no new migration. `channel_connections` is not written. `sending_enabled` stays false. AI AutoTech will not use unofficial WhatsApp Web/QR session hijacking. Official API only.

The draft pull request is the only place this panel exists until Billy says yes to merge. This visit does not merge it. Production at https://ai-autotech-crm.vercel.app does not show the panel while `WHATSAPP_EMBEDDED_SIGNUP_ENABLED` is unset. Leave it unset on this visit.

Token collection for a later live Cloud API setup stays on [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md). That page is a different yes. This page does not collect `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, or `META_APP_SECRET`.

## Stop until these are true

1. You will review the draft only. You will not merge it. You will not enable the flag in Vercel Production or Preview.
2. `WHATSAPP_EMBEDDED_SIGNUP_ENABLED` stays unset. The panel is off unless the value is the exact string `true`. Unset, blank, `false`, `TRUE`, or `true ` with a space keeps the panel hidden.
3. You will not put a Meta app secret, a token, or a phone-number id in git, a pull request, chat, an issue, or this file.
4. You will not turn `sending_enabled` on. You will not tap Send test, Send now, or Go live. You will not register a webhook.
5. A yes to read this page is not a yes to send, not a yes to Meta app review, and not a yes to become a Tech Provider.

If any check is false, stop.

## 1. Flag off: Connect and Settings look as they do today

Stay on the deployment that does not have the flag. On this visit that is production, and the draft is not merged.

1. Open https://ai-autotech-crm.vercel.app/command-centre/connect-accounts/whatsapp?org=ai-autotech
2. Sign in when the phone lands on `/login`. The documented address is `billyfaber06@gmail.com` when that Auth user exists.
3. Pass: the page still says Billy must add Meta app credentials later. It still says no OAuth runs and no key is stored. It still says Needs provider keys. Send test is still on the sandbox stub. Outbox queued stays 0.
4. Pass: the heading **Connect with Meta Embedded Signup** is absent. The line `needs Meta Tech Provider / Billy keys` is absent.
5. Open https://ai-autotech-crm.vercel.app/command-centre/settings?org=ai-autotech
6. Pass: Automation settings is unchanged. The Embedded Signup heading is absent. The install card is still there.

Facebook / Instagram at `/command-centre/connect-accounts/meta` does not grow this panel. That page is unchanged.

Stop if the Embedded Signup heading is on screen while the flag is unset.

## 2. Optional flag, only after Billy reviews the draft and says yes

Skip this section on the review visit. Leave the flag unset.

A later yes is one name only: `WHATSAPP_EMBEDDED_SIGNUP_ENABLED`. The value is the exact string `true`. Add it on Vercel project `ai-autotech-crm` for the deployment he names. A yes for `META_CONNECT_STUB_ENABLED`, `WHATSAPP_TOKEN`, or a website publish is not this yes. Setting the flag does not send and does not mark a channel connected.

When that deployment is re-read and the flag is the exact string `true`:

1. Open the WhatsApp connect page and Settings again.
2. Pass: both show **Connect with Meta Embedded Signup**.
3. Pass: the copy names official WhatsApp Cloud API and coexistence (the WhatsApp Business app stays on the same number).
4. Pass: the copy says AI AutoTech will not use unofficial WhatsApp Web/QR session hijacking. Official API only.
5. Pass: the checklist reads Meta Business portfolio, Tech Provider, Coexistence, and Webhook later.
6. The button does not open Facebook. The page does not load the Meta SDK. `launch` stays false.

## 3. Missing Meta config

With the flag on and no public numeric app id, the panel is the empty state.

Pass: the amber line is `needs Meta Tech Provider / Billy keys`. The primary button is disabled. Nothing is stored. The app id is not invented on the phone.

`META_APP_SECRET`, `WHATSAPP_APP_SECRET`, and `WHATSAPP_TOKEN` do not fill this gap. A non-numeric value does not count. Leave those names on [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md).

The public id, only after he says yes to that name, is `NEXT_PUBLIC_META_APP_ID` or `META_APP_ID`. It is the numeric id Meta shows on the app: digits only, 8 to 20 characters. It is not the secret. Store it in the password manager. Do not paste it into this file. This draft still does not print the id on the page. The browser bundle for this stub does not read that name.

## 4. App id present is still not a live connect

When a public numeric id is saved and the flag is the exact string `true`:

1. Pass: the panel says a public Meta app id is present and Meta login stays closed.
2. The button can be pressed. The status stays: Preview only. Meta login did not run. The channel stays not connected. `sending_enabled` stays off.
3. The button does not call Meta. It does not set `sending_enabled`. It does not write `channel_connections`.
4. Webhook setup stays later. Do not paste a callback URL on this visit.

Live Embedded Signup still needs Billy, a Meta Tech Provider setup, and Meta app review. This panel is not that review and it is not a yes to send.

## Stop rules

- No real send. Leave **Send test**, **Send now**, and **Go live** untapped.
- No Graph API call. No Facebook login. No QR code. No WhatsApp Web session.
- No spend. No ad. No phone-number purchase.
- No SQL paste. No new migration is waiting. Do not apply steps 20 through 36 from this page.
- No secret in git, a pull request, chat, an issue, or this file.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).
- Leave the other Phase 5 flags on [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). This flag is not on that list. A yes here does not turn those names on.

## Pass means

You left `WHATSAPP_EMBEDDED_SIGNUP_ENABLED` unset. Signed in, the WhatsApp connect page and Settings did not show **Connect with Meta Embedded Signup**. The sandbox stub still says no OAuth and no key is stored. Nothing was sent. `sending_enabled` stayed false. No Meta app secret was saved. No webhook was registered. The draft stayed unmerged.

A pass does not mean Embedded Signup is live, the flag was turned on, a number was connected, or sending was allowed.
