# Phone checklist: OpenRouter for Conversation AI drafts (no send)

Billy wires OpenRouter into production Conversation AI drafts. He bought OpenRouter credit on 13 Oct 2026. This page saves three Vercel names so a later draft can call that credit. It does not send. It does not spend that credit. It does not call OpenRouter.

The CRM already accepts any OpenAI-compatible `AI_REPLY_BASE_URL`. The app posts to `{AI_REPLY_BASE_URL}/chat/completions` with `Authorization: Bearer`. See `.env.example` (`AI_REPLY_*`). OpenRouter’s root for that call is `https://openrouter.ai/api/v1`.

This page is a phone checklist. It is not a SQL step. It is not a channel-key page. Email, WhatsApp, Meta, SMS, LinkedIn, and PayFast stay on their own pages. `CRON_SECRET` stays on [`docs/phone-cron-secret.md`](phone-cron-secret.md). The ops panel stays on [`docs/phone-ops-secrets.md`](phone-ops-secrets.md). The index is [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md).

Writing this page does not create a key, save an environment value, redeploy, apply SQL, or call `https://openrouter.ai/api/v1`. Steps 1 through 19 are already live. Steps 20 through 36 stay unapplied. `SUPABASE_ACCESS_TOKEN` on the ops box is still a chat note. A Personal Access Token starts with `sbp_`. This checklist does not need that token. `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`. Gated Phase 5 command-centre panels stay paused. Do not merge [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) or [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5).

The production CRM is https://ai-autotech-crm.vercel.app . It is auth-gated. The Vercel project is `ai-autotech-crm`. The Supabase project ref is `fnysxlswzufdnlbhndxc`. This page does not open the SQL editor.

## Names on this page

Document only. No API key is written in this file.

| Name | What to store, after his explicit yes to that name |
| --- | --- |
| `AI_REPLY_API_KEY` | The key he creates or copies on https://openrouter.ai/keys . It starts with `sk-or-`. It is not invented in this file. |
| `AI_REPLY_BASE_URL` | `https://openrouter.ai/api/v1` |
| `AI_REPLY_MODEL` | Suggestion he can change: `openai/gpt-4o-mini`. That id is documented at https://openrouter.ai/openai/gpt-4o-mini . It is a small, cheap model for draft replies. |

Leave these unset on this visit:

| Name | Why it stays unset |
| --- | --- |
| `AI_REPLY_CRON_ENABLED` | A flag. Unset, blank, or any value other than the string `true` keeps `/api/cron/ai-replies` idle. This page does not turn that job on. |
| `AUTOMATION_SEND_ENABLED` | Stays unset, or stays the string `false`. |
| `CRON_SECRET` | Not this visit. [`docs/phone-cron-secret.md`](phone-cron-secret.md). |
| Channel keys | Email, WhatsApp, Meta, SMS, LinkedIn, and PayFast stay on their own pages. This page does not set them. |

A yes for a channel key, `CRON_SECRET`, or PayFast is not a yes for these three names. A yes for one of these three names is not a yes for the others. Saving a name does not send.

When `AI_REPLY_MODEL` is empty, the app sends `gpt-4o-mini`. That is the OpenAI id. It is not an OpenRouter id. Set `AI_REPLY_MODEL` when the base URL is OpenRouter. The suggestion above includes the `openai/` prefix. He may type a different documented OpenRouter model id. Do not invent an id that is not on https://openrouter.ai/models .

Do not put `/chat/completions` on `AI_REPLY_BASE_URL`. The app adds that path.

There is no `OPENROUTER_API_KEY` in this repo. Do not invent that name on Vercel. The key goes in `AI_REPLY_API_KEY`.

## Stop until these are true

1. You will create or copy a key on https://openrouter.ai/keys . You will not invent a key. You will not type a sample that starts with `sk-or-` from this file. This file has no key.
2. You will store the key in a password manager only. You will not paste it into git, a pull request, chat, an issue, a screenshot, or this file.
3. You will not buy more credit. Credit was bought on 13 Oct 2026. You will not add a card. You will not open a top-up.
4. You will not call `https://openrouter.ai/api/v1` from the phone. You will not tap **Draft with AI**. That button spends the credit.
5. You will leave `AI_REPLY_CRON_ENABLED` unset. You will not turn `sending_enabled` on. You will not set `AUTOMATION_SEND_ENABLED`.
6. You will not register a row in `channel_connections`. OpenRouter is not a channel.

If any check is false, stop.

## 1. Create or copy the key

Billy does this. This page does not.

On the phone browser, not an app store listing:

1. Open https://openrouter.ai/keys
2. Sign in to the OpenRouter account that already holds the credit from 13 Oct 2026.
3. Read the key list. When a key for the CRM is already there and the password manager still has its secret, use that copy. Do not create a second key. The secret is shown once. If the password manager has no secret, stop. Do not invent a replacement. Create a new key only when he says yes on this call to create an OpenRouter key.
4. Stay on API Keys. Do not open Management API Keys. A management key creates other keys. The CRM does not use one. Do not call `POST /api/v1/keys`.

When he says yes to create:

1. Use Create. Name it so he can tell it is the CRM draft key. A name is not the secret.
2. A credit limit on the key is optional. Do not raise the account credit. Do not buy credit.
3. Copy the secret once into the password manager under `AI_REPLY_API_KEY`. It starts with `sk-or-`. One line. No spaces at either end.
4. Close the screen. The secret is not shown again.

Stop when the value does not start with `sk-or-`. Stop when the screen is a payment page or a credit top-up. Close it. Do not add a card.

Storing the key is not a yes to save it on Vercel, and it is not a yes to draft.

## 2. Vercel Production, only after his yes to each name

On the phone, open Vercel → the CRM project `ai-autotech-crm` → Settings → Environment Variables. On a narrow screen the project tabs scroll sideways. Settings is at the end of that row.

Read the list first.

When a row named `AI_REPLY_API_KEY` is already on Production, stop on that name. Do not create a second key. Do not edit that row. Do not replace it. This page does not prove the stored value matches the password manager. When the password manager has no entry, stop. Do not invent a replacement.

When `AI_REPLY_BASE_URL` or `AI_REPLY_MODEL` is already set, read the name only. Do not open the value if it is marked Sensitive. Leave an existing row until he says yes to change that name. Do not point the base URL at `https://api.openai.com/v1` while the key is an OpenRouter key.

When a name is missing, leave it missing until he says yes to that name.

When he says yes, add one name at a time. Production only. Leave Preview off unless he says Preview too on this call. Leave Development off.

1. `AI_REPLY_API_KEY`. Paste from the password manager at the moment you save. Mark it Sensitive if the UI allows, so the phone does not keep the value on screen after save.
2. `AI_REPLY_BASE_URL`. The value is `https://openrouter.ai/api/v1`. No trailing slash required. No `/chat/completions`.
3. `AI_REPLY_MODEL`. The suggestion is `openai/gpt-4o-mini`. He can change it to another documented OpenRouter model id before save. Do not leave this name empty. Empty makes the app send `gpt-4o-mini`, which is not the OpenRouter id.

Do not add `AI_REPLY_CRON_ENABLED`. Do not add any channel name. Do not delete a name.

After save, confirm the list shows the three names on Production. Do not open `AI_REPLY_API_KEY`. The base URL and the model are not secrets. They may stay visible. The key must not.

Leave the key out of git, pull requests, issues, and docs.

Saving the names does not send. Saving the names does not turn `sending_enabled` on. Saving the names does not write `channel_connections`. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.

## 3. Leave `AI_REPLY_CRON_ENABLED` unset

Do not add that name. If a row already exists, do not set it to `true`. Unset, blank, or any other value keeps the cron idle.

The cron route is `/api/cron/ai-replies`. Do not call it. Do not send `Authorization: Bearer` from the phone. A yes to save the three names is not a yes to run that job.

The cron still needs `CRON_SECRET` in production, and it still does not queue while sending is off or while `require_human_before_send` is true. The default is true. This page does not change that default. This page does not save `CRON_SECRET`.

The ops panel lists the job name `ai-reply-drafts`. This page does not register it. The schedule paste stays on [`docs/phone-pg-cron-schedules.md`](phone-pg-cron-schedules.md). This visit does not open that paste.

## 4. A redeploy may be needed

A saved variable is read on the next deployment. Production keeps the previous values until a new deployment is Ready. A redeploy may be needed before these three names are picked up.

This page does not click Redeploy. A yes to save the names is not a yes to redeploy. Do not open Cron Jobs. Do not edit `vercel.json`. Do not paste `cron.schedule`.

When he later says yes to a redeploy, the click is Vercel → `ai-autotech-crm` → Deployments → the latest Production deployment → Redeploy. Leave the environment on Production. Do not edit variables on that screen. Wait until that deployment shows Ready. That yes is not this page’s pass. This visit can stop after the names are saved.

## 5. Drafts stay drafts

Env names alone do not draft. The workspace still needs `ai_reply_settings.enabled` in the UI.

The control is the checkbox **Enable Conversation AI drafts** on `/command-centre/ai-replies`. An agency owner or a client admin can turn it on. Enabling drafts does not turn sending on. The page says so. This visit does not tick that box. This visit does not tap **Save Conversation AI**. A later yes to that checkbox is not a yes to send.

When that later yes happens, leave these as they are:

- Mode stays **Draft only — approve keeps it in the inbox**. Do not switch to **Queue outbox**.
- **Require a person before send** stays ticked. That is `require_human_before_send`. The default is true. Do not untick it.
- The header chip stays **Sending is off**. If it reads **Sending is on**, stop. Do not tick **Sending enabled**.

Drafts stay drafts. Nothing is sent.

Do not tap **Draft with AI** in the inbox. That button calls OpenRouter and spends the credit from 13 Oct 2026. This checklist does not spend it. Do not claim a draft was generated. Do not claim a draft was stored.

This checklist does not register `channel_connections`. It does not call `store_channel_secret`. It does not run `scripts/migrate-channel-credentials.mjs`. OpenRouter is not WhatsApp, SMS, email, or a social channel.

## 6. Signed-out gate

Stay logged out. Use a private tab so an old session cookie is not treated as signed in.

Open https://ai-autotech-crm.vercel.app/command-centre/ai-replies

Production answers 307 and the phone lands on `/login`. `next` is `/command-centre/ai-replies`.

A phone browser follows that redirect, so the address bar shows the sign-in page and does not show the number 307. A check that does not follow redirects reports **307** and a `Location` whose path is `/login` with that `next`. That is the same gate.

The same URL with `?org=ai-autotech` puts `org=ai-autotech` on `next`. That link also 307s to `/login` while signed out.

Pass: you see the sign-in page. You do not see **Conversation AI**, **Enable Conversation AI drafts**, **Save Conversation AI**, or **Draft with AI**. Landing on `/login` is a pass for the gate. It is not a draft. Do not claim a draft was generated.

Do not sign in to prove the key. A signed-in look is a different visit. This pass is the signed-out gate.

## Stop rules

- No API key in this file. No key in git, a pull request, chat, an issue, or a screenshot.
- Do not invent a key. Do not invent a model id. The suggestion `openai/gpt-4o-mini` is a suggestion. He can change it to another documented OpenRouter id.
- Do not buy credit. Do not add a card. Credit from 13 Oct 2026 stays unspent on this visit.
- Do not call `https://openrouter.ai/api/v1`. Do not tap **Draft with AI**.
- Production only, unless he says Preview too. Development stays off.
- `AI_REPLY_API_KEY` is Sensitive if the UI allows.
- `AI_REPLY_CRON_ENABLED` stays unset. Do not call `/api/cron/ai-replies`.
- No redeploy on this visit. No cron registration. No `cron.schedule` paste.
- `sending_enabled` stays false. `AUTOMATION_SEND_ENABLED` stays unset, or stays the string `false`.
- `require_human_before_send` stays true. Mode stays draft only. Do not tick **Enable Conversation AI drafts** on this visit.
- No `channel_connections` row. No channel key. No `store_channel_secret`.
- No SQL. Steps 1 through 19 stay Already live. Do not paste step 15 (`phase3a_conversation_ai`) again. Steps 20 through 36 stay unapplied.
- No Phase 5 flag. Gated command-centre panels stay paused.
- No send. No spend.
- [aiautotech#4](https://github.com/billyboy95/aiautotech/pull/4) and [aiautotech#5](https://github.com/billyboy95/aiautotech/pull/5) stay open until Billy says yes to publish. Do not merge them. See [`docs/website-publish-decision.md`](website-publish-decision.md).

## What still needs Billy’s yes

A yes for one line is not a yes for the others.

- Create an OpenRouter key, when the password manager does not already have one.
- Save `AI_REPLY_API_KEY` on Vercel Production.
- Save `AI_REPLY_BASE_URL` as `https://openrouter.ai/api/v1`.
- Save `AI_REPLY_MODEL`. The suggestion is `openai/gpt-4o-mini`. He can name a different documented OpenRouter model id.
- Add Preview. Leave it off unless he says Preview too.
- Redeploy Production so the new names are picked up. This page is not that yes. Section 4.
- Tick **Enable Conversation AI drafts** (`ai_reply_settings.enabled`). This page is not that yes. Drafts stay drafts. **Require a person before send** stays ticked.
- Tap **Draft with AI**. That spends credit. This page is not that yes. Do not claim a draft was generated.
- Set `AI_REPLY_CRON_ENABLED`, `CRON_SECRET`, or `AUTOMATION_SEND_ENABLED`. Leave them as they are.
- Turn `sending_enabled` on. That yes is [`docs/phone-sending-enabled.md`](phone-sending-enabled.md). A yes for these three names is not that yes.
- Register `channel_connections`. This page does not.

## Pass means

You stored an OpenRouter key in the password manager, or you stopped because the Production name `AI_REPLY_API_KEY` was already present and the password manager still has it, or because he had not said yes. When the three names were missing and he said yes to each one, Vercel Production on project `ai-autotech-crm` shows `AI_REPLY_API_KEY`, `AI_REPLY_BASE_URL`, and `AI_REPLY_MODEL`. The key is not in this file. `AI_REPLY_CRON_ENABLED` is still unset. Nothing was redeployed on this visit. No cron was registered. Signed out, `/command-centre/ai-replies` answered 307 and landed on `/login`. You did not claim a draft was generated. `sending_enabled` is still false. `AUTOMATION_SEND_ENABLED` is still unset, or still the string `false`. `require_human_before_send` is still the default true. No `channel_connections` row was registered. Nothing was sent. Nothing was spent.

A pass does not mean a draft was generated, the cron has run, sending is on, or SQL steps 20 through 36 are applied.
