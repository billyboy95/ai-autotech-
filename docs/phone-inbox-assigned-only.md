# Phone checklist: inbox assigned-only scope

Billy reviews this on a phone. The draft limits `/command-centre/inbox` when `INBOX_ASSIGNED_ONLY_ENABLED` is the exact string `true` after trimming spaces. `True`, `TRUE`, `1`, `yes`, blank, and unset keep today's inbox. Open, Mine, and Unassigned stay on the page. A membership with `assigned_only` is not given a new restriction by this draft until that exact string is saved.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change. The read uses `memberships.assigned_only` and `conversations.assigned_user_id` from step 12 (`supabase/migrations/20261018120000_phase2e_inbox.sql`). That step is already live. Do not paste it again. Do not add an index on this visit. `supabase/APPLY-ORDER.md` does not gain a new file.

The scope does not assign a thread. It does not change consent. It does not queue a reply. It does not insert `crm_outbox`. It does not call a provider. This is not a yes to send.

This scope is separate from the WhatsApp number filter on draft [#94](https://github.com/billyboy95/ai-autotech-/pull/94). It is separate from team stats ([#95](https://github.com/billyboy95/ai-autotech-/pull/95)), the 24-hour window ([#96](https://github.com/billyboy95/ai-autotech-/pull/96)), quick replies ([#97](https://github.com/billyboy95/ai-autotech-/pull/97)), WhatsApp metering ([#98](https://github.com/billyboy95/ai-autotech-/pull/98)), bulk assign and close ([#99](https://github.com/billyboy95/ai-autotech-/pull/99)), the contact panel ([#100](https://github.com/billyboy95/ai-autotech-/pull/100)), seat billing ([#101](https://github.com/billyboy95/ai-autotech-/pull/101)), internal notes ([#102](https://github.com/billyboy95/ai-autotech-/pull/102)), Embedded Signup ([#103](https://github.com/billyboy95/ai-autotech-/pull/103)), the templates picker ([#104](https://github.com/billyboy95/ai-autotech-/pull/104)), search ([#105](https://github.com/billyboy95/ai-autotech-/pull/105)), tag chips ([#106](https://github.com/billyboy95/ai-autotech-/pull/106)), inbound media ([#107](https://github.com/billyboy95/ai-autotech-/pull/107)), status and assignee chips ([#108](https://github.com/billyboy95/ai-autotech-/pull/108)), outbound media ([#109](https://github.com/billyboy95/ai-autotech-/pull/109)), and realtime plus unread ([#110](https://github.com/billyboy95/ai-autotech-/pull/110)). Each of those stays behind its own flag. Do not set those names from this page. This draft does not add snooze, mentions, or typing indicators.

## What you are reviewing

Draft [#111](https://github.com/billyboy95/ai-autotech-/pull/111). Branch `cursor/inbox-assigned-only-44de`. The base is `main`. It is not stacked on #94–#110. The Files tab is only this scope. It is not the inbox stack.

When the flag is the exact string `true`:

- A signed-in membership for this workspace with `assigned_only` sees conversations where `assigned_user_id` is that user. Unassigned threads and other people's threads stay off the list.
- Open and Mine stay. Unassigned is hidden. A link with `filter=unassigned` does not reveal those threads.
- A search string cannot drop the assignee pin. Realtime for another assignee does not add that thread.
- Opening a thread, a note, assign, close, mark read, and the Conversation AI actions on the inbox use the same rule. A hidden thread is treated as not in this workspace. Nothing is queued.
- No membership row, a membership lookup error, or a signed-out live session fails closed: the list is empty and nothing is sent.
- An agency owner or agency staff member who reaches a client workspace through the parent membership, and any member whose `assigned_only` is false, keeps the full workspace inbox.
- Nothing is delivered. Queue reply is unchanged for a thread they are allowed to open.

When the flag is unset, the preview inbox and the signed-in inbox match main. Unassigned is on the page.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open https://github.com/billyboy95/ai-autotech-/pull/111 . The branch is `cursor/inbox-assigned-only-44de`. The base is `main`.
3. Read the title and the base branch. If the base is an inbox stack branch (`cursor/inbox-multi-number-6d2e` or any later inbox branch, including realtime), stop. Do not merge it into that stack from here.
4. Open Files changed. Pass when the diff is the assigned-only flag, the list and thread scope, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, changes consent, inserts `crm_outbox` from the scope itself, adds a migration, sets another inbox flag, or sends WhatsApp, email, or SMS.
5. Leave the draft as a draft. Do not tap Merge on this visit unless Billy says yes to this pull request on its own.

## Merge, only after Billy says yes

Merge this draft only when Billy says yes to this pull request. Merge one pull request at a time. A yes to this draft is not a yes to #94–#110, and a yes to one of those is not a yes to this draft.

This branch starts from `main`, not from the inbox stack. If this draft and #94–#110 both land, the inbox stack may need a later rebase because those pull requests edit the same inbox files. This visit does not rebase them.

A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_ASSIGNED_ONLY_ENABLED`. The value is the exact string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_MULTI_NUMBER_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_WA_METERING_ENABLED`, `INBOX_BULK_ACTIONS_ENABLED`, `INBOX_CONTACT_PANEL_ENABLED`, `INBOX_INTERNAL_NOTES_ENABLED`, `INBOX_TEMPLATES_PICKER_ENABLED`, `INBOX_SEARCH_ENABLED`, `INBOX_TAG_FILTER_ENABLED`, `INBOX_MEDIA_ENABLED`, `INBOX_STATUS_ASSIGNEE_FILTERS_ENABLED`, `INBOX_OUTBOUND_MEDIA_ENABLED`, or `INBOX_REALTIME_ENABLED` from this page. Each of those is a separate yes. Do not set `sending_enabled`.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, open `/command-centre/inbox` while the flag is unset. Open, Mine, and Unassigned are on the page, as on main today. Nothing is delivered.

After Billy has said yes to the flag and Production is on that commit, sign in as a member whose membership for this workspace has `assigned_only`. The list is only threads assigned to that login. Unassigned is not on the page. An agency owner on the same workspace still sees the full inbox. Nothing is delivered.
