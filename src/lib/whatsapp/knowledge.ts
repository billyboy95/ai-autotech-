/**
 * Facts the WhatsApp assistant may use, taken from the live site (https://aiautotech.co.za,
 * repo billyboy95/aiautotech, pulled 2026-09-25). Anything not in here must not be stated as fact.
 * Update this file when the site changes (prices especially).
 */

export const SITE = {
  audit: "https://aiautotech.co.za/audit/",
  book: "https://aiautotech.co.za/book/",
  home: "https://aiautotech.co.za",
};

/** The only Rand amounts the bot is allowed to mention. Anything else gets blocked by the guard. */
export const PUBLISHED_PRICES = ["R8,999", "R8 999", "R8999", "R14,999", "R14 999", "R14999"];

export const KNOWLEDGE = `
COMPANY
- AI AutoTech (Pty) Ltd ("AI Auto Tech"), Benoni, Gauteng. Founder & MD: Willem "Billy" Faber.
- Serves Benoni, Ekurhuleni, Johannesburg and Gauteng (and works remotely). Service-area business, no walk-in office. Meetings on Google Meet, WhatsApp or phone.
- Phone/WhatsApp 064 686 3803. Email billyfaber06@gmail.com.
- Builds AI employees that answer WhatsApps and calls, follow up leads, book appointments and handle admin for South African businesses, so they can scale without hiring.
- Local first: knows SA realities (load shedding, data costs, cash-flow pressure, WhatsApp-first customers). Rand pricing, no dollar subscriptions. Done for you: builds, deploys and manages the system. You deal directly with the people who build it, not a call centre. No long contracts / no recruitment or HR admin.
- Every system hands anything sensitive to a person.

SERVICES (10)
1. AI Employees & Agents: trained AI agents that answer, follow up, book and do admin 24/7. From R8,999/month excl. VAT.
2. WhatsApp Automation: instant replies, lead capture, quick-reply menus, reminders, hand-over to your team, one shared team inbox, every chat saved to the CRM. Uses the official WhatsApp Business Platform (Meta's API), verified business profile, POPIA-friendly opt-in wording. Reviewed weekly for the first month. Priced after the free audit (fixed quote).
3. AI Voice Agents: natural-sounding agents that answer calls, qualify and book, day and night. From R14,999/month excl. VAT.
4. CRM & Pipelines: every lead from WhatsApp, website, forms, calls and social in one pipeline with automatic follow-ups. Priced after the audit.
5. AI Chat + Voice: one assistant for web chat, WhatsApp, social and voice notes. Priced after the audit.
6. Business Automation: quotes, invoices, onboarding, document chasing and reports that run themselves. Priced after the audit.
7. Websites & Dashboards: fast mobile-first sites with WhatsApp and booking buttons, lead capture, SEO basics, HTTPS hosting, plus a live dashboard of leads, bookings and sales. Priced after the audit.
8. Digital Transformation: phased move from paper and spreadsheets to connected systems. Priced after the audit.
9. Autonomous Research Specialist: an AI researcher that reads the sources and hands you a cited brief.
10. Autonomous Orchestrator: the hub that assigns, checks and connects your AI agents as you add more.

READY-MADE AI TEAMS (each from R8,999/month excl. VAT; final price depends on how many AI employees you start with and your setup, confirmed before any work starts)
- Dental Front Desk Team (5 AI employees): WhatsApp Receptionist (answers patient WhatsApps 24/7), Booking Agent (books/moves/cancels in the practice diary), Reminder Agent, No-show Follow-up Agent, Reviews Agent (asks for Google reviews). Medical aid / clinical questions go to reception.
- Estate Agent Lead Team (4): Enquiry Responder (portal, website and WhatsApp enquiries in seconds), Buyer & Renter Qualifier (budget, area, bond pre-approval or move-in date, tags hot/warm/cold), Viewing Scheduler, Follow-up Agent.
- College Admissions Team (4): Admissions Assistant (course, entry requirement and fee questions from approved info), Application Collector (ID copies, results), Applicant Follow-up Agent, Campus Visit Scheduler.
- Broker Client Team (4): Quote Request Agent, Document Collector, Renewal Reminder Agent, Policy Q&A Assistant (never gives advice; advice and claims go to licensed staff).

PRICING RULES
- Published: AI employees / AI teams from R8,999/month excl. VAT. AI voice agents from R14,999/month excl. VAT. All prices in Rand, excl. VAT, flat monthly.
- Everything else (WhatsApp automation, CRM, automation, websites, research) is scoped per business with a fixed quote after the free audit.
- There are NO other published numbers: no setup fees, no website prices, no discounts, no timelines, no ROI stats. Never make them up. Say it depends on the setup and Billy gives a fixed quote after the audit or a call.

FREE AI AUDIT: ${SITE.audit}
- About 5 minutes, free, no card, no obligation. You get your top AI opportunities, a recommended AI team and a Priority 1-2-3 plan (what to automate first, with time-saving estimates based on your answers). POPIA-aware.

BOOK A CALL: ${SITE.book}
- Free 30-minute Google Meet with Billy, times in SAST. Goes through audit results, recommended AI team and Priority 1-2-3 plan and next steps. Can book without doing the audit.

PUBLIC WORK (the only named client work you may mention)
- Live sites shipped for EASTC Holdings: eastech.co.za (hub plus Technical School, Artisanal College and Varsity), eastechfoundation.co.za (EASTC Foundation NPC), eastech-institute.co.za (EASTECH Institute). Do not name any other clients and do not quote results or stats.

WORKS WITH: Claude Code, Codex, Cursor, Grok, Perplexity, Hermes, Supabase, Vercel (compatibility only, not partnerships).
`.trim();
