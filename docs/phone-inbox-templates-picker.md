# Phone checklist: inbox templates picker

Billy reviews this on a phone. The draft adds a Templates button on an open thread at `/command-centre/inbox`. It stays off until `INBOX_TEMPLATES_PICKER_ENABLED` is the string `true`. Unset, blank, or any other value keeps the composer as it is on this stack. There is no Templates button and no template list.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change. The list reads `message_templates` for this workspace. The inbox already loads those rows. Phase 2e, step 12, is already live. Do not paste that file again.

Picking a template only puts its text in the reply box. Words in double braces, such as `{{name}}`, stay as written. It does not queue a reply. It does not insert `crm_outbox`. It does not change consent. It does not change who owns the thread. It does not change the Template dropdown that is already on the composer. Outside the 24-hour WhatsApp window, free-form stays blocked. The template text can show in the box, and Queue reply stays off. This is not a yes to send.

This list is the named templates stored for the workspace. WhatsApp rows are the approved ones. Other channels are the templates stored for that channel. It is separate from the quick replies on draft [#97](https://github.com/billyboy95/ai-autotech-/pull/97). Those stay behind `INBOX_QUICK_UX_ENABLED`.

## What you are reviewing

Draft on branch `cursor/inbox-templates-picker-2e3d`. It stacks on draft [#102](https://github.com/billyboy95/ai-autotech-/pull/102) (`cursor/inbox-internal-notes-ca4e`). The Files tab is only the templates picker. It is not the whole inbox stack.

When the flag is the string `true`:

- An open thread shows a Templates button in the reply area, above the message box.
- Tap Templates to open the list. Each row shows the name, the channel, and the category when the template has one.
- A workspace with no approved WhatsApp template and no template on another channel says No templates for this workspace.
- Tap a row and the reply box shows that template text, including `{{name}}` when the template has it. That tap does not queue the reply.
- Queue reply still only queues, and only when the reply box is already open. Nothing is delivered.
- A closed 24-hour WhatsApp window stays closed. Queue reply stays off after you pick a template.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open the pull request for branch `cursor/inbox-templates-picker-2e3d`.
3. Read the title and the base branch. The base is `cursor/inbox-internal-notes-ca4e` (draft #102). If the base is `main`, stop. Do not merge it into main from here.
4. Open Files changed. Pass when the diff is the templates-picker flag, the Templates button, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, changes consent, queues the outbox, adds a migration, or sends WhatsApp, email, or SMS.
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
9. This draft — templates picker (`cursor/inbox-templates-picker-2e3d`). After #102 is on main.

A yes to one pull request is not a yes to the next. A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_TEMPLATES_PICKER_ENABLED`. The value is the string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_INTERNAL_NOTES_ENABLED`, `INBOX_CONTACT_PANEL_ENABLED`, `INBOX_BULK_ACTIONS_ENABLED`, `INBOX_WA_METERING_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, or `INBOX_MULTI_NUMBER_ENABLED` from this page. Each of those is a separate yes.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, open a thread on `/command-centre/inbox`. Tap Templates. The list shows the template name, the channel, and the category when there is one. Tap a template. The reply box shows that text. That tap does not press Queue reply. Nothing is delivered.
