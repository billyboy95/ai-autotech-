# Phone checklist: inbox media

Billy reviews this on a phone. The draft shows images and document chips on an open thread at `/command-centre/inbox`. It stays off until `INBOX_MEDIA_ENABLED` is the string `true`. Unset, blank, or any other value keeps the thread as it is on this stack. There are no thumbnails and no attachment chips.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change. The chips read `messages.media` already stored on each message. Phase 2e, step 12, is already live. Do not paste that file again. Do not add a column on this visit.

Opening a thumbnail only enlarges that image in the thread. A document chip shows the filename and the mime type when they are stored, and opens the stored link. A missing or unsafe link says Attachment unavailable. Nothing is uploaded. It does not queue a reply. It does not insert `crm_outbox`. It does not change consent. It does not change who owns the thread. This is not a yes to send.

This is the open thread. It is separate from the Templates button on draft [#104](https://github.com/billyboy95/ai-autotech-/pull/104). That button only fills the reply box and stays behind `INBOX_TEMPLATES_PICKER_ENABLED`. It is separate from the quick replies on draft [#97](https://github.com/billyboy95/ai-autotech-/pull/97). Those stay behind `INBOX_QUICK_UX_ENABLED`. It is separate from the search box on draft [#105](https://github.com/billyboy95/ai-autotech-/pull/105). That box stays behind `INBOX_SEARCH_ENABLED`. It is separate from the tag chips on draft [#106](https://github.com/billyboy95/ai-autotech-/pull/106). Those stay behind `INBOX_TAG_FILTER_ENABLED`.

## What you are reviewing

Draft for branch `cursor/inbox-media-attachments-6195`. It stacks on draft [#106](https://github.com/billyboy95/ai-autotech-/pull/106) (`cursor/inbox-tag-filter-d936`). The Files tab on this draft is only the media viewer. It is not the whole inbox stack.

When the flag is the string `true`:

- On an open thread, a stored image shows as a thumbnail. Tap it to see it larger. Tap again to shrink it.
- A stored document or link shows the filename and the mime type when those were saved.
- A message with no media stays text only.
- A missing or unsafe link says Attachment unavailable. The thread does not crash.
- Nothing is delivered. Queue reply is unchanged. No file is uploaded.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open the pull request for branch `cursor/inbox-media-attachments-6195`.
3. Read the title and the base branch. The base is `cursor/inbox-tag-filter-d936` (draft #106). If the base is `main`, stop. Do not merge it into main from here.
4. Open Files changed. Pass when the diff is the media flag, the thread chips, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, changes consent, queues the outbox, uploads a file, adds a migration, or sends WhatsApp, email, or SMS.
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
10. [#105](https://github.com/billyboy95/ai-autotech-/pull/105) — conversation search (`cursor/inbox-conversation-search-353d`). After #104 is on main.
11. [#106](https://github.com/billyboy95/ai-autotech-/pull/106) — tag filter (`cursor/inbox-tag-filter-d936`). After #105 is on main.
12. This draft — media on the open thread (`cursor/inbox-media-attachments-6195`). After #106 is on main.

A yes to one pull request is not a yes to the next. A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_MEDIA_ENABLED`. The value is the string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_TAG_FILTER_ENABLED`, `INBOX_SEARCH_ENABLED`, `INBOX_TEMPLATES_PICKER_ENABLED`, `INBOX_INTERNAL_NOTES_ENABLED`, `INBOX_CONTACT_PANEL_ENABLED`, `INBOX_BULK_ACTIONS_ENABLED`, `INBOX_WA_METERING_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, or `INBOX_MULTI_NUMBER_ENABLED` from this page. Each of those is a separate yes.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen. Do not upload a file.

## Pass

Signed in, open `/command-centre/inbox` and open a thread that already has media stored. The image is a thumbnail. Tap it and it grows. A document shows its name. A message with no media stays text. Nothing is delivered.
