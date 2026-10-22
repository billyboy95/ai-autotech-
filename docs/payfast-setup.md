# PayFast setup on your phone

This is for Billy. It sets up the two new income streams: service quotes (once-off) and AIOS membership (monthly). PayFast stays in **sandbox** until you say the word live.

Nothing in this file is a secret. Do not paste a merchant key, a passphrase, or a service-role value into git, a pull request, chat, or this file.

Business email everywhere on these pages is `Willem@aiautotech.co.za` (W-i-l-l-e-m). `billyfaber06@gmail.com` is the owner login. It is never the From.

This page does not apply SQL. This page does not charge a card. This page does not send email or WhatsApp.

## Prices

| Stream | Price on the page | What it is |
| --- | --- | --- |
| Website Starter | R4,500 once-off | Confirmed. VAT excluded. |
| Website Business | R8,950 once-off | Confirmed. VAT excluded. |
| Website Premium | From R16,500 once-off | The quote starts at this amount. VAT excluded. |
| App MVP | From R35,000 build + R750/mo support | The quote starts at the build amount. VAT excluded. |
| App Full | From R85,000 build + R1,500/mo support | The quote starts at the build amount. VAT excluded. |
| Marketing Starter | R3,950/mo retainer | Confirmed. VAT excluded. |
| Marketing Growth | R7,500/mo retainer | Confirmed. VAT excluded. |
| Hosting, domain and SSL | R150/mo | Add-on. VAT excluded. |
| AIOS platform | R299 per month | Live site price. VAT excluded. |
| AIOS agents | From R699 per month | Starter is R699. Pro is R1,499. Always-On is R4,999. VAT excluded. |

## Names to set on Vercel

Project: `ai-autotech-crm`. Settings → Environment Variables → Production. Mark each secret Sensitive.

Set one name at a time, and only after you say yes to that name.

| Name | Value |
| --- | --- |
| `PAYFAST_MODE` | `sandbox` until you say live. Unset also means sandbox. |
| `PAYFAST_MERCHANT_ID` | Sandbox merchant id from https://sandbox.payfast.co.za . The published sandbox id is `10000100`. Do not type a live id while mode is sandbox. |
| `PAYFAST_MERCHANT_KEY` | Sandbox merchant key from the password manager. Not written here. |
| `PAYFAST_PASSPHRASE` | Sandbox Salt Passphrase. It must match PayFast → Settings → Salt Passphrase. Not written here. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already used by the ITN webhook. It stores the payment. Not written here. |
| `NEXT_PUBLIC_SITE_URL` | `https://aiautotech.co.za` so return and notify URLs are right. |

Leave `AUTOMATION_SEND_ENABLED` unset, or set it to `false`. Leave `sending_enabled` false on every workspace. The membership upsell sequence is drafts only. Both gates have to be on before any later sender may run, and this change still does not send.

`BILLING_SANDBOX` still gates the older workspace billing screen. The new quote and membership checkout use `PAYFAST_MODE` instead. Default is sandbox.

## 1. Sandbox only, unless you say live

1. Open https://sandbox.payfast.co.za
2. Read the address bar. It must start with `https://sandbox.payfast.co.za`.
3. If you are on the live PayFast site, close the tab.
4. Copy the merchant id and merchant key into the password manager.
5. Open Settings → Salt Passphrase. Copy that same value into the password manager under `PAYFAST_PASSPHRASE`.
6. On Vercel, set `PAYFAST_MODE` to `sandbox` if it is missing.

Do not create a live merchant on this visit.

## 2. Notify URL

In the sandbox account, the ITN notify URL the app sends is:

`https://aiautotech.co.za/api/webhooks/payfast`

The app also posts it on each checkout as `notify_url`. You do not type a key into that URL.

The webhook checks four things before it stores a payment:

1. The MD5 signature, using `PAYFAST_PASSPHRASE`.
2. The source IP is one of PayFast’s published ranges.
3. The amount matches the quote or the membership.
4. PayFast’s own confirm URL returns `VALID`.

Sandbox confirm URL: `https://sandbox.payfast.co.za/eng/query/validate`

Live confirm URL, only when `PAYFAST_MODE` is `live`: `https://www.payfast.co.za/eng/query/validate`

A failed check does not mark a quote paid and does not activate a membership.

## 3. What the customer does

Service quote:

1. They open `/services` and request a quote.
2. The CRM gets a lead and a quote at the confirmed starting price.
3. They open the quote link and choose Accept and pay.
4. The browser goes to PayFast once-off checkout.

Membership:

1. They open `/membership`.
2. Platform is R299 per month. Agents start at R699 per month. VAT excluded.
3. The browser goes to a PayFast monthly subscription (`subscription_type` 1, monthly, until cancelled).

Returning from PayFast does not mark the payment complete. Only a confirmed ITN does that.

When a service quote is paid, the lead moves to the pipeline stage `membership upsell`. Three draft notes (day 0, day 2, day 5) advise AIOS membership. They stay drafts.

An active membership allows platform access. A past due, suspended, or cancelled membership blocks a client workspace. Agency owners are not blocked. A workspace with no membership row is not blocked. That keeps current clients working until you attach a membership.

## 4. SQL

The migration is not applied. Do not paste it into the Supabase SQL editor until you say yes.

File: `supabase/migrations/20261115120000_income_streams.sql`

It is not one of steps 1 through 36. Steps 20 through 36 stay unapplied. Do not invent Success.

## 5. Live mode, later

Live is a separate yes. When you say yes:

1. Set `PAYFAST_MODE` to the string `live`.
2. Replace `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, and `PAYFAST_PASSPHRASE` with the live values from the password manager.
3. Do not leave the sandbox merchant id in place after that switch.

Until that yes, checkout posts only to `https://sandbox.payfast.co.za/eng/process`.

## Stop

- Do not charge a card on this visit.
- Do not paste the migration.
- Do not turn `sending_enabled` on.
- Do not set `AUTOMATION_SEND_ENABLED` to `true`.
- Do not put a key in git.
- From stays `Willem@aiautotech.co.za`.
