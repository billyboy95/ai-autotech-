# Phone checklist: inbox internal notes

Billy reviews this on a phone. The draft adds a staff-only notes section on an open thread at `/command-centre/inbox`. It stays off until `INBOX_INTERNAL_NOTES_ENABLED` is the string `true`. Unset, blank, or any other value keeps the inbox without that notes section. The note line that used to sit under the reply box is behind this same flag, so it stays hidden too.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change. `conversation_notes` is already in phase 2e, step 12, and that step is already live. Do not paste that file again.

Saving a note writes that conversation only. It does not queue a reply. It does not change consent. It does not mark the thread read or closed. It does not start a sequence.

## What you are reviewing

This draft. Branch `cursor/inbox-internal-notes-ca4e`. It stacks on draft [#100](https://github.com/billyboy95/ai-autotech-/pull/100) (`cursor/inbox-contact-panel-85fc`). The Files tab is only the internal notes change. It is not the whole inbox stack.

When the flag is the string `true`:

- An open thread shows Internal notes under the reply box: earlier notes, then a box to add one.
- Each note shows who wrote it and the time in UTC. Your own note says You.
- A thread with no notes says No internal notes yet.
- Save note stores the text on that thread only. Queue reply still only queues. Nothing is delivered.
- The note is not a WhatsApp, email, or SMS message. It does not appear in the customer message list.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open this draft. The branch is `cursor/inbox-internal-notes-ca4e`.
3. Read the title and the base branch. The base is `cursor/inbox-contact-panel-85fc` (draft #100). If the base is `main`, stop. Do not merge it into main from here.
4. Open Files changed. Pass when the diff is the internal-notes flag, the notes section, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, changes consent, queues the outbox, or sends WhatsApp, email, or SMS.
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
8. This draft — internal notes (`cursor/inbox-internal-notes-ca4e`). After #100 is on main.

A yes to one pull request is not a yes to the next. A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_INTERNAL_NOTES_ENABLED`. The value is the string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_CONTACT_PANEL_ENABLED`, `INBOX_BULK_ACTIONS_ENABLED`, `INBOX_WA_METERING_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, or `INBOX_MULTI_NUMBER_ENABLED` from this page. Each of those is a separate yes.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, open a thread on `/command-centre/inbox`. Internal notes shows under the reply box. Save note adds a line with your name and the time. That line is not in the customer messages. Queue reply still only queues. Nothing is delivered.
