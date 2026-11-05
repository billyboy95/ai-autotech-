# Phone checklist: inbox snooze

Billy reviews this on a phone. The draft adds snooze on `/command-centre/inbox` when `INBOX_SNOOZE_ENABLED` is the exact string `true` after trimming spaces. `True`, `TRUE`, `1`, `yes`, blank, and unset keep today's inbox. Open, Mine, and Unassigned stay on the page. No Snooze buttons and no Snoozed chip appear until that exact string is saved.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. One new SQL file is in this change: `supabase/migrations/20261117120000_inbox_snooze.sql`. It adds nullable `conversations.snoozed_until`. It is not a step in `supabase/APPLY-ORDER.md`. Do not paste it until Billy says yes. Do not apply it on this visit. `supabase/APPLY-ORDER.md` names the file and says it waits. Steps 1 through 19 stay already live. Steps 20 through 36 stay unapplied.

Snooze hides a thread until a time. It does not assign a thread. It does not change consent. It does not queue a reply. It does not insert `crm_outbox`. It does not call a provider. This is not a yes to send.

This snooze is separate from the WhatsApp number filter on draft [#94](https://github.com/billyboy95/ai-autotech-/pull/94). It is separate from team stats ([#95](https://github.com/billyboy95/ai-autotech-/pull/95)), the 24-hour window ([#96](https://github.com/billyboy95/ai-autotech-/pull/96)), quick replies ([#97](https://github.com/billyboy95/ai-autotech-/pull/97)), WhatsApp metering ([#98](https://github.com/billyboy95/ai-autotech-/pull/98)), bulk assign and close ([#99](https://github.com/billyboy95/ai-autotech-/pull/99)), the contact panel ([#100](https://github.com/billyboy95/ai-autotech-/pull/100)), seat billing ([#101](https://github.com/billyboy95/ai-autotech-/pull/101)), internal notes ([#102](https://github.com/billyboy95/ai-autotech-/pull/102)), Embedded Signup ([#103](https://github.com/billyboy95/ai-autotech-/pull/103)), the templates picker ([#104](https://github.com/billyboy95/ai-autotech-/pull/104)), search ([#105](https://github.com/billyboy95/ai-autotech-/pull/105)), tag chips ([#106](https://github.com/billyboy95/ai-autotech-/pull/106)), inbound media ([#107](https://github.com/billyboy95/ai-autotech-/pull/107)), status and assignee chips ([#108](https://github.com/billyboy95/ai-autotech-/pull/108)), outbound media ([#109](https://github.com/billyboy95/ai-autotech-/pull/109)), realtime plus unread ([#110](https://github.com/billyboy95/ai-autotech-/pull/110)), and assigned-only scope ([#111](https://github.com/billyboy95/ai-autotech-/pull/111)). Each of those stays behind its own flag. Do not set those names from this page. This draft does not add mentions or typing indicators.

## What you are reviewing

Draft pull request against `main`. Branch `cursor/inbox-snooze-a74d`. The base is `main`. It is not stacked on #94–#111. The Files tab is only this scope. It is not the inbox stack.

When the flag is the exact string `true`, and the column is already on the database:

- An open thread shows Snooze. The choices are 1 hour, Later today, Tomorrow, Next week, and Clear snooze.
- Later today is 18:00 Africa/Johannesburg. If that time is not still ahead, it is 09:00 the next Johannesburg morning.
- Tomorrow is 09:00 Africa/Johannesburg on the next calendar day.
- Next week is 09:00 Africa/Johannesburg on the next Monday. A Monday tap waits until the Monday after.
- The thread stays `open`. It leaves Open, Mine, and Unassigned until `snoozed_until` passes. Then it returns on its own. Clear snooze brings it back immediately.
- A Snoozed chip lists threads whose time is still ahead. The line on the thread says the time and that nothing is sent.
- Nothing is delivered. Queue reply is unchanged.

When the flag is unset, the preview inbox and the signed-in inbox match main. Snooze is not on the page. A link with `filter=snoozed` is the Open list.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open the draft whose branch is `cursor/inbox-snooze-a74d`. The base is `main`.
3. Read the title and the base branch. If the base is an inbox stack branch (`cursor/inbox-multi-number-6d2e` or any later inbox branch, including realtime or assigned-only), stop. Do not merge it into that stack from here.
4. Open Files changed. Pass when the diff is the snooze flag, the list and thread snooze, the one migration, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, changes consent, inserts `crm_outbox` from the snooze action, sets another inbox flag, or sends WhatsApp, email, or SMS.
5. Leave the draft as a draft. Do not tap Merge on this visit unless Billy says yes to this pull request on its own.

## Merge, only after Billy says yes

Merge this draft only when Billy says yes to this pull request. Merge one pull request at a time. A yes to this draft is not a yes to #94–#111, and a yes to one of those is not a yes to this draft.

This branch starts from `main`, not from the inbox stack. If this draft and #94–#111 both land, the inbox stack may need a later rebase because those pull requests edit the same inbox files. This visit does not rebase them.

A yes to merge is not a yes to the SQL, not a yes to the flag, and it is not a yes to send.

## Paste the SQL, only after Billy says yes

Do this only when Billy says yes to `supabase/migrations/20261117120000_inbox_snooze.sql` on its own. A yes to merge is not this yes.

1. Open the Supabase SQL editor for project `fnysxlswzufdnlbhndxc`.
2. Paste that one file whole. Run it once. Expect `Success. No rows returned`.
3. If it fails, stop. Do not set the flag. Do not paste steps 1 through 36 again.
4. This paste does not send and does not tick Sending enabled.

## Set the flag

Do this only after this draft is on main, the snooze SQL has succeeded, and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_SNOOZE_ENABLED`. The value is the exact string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_MULTI_NUMBER_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_WA_METERING_ENABLED`, `INBOX_BULK_ACTIONS_ENABLED`, `INBOX_CONTACT_PANEL_ENABLED`, `INBOX_INTERNAL_NOTES_ENABLED`, `INBOX_TEMPLATES_PICKER_ENABLED`, `INBOX_SEARCH_ENABLED`, `INBOX_TAG_FILTER_ENABLED`, `INBOX_MEDIA_ENABLED`, `INBOX_STATUS_ASSIGNEE_FILTERS_ENABLED`, `INBOX_OUTBOUND_MEDIA_ENABLED`, `INBOX_REALTIME_ENABLED`, or `INBOX_ASSIGNED_ONLY_ENABLED` from this page. Each of those is a separate yes. Do not set `sending_enabled`.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, open `/command-centre/inbox` while the flag is unset. Open, Mine, and Unassigned are on the page, as on main today. Snooze is not on the thread. Nothing is delivered.

After Billy has said yes to the SQL and the flag, and Production is on that commit, open a thread and tap 1 hour. The thread leaves Open and shows under Snoozed. Tap Clear snooze. It returns to Open. Nothing is delivered.
