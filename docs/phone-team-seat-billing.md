# Phone checklist: team seats and WhatsApp numbers

Billy reviews the draft for team-seat billing on a phone. This page does not merge that draft, does not set an environment variable, does not apply SQL, and does not charge a card.

The billing screen is https://ai-autotech-crm.vercel.app/command-centre/billing . Workspace settings is https://ai-autotech-crm.vercel.app/agency/ai-autotech/settings . Signed out, both land on `/login`. The header chip must read **Sending is off**. If it reads **Sending is on**, stop.

PayFast sandbox stays the only PayFast site: https://sandbox.payfast.co.za . The names for that sandbox are on [`docs/phone-payfast-sandbox.md`](phone-payfast-sandbox.md). This page does not replace that checklist.

## What this draft adds

When `TEAM_SEAT_BILLING_ENABLED` is unset, `/command-centre/billing` and workspace settings look the same as today. There is no seat panel and no extra checkout line.

When that name is the exact string `true`, the billing card shows two read-only counts for the open workspace:

- Team seats, from membership rows.
- Connected WhatsApp numbers, from channel connections whose channel is WhatsApp and whose status is connected.

If those tables cannot be read, the counts say **Unavailable**. They do not show a fake zero. The same card lists two catalogue lines:

| Line | Placeholder amount |
| --- | --- |
| Extra team seat (placeholder) | R149 a month |
| Extra WhatsApp number (placeholder) | R99 a month |

Those rands are placeholders. They are not a price Billy has approved for a client quote. AI AutoTech is not VAT-registered. The lines exclude VAT. Do not add a VAT line. Do not read R149 or R99 out as a quote.

Checkout for those lines still uses the PayFast sandbox form. It refuses a live PayFast host, a merchant id other than `10000100`, and `PAYFAST_MODE=live`. Nothing on the card sends WhatsApp, email, or SMS.

The seed file is `supabase/migrations/20261117120000_team_seat_billing.sql`. It is not an APPLY-ORDER step. It is unapplied. [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) says the same. Do not paste it on this visit.

## Stop until these are true

1. You are reviewing the draft. You will not tap Merge.
2. You will not set `TEAM_SEAT_BILLING_ENABLED` on this visit. A yes to merge later is not a yes for that name.
3. You will not paste `supabase/migrations/20261117120000_team_seat_billing.sql`.
4. You will not open live PayFast. You will not set `PAYFAST_MODE` to `live`. You will not change `PAYFAST_MERCHANT_ID` away from `10000100` if it is already that sandbox id.
5. You will not turn `sending_enabled` on. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
6. You will not treat R149 or R99 as an approved client price.

If any check is false, stop.

## Review the draft on the phone

1. Open GitHub for `billyboy95/ai-autotech-`. Find the draft pull request for team seat billing. It targets `main`.
2. Read the title and the description. It must say draft, flag off, PayFast sandbox, and placeholder prices.
3. Open the changed files. You should see `TEAM_SEAT_BILLING_ENABLED`, `docs/phone-team-seat-billing.md`, and `supabase/migrations/20261117120000_team_seat_billing.sql`.
4. In `.env.example`, `TEAM_SEAT_BILLING_ENABLED` is blank. Blank is off. `TRUE`, `1`, and `true ` with a space are also off. Only the exact string `true` turns the panel on.
5. Leave the pull request open. Do not tap Merge. Do not tap Ready for review unless Billy says that on this call.

Merging this draft does not turn the flag on. Setting the flag does not merge the draft. Those are two separate yeses. This visit is the review. It is not either yes.

With the flag still unset, you can open https://ai-autotech-crm.vercel.app/command-centre/billing after you sign in. Pass: the billing card has no heading **Team seats and WhatsApp numbers**. Sending stays off. That is the current screen, and it stays the current screen until the flag is the string `true`.

## Later, only after both yeses

Do not do this while the pull request is still a draft, and do not do it in the same breath as Merge.

Billy has to say yes to merge, and then a separate yes to the flag. The flag is Production only.

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. Choose Production. Do not add Preview.

| Name | Production value |
| --- | --- |
| `TEAM_SEAT_BILLING_ENABLED` | The exact string `true` |

Leave `BILLING_SANDBOX` as it is. Leave `PAYFAST_MERCHANT_ID` as `10000100` when it is set. Leave `PAYFAST_MODE` unset, or leave it `sandbox`. Do not set `live`.

After that deploy, sign in and open `/command-centre/billing`. Pass: the card shows **Team seats and WhatsApp numbers**, the two counts, and the two lines marked **Placeholder**. The plan menu can list those same lines. Prepare PayFast sandbox checkout still posts only to https://sandbox.payfast.co.za . Do not submit the form on this visit.

The SQL file stays unapplied until Billy says yes to paste it. The screen can show the placeholder lines from the app before that paste. The paste only stores the same placeholder rows in `plans` and, when `pricing_sheet` already exists, in that sheet. It does not charge and it does not send.

## Hard refuse

- Merging this pull request from the phone.
- Setting `TEAM_SEAT_BILLING_ENABLED` before he says yes to that name.
- Setting that name on Preview, or to anything other than the exact string `true`.
- Pasting `supabase/migrations/20261117120000_team_seat_billing.sql` before he says yes.
- Adding a VAT line. Quoting R149 or R99 to a client.
- Opening live PayFast. Setting `PAYFAST_MODE` to `live`. Putting a live merchant id in the environment.
- Submitting the PayFast form. Charging a card.
- Turning `sending_enabled` on. Setting `AUTOMATION_SEND_ENABLED` to `true`.
- Sending WhatsApp, email, or SMS.

## Pass means

You opened the draft pull request on the phone and left it unmerged. `TEAM_SEAT_BILLING_ENABLED` is still unset. The seat migration is still unapplied. R149 and R99 stayed labelled as placeholders. PayFast stayed on the sandbox. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset, or stayed `false`. Nobody was charged and nobody was contacted.

A pass does not mean the draft is merged, the flag is on, or the placeholder prices are approved.
