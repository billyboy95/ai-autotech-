# Phone checklist: inbox open, mine, unassigned, and closed

Billy reviews this on a phone. The draft adds a **Closed** chip on `/command-centre/inbox`. It stays off until `INBOX_STATUS_ASSIGNEE_FILTERS_ENABLED` is the exact string `true` after trimming spaces. `True`, `TRUE`, `1`, `yes`, blank, and unset keep today's list. There is no Closed chip and `filter=closed` does nothing.

Open, Mine, and Unassigned are already on main. This draft does not remove them and does not add a second set. With the flag off, the list is the list main shows today. Open still means not closed (`open` or `pending`). Mine is `assigned_user_id` equal to the signed-in user. Unassigned is `assigned_user_id` null. Closed threads stay out of that list.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change. The chips read `conversations.status` and `conversations.assigned_user_id` from step 12 (`supabase/migrations/20261018120000_phase2e_inbox.sql`). Status is already `open`, `pending`, or `closed`. That step is already live. Do not paste it again. Do not add an index on this visit.

Choosing a chip only hides threads on this list. It does not assign the thread. It does not close it. Assign and close stay on the bulk-actions draft. It does not queue a reply. It does not insert `crm_outbox`. It does not change consent. This is not a yes to send.

This list filter is separate from the WhatsApp number filter on draft [#94](https://github.com/billyboy95/ai-autotech-/pull/94). It is separate from team stats ([#95](https://github.com/billyboy95/ai-autotech-/pull/95)), the 24-hour window ([#96](https://github.com/billyboy95/ai-autotech-/pull/96)), quick replies ([#97](https://github.com/billyboy95/ai-autotech-/pull/97)), WhatsApp metering ([#98](https://github.com/billyboy95/ai-autotech-/pull/98)), bulk assign and close ([#99](https://github.com/billyboy95/ai-autotech-/pull/99)), the contact panel ([#100](https://github.com/billyboy95/ai-autotech-/pull/100)), internal notes ([#102](https://github.com/billyboy95/ai-autotech-/pull/102)), the templates picker ([#104](https://github.com/billyboy95/ai-autotech-/pull/104)), search ([#105](https://github.com/billyboy95/ai-autotech-/pull/105)), tag chips ([#106](https://github.com/billyboy95/ai-autotech-/pull/106)), and media ([#107](https://github.com/billyboy95/ai-autotech-/pull/107)). Each of those stays behind its own flag.

## What you are reviewing

Draft pull request titled **Draft: flag-gated inbox open/mine/unassigned filters**. Branch `cursor/inbox-status-assignee-filters-e53d`. The base is `main`. It is not stacked on #94–#107. The Files tab is only this filter. It is not the inbox stack.

When the flag is the exact string `true`:

- Closed sits with Open, Mine, and Unassigned.
- Open is still today's open list. Closed threads stay off it.
- Mine keeps threads assigned to you, and still hides closed.
- Unassigned keeps threads with no assignee, and still hides closed.
- Closed lists threads whose status is `closed`.
- A choice that matches nothing says No conversations in this filter.
- Nothing is delivered. Queue reply is unchanged. Assign and Close on the thread are unchanged.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open the draft titled **Draft: flag-gated inbox open/mine/unassigned filters**. The branch is `cursor/inbox-status-assignee-filters-e53d`.
3. Read the title and the base branch. The base is `main`. If the base is an inbox stack branch (`cursor/inbox-multi-number-6d2e` or any later inbox branch), stop. Do not merge it into that stack from here.
4. Open Files changed. Pass when the diff is the status-filter flag, the Closed chip, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, changes consent, assigns or closes from the chip, queues the outbox, adds a migration, or sends WhatsApp, email, or SMS.
5. Leave the draft as a draft. Do not tap Merge on this visit unless Billy says yes to this pull request on its own.

## Merge, only after Billy says yes

Merge this draft only when Billy says yes to this pull request. Merge one pull request at a time. A yes to this draft is not a yes to #94–#107, and a yes to one of those is not a yes to this draft.

This branch starts from `main`, not from the inbox stack. If this draft and #94–#107 both land, the inbox stack may need a later rebase because those pull requests edit the same inbox files. This visit does not rebase them.

A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_STATUS_ASSIGNEE_FILTERS_ENABLED`. The value is the exact string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_MULTI_NUMBER_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_WA_METERING_ENABLED`, `INBOX_BULK_ACTIONS_ENABLED`, `INBOX_CONTACT_PANEL_ENABLED`, `INBOX_INTERNAL_NOTES_ENABLED`, `INBOX_TEMPLATES_PICKER_ENABLED`, `INBOX_SEARCH_ENABLED`, `INBOX_TAG_FILTER_ENABLED`, or `INBOX_MEDIA_ENABLED` from this page. Each of those is a separate yes.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, open `/command-centre/inbox` while the flag is unset. Open, Mine, and Unassigned are on the page, as on main today. Closed is not. Tap Mine. The list is threads assigned to you. Tap Unassigned. The list is threads with no assignee. Nothing is delivered.

After Billy has said yes to the flag and Production is on that commit, Closed is beside the other three. Tap it. The list is closed threads only. Tap Open. The usual list is back. Nothing is delivered.
