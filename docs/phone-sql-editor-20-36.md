# Phone checklist: SQL editor for steps 20–36

Billy pastes the Unapplied SQL files, steps 20 through 36, one file at a time, in the Supabase SQL editor. This page is Phone-first unblock, step 7 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). It comes after PayFast sandbox and billing readiness ([`docs/phone-payfast-sandbox.md`](phone-payfast-sandbox.md), step 6).

Writing this page does not run SQL. Steps 1 through 19 are already live (27 Sep 2026). Steps 20 through 36 stay unapplied until every paste on this visit shows Success. Do not claim they are already applied. Do not invent `Success. No rows returned` or `Success. Steps 20–36 applied.`

`SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note, unless Billy already replaced it on [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). A Personal Access Token starts with `sbp_`. This checklist does not replace that token and does not print one. The SQL editor does not need it. Do not run `scripts/apply-pending-migrations.mjs --apply` while the value is still a chat note.

`sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. No real send. No ad spend. No live PayFast charge. Gated Phase 5 command-centre panels stay paused. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The project ref is `fnysxlswzufdnlbhndxc`. The CRM project on Vercel is `ai-autotech-crm`. The only safe order is the Unapplied list in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Do not sort the migrations folder by filename. Do not change the Already live or Unapplied headers.

Business email From stays `Willem@aiautotech.co.za` (spelling W-i-l-l-e-m). `billyfaber06@gmail.com` is the agency owner login. It is never the From. This page does not send.

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `Willem@aiautotech.co.za` | The only From for AI AutoTech business email. Not used on this page. Do not send. |
| `billyfaber06@gmail.com` | Agency owner login. `OWNER_EMAILS` on step 4. Never a From. |
| `billy@aiautotech.co.za` | Old example. Do not use it. |

## Stop until these are true

1. You will open the SQL editor for project `fnysxlswzufdnlbhndxc` only. If the address bar shows a different project ref, close the tab.
2. You will paste steps 20 through 36 only, in that order, one whole file at a time. You will not paste steps 1 through 19 again.
3. You will not sort by filename. You will not split a file into pieces.
4. You will stop on the first failure. You will not skip ahead. You will resume at the failed step only after the cause is fixed.
5. You will not invent Success. You will not write `Success. No rows returned` unless the editor showed it for that file.
6. You will not replace `SUPABASE_ACCESS_TOKEN` on this visit, turn `sending_enabled` on, set `CRON_SECRET` or a channel key or a PayFast name, click a pack, merge the website pull requests, spend, or send.

If any check is false, stop.

## 1. Open the project SQL editor

On the phone, or on a desktop for the large files in section 3:

1. Open https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new
2. If the session has expired, sign in again, then open that same address.
3. Read the address bar. The project ref in it is `fnysxlswzufdnlbhndxc`.
4. Pass: a new query is open in that project.

Stop, and close the tab, when the ref is any other project.

The project SQL Editor list is the same project: https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql . Use a new query for each file.

## 2. Paste one Unapplied file, then the next

The source of truth is `supabase/migrations` in this repo, in the order below. An ops-box copy is optional. When it is present, the path is `/workspace/supabase-apply/NN-*.sql`, where `NN` is the step number from 20 through 36. Use that copy only for the same step. If the two copies differ, paste the repo file.

For each step, in order:

1. Open the file for that step. Copy the whole file.
2. Paste it into an empty query. Do not append it under a previous file.
3. On a phone, compare the pasted length with the file size in section 3 before Run. When the paste is shorter than the file, stop. Do not Run. Paste the whole file from a desktop.
4. Run that one file.
5. Read the result. Go to section 4.
6. After Success for that file, open a new query for the next step. Do not re-run a file that already showed Success.

Do not paste `supabase/owner-bootstrap.sql`. That file is not a migration. It stays in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) (Not part of this apply) until steps 20 through 36 have succeeded and the Auth user exists.

Files, in this order only:

20. `supabase/migrations/20261026120000_phase4c_aios_pricing.sql`
21. `supabase/migrations/20261027120000_phase4d_eastc_education.sql`
22. `supabase/migrations/20261028120000_phase5a_agent_computers.sql`
23. `supabase/migrations/20261029120000_phase5b_lead_onboarding.sql`
24. `supabase/migrations/20261030120000_phase5c_connect_import.sql`
25. `supabase/migrations/20261031120000_phase5d_home_chat.sql`
26. `supabase/migrations/20261101120000_phase5e_campaign_dry_run.sql`
27. `supabase/migrations/20261102120000_phase5f_campaign_csv_channels.sql`
28. `supabase/migrations/20261103120000_phase5g_social_drafts.sql`
29. `supabase/migrations/20261104120000_phase5h_zentrix_workspace_pack.sql`
30. `supabase/migrations/20261105120000_phase5i_campaign_seed_ops.sql`
31. `supabase/migrations/20261106120000_phase5j_pwa_mobile_shell.sql`
32. `supabase/migrations/20261107120000_phase5k_setup_wizard.sql`
33. `supabase/migrations/20261108120000_phase5l_migration_runner.sql`
34. `supabase/migrations/20261109120000_phase5m_owner_bootstrap.sql`
35. `supabase/migrations/20261110120000_phase5n_ops_secrets_ready.sql`
36. `supabase/migrations/20261111120000_phase5o_golive_checklist.sql`

## 3. Large files: use a desktop

A phone SQL editor can cut a long paste short. A shorter paste is a different statement. Paste each file whole. Do not split a file into pieces.

Prefer a desktop paste for these five. Step 27 is the one to treat first.

| Step | File | Size |
| --- | --- | --- |
| 20 | `phase4c_aios_pricing` | about 12 KB (12,497 bytes) |
| 26 | `phase5e_campaign_dry_run` | about 14 KB (14,479 bytes) |
| 27 | `phase5f_campaign_csv_channels` | about 20 KB (20,759 bytes) |
| 28 | `phase5g_social_drafts` | about 12 KB (12,708 bytes) |
| 29 | `phase5h_zentrix_workspace_pack` | about 15 KB (15,089 bytes) |

The same rule applies to any later file if the phone cuts it. When the paste is shorter than the file, stop and paste the whole file from a desktop.

## 4. What to read after Run

For each file, expect `Success. No rows returned`, or the editor’s equivalent Success with no error. A result grid is not required.

On an error, stop. Later steps were not applied. Do not skip ahead. Do not paste the next file. Fix the cause, then resume at the failed step only. Do not invent Success for the file that failed.

If the error says an object from steps 1 through 19 is missing, stop. Do not paste steps 1 through 19 again from this page. Those files stay Already live. Resume at the failed step only after that cause is fixed.

Do not mark the Unapplied header in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) as applied from the phone. Steps 20 through 36 stay unapplied until every file from 20 through 36 has shown Success.

## 5. Refuse

This visit refuses all of the following. A Success line for one file is not a yes for any line here.

- Claiming steps 20 through 36 are already applied. Writing this page is not Success.
- Replacing `SUPABASE_ACCESS_TOKEN` here. That checklist is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md).
- Running `scripts/apply-pending-migrations.mjs --apply` without a real `sbp_` token.
- Turning `sending_enabled` on. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. No real send. When he later says yes to real outbound for one named workspace, the gate is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). A Success line is not that yes.
- Setting `CRON_SECRET`, a channel key, or a PayFast name. Those stay on steps 5 and 6.
- Clicking Apply Education pack or the Zentrix pack. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset. No ad spend.
- Merging [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). They stay open until Billy says yes to publish. See [`docs/website-publish-decision.md`](website-publish-decision.md).
- Inventing `Success. No rows returned` or `Success. Steps 20–36 applied.`
- Pasting a token, a password, a merchant key, a passphrase, a service-role value, or a SQL secret into git, a pull request, chat, an issue, or this file.

## 6. Still blocked

These stay blocked after a pass on this page, including after every paste has shown Success:

- Gated Phase 5 command-centre panels stay paused. Do not set a Phase 5 flag. The names stay in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md) (Flags left unset) and in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Leave flags unset until their SQL is applied).
- `sending_enabled` stays false. No real send. No ad spend. No live PayFast charge.
- `SUPABASE_ACCESS_TOKEN` is still not an `sbp_` token, unless Billy already replaced it on [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md). This page does not paste a token.
- Website pull requests [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open.
- Education pack and Zentrix pack stay unclicked. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset.

Until every file from 20 through 36 has shown Success, steps 20 through 36 stay unapplied. Do not open a pack button.

## 7. Next checklist

Stop on this page after step 36 shows Success. Do not click a pack here. Do not run the schema reload on this page.

The next phone checklist is [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md) (Phone-first unblock, step 8 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md)). The click order there is:

1. Schema reload: `NOTIFY pgrst, 'reload schema';`
2. Education pack, only when Billy says yes, as an agency owner.
3. Zentrix pack, only after `ZENTRIX_WORKSPACE_PACK_ENABLED` is the string `true` and Billy says yes.

This page does not run that reload and does not click either pack. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset.

After that reload, and before those clicks, the logged-out production smoke is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). The Phase 5 flag order is [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). The Zentrix pack notes are [`docs/zentrix-workspace-pack.md`](zentrix-workspace-pack.md). This page does not set a flag and does not open those clicks.

## Stop rules

- Steps 20 through 36 stay unapplied until every paste shows Success. Do not invent Success.
- Do not re-apply steps 1 through 19. Do not sort by filename. Do not split a file.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- Do not replace `SUPABASE_ACCESS_TOKEN` here. Do not pass `--apply` without a real `sbp_` token.
- Gated Phase 5 command-centre panels stay paused. Do not click a pack. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset.
- Do not set `CRON_SECRET`, a channel key, or a PayFast name.
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish.
- From stays `Willem@aiautotech.co.za`. Do not send from personal Gmail.
- Do not paste a token, a password, a merchant key, a passphrase, a service-role value, or a SQL secret into git, a pull request, chat, an issue, or this file.

## What still needs Billy’s yes

A yes for one line is not a yes for the others. A Success line in the editor is not a yes for any line here.

- Replace `SUPABASE_ACCESS_TOKEN` with an `sbp_` token. That is [`docs/phone-supabase-access-token.md`](phone-supabase-access-token.md).
- `--apply` for steps 20 through 36, only after that token is a real `sbp_` token, the dry-run looks correct, and he says yes on that call.
- Schema reload, the Education pack, and the Zentrix pack. Those are [`docs/phone-education-zentrix-pack-apply.md`](phone-education-zentrix-pack-apply.md) (step 8). Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset until he says yes.
- `CRON_SECRET`, channel keys, PayFast sandbox names, and every Phase 5 flag.
- Turning `sending_enabled` on. Live charges. That yes is separate, and it is not this page.
- Merge the website pull requests, spend, or send.

## Pass means

You opened https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new for project `fnysxlswzufdnlbhndxc`, or you stopped because the session would not sign in. You pasted Unapplied files only, in order from 20, one whole file at a time, or you stopped at the first file that did not show Success. You did not paste steps 1 through 19. You did not Run a paste that was shorter than the file. `sending_enabled` is still false. Gated Phase 5 command-centre panels are still paused. `ZENTRIX_WORKSPACE_PACK_ENABLED` is still unset. No pack was clicked. Nothing was sent. No ad spend. No live charge. `SUPABASE_ACCESS_TOKEN` is still not an `sbp_` token unless Billy already replaced it elsewhere.

A pass does not mean steps 20 through 36 are applied unless every file from 20 through 36 showed `Success. No rows returned`, or the editor’s equivalent Success with no error, on this visit. Writing this page is not that Success.
