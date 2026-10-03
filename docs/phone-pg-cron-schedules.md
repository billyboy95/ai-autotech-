# Phone checklist: schedules after `CRON_SECRET`

`CRON_SECRET` on Vercel Production lets the CRM cron routes accept a call. It does not register a job. This page is the phone paste that registers the three Supabase schedules in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md), and the check that the one daily job already in `vercel.json` is still the only Vercel cron.

Writing this page does not run SQL, does not redeploy, and does not set a flag. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This paste does not need that token and does not need `SUPABASE_DB_URL`. Do not claim the SQL for steps 20 through 36 is applied. Do not paste a secret into git, a pull request, chat, or this file.

The statements below are the blocks already in `supabase/APPLY-ORDER.md`. The host is filled in. The secret stays a placeholder until you paste it in the SQL editor.

## Stop until these are true

1. `CRON_SECRET` is already saved on Vercel Production for the CRM project `ai-autotech-crm`. That save is [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Phone-first unblock, step 5). If the name is missing, stop and do that step. Do not generate a second secret.
2. The password manager still has that same value. Vercel hides a Sensitive value after save. If the password manager value is gone, stop. Do not invent a replacement here.
3. Steps 11, 13, and 15 are already live (workflow tables, billing cycle, conversation AI). They are under Already live in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). Do not paste them again. This page does not paste steps 20 through 36.
4. `sending_enabled` stays false on every workspace. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. `AI_REPLY_CRON_ENABLED` stays unset. `WORKFLOW_ENGINE_ENABLED` stays unset.

If any check is false, stop.

## 1. Redeploy Production

A saved variable is read on the next deployment. Until that deployment is Ready, the cron routes still reject the bearer token.

1. On the phone, open Vercel → the CRM project `ai-autotech-crm` → Deployments.
2. Open the latest Production deployment. Choose Redeploy. Leave the environment on Production. Do not edit variables on that screen.
3. Wait until the new deployment shows Ready.

Success: that Ready deployment started after `CRON_SECRET` was saved.

Stop: the redeploy fails. Do not paste SQL.

## 2. Confirm the one Vercel cron

`vercel.json` already calls `/api/cron/automation` on `0 4 * * *`. That is 04:00 UTC, 06:00 Africa/Johannesburg. Vercel sends `Authorization: Bearer <CRON_SECRET>` on that call. You do not paste the secret into the Cron Jobs screen.

1. On the phone, open Vercel → the CRM project → Settings → Cron Jobs.
2. Confirm one row: path `/api/cron/automation`, schedule `0 4 * * *`.

Leave the other three paths off this screen. `/api/cron/workflows` is every minute, and a Hobby plan rejects a minute schedule. `/api/cron/billing` and `/api/cron/ai-replies` are not in `vercel.json`. They are the Supabase paste in step 4.

This daily job does not run at the moment of the redeploy. The next Vercel run is 04:00 UTC. Do not add a Supabase job named `automation`. A second caller would run the phase 1 job twice.

Success: the Cron Jobs list shows that one path and that daily schedule.

Stop: the list is empty on the Ready Production deployment, or it shows another CRM cron path. Do not edit `vercel.json` from the phone.

## 3. Enable the two extensions

On the phone, open Supabase → project `fnysxlswzufdnlbhndxc` → Database → Extensions:

https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/database/extensions

1. Search `pg_cron`. Enable it when it is off.
2. Search `pg_net`. Enable it when it is off.

Leave every other extension as it is.

## 4. Paste the schedules

Open a new query. This is the same editor as Phone-first unblock, step 7:

https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new

Run one block at a time. Stop on the first error. Do not skip ahead.

In each schedule block, replace `REPLACE_WITH_CRON_SECRET` with the password-manager value of `CRON_SECRET`. The host is already `ai-autotech-crm.vercel.app`. Confirm that host is a Production domain under Vercel → the CRM project → Settings → Domains. Do not use a Preview URL. Cron URLs stay on `ai-autotech-crm.vercel.app`. Attaching `crm.aiautotech.co.za` is [`docs/phone-crm-custom-domain.md`](phone-crm-custom-domain.md). Do not rewrite these job URLs to that host.

Do not save the query as a snippet. After Run, close that editor tab. The job stores the bearer token in the database. Later reads on this page do not select the command text. Do not screenshot the editor while the secret is on screen.

### 4.1 Extensions

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

Success: `Success. No rows returned`, or the editor’s equivalent success with no error.

Stop: any other error. Do not rewrite the statement.

### 4.2 `workflow-engine`

Schedule `* * * * *` (every minute, UTC). Path `/api/cron/workflows`. While `WORKFLOW_ENGINE_ENABLED` is unset, a successful call returns ok and skipped. Phase 1 stays on `/api/cron/automation`. Leave `WORKFLOW_ENGINE_ENABLED` unset.

```sql
select cron.schedule(
  'workflow-engine',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://ai-autotech-crm.vercel.app/api/cron/workflows',
    headers := jsonb_build_object('Authorization', 'Bearer REPLACE_WITH_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
```

Success: one row with one number. That number is the job id. A schedule paste does not say `Success. No rows returned`.

Stop: any error. When the error says the job name already exists, stop. The schedule is already there. Do not paste it again.

### 4.3 `billing-cycle`

Schedule `15 2 * * *` (02:15 UTC, 04:15 Africa/Johannesburg). Path `/api/cron/billing`. Step 13 is already live. Keep this schedule as written. This job does not call PayFast, Paystack, or Yoco, and it does not turn sending on. It can later force `sending_enabled` false on a workspace that has been `past_due` for seven days. This page does not create a `past_due` row.

```sql
select cron.schedule(
  'billing-cycle',
  '15 2 * * *',
  $$
  select net.http_post(
    url := 'https://ai-autotech-crm.vercel.app/api/cron/billing',
    headers := jsonb_build_object('Authorization', 'Bearer REPLACE_WITH_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
```

Success: one row with one job id.

Stop: any error, including a job name that already exists. This job does not fire in the next few minutes. Absence of a run before 02:15 UTC is expected.

### 4.4 `ai-reply-drafts`

Schedule `*/10 * * * *` (every 10 minutes, UTC). Path `/api/cron/ai-replies`. Step 15 is already live. Leave `AI_REPLY_CRON_ENABLED` unset. With that flag unset, a successful call returns ok, processed 0, queued 0, and skipped `flag_off`. It does not queue a draft and does not mark a draft sent.

```sql
select cron.schedule(
  'ai-reply-drafts',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://ai-autotech-crm.vercel.app/api/cron/ai-replies',
    headers := jsonb_build_object('Authorization', 'Bearer REPLACE_WITH_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
```

Success: one row with one job id.

Stop: any error, including a job name that already exists. Do not set `AI_REPLY_CRON_ENABLED` to make a row appear sooner.

## 5. Read the job list back

New query. Do not reuse the tab that still shows the bearer token.

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname in ('workflow-engine', 'billing-cycle', 'ai-reply-drafts')
order by jobname;
```

Success: three rows, each with `active` true:

| jobname | schedule |
| --- | --- |
| `ai-reply-drafts` | `*/10 * * * *` |
| `billing-cycle` | `15 2 * * *` |
| `workflow-engine` | `* * * * *` |

There is no `automation` row in this result. That job stays on Vercel.

Stop: fewer than three rows, `active` false, or a different schedule. Do not paste the schedule again. Do not select the command column. That column holds the bearer token.

## 6. What a fired call looks like

Wait about two minutes, then run this in a new query:

```sql
select j.jobname, d.status, d.start_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname in ('workflow-engine', 'billing-cycle', 'ai-reply-drafts')
order by d.start_time desc
limit 10;
```

`succeeded` here means Supabase ran `net.http_post`. The CRM status code is the next query.

Success:

- `workflow-engine` has a `succeeded` row from the last couple of minutes.
- `billing-cycle` has no row yet when the clock has not passed 02:15 UTC. That absence is expected.
- `ai-reply-drafts` has a `succeeded` row once ten minutes have passed. A check before that can be empty. That absence is expected.

Stop: a row with status `failed`. Do not paste the schedule again.

Then, same editor:

```sql
select status_code, error_msg, created
from net._http_response
order by created desc
limit 5;
```

Success: a recent row with `status_code` 200. That 200 means the route accepted `CRON_SECRET`. With the flags left unset, the workflow call is a skip and the ai-reply call is a skip. `sending_enabled` stays false.

On the phone you can also open Vercel → the Ready Production deployment → Logs and look for `/api/cron/workflows` with status 200. Read the status only.

Stop:

- `status_code` 401. The Ready deployment does not have this `CRON_SECRET`. Return to step 1. Do not change the secret. Do not paste another job.
- `status_code` 500 or 503. The call arrived and the route reported failure. Stop. Do not turn sending on. `SUPABASE_SERVICE_ROLE_KEY` stays on Phone-first unblock, step 6, and only when Billy says yes to sandbox billing. This page does not set it.
- `net._http_response` itself errors. The schedule Success remains the three rows in step 5. Stop on the HTTP read. Do not paste another job.

## Still blocked

- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- `AI_REPLY_CRON_ENABLED` and `WORKFLOW_ENGINE_ENABLED` stay unset.
- Channel keys stay on Phone-first unblock, step 5. WhatsApp and Meta collection is [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md). A fired cron is not a yes to send. See that step for the names. This page does not set them.
- PayFast names stay on Phone-first unblock, step 6. Live PayFast stays off.
- Steps 20 through 36 stay unapplied until Phone-first unblock, step 7 shows Success. This page does not paste those files.
- `SUPABASE_ACCESS_TOKEN` stays a chat note until Billy replaces it with an `sbp_` token. This page does not paste a token.
- Gated Phase 5 command-centre panels stay paused. This page adds no page under `/command-centre` or `/agency`.
- Do not tap **Send now**, **Go live**, **Publish**, or **Post now**.
- Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5). See [`docs/website-publish-decision.md`](website-publish-decision.md).
- No ad spend.

## Other phone checklists

This page does not replace them.

1. `CRON_SECRET` and the outbound channel key names: [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Phone-first unblock, step 5). WhatsApp Cloud API and Meta Page / Instagram keys are [`docs/phone-whatsapp-meta-keys.md`](phone-whatsapp-meta-keys.md). That page does not send, does not turn `sending_enabled` on, and does not register a webhook unless Billy says yes on that call.
2. After SQL steps 20 through 36 and `NOTIFY pgrst, 'reload schema';` have shown Success, the logged-out production smoke is [`docs/phone-post-sql-smoke-verify.md`](phone-post-sql-smoke-verify.md). Run that before any Phase 5 flag. This schedule page does not call those public URLs and does not claim that smoke has passed.
3. Phase 5 flags, only the names Billy says yes to, after that smoke: [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md). That page leaves `AI_REPLY_CRON_ENABLED` unset. This page does not set a flag.

This page does not claim steps 20 through 36 are applied, does not claim a Vercel cron has already run today, and does not claim a message was sent.
