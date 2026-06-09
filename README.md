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

Analytics placeholders are enabled only when these variables are present:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_META_PIXEL_ID`
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`

## Next Build Steps

- Replace mock dashboard data with Supabase queries.
- Add create/edit forms for each private module.
- Add client organization tenancy boundaries.
- Add subscription billing.
- Add file uploads for documents.
- Add PDF rendering for proposals and invoices.
