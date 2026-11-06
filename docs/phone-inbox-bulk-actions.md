# Phone checklist: inbox bulk actions

Billy reviews this on a phone. The draft adds select-many on `/command-centre/inbox`. It stays off until `INBOX_BULK_ACTIONS_ENABLED` is the string `true`. Unset, blank, or any other value keeps today’s inbox: no checkboxes and no bulk toolbar.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change.

Bulk actions update conversation rows only: assignee, open or closed, and unread. They do not queue a reply.

## What you are reviewing

Draft [#99](https://github.com/billyboy95/ai-autotech-/pull/99). Branch `cursor/inbox-bulk-actions-707e`. It stacks on draft [#98](https://github.com/billyboy95/ai-autotech-/pull/98) (`cursor/inbox-wa-metering-bd44`). The Files tab on #99 is only the bulk-action change. It is not the whole inbox stack.

When the flag is the string `true`:

- Each open thread in the list has a checkbox. Closed threads are not selectable.
- Choose several, then Assign (a teammate, or Unassigned), Close, or Mark read. If every selected thread is already closed, the button says Reopen. The open list uses Close.
- Changing Open, Mine, Unassigned, the channel, or the WhatsApp number clears the selection.
- Only the selected conversations in the current workspace are updated. A teammate who only sees their own assignments cannot update anyone else’s threads.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open https://github.com/billyboy95/ai-autotech-/pull/99 . The branch is `cursor/inbox-bulk-actions-707e`.
3. Read the title and the base branch. The base is `cursor/inbox-wa-metering-bd44` (draft #98). If the base is `main`, stop. Do not merge it into main from here.
4. Open Files changed. Pass when the diff is the bulk flag, the inbox checkboxes and toolbar, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, or sends WhatsApp, email, or SMS.
5. Leave the draft as a draft. Do not tap Merge on this visit unless Billy says yes to the whole stack below, in that order.

## Merge order, only after Billy says yes

Merge one pull request at a time, from the bottom of the stack. Wait until the next pull request shows base `main` before you merge it. If it still points at the previous branch, stop. Do not merge it into that branch.

1. [#94](https://github.com/billyboy95/ai-autotech-/pull/94) — filter the inbox by WhatsApp number. Base `main`.
2. [#95](https://github.com/billyboy95/ai-autotech-/pull/95) — team stats. After #94 is on main.
3. [#96](https://github.com/billyboy95/ai-autotech-/pull/96) — 24-hour WhatsApp care window. After #95 is on main.
4. [#97](https://github.com/billyboy95/ai-autotech-/pull/97) — quick replies, collision warning, and the narrow layout. After #96 is on main.
5. [#98](https://github.com/billyboy95/ai-autotech-/pull/98) — WhatsApp category, cost, and the free service counter. After #97 is on main.
6. [#99](https://github.com/billyboy95/ai-autotech-/pull/99) — select several threads, then assign, close, or mark read (`cursor/inbox-bulk-actions-707e`). After #98 is on main.

A yes to one pull request is not a yes to the next. A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_BULK_ACTIONS_ENABLED`. The value is the string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_WA_METERING_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, or `INBOX_MULTI_NUMBER_ENABLED` from this page. Each of those is a separate yes.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, `/command-centre/inbox` shows a checkbox on each open thread. Selecting one or more shows Assign, Close, and Mark read. Those buttons change the selected rows only. Queue reply still only queues. Nothing is delivered.
