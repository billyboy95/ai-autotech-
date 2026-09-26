-- Run this AFTER the tenancy migration, and AFTER you create your login
-- in Supabase Dashboard → Authentication → Users.
-- Replace the email with the exact address you used. This does not delete anything.
--
-- Until this row exists, /command-centre still opens the AI AutoTech workspace
-- without a password (the current owner path). /agency and client workspaces
-- such as EASTC ask you to sign in.

insert into public.memberships (user_id, org_id, role)
select u.id, o.id, 'agency_owner'
from auth.users u
join public.organizations o on o.slug = 'ai-autotech'
where lower(u.email) = lower('you@aiautotech.co.za')
on conflict (user_id, org_id) do update set role = 'agency_owner';
