# Inbox quick replies, collision warning, and narrow layout

`/command-centre/inbox` can show three team-inbox helpers. They stay off until `INBOX_QUICK_UX_ENABLED` is the string `true`. Unset, blank, or any other value keeps today's inbox: no quick-reply chips, no collision banner, and the desktop-first layout.

`sending_enabled` stays false. Queue reply still only queues. Nothing is sent. Meta is not called. No live key is required.

## What turns on

- Quick replies. Short workspace answers sit above the composer. Choosing one fills the box. It does not submit the form.
- Collision warning. If another teammate is on the open conversation, the thread shows "{Name} is viewing" or "{Name} is typing".
- Narrow layout. Below the large breakpoint the list stacks above the thread, filters scroll inside the page with a larger tap target, and the inbox does not widen the page. At the large breakpoint the three columns stay.

`INBOX_MULTI_NUMBER_ENABLED`, `INBOX_TEAM_STATS_ENABLED`, `INBOX_WA_WINDOW_ENABLED`, and `INBOX_WA_METERING_ENABLED` are separate. Leave each unset unless that flag is already meant to be on.

## Storage

No new table. Do not add a migration for this flag.

- Preview (no Supabase) uses the in-memory replies in `src/lib/inbox/quick-ux.ts`.
- A signed-in workspace reads `organizations.settings.inbox_quick_replies`. Each item needs a `label` and a `body`. `id` is optional and must be letters, numbers, `_`, or `-` when set. At most 8 replies are used.
- If that list is missing or empty, the same in-memory replies are shown.

Follow-up, only after Billy asks for editable replies in the product: a dedicated `inbox_quick_replies` table. This change does not add that table and does not change apply order.

## Presence

The signed-in inbox reuses the existing Supabase channel `inbox-{orgId}`. It tracks viewing or typing for the open conversation only. The message text is not broadcast. Names on that channel come from the workspace membership role, not from the payload.

Preview has no Realtime socket. Fixtures stand in so the banner can be checked without a provider:

- Lerato Mokoena: Naledi Khumalo is typing.
- Amina Patel: Sam Okonkwo is viewing.
- Other preview threads: no banner.

## Verify with preview fixtures

Leave Supabase, Stripe, and messaging secrets unset. Copying `.env.example` to `.env.local` turns the auth gate on, so leave `.env.local` unset for this check.

Flag off (today's inbox):

```bash
npm run dev
```

Open `/command-centre/inbox`. There are no quick-reply chips and no "is typing" or "is viewing" banner.

Flag on, local only. Do not set this in production until Billy says yes:

```bash
INBOX_QUICK_UX_ENABLED=true npm run dev
```

Open `/command-centre/inbox`.

- The Hours, Callback, and Booked chips are above the composer. Choose Hours. The text lands in the box. The form is not submitted. Queue reply is still required, and the reply stays queued.
- The open thread says "Naledi Khumalo is typing".
- Open Amina Patel. The banner says "Sam Okonkwo is viewing".
- Open Thabo Ndlovu. There is no collision banner.
- Narrow the window. The conversation list stacks above the thread, the filter chips scroll inside the page, and the page itself does not scroll sideways.
- The three-column layout returns when the window is wide.

Nothing in that pass is delivered.
