# Phone checklist: queue an opener (do not send)

Billy can save a personal opener for broker prospects on a phone in South Africa. Queue is not a send. This page does not turn sending on, does not set an environment variable, and does not contact anyone.

The desk is https://ai-autotech-crm.vercel.app/command-centre/outreach?org=ai-autotech . Signed out, it lands on `/login`. The header chip must read **Sending is off**. If it reads **Sending is on**, stop.

## Queue is not a send

**Queue opener** writes one outbox row per prospect with status `draft`.

The sender only delivers outbox status `queued` or `approved`, and only when all three of these are already true:

1. A row in `channel_connections` for the workspace (there are none today).
2. The workspace checkbox **Sending enabled** (`organizations.sending_enabled`). It stays off.
3. The Vercel environment variable `AUTOMATION_SEND_ENABLED` set to the string `true`. Billy must say that name before anyone sets it. It stays unset, or stays `false`.

A draft is ignored even if that variable is later set to `true`. This page has no button that promotes a draft to `queued` or `approved`. It does not call Resend, SMTP, WhatsApp, or SMS.

A prospect with no marketing opt-in still gets a draft, marked as a consent request. Do-not-contact, a suppression, or an opt-out gets no row. The stage becomes **Opener queued**, not **Sent**. **Sent** means a message was delivered. This button does not do that.

The words are a free 20-minute look at how new enquiries get a reply. They say this is not insurance advice. They do not recommend a policy, a product, or cover.

## Before you tap

1. Open https://ai-autotech-crm.vercel.app/command-centre/outreach?org=ai-autotech
2. Sign in as the agency owner (`billyfaber06@gmail.com`) if the phone is on `/login`.
3. Pass: eyebrow **Outreach**, heading **Outreach funnel**, chip **Sending is off**, and a section **Queue opener**.
4. If the page says to apply `supabase/migrations/20261114120000_outreach_queue_opener.sql`, stop. That file is not applied until Billy says yes. Do not paste it from this visit.

## Queue opener

Skip this until Billy names the prospects.

1. Tick those prospects in the table. At most 25.
2. Tap **Queue opener** once.
3. Pass: `Opener saved as a draft. Nothing was sent.` The stage reads **Opener queued**.
4. Leave **Sent** untapped.

A second tap of the same prospect does not add another draft.

## Hold queued marketing outbox

Five older marketing rows are already `queued`. Turning sending on later could flush them. This control lists them first. It changes nothing until the box is ticked.

1. Read **Hold queued marketing outbox**. The count and the addresses are the dry run.
2. If the list is not the stale marketing rows you expect, stop. Do not tick the box.
3. Tick **I understand this cancels the listed queued marketing rows and does not send anything.**
4. Tap **Cancel these queued marketing rows** once.
5. Pass: `Queued marketing rows were cancelled. Nothing was sent.` Those rows are `cancelled`. Draft openers stay `draft`.

Unticked, the button does not change rows. The line is `Tick the confirm box before cancelling queued marketing rows. Nothing was changed.` An empty list says `No queued marketing rows to cancel. Nothing was sent.`

## Still required before any real delivery

Do not do these on this visit.

- Connect a channel (`channel_connections` stays empty).
- Tick **Sending enabled** on the workspace. `sending_enabled` stays false.
- Set `AUTOMATION_SEND_ENABLED` to `true`. Billy must say that env name first.

## Hard refuse

- Merging this pull request from the phone.
- Pasting `supabase/migrations/20261114120000_outreach_queue_opener.sql` before Billy says yes.
- Setting `AUTOMATION_SEND_ENABLED`, or any other secret, in Vercel.
- Turning `sending_enabled` on.
- Tapping **Send**, **Send now**, **Go live**, or **Send test**.
- Moving a prospect to **Sent**.
- Buying credit, a number, or a domain.

## Pass means

You saw **Queue opener** and **Hold queued marketing outbox**, with **Sending is off**. You queued a draft only if Billy named the prospects, and the blue line said nothing was sent. You cancelled stale rows only after the dry-run list looked right and the confirm box was ticked. `sending_enabled` stayed false. `AUTOMATION_SEND_ENABLED` stayed unset or `false`. Nobody was contacted.
