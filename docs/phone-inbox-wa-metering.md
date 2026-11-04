# Phone checklist: WhatsApp category, cost, and the free service counter

Billy reviews this on a phone. The draft adds a display on `/command-centre/inbox`. It stays off until `INBOX_WA_METERING_ENABLED` is the string `true`. Unset, blank, or any other value keeps today’s inbox.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change. Do not paste a migration for it.

The counter already lives in phase 2e (`wa_service_sends_this_month`, 1,000 free service messages per WhatsApp number from 1 Oct 2026). Step 12 in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) is that file. This draft does not apply it. If that function is missing, the inbox counts outbound service messages for the calendar month instead. That fallback does not need a new apply step.

## What you are reviewing

Draft [#98](https://github.com/billyboy95/ai-autotech-/pull/98). Branch `cursor/inbox-wa-metering-bd44`. It stacks on draft [#97](https://github.com/billyboy95/ai-autotech-/pull/97) (`cursor/inbox-quick-ux-a99b`). The Files tab on #98 is only the metering change. It is not the whole inbox stack.

When the flag is the string `true`:

- An outbound WhatsApp message shows its category (marketing, utility, authentication, or service) and a cost when that category is stored. A stored cost is shown as stored. A billable category stored at 0 cents shows an estimate from the rate card. A blank category stays hidden. Inbound messages do not get this line.
- Each connected WhatsApp number shows `used / 1000` free service messages for the current calendar month. The month uses the workspace timezone when that value is set, otherwise Africa/Johannesburg.
- The 24-hour window from [#96](https://github.com/billyboy95/ai-autotech-/pull/96) is unchanged. This draft does not block the composer and does not turn sending on.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open https://github.com/billyboy95/ai-autotech-/pull/98 . The branch is `cursor/inbox-wa-metering-bd44`.
3. Read the title and the base branch. The base is `cursor/inbox-quick-ux-a99b` (draft #97). If the base is `main`, stop. Do not merge it into main from here.
4. Open Files changed. Pass when the diff is the metering flag, the inbox display, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, or sends WhatsApp, email, or SMS.
5. Leave the draft as a draft. Do not tap Merge on this visit unless Billy says yes to the whole stack below, in that order.

## Merge order, only after Billy says yes

Merge one pull request at a time, from the bottom of the stack. Wait until the next pull request shows base `main` before you merge it. If it still points at the previous branch, stop. Do not merge it into that branch.

1. [#94](https://github.com/billyboy95/ai-autotech-/pull/94) — filter the inbox by WhatsApp number. Base `main`.
2. [#95](https://github.com/billyboy95/ai-autotech-/pull/95) — team stats. After #94 is on main.
3. [#96](https://github.com/billyboy95/ai-autotech-/pull/96) — 24-hour WhatsApp care window. After #95 is on main.
4. [#97](https://github.com/billyboy95/ai-autotech-/pull/97) — quick replies, collision warning, and the narrow layout. After #96 is on main.
5. [#98](https://github.com/billyboy95/ai-autotech-/pull/98) — WhatsApp category, cost, and the free service counter (`cursor/inbox-wa-metering-bd44`). After #97 is on main.

A yes to one pull request is not a yes to the next. A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_WA_METERING_ENABLED`. The value is the string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, or `INBOX_MULTI_NUMBER_ENABLED` from this page. Each of those is a separate yes.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, `/command-centre/inbox` shows `used / 1000` for each WhatsApp number and a category plus cost on outbound WhatsApp messages that have a category. Messages with no category do not show a cost line. Queue reply still only queues. Nothing is delivered.
