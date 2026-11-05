# Phone checklist: inbox tag filter

Billy reviews this on a phone. The draft adds tag chips near the filters on `/command-centre/inbox`. It stays off until `INBOX_TAG_FILTER_ENABLED` is the string `true`. Unset, blank, or any other value keeps the list as it is on this stack. There are no tag chips and no tag filter.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change. The chips use tags already stored on the contacts the inbox lists. With the flag on, that same contact join also reads the tags and the linked lead. When the contact has no tags, one read of the linked lead’s tags fills in. Phase 2b is already live. Do not paste that file again. Do not add a column on this visit. If the lead has no tags column, the inbox still loads and only contact tags filter.

Choosing a tag only hides threads on this list. A thread stays when its contact tags include any chosen tag. If the contact has none, the linked lead’s tags are used. That is the same rule as the contact panel. Two chosen tags match with OR: the thread needs one of them, not both. Clear tags brings back the list for Open, Mine, Unassigned, channel, WhatsApp number, and search. It does not write a tag. It does not queue a reply. It does not insert `crm_outbox`. It does not change consent. It does not change who owns the thread. This is not a yes to send.

This is the conversation list. It is separate from Save contact on draft [#100](https://github.com/billyboy95/ai-autotech-/pull/100). That button writes the stage and the contact tags and stays behind `INBOX_CONTACT_PANEL_ENABLED`. It is separate from the search box on draft [#105](https://github.com/billyboy95/ai-autotech-/pull/105). That box stays behind `INBOX_SEARCH_ENABLED`.

## What you are reviewing

This draft. Branch `cursor/inbox-tag-filter-d936`. It stacks on draft [#105](https://github.com/billyboy95/ai-autotech-/pull/105) (`cursor/inbox-conversation-search-353d`). The Files tab on this draft is only the tag filter. It is not the whole inbox stack.

When the flag is the string `true`:

- Tag chips sit with the other inbox filters. Open, Mine, Unassigned, channel, WhatsApp number, and the search box stay where they are.
- Tap one or more tags. The list shows threads that have any chosen tag on the contact, or on the linked lead when the contact has none.
- Tap Clear tags. The list is the normal list for those other filters again.
- A choice that matches nothing says No conversations match these tags.
- A list with no tags says No tags on this list.
- Nothing is delivered. Save contact is unchanged. Queue reply is unchanged.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open the pull request for branch `cursor/inbox-tag-filter-d936`.
3. Read the title and the base branch. The base is `cursor/inbox-conversation-search-353d` (draft #105). If the base is `main`, stop. Do not merge it into main from here.
4. Open Files changed. Pass when the diff is the tag-filter flag, the tag chips, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, changes consent, writes tags from the chips, queues the outbox, adds a migration, or sends WhatsApp, email, or SMS.
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
11. This draft — tag filter (`cursor/inbox-tag-filter-d936`). After #105 is on main.

A yes to one pull request is not a yes to the next. A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_TAG_FILTER_ENABLED`. The value is the string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_SEARCH_ENABLED`, `INBOX_TEMPLATES_PICKER_ENABLED`, `INBOX_INTERNAL_NOTES_ENABLED`, `INBOX_CONTACT_PANEL_ENABLED`, `INBOX_BULK_ACTIONS_ENABLED`, `INBOX_WA_METERING_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, or `INBOX_MULTI_NUMBER_ENABLED` from this page. Each of those is a separate yes.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, open `/command-centre/inbox`. The tag chips are with the filters. Tap a tag that a contact has. That thread stays and the others drop. Tap Clear tags. The list is back. Nothing is delivered. The contact panel, when its own flag is on, is still the only place that writes tags.
