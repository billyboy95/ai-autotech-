-- Run this AFTER the tenancy migration, and AFTER you create your login
-- in Supabase Dashboard → Authentication → Users.
-- Replace the email with the exact address you used. This does not delete anything.
--
-- /command-centre and /agency require a Supabase Auth session.
-- Alternatively set OWNER_EMAILS (see .env.example). On first login, a listed
-- address with no membership is attached as agency_owner. This script is the
-- manual path when that variable is not set. It does not delete anything.

insert into public.memberships (user_id, org_id, role)
select u.id, o.id, 'agency_owner'
from auth.users u
join public.organizations o on o.slug = 'ai-autotech'
where lower(u.email) = lower('billyfaber06@gmail.com')
on conflict (user_id, org_id) do update set role = 'agency_owner';
