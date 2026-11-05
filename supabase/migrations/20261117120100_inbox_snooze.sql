-- Inbox snooze. Additive. Not a numbered step in supabase/APPLY-ORDER.md.
-- Timestamp 20261117120100 is later than draft #101 team seat billing
-- (20261117120000_team_seat_billing.sql). The two files do not share a timestamp.
-- Do not paste this until Billy says yes. Do not apply it from this change.
-- Adds conversations.snoozed_until. Null means the thread is not snoozed.
-- A future timestamp hides the thread from the Open list until that time.
-- This file does not send, does not insert an outbox row, does not change consent,
-- and does not set sending_enabled.

do $snooze$
begin
  if to_regclass('public.conversations') is null then
    raise exception 'inbox snooze needs phase 2e conversations; apply 20261018120000_phase2e_inbox.sql first';
  end if;
end
$snooze$;

alter table public.conversations
  add column if not exists snoozed_until timestamptz;

comment on column public.conversations.snoozed_until is
  'When set in the future, the inbox hides this thread from Open until this time. Null means not snoozed. Does not send.';

create index if not exists conversations_snoozed_until_idx
  on public.conversations (org_id, snoozed_until)
  where snoozed_until is not null;
