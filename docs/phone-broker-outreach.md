# Phone checklist: broker outreach funnel (PR #85)

Billy reviews the broker outreach funnel on a phone in South Africa (Safari or Chrome), then stops. Merge, the additive migration, and any send each wait for his own yes. This page is the tap path for [CRM pull request #85](https://github.com/billyboy95/ai-autotech-/pull/85) (`brokers-outreach-funnel`, head `053ea5d`). CI was green on that head (test and Vercel). The preview named on that pull request is https://ai-autotech-ojqotglr3-billyfaber06-6675s-projects.vercel.app/command-centre/outreach . Production stays https://ai-autotech-crm.vercel.app . `crm.aiautotech.co.za` may be unreachable. Do not move this visit onto that host.

Writing this page does not merge #85, does not apply SQL, does not set a flag, does not import a CSV, and does not send. #85 stays open until Billy says yes to merge. Do not claim it is merged. Do not claim `supabase/migrations/20261113120000_outreach_funnel.sql` is applied. There is no outreach flag. Do not turn a Phase 5 flag on to open this page. `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.

The page logs a 2-call funnel: Not contacted, Sent, Replied, Booked call 1, Showed (call 1), Call 2, Closed, and Lost. **Sent** on this page is a stage stamp. It does not send email, SMS, or WhatsApp. The live line is `Manual outreach log. Nothing is sent from this page.` This page has no **Send** button.

Steps 20 through 36 stay on [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). This file is not one of those steps. Do not paste them again from here. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `Willem@aiautotech.co.za` | The only From for AI AutoTech business email. Not used on this page. Do not send. |
| `billyfaber06@gmail.com` | Agency owner login. Never a From. |
| `billy@aiautotech.co.za` | Old example. Do not use it. |

## Order

Do these in this order. A yes for one line is not a yes for the next.

1. Review the preview. Look only.
2. Stop until Billy says yes to merge #85. This page does not merge it.
3. Apply the one additive migration only after that yes, and only after the merge is on `main`. This page does not paste it.
4. Smoke `/command-centre/outreach` on https://ai-autotech-crm.vercel.app .
5. Optional CSV import, only after that smoke shows the live desk. After Billy merges #85 and applies the additive migration, import broker CSV via `/command-centre/outreach` — drafts stay `draft_not_sent`.
6. Never Send without a separate yes. `sending_enabled` stays false.

If a later check is false, stop. Do not skip ahead.

## 1. Review the preview

Look only. Do not tap **Import**, **Save**, **Save note**, or **Mark do-not-contact**. Do not choose a file. Do not merge.

1. Open the preview in a private tab: https://ai-autotech-ojqotglr3-billyfaber06-6675s-projects.vercel.app/command-centre/outreach
2. Signed out, the phone lands on `/login`. `next` is `/command-centre/outreach`. That gate is a pass for the look. You do not see **Outreach funnel** or **Import** while signed out.
3. Sign in only to read the page, as the agency owner when that Auth user already exists. The documented address is `billyfaber06@gmail.com`. After sign-in, open the same preview URL again if the app landed somewhere else.
4. Pass for the look: the eyebrow is **Outreach**. The heading is **Outreach funnel**. The line under it names sent, replied, booked call 1, showed, call 2, closed. The header chip reads **Sending is off**. If the chip reads **Sending is on**, stop.
5. Sample rows are fiction. Businesses are named `Example Brokers … (sample)`. The line `Sample data. Sign in to see your real outreach list.` means the desk is not your list. Do not treat those rows as brokers. Do not edit them.
6. If the line is `The outreach table is not in the database yet. Apply supabase/migrations/20261113120000_outreach_funnel.sql.`, that is expected before the migration. Read it. Do not paste the file on this preview visit.
7. Leave the stage dropdown, **Save**, **Save note**, **Mark do-not-contact**, and **Import** untapped.

A pass here is a review. It is not a merge. It is not Success in the SQL editor. It is not a yes to send.

## 2. Merge only when Billy says yes

[CRM #85](https://github.com/billyboy95/ai-autotech-/pull/85) stays open. Do not merge it from the phone, from this page, or from this agent.

A yes to the preview look is not a yes to merge. A yes to merge is not a yes to paste SQL, not a yes to import, and not a yes to send.

When he says yes, he merges #85 into `main` himself. Wait until that merge is the commit on `main` and the production deploy of that merge is live. This page does not press Merge.

Also leave these unmerged: [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). See [`docs/website-publish-decision.md`](website-publish-decision.md).

## 3. Additive migration, only after that yes

Skip this section while #85 is open. Do not paste this file from the open pull request into production.

After Billy has merged #85 and that file is on `main`, the only new SQL for this visit is:

`supabase/migrations/20261113120000_outreach_funnel.sql`

It creates `crm_outreach_prospects`, a stamp trigger, and row-level security. It does not send, does not write `crm_outbox`, does not change an existing table, and does not turn `sending_enabled` on. It is not step 20 through 36. Do not paste those files again. Do not paste steps 1 through 19. Steps 1 through 19 stay Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md).

The project ref is `fnysxlswzufdnlbhndxc`. Phone steps, only after the merge yes:

1. Open https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new
2. Read the address bar. The project ref is `fnysxlswzufdnlbhndxc`. Any other project, stop and close the tab.
3. Open a new empty query. Paste that one file whole. Do not split it. If the phone cuts the paste short, stop and paste from a desktop.
4. Run it once. Pass is `Success. No rows returned`, or the editor’s equivalent Success with no error. A result grid is not required.
5. On an error, stop. If the error says the file needs phase 2a access, stop. Do not re-apply steps 1 through 19 from this page. Do not invent Success.
6. After that Success, open a new empty query and run this once:

```sql
NOTIFY pgrst, 'reload schema';
```

Pass is the same Success line. That statement refreshes the PostgREST schema cache. It does not apply another migration and it does not send. If it errors, stop. Do not import.

This page does not run those statements. Writing this page is not that Success. `SUPABASE_ACCESS_TOKEN` may still be a chat note. This paste does not need it. Do not replace the token here. The token checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md).

## 4. Smoke `/command-centre/outreach`

Run this on production after section 3 showed Success, and after the merged deploy is live. Stay on https://ai-autotech-crm.vercel.app . If `crm.aiautotech.co.za` does not load, leave it. The hostname checklist is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md).

Signed out, private tab:

| Open | `next` |
| --- | --- |
| https://ai-autotech-crm.vercel.app/command-centre/outreach | `/command-centre/outreach` |

The phone lands on `/login`. A check that does not follow redirects reports **307** and a `Location` whose path is `/login` with that `next`. You do not see **Outreach funnel** or **Import**. A **404** means the merge is not on this host yet. Stop. Do not import. Do not paste the SQL again.

Signed-in look, still no import:

1. Open https://ai-autotech-crm.vercel.app/command-centre/outreach?org=ai-autotech
2. Sign in as the agency owner when the phone is on `/login` and that user already exists (`billyfaber06@gmail.com`). If the app lands on `/agency`, open the outreach URL again.
3. Pass: eyebrow **Outreach**, heading **Outreach funnel**, slug `ai-autotech`, header chip **Sending is off**. If the chip reads **Sending is on**, stop. If the header names EASTC or Zentrix, open the `?org=ai-autotech` link again.
4. The command-centre nav includes **Outreach funnel**. That link opens `/command-centre/outreach`. Do not open Campaigns, setup, go-live, or a pack from this visit.

Read the line under the heading. Act on the words:

- `The outreach table is not in the database yet. Apply supabase/migrations/20261113120000_outreach_funnel.sql.` Stop. Section 3 is not done, or the schema reload has not landed. Do not import.
- `Sample data. Sign in to see your real outreach list.` Stop. That desk is the fixture. Campaign reads `sample`. Do not import on it.
- `No prospects yet. Import a list to start.` The table is present and empty. That is the live empty desk. Import stays optional in section 5.
- `Manual outreach log. Nothing is sent from this page. Do-not-contact prospects can never be moved to Sent.` The table is present and has rows. Leave every stage where it is.

**Import a prospect list (CSV)** is on the live desk only. If that heading is missing, you are on the sample desk. Stop.

Leave **Save**, **Save note**, **Mark do-not-contact**, **Remove flag**, and **Import** untapped on this smoke. Do not type a note.

## 5. Optional CSV import

Skip this section on the review visit and on the smoke visit. Come back only when Billy says yes to this import, section 3 has shown Success, and section 4 showed the live desk (the empty line or the manual-log line), not the sample line and not the missing-table line.

After Billy merges #85 and applies the additive migration, import broker CSV via `/command-centre/outreach` — drafts stay `draft_not_sent`.

The broker file is not in this repo. This page does not name a box path, does not count rows, and does not list businesses. Do not retype rows into the page. Do not paste the CSV into git, a pull request, chat, or this file. If the phone cannot choose the file, stop and import from a desktop. A shorter paste is a different list.

The form on the live desk names the columns it already accepts: Business, Area, Website, Public business email, Phone, Source URL, Personalisation hook, Priority. A Business column is required. This page does not add columns and does not describe a file that is not on the screen.

On the phone, when he has said yes to the import:

1. Stay on https://ai-autotech-crm.vercel.app/command-centre/outreach?org=ai-autotech
2. Scroll to **Import a prospect list (CSV)**. The campaign field defaults to `brokers-gauteng`. Leave that name, or replace it with lowercase letters, numbers, and dashes only. A bad name shows `Campaign name: lowercase letters, numbers and dashes only.` Stop and fix the name. Do not invent a second campaign to force the import.
3. Choose the broker CSV. It must be under 1 MB. `Choose a CSV file under 1 MB.` and `No rows found. The CSV needs a Business column.` are stops. `Import failed. Check the CSV columns.` is a stop. Do not edit production rows to force them in.
4. Tap **Import** once.

Success is the blue status `Import done. Existing prospects were left as they were.`

What that line means:

- New rows start at **Not contacted**. That is the unsent draft. Drafts stay `draft_not_sent`.
- The same campaign and business is not overwritten.
- Nothing was sent. The outbox is not this page. `sending_enabled` stays false.

Leave the stage on **Not contacted**. Do not change it to **Sent**. Do not tap **Save** on a stage. Do not tap **Mark do-not-contact**. A second **Import** of the same file leaves existing rows as they were. It still does not send. Leave the button after the success line is on screen.

## 6. Never Send without a yes

This page does not send. There is no **Send**, **Send now**, **Go live**, **Send test**, **Publish**, or **Post now** on `/command-centre/outreach`. Do not go looking for them on Campaigns, the inbox, or `/agency`.

**Sent** in the stage dropdown is a log stamp. Saving it does not deliver a message. Do not move a prospect to **Sent** on this visit. A yes to merge, a yes to the migration, or a yes to import is not a yes to that stamp and is not a yes to send.

Do-not-contact is a hard stop on the page. A prospect marked do-not-contact who is still **Not contacted** cannot be moved to **Sent**. The status is `Blocked: this prospect is do-not-contact and cannot be sent to.` Leave **Mark do-not-contact** untapped unless Billy names that prospect on a later call. This page is not that call.

`sending_enabled` stays false on every workspace. The checkbox **Sending enabled** stays unticked. The header chip stays **Sending is off**. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. The later gate, when he says yes to real outbound for one named workspace, is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). A yes on this page is not that yes.

## Hard refuse

This visit refuses all of the following.

- Merging [CRM #85](https://github.com/billyboy95/ai-autotech-/pull/85) before Billy says yes. This page does not merge it.
- Pasting `supabase/migrations/20261113120000_outreach_funnel.sql` before that merge, or pasting steps 1 through 19 or steps 20 through 36 from this page.
- Inventing `Success. No rows returned`.
- Setting any Phase 5 flag. There is no outreach flag. Leave `HOME_CHAT_ENABLED`, `CAMPAIGN_DRY_RUN_ENABLED`, `META_CONNECT_STUB_ENABLED`, `CAMPAIGN_CSV_IMPORT_ENABLED`, `EMAIL_SMS_CONNECT_STUB_ENABLED`, `SOCIAL_DRAFTS_ENABLED`, `TIKTOK_LINKEDIN_CONNECT_STUB_ENABLED`, `ZENTRIX_WORKSPACE_PACK_ENABLED`, `EAST_RAND_CAMPAIGN_SEED_ENABLED`, `PWA_INSTALL_SHELL_ENABLED`, `SETUP_WIZARD_ENABLED`, `MIGRATION_RUNNER_ENABLED`, `OWNER_BOOTSTRAP_UI_ENABLED`, `OPS_SECRETS_READY_ENABLED`, `GOLIVE_CHECKLIST_ENABLED`, `AI_REPLY_CRON_ENABLED`, `E2B_API_KEY`, `BROWSERBASE_API_KEY`, and `COMPUTER_PROVIDER_ENABLED` unset. The order stays on [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md).
- Turning `sending_enabled` on. Tapping **Send**, **Send now**, **Go live**, **Send test**, **Publish**, or **Post now**.
- Moving a row to **Sent**, or marking do-not-contact, on this visit.
- Importing before the live desk is on screen. Importing the sample rows. Inventing the broker file.
- Ad spend, a purchase, SMS credit, a phone number, or a card charge.
- A DNS edit. A cron registration. A pack click. **Apply Education pack to EASTC** and **Apply Zentrix pack to Zentrix Online** stay untapped.
- A secret, key, token, password, database URL, or service-role value in git, a pull request, chat, an issue, or this file.

## Pass means

You opened the preview, or you stopped because it did not load, and you did not tap **Import** or a stage **Save**. [CRM #85](https://github.com/billyboy95/ai-autotech-/pull/85) is still open unless Billy already merged it himself. You did not paste SQL. You did not set a flag. You did not send. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset or `false`. No DNS record was edited. No purchase was made.

If he later said yes and you finished section 3, you saw Success for that one file and for `NOTIFY pgrst, 'reload schema';`, or you stopped on the error that was actually on screen. Section 4 then showed `/login` while signed out and, when you signed in, **Outreach funnel** with **Sending is off**. You imported only if he said yes, the live desk was on screen, and the blue line `Import done. Existing prospects were left as they were.` was the line you saw. New rows stayed **Not contacted**. Drafts stayed `draft_not_sent`. You did not move a row to **Sent**.

A pass does not mean #85 is merged, the migration is applied, a CSV was imported, or anyone was contacted, unless those lines were on the screen after his yes.
