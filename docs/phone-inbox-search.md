# Phone checklist: inbox conversation search

Billy reviews this on a phone. The draft adds a search box above the conversation list at `/command-centre/inbox`. It stays off until `INBOX_SEARCH_ENABLED` is the string `true`. Unset, blank, or any other value keeps the list as it is on this stack. There is no search box and no query filter.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change. The list is the conversations the inbox already loads. With the flag on, that same contact join also reads the email and the phone, and one read of messages already stored fills an empty preview line. Phase 2e, step 12, is already live. Do not paste that file again.

Typing filters the threads already on the screen. It matches the contact name, the phone or email on that contact, and the preview line. It does not ask the server again for each letter. It does not queue a reply. It does not insert `crm_outbox`. It does not change consent. It does not change who owns the thread. This is not a yes to send.

This is the conversation list. It is separate from the Templates button on draft [#104](https://github.com/billyboy95/ai-autotech-/pull/104). That button only fills the reply box and stays behind `INBOX_TEMPLATES_PICKER_ENABLED`. It is separate from the quick replies on draft [#97](https://github.com/billyboy95/ai-autotech-/pull/97). Those stay behind `INBOX_QUICK_UX_ENABLED`.

## What you are reviewing

This draft. Branch `cursor/inbox-conversation-search-353d`. It stacks on draft [#104](https://github.com/billyboy95/ai-autotech-/pull/104) (`cursor/inbox-templates-picker-2e3d`). The Files tab is only the conversation search. It is not the whole inbox stack.

When the flag is the string `true`:

- A search box sits above the conversation list. Open, Mine, Unassigned, channel, and WhatsApp number stay where they are.
- Type a name, a phone, an email, or words from the preview line. The list shows the threads that match. The other filters stay in force.
- Clear the box. The list is the normal list for those filters again.
- A query that matches nothing says No conversations match this search.
- The list updates shortly after you pause. It does not send a new request for each letter.
- Nothing is delivered. Queue reply is unchanged.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open the pull request for branch `cursor/inbox-conversation-search-353d`.
3. Read the title and the base branch. The base is `cursor/inbox-templates-picker-2e3d` (draft #104). If the base is `main`, stop. Do not merge it into main from here.
4. Open Files changed. Pass when the diff is the search flag, the search box, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, changes consent, queues the outbox, adds a migration, or sends WhatsApp, email, or SMS.
5. Leave the draft as a draft. Do not tap Merge on this visit unless Billy says yes to the whole stack below, in that order.

## Merge order, only after Billy says yes

Merge one pull request at a time, from the bottom of the stack. Wait until the next pull request shows base `main` before you merge it. If it still points at the previous branch, stop. Do not merge it into that branch.

1. [#94](https://github.com/billyboy95/ai-autotech-/pull/94) — filter the inbox by WhatsApp number. Base `main`.
2. [#95](https://github.com/billyboy95/ai-autotech-/pull/95) — team stats. After #94 is on main.
3. [#96](https://github.com/billyboy95/ai-autotech-/pull/96) — 24-hour WhatsApp care window. After #95 is on main.
4. [#97](https://github.com/billyboy95/ai-autotech-/pull/97) — quick replies, collision warning, and the narrow layout. After #96 is on main.
5. [#98](https://github.com/billyboy95/ai-autotech-/pull/98) — WhatsApp category, cost, and the free service counter. After #97 is on main.
6. [#99](https://github.com/billyboy95/ai-autotech-/pull/99) — select several threads, then assign, close, or mark read. After #98 is on main.
7. [#100](https://github.com/billyboy95/ai-autotech-/pull/100) — contact side panel (`cursor/inbox-contact-panel-85fc`). After #99 is on main.
8. [#102](https://github.com/billyboy95/ai-autotech-/pull/102) — internal notes (`cursor/inbox-internal-notes-ca4e`). After #100 is on main.
9. [#104](https://github.com/billyboy95/ai-autotech-/pull/104) — templates picker (`cursor/inbox-templates-picker-2e3d`). After #102 is on main.
10. This draft — conversation search (`cursor/inbox-conversation-search-353d`). After #104 is on main.

A yes to one pull request is not a yes to the next. A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_SEARCH_ENABLED`. The value is the string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_TEMPLATES_PICKER_ENABLED`, `INBOX_INTERNAL_NOTES_ENABLED`, `INBOX_CONTACT_PANEL_ENABLED`, `INBOX_BULK_ACTIONS_ENABLED`, `INBOX_WA_METERING_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, or `INBOX_MULTI_NUMBER_ENABLED` from this page. Each of those is a separate yes.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, open `/command-centre/inbox`. The search box is above the list. Type a contact name. That thread stays and the others drop. Clear the box. The list is back. Nothing is delivered.
