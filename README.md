# AI AutoTech

Production-ready SaaS foundation for AI AutoTech. The app includes a public website, a private command-centre dashboard, Supabase Auth integration points, lead capture, RBAC scaffolding, and a Supabase/PostgreSQL schema.

## Stack

- Next.js 15
- TypeScript
- Tailwind CSS v4
- ShadCN-inspired component patterns
- Framer Motion
- Recharts
- Supabase Auth and PostgreSQL
- Server Actions
- Stripe subscriptions
- Supabase Storage document uploads
- PDF rendering for proposals and invoices
- Vercel-ready deployment

## Routes

- `/` public landing page with lead capture
- `/services`
- `/ai-agents`
- `/automation`
- `/crm-solutions`
- `/software-development`
- `/case-studies`
- `/blog`
- `/about`
- `/contact`
- `/login`
- `/command-centre`

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Agency workspaces

AI AutoTech Pty Ltd is the parent agency. Client workspaces such as EASTC and Zentrix Online are isolated by `org_id` and Row Level Security. `/command-centre` and `/agency` require a Supabase Auth session and a membership in the organisation being viewed. Owner steps: `docs/agency-owner-setup.md`.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Create users in Supabase Auth.
6. Create an `organizations` row and matching `organization_members` rows for each user.
7. Insert matching rows into `profiles` with one of these roles: `Super Admin`, `Admin`, `Staff`, `Contractor`, `Client`.

When Supabase variables are set, `/command-centre` is protected by middleware. Without Supabase variables, the dashboard remains viewable for local design review.

## Lead Capture

The public forms call a Server Action in `src/app/actions/leads.ts`. Leads are validated with Zod and inserted into the `leads` table with `lead_status = New Lead`.

Required lead fields:

- `full_name`
- `company_name`
- `email`
- `phone`
- `business_type`
- `service_interest`
- `message`
- `source_page`
- `lead_status`
- `created_at`

## Security Foundation

- Supabase Auth server client
- Login action
- Protected-route middleware
- Role-based access model
- Organization membership boundaries for tenant-scoped records
- RLS-enabled SQL schema
- Public insert policy for leads
- Internal read/write policies for platform modules
- Audit log table
- Environment variable examples

## Private Modules

The Command Centre includes create/edit forms for:

- CRM leads
- Clients
- Projects
- Proposals
- Invoices
- AI agents
- Support tickets
- Documents

Forms use Server Actions and write to Supabase when the environment variables and SQL schema are configured. The dashboard loads live Supabase data and falls back to sample data when Supabase is not connected.

## Billing, Uploads, and PDFs

- Stripe checkout action: `src/app/actions/billing.ts`
- Stripe webhook route: `/api/billing/webhook`
- Document upload action: `src/app/actions/documents.ts`
- Proposal PDF route: `/api/proposals/[id]/pdf`
- Invoice PDF route: `/api/invoices/[id]/pdf`

## Deployment

Deploy to Vercel as a Next.js project. Add the same environment variables from `.env.example` in the Vercel project settings before production deploy.

The live CRM app hostname is `https://ai-autotech-crm.vercel.app`. The phone checklist to attach `crm.aiautotech.co.za` on that project's Production environment, and to confirm the GoDaddy record for `aiautotech.co.za`, is `docs/phone-crm-custom-domain.md`. That page does not edit DNS. The public website origin in `.env.example` is `https://aiautotech.co.za` (no hyphen). The phone checklist for the Vercel Production value of `NEXT_PUBLIC_SITE_URL` is `docs/phone-site-url-verify.md`. The other phone checklists start at `docs/GO-LIVE-RUNBOOK.md` (Phone-first unblock).

Analytics placeholders are enabled only when these variables are present:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_META_PIXEL_ID`
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`

## Automated CRM

The command centre works leads from capture through handover. Stages are New, Contacted, Audit booked, Audit done, Proposal sent, Won, Lost, and Onboarding/Handover.

Intake at `/api/public/audit`, `/api/public/contact`, and `/api/public/leads` still saves the lead first. After that, the automation layer assigns an owner, scores the lead, and queues the acknowledgement. If the automation tables are missing, the original insert still succeeds.

### Apply the migration

In the Supabase SQL editor, run the whole file:

`supabase/migrations/20260926160000_crm_automation.sql`

Then run:

`supabase/migrations/20260926183000_outbound_channels.sql`

Then run:

`supabase/migrations/20260926200000_send_compliance.sql`

All three only add columns and tables. The first remaps existing `Talking` leads to `Contacted` and `Quoted` leads to `Proposal sent`. None of them delete rows. Run the first before expecting stage changes or the outbox to save. Run the second before SMS, social posts, tracked clicks, or campaign prospects will save. Run the third before opt-outs, marketing consent, and per-send cost will save. Until the first file is applied, the board still lists current leads and shows a setup note. Saves upsert the rows that changed. They do not delete a lead, client, job, or invoice that was written by another request.

### What runs without extra keys

- Pipeline board, lead timeline, templates, settings, and the daily summary
- Auto-assignment (default owner Billy, optional round-robin, QR rule for `qr_source=billy_phone_qr`)
- Scoring from audit answers, source, and company size
- Follow-up queue: acknowledgement, day 1, day 3, day 7, audit reminder, proposal follow-up
- SMS drafts, social calendar (Facebook, Instagram, LinkedIn) with copy-and-post, and `/api/public/go` tracked links
- Outbound campaign CSV import. Prospects enter the pipeline only after a reply or a booking
- Stage rules, booking webhook, won → handover checklist, draft quote
- `GET /api/automation/summary` for a bot
- `POST /api/automation/inbound` for `booking.created`, `reply.received`, `audit.completed`, `proposal.sent` (Calendly `invitee.created` is accepted)
- Vercel Cron `0 4 * * *` (06:00 Africa/Johannesburg) hits `/api/cron/automation`. After `CRON_SECRET` is saved, the phone steps for that daily job and the Supabase schedules are `docs/phone-pg-cron-schedules.md`.

### What needs configuration

| Need | Variable |
| --- | --- |
| Scheduled job in production | `CRON_SECRET`. Vercel sends `Authorization: Bearer <CRON_SECRET>`. |
| Booking or reply webhooks in production | `AUTOMATION_WEBHOOK_SECRET` (or `CRON_SECRET`) as `x-automation-secret` |
| Booking link inside templates | Settings → booking URL. If that is empty, `NEXT_PUBLIC_CALENDLY_URL` is used |
| Actually email someone | `AUTOMATION_SEND_ENABLED=true` plus `RESEND_API_KEY` or `SMTP_HOST` |
| Actually WhatsApp someone | `AUTOMATION_SEND_ENABLED=true` plus `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. Without those, the outbox keeps a `wa.me` link |
| Actually send SMS | `AUTOMATION_SEND_ENABLED=true` plus BulkSMS (`BULKSMS_TOKEN_ID` and `BULKSMS_TOKEN_SECRET`), or `CLICKATELL_API_KEY`, or Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`). Without those, the outbox keeps an `sms:` link |
| Publish a Facebook Page post | `AUTOMATION_SEND_ENABLED=true` plus `META_PAGE_ID` and `META_PAGE_ACCESS_TOKEN` |
| Publish an Instagram post | `AUTOMATION_SEND_ENABLED=true` plus `META_IG_USER_ID`, `META_PAGE_ACCESS_TOKEN`, and an image URL on the post |
| Publish a LinkedIn post | `AUTOMATION_SEND_ENABLED=true` plus `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN` |
| Lock the summary API | `AUTOMATION_SUMMARY_TOKEN` |
| Rand amount on a WhatsApp send | `WHATSAPP_USDZAR`. Without it, the outbox stores the USD card rate only |
| Override the WhatsApp card | `WHATSAPP_MARKETING_USD` (default `0.0379`) and `WHATSAPP_SERVICE_USD` (default `0.0095`) |
| Cost of one SMS or email | `SMS_COST_ZAR` and `EMAIL_COST_ZAR`. Unset means that send has no amount |

`AUTOMATION_SEND_ENABLED` defaults off. Do not turn it on until you intend to message real leads. Approving a draft does not send while the switch is off.

Marketing messages (nudges, proposal follow-ups, and campaign steps) need a recorded opt-in. Acknowledgements and audit reminders do not. Every marketing body includes AI AutoTech and “Reply STOP to opt out”. A reply of STOP, UNSUBSCRIBE, or OPT OUT suppresses that address and cancels what is still queued. From 1 October 2026, each WhatsApp number’s first 1,000 service sends in a Johannesburg calendar month are stored at USD 0. The next Cloud API service send is stored at USD 0.0095. Marketing Cloud API sends are stored at USD 0.0379. A `wa.me` link is USD 0. A CSV import is not consent.

Local proof, with no Supabase:

```bash
npm run demo:automation
npm test
```

`CRM_DEMO_DATA=1` makes the command centre read `data/automation-demo.json` instead of Supabase.

### Privacy

`/command-centre` and `/agency` require a Supabase Auth session when Supabase keys are set. A signed-in user only sees organisations they belong to. `OWNER_EMAILS` defaults to `billyfaber06@gmail.com` and attaches that owner on first login. `/command-centre/owner` shows that status and the `supabase/owner-bootstrap.sql` paste. `OWNER_BOOTSTRAP_UI_ENABLED` stays unset. `/command-centre/ops-secrets` shows whether `CRON_SECRET` and the outbound channel keys are present. Values are not shown. `OPS_SECRETS_READY_ENABLED` stays unset. Social sign-in buttons follow `NEXT_PUBLIC_AUTH_PROVIDERS` and stay hidden unless that Supabase provider is enabled. The email magic link remains available. Without Supabase keys the pages render fixture data for local review and CI. Public intake stays at `/api/public/*`.

## Next Build Steps

- Replace mock dashboard data with Supabase queries.
- Add create/edit forms for each private module.
- Add client organization tenancy boundaries.
- Add subscription billing.
- Add file uploads for documents.
- Add PDF rendering for proposals and invoices.
