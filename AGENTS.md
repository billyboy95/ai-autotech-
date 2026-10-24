<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cloud Agent

Node.js 22 and npm are already installed. Bootstrap with `npm ci`.

Leave Supabase, Stripe, and messaging secrets unset for local smoke tests. Copying `.env.example` to `.env.local` fills in placeholder Supabase values, and those values turn the auth gate on so `/command-centre` stops rendering fixture data.

- `npm test` and `npm run lint` match CI. `npm test` includes the route smoke test, which starts its own Next.js dev server on port 4187.
- `npm run build` produces the production build and type-check.
- Dev server: `npm run dev`. Next.js 15 listens on `0.0.0.0:3000` by default.
- `npm run demo:automation` writes a local CRM proof to `data/automation-demo.json` without Supabase. Do not commit that file after a demo run.
- With secrets unset, `/`, `/services`, and `/command-centre` render fixture data. `GET /api/proposals/demo/pdf` returns a sample proposal PDF.

If a client disconnects while the first page is still compiling, `next dev` can answer `/` with 404 until the dev server is restarted.
