# Phone checklist: inbox contact panel

Billy reviews this on a phone. The draft adds a contact side panel on `/command-centre/inbox`. It stays off until `INBOX_CONTACT_PANEL_ENABLED` is the string `true`. Unset, blank, or any other value keeps today’s inbox: no new contact panel.

This page does not merge a pull request, does not set the flag, does not send, and does not spend. `sending_enabled` stays false. Nothing is sent. Meta is not called. No new SQL file is in this change.

The panel reads the contact already on the thread. Save contact writes the lead stage and the contact tags in this workspace only. It does not change consent. It does not queue a reply and it does not start a sequence.

## What you are reviewing

Draft [#100](https://github.com/billyboy95/ai-autotech-/pull/100). Branch `cursor/inbox-contact-panel-85fc`. It stacks on draft [#99](https://github.com/billyboy95/ai-autotech-/pull/99) (`cursor/inbox-bulk-actions-707e`). The Files tab on #100 is only the contact panel. It is not the whole inbox stack.

When the flag is the string `true`:

- A desktop thread shows the contact beside the messages. On a narrow screen, tap Contact to open or close that same panel.
- The panel shows the name, the phone or email, the linked lead stage, WhatsApp, email, and SMS consent, and tags.
- Tags are the contact’s tags. If the contact has none and the linked lead has tags, those lead tags are shown and labelled as from the lead.
- A missing stage, tag, phone, email, or consent row stays empty or Unknown. The panel does not fill in a guess.
- Save contact updates that lead and that contact only. Assign still only changes who owns the thread. Queue reply still only queues.

## Review the draft

On the phone:

1. Open GitHub and sign in as the account that can see `billyboy95/ai-autotech-`.
2. Open https://github.com/billyboy95/ai-autotech-/pull/100 . The branch is `cursor/inbox-contact-panel-85fc`.
3. Read the title and the base branch. The base is `cursor/inbox-bulk-actions-707e` (draft #99). If the base is `main`, stop. Do not merge it into main from here.
4. Open Files changed. Pass when the diff is the contact-panel flag, the side panel, tests, and this note. Fail and stop if the diff turns `sending_enabled` on, calls Meta, changes consent, or sends WhatsApp, email, or SMS.
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

A yes to one pull request is not a yes to the next. A yes to merge is not a yes to the flag, and it is not a yes to send.

## Set the flag

Do this only after this draft is on main and Production has deployed that commit, and only when Billy says yes to this name.

1. Open Vercel → the CRM project → Settings → Environment Variables.
2. Add `INBOX_CONTACT_PANEL_ENABLED`. The value is the string `true`. Save it for Production only. Leave Preview unset unless he says yes to Preview.
3. A saved name is read on the next Production deployment. If Production already deployed before the name was saved, redeploy that Production deployment only when he says yes.
4. Do not set `INBOX_BULK_ACTIONS_ENABLED`, `INBOX_WA_METERING_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, `INBOX_QUICK_UX_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, or `INBOX_MULTI_NUMBER_ENABLED` from this page. Each of those is a separate yes.
5. Leave `sending_enabled` false. Do not send a test. Do not open a Meta send screen.

## Pass

Signed in, open a thread on `/command-centre/inbox`. The contact panel shows the name, a phone or email, the lead stage, consent for WhatsApp, email, and SMS, and tags. A channel with no consent row says Unknown. Save contact changes the stage or tags on that row only. Queue reply still only queues. Nothing is delivered.
