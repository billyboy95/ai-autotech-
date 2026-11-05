# Phone checklist: inbox live updates and unread counts

Billy reviews this on a phone. The draft lets `/command-centre/inbox` update the conversation list and the open thread when a message lands, and it moves the unread numbers. It stays off until `INBOX_REALTIME_ENABLED` is the exact string `true` after trimming spaces. `True`, `TRUE`, `1`, `yes`, blank, and unset keep the inbox as it is on main. There is no second realtime subscription and no extra unread badge.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change. Phase 2e, step 12 (`supabase/migrations/20261018120000_phase2e_inbox.sql`), already adds `conversations` and `messages` to `supabase_realtime` when that publication exists. Unread numbers are the `conversations.unread_count` column that step already has. Do not paste that file again. Do not add a publication, an index, or a column on this visit. This page does not edit `supabase/APPLY-ORDER.md`.

A live row only refreshes this screen. It does not queue a reply. It does not insert `crm_outbox`. It does not change consent. It does not assign the thread. It does not turn sending on. This is not a yes to send.

The subscription is scoped to one organisation. A row for another workspace is dropped. Row security on the existing tables stays the other wall.

This draft is separate from the WhatsApp number filter ([#94](https://github.com/billyboy95/ai-autotech-/pull/94)), team stats ([#95](https://github.com/billyboy95/ai-autotech-/pull/95)), the 24-hour window ([#96](https://github.com/billyboy95/ai-autotech-/pull/96)), quick replies ([#97](https://github.com/billyboy95/ai-autotech-/pull/97)), WhatsApp metering ([#98](https://github.com/billyboy95/ai-autotech-/pull/98)), bulk assign and close ([#99](https://github.com/billyboy95/ai-autotech-/pull/99)), the contact panel ([#100](https://github.com/billyboy95/ai-autotech-/pull/100)), seat billing ([#101](https://github.com/billyboy95/ai-autotech-/pull/101)), internal notes ([#102](https://github.com/billyboy95/ai-autotech-/pull/102)), Embedded Signup ([#103](https://github.com/billyboy95/ai-autotech-/pull/103)), the templates picker ([#104](https://github.com/billyboy95/ai-autotech-/pull/104)), search ([#105](https://github.com/billyboy95/ai-autotech-/pull/105)), tag chips ([#106](https://github.com/billyboy95/ai-autotech-/pull/106)), inbound media ([#107](https://github.com/billyboy95/ai-autotech-/pull/107)), status and assignee filters ([#108](https://github.com/billyboy95/ai-autotech-/pull/108)), and outbound media attach ([#109](https://github.com/billyboy95/ai-autotech-/pull/109)). Each of those stays behind its own flag. This draft does not set those flags.

## What you are reviewing

Draft [#110](https://github.com/billyboy95/ai-autotech-/pull/110). Branch `cursor/inbox-realtime-unread-d2b8`. The base is `main`. It is not stacked on #94–#109. It can land on its own after Billy says yes to this pull request. It does not have to wait for the inbox stack, and the inbox stack does not have to wait for it. If both land, the stack may need a later rebase because those pull requests also edit inbox files. This visit does not rebase them.

When the flag is the exact string `true`:

- The inbox shows the line `Live for this workspace. Nothing is sent.`
- A new inbound or outbound message in this workspace updates the list and the open thread without reloading the browser.
- The blue unread number on a conversation comes from `conversations.unread_count`. The line `N unread in this view` uses those same numbers.
- A row from another workspace does not appear.
- Nothing is delivered. Queue reply is unchanged.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open https://github.com/billyboy95/ai-autotech-/pull/110 . The branch is `cursor/inbox-realtime-unread-d2b8`.
3. Read the title and the base branch. The base is `main`. If the base is an inbox stack branch (`cursor/inbox-multi-number-6d2e`, `cursor/inbox-media-attachments-6195`, `cursor/inbox-outbound-media-dbde`, or any later inbox branch), stop. Do not merge it into that stack from here.
4. Open Files changed. Pass when the diff is the realtime flag, the live list, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, changes consent, assigns a thread by itself, queues the outbox, adds a migration, or sends WhatsApp, email, or SMS.
5. Leave the draft as a draft. Do not tap Merge on this visit unless Billy says yes to this pull request on its own.

## Merge, only after Billy says yes

Merge this draft only when Billy says yes to this pull request. A yes to this draft is not a yes to #94–#109, and a yes to one of those is not a yes to this draft.

This branch starts from `main`, not from the inbox stack. It can land before, after, or without #94–#109. Do not rebase it onto those branches from this page.

A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables.
2. Add `INBOX_REALTIME_ENABLED`. The value is the exact string `true`. `True` stays off. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_MULTI_NUMBER_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_WA_METERING_ENABLED`, `INBOX_BULK_ACTIONS_ENABLED`, `INBOX_CONTACT_PANEL_ENABLED`, `INBOX_INTERNAL_NOTES_ENABLED`, `INBOX_TEMPLATES_PICKER_ENABLED`, `INBOX_SEARCH_ENABLED`, `INBOX_TAG_FILTER_ENABLED`, `INBOX_MEDIA_ENABLED`, `INBOX_STATUS_ASSIGNEE_FILTERS_ENABLED`, or `INBOX_OUTBOUND_MEDIA_ENABLED` from this page. Each of those is a separate yes.
5. Leave `sending_enabled` false. Do not set `AUTOMATION_SEND_ENABLED`. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, open `/command-centre/inbox` while the flag is unset. The page looks as it does on main. The line `Live for this workspace. Nothing is sent.` is absent. Nothing is delivered.

After Billy has said yes to the flag and Production is on that commit, that line is on the page. A new message in this workspace shows on the list and in the open thread without reloading the browser. The unread number matches `conversations.unread_count`. Nothing is delivered.
