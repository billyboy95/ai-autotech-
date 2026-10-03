# Phone checklist: replace `SUPABASE_ACCESS_TOKEN`

Billy replaces the chat note stored as `SUPABASE_ACCESS_TOKEN` with a Supabase Personal Access Token that starts with `sbp_`. Then, on the box, he dry-runs steps 20 through 36. `--apply` waits until that dry-run looks correct and he says yes on that call.

The value on the ops box today is a chat note. It does not start with `sbp_`. That blocks `scripts/apply-pending-migrations.mjs` and the Supabase CLI. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. This page is Phone-first unblock, step 1 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md).

Writing this page does not create a token, does not write an environment value, and does not run the script. It does not apply SQL. `sending_enabled` stays false. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The project ref is `fnysxlswzufdnlbhndxc`. The CRM app is `https://ai-autotech-crm.vercel.app`. The public site is `aiautotech.co.za` (no hyphen). The token is not pasted into either host.

## Which address is which

| Address | Role on this visit |
| --- | --- |
| `billyfaber06@gmail.com` | Agency owner login for Supabase and Vercel. Never a From, a reply-to, or a test sender. |
| `Willem@aiautotech.co.za` | The only From for AI AutoTech business email (spelling W-i-l-l-e-m). Not used on this page. Do not send. |

## Stop until these are true

1. You are signed in to the Supabase account that owns project `fnysxlswzufdnlbhndxc`. That login is `billyfaber06@gmail.com`.
2. You will copy the new token once into a password manager. You will not paste it into git, a pull request, chat, an issue, or this file.
3. You will reject a chat note and a JWT-looking string. The saved value has to start with `sbp_`.
4. You will verify the token with a project list before any `--apply`.
5. You will dry-run first. `--apply` waits for a correct dry-run and for Billy’s yes on this call. A yes to create the token is not a yes to apply SQL.

If any check is false, stop.

## 1. Open Access Tokens

On the phone, open Supabase → Account → Access Tokens:

https://supabase.com/dashboard/account/tokens

This is the account page, not Project Settings → API Keys. An `anon` key or a `service_role` key from that project page is not a Personal Access Token.

## 2. Create the token

1. Create a token. Name it for AI AutoTech ops.
2. Copy it once into the password manager. Supabase shows the value only at creation.
3. If the copy is lost, revoke that token on the same page and create another. Do not guess the old value. Do not photograph it into the repo.

## 3. Confirm it starts with `sbp_`

Read the start of the password-manager value. Do not read it aloud into chat.

Pass: the value starts with `sbp_`, and it is longer than those four characters. The apply script also refuses a value shorter than 20 characters.

Stop, and do not save it, when any of these are true:

- It does not start with `sbp_`. A chat note is this case. The ops-box value today is a note, not a token.
- It looks like a JWT. That is a string that starts with `eyJ`, or three parts separated by dots. Those are `anon` or `service_role` keys. `SUPABASE_SERVICE_ROLE_KEY` is a different name. It stays on Phone-first unblock, step 6, and only when Billy says yes to sandbox billing.
- You typed a stand-in that happens to start with `sbp_`. The dashboard has to have issued this token.

A prefix check is not proof Supabase accepts the token. Section 5 is that check.

## 4. Paste it under the name `SUPABASE_ACCESS_TOKEN`

Names only. Two places hold the chat note today. Replace both. Saving one does not update the other.

### Box

The apply script reads the box environment. Vercel does not feed that shell.

1. Unset the old value first. A leftover chat note makes the script exit non-zero and apply nothing, including on a dry-run.
2. Put the password-manager value in the environment the script reads: the gitignored env file on the box, or a shell export in that same shell.
3. The name is `SUPABASE_ACCESS_TOKEN`. Do not put the value on the command line as an argument. Do not `echo` it. Do not commit the env file.

### Vercel

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables.

1. Open the row named `SUPABASE_ACCESS_TOKEN`.
2. Replace the value with the password-manager token. Save it for Production. Mark it Sensitive.
3. Add Preview only when Billy says yes to Preview.

Saving this row does not run SQL. This apply does not need a redeploy. The script still reads the box. If the box still has the chat note, stop and finish the box half of this section.

Leave the token out of git, pull requests, issues, and docs.

## 5. Verify the token

Do this on the box, after section 4, with the chat note unset. Read the screen. Do not paste the output into git, a pull request, chat, or this file.

The dry-run in section 6 does not call Supabase. It only checks the prefix and the file list. This section is the call that proves the token.

### 5.1 `supabase projects list`

```bash
supabase projects list
```

The CLI reads `SUPABASE_ACCESS_TOKEN` from the environment. Do not pass the token as an argument.

Pass: the screen shows project ref `fnysxlswzufdnlbhndxc`.

Stop: unauthorized, or the ref is missing. Return to section 2. Do not pass `--apply`.

If the CLI is signed in as a different account, stop and use section 5.2 so you are testing this environment value.

### 5.2 Management API project list

Use this when the CLI is missing, or when you want a second read. This is `GET https://api.supabase.com/v1/projects` with header `Authorization: Bearer` and the environment value.

Do not POST. Do not call `/v1/projects/fnysxlswzufdnlbhndxc/database/query` for this check. That path is what `--apply` uses, and it sends SQL.

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  "https://api.supabase.com/v1/projects" \
  | grep -oE 'fnysxlswzufdnlbhndxc|HTTP [0-9]+'
```

Pass: the screen shows `fnysxlswzufdnlbhndxc` and `HTTP 200`.

Stop: `HTTP 401`, any other status, or the ref is missing. Do not pass `--apply`.

## 6. Dry-run

From the repo root on the box. No SQL is sent.

```bash
SUPABASE_PROJECT_REF=fnysxlswzufdnlbhndxc node scripts/apply-pending-migrations.mjs
```

That is the same command as the export form in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Phone-first unblock, step 2). `--project-ref fnysxlswzufdnlbhndxc` is the same ref. Dry-run is the default.

A correct dry-run prints all of these, and does not print the token:

- `Dry-run. No SQL was sent.`
- `Steps 20–36 (17 files) from supabase/APPLY-ORDER.md:` followed by steps 20 through 36
- `Token accepted (sbp_ prefix). The value is not shown.`
- `Project ref: fnysxlswzufdnlbhndxc`
- `sending_enabled stays false. This script does not schedule crons and does not call Apply Education or the Zentrix pack.`

`Token accepted (sbp_ prefix)` means the prefix check passed. It does not mean Supabase ran SQL. It does not mean the apply succeeded.

Stop, and do not pass `--apply`, when you see any of these:

- `Fail. Need SUPABASE_ACCESS_TOKEN starting with sbp_. The current value is not an sbp_ token. Nothing was applied.` The chat note is still set. The script can still print the file list, then exit non-zero. That list is not Success.
- `Need SUPABASE_ACCESS_TOKEN starting with sbp_ before --apply.` The token is missing. That dry-run can exit 0. It is still not a yes to apply.
- `Project ref: missing.`
- The token text on screen.
- A step list other than 20 through 36.

Return to section 4 when the token line fails. Do not invent Success.

## 7. `--apply` only after Billy says yes

Stop until both are true: section 6 looked correct, and Billy says yes to apply on this call, while he is watching. Creating the token is not that yes. This file is not that yes.

```bash
SUPABASE_PROJECT_REF=fnysxlswzufdnlbhndxc node scripts/apply-pending-migrations.mjs --apply
```

The script stops on the first failure. It prints `Success` or `Fail` for each step. The default transport is the Management API. It does not need `SUPABASE_DB_URL` or a database password.

On `Fail step N`, stop. Later steps were not applied. Do not invent Success. Fix the cause, then resume at that step number (20 through 36). Do not skip ahead.

```bash
node scripts/apply-pending-migrations.mjs --apply --from N
```

`N` is the failed step. The project ref stays in the environment.

The only apply Success this page treats as done is:

`Success. Steps 20–36 applied.`

Until that line prints, steps 20 through 36 stay unapplied.

The script does not turn `sending_enabled` on, does not schedule a cron, and does not click Apply Education pack or the Zentrix pack. After that Success line, the next checklist is Phone-first unblock, step 8: `NOTIFY pgrst, 'reload schema';`, then the packs only when Billy says yes. This page does not run that reload and does not click either pack.

## 8. Fallback when there is still no `sbp_` token

Skip this section when sections 5 and 6 passed.

When you cannot save a token that starts with `sbp_`, stop the CLI. Do not pass `--apply`. Do not invent a token.

The SQL editor does not need the token. The paste order is already Phone-first unblock, step 7 in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md). The same order is the Unapplied list in [`supabase/APPLY-ORDER.md`](../supabase/APPLY-ORDER.md). This page does not copy those files.

On the phone, open a new query:

https://supabase.com/dashboard/project/fnysxlswzufdnlbhndxc/sql/new

1. Paste steps 20 through 36 only, in that order. One file at a time, from `supabase/migrations`, or the matching ops-box copy `/workspace/supabase-apply/NN-*.sql` (`NN` is 20 through 36).
2. Do not paste steps 1 through 19. They are Already live.
3. Expect `Success. No rows returned`, or the editor’s equivalent success with no error. Stop on the first failure. Do not skip ahead.
4. Paste each file whole. The runbook names the long files and their sizes. A phone paste can cut them short. Prefer a desktop paste for those. Do not split a file.

An editor line `Success. No rows returned` is not the CLI line `Success. Steps 20–36 applied.` Do not write either line down unless you saw it.

After every file has shown that editor success, the next checklist is still step 8. This fallback does not click a pack and does not set a flag.

## Stop rules

- Do not invent Success. A file list, a prefix line, or an HTTP 200 is not `Success. Steps 20–36 applied.`
- Do not pass `--apply` until section 6 looks correct and Billy says yes on this call.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Do not send.
- Do not schedule a cron. The schedule paste is [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This page does not run it.
- Do not click **Apply Education pack to EASTC** or **Apply Zentrix pack to Zentrix Online**. Those stay on step 8, after SQL Success, and only when Billy says yes to that pack. Leave `ZENTRIX_WORKSPACE_PACK_ENABLED` unset.
- Do not set a Phase 5 flag. The names stay in [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (Leave flags unset until their SQL is applied) and [`docs/phone-phase5-flags-enable-order.md`](phone-phase5-flags-enable-order.md).
- No DNS edit, no domain purchase, and no spend. Leave `aiautotech.co.za` alone. Do not merge the website pull requests.
- Do not paste a token, a JWT, a service-role key, or command output into git.

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- `--apply` for steps 20 through 36, only after the dry-run in section 6 looks correct.
- Schema reload, the Education pack, and the Zentrix pack. Those are step 8.
- `CRON_SECRET`, channel keys, PayFast sandbox names, and every Phase 5 flag.
- Turning `sending_enabled` on.
- Publishing [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

## Pass means

The password manager holds a token that starts with `sbp_`. The box name `SUPABASE_ACCESS_TOKEN` is that token, and the chat note is unset. Section 5 showed ref `fnysxlswzufdnlbhndxc` (or HTTP 200 plus that ref), and that output was not saved into git. The dry-run printed the prefix line and `Project ref: fnysxlswzufdnlbhndxc`, and it sent no SQL.

A pass does not mean steps 20 through 36 are applied, unless Billy said yes on this call and the script printed `Success. Steps 20–36 applied.` Writing this page is not that yes.

When section 8 was the path you used, pass means each file from 20 through 36 showed editor success. You still do not claim the CLI printed Success unless it did. `sending_enabled` is still false. Nothing was sent. No flag was set. No pack was clicked.
