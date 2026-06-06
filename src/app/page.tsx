import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LeadForm } from "@/components/lead-form";
import {
  databaseTables,
  publicPages,
  roleMatrix,
  services,
} from "@/lib/platform-data";

const modules = [
  "Executive Dashboard",
  "CRM / Lead Management",
  "Client Management",
  "Project Management",
  "Proposal Generator",
  "Invoice Tracking",
  "AI Agent Dashboard",
  "Client Portal",
  "Support Tickets",
  "Reporting Centre",
];

const readiness = [
  "Multi-tenancy",
  "Subscription billing",
  "Client organizations",
  "SaaS modules",
  "AI agent marketplace",
  "White-label dashboards",
  "API integrations",
  "Mobile app expansion",
];

export default function Home() {
  return (
    <main className="bg-[#F3F4F6] text-[#111827]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo compact />
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 xl:flex">
            {publicPages.slice(1, 7).map((page) => (
              <Link key={page.href} href={page.href} className="hover:text-[#2563EB]">
                {page.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/command-centre"
              className="hidden h-10 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#0B1F3A] transition hover:border-[#2563EB] md:flex"
            >
              Open Dashboard
            </Link>
            <Link
              href="#contact"
              className="flex h-10 items-center gap-2 rounded-md bg-[#2563EB] px-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              Book Call
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section className="grid-pattern border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:px-6 lg:py-20">
          <div className="flex flex-col justify-center">
            <h1 className="font-display text-4xl font-extrabold leading-tight text-[#0B1F3A] md:text-6xl">
              AI AutoTech
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              A scalable operating system for automation, AI, software delivery, CRM, proposals, invoices, client portals, and future SaaS products for South African SMEs.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#contact"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#2563EB] px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#1d4ed8]"
              >
                Book A Free Discovery Call
                <CalendarDays size={17} />
              </Link>
              <Link
                href="/command-centre"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-[#0B1F3A] transition hover:border-[#2563EB]"
              >
                View Command Centre
                <ExternalLink size={17} />
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Automation", "AI", "Software"].map((item) => (
                <div key={item} className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="font-display text-lg font-bold text-[#0B1F3A]">{item}</p>
                  <p className="text-sm text-slate-500">Digital transformation layer</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-lg p-4">
            <div className="rounded-md bg-[#0B1F3A] p-4 text-white">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Live Ops</p>
                  <p className="font-display text-xl font-bold">Executive Dashboard</p>
                </div>
                <ShieldCheck className="text-[#38BDF8]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["R428k", "Revenue"],
                  ["312", "Leads"],
                  ["48", "Clients"],
                  ["14", "Agents"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-md bg-white/10 p-3">
                    <p className="font-display text-2xl font-bold">{value}</p>
                    <p className="text-xs text-slate-300">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
                <div className="rounded-md bg-white p-4 text-[#111827]">
                  <p className="font-semibold">Pipeline</p>
                  <div className="mt-4 space-y-3">
                    {["New Lead", "Discovery Booked", "Proposal Sent", "Won"].map((stage, index) => (
                      <div key={stage}>
                        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
                          <span>{stage}</span>
                          <span>{82 - index * 18}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-[#2563EB]"
                            style={{ width: `${88 - index * 16}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-md bg-white p-4 text-[#111827]">
                  <p className="font-semibold">Agent Health</p>
                  <div className="mt-4 space-y-3">
                    {["Sales Agent", "Support Agent", "Finance Agent"].map((agent) => (
                      <div key={agent} className="flex items-center justify-between rounded-md bg-slate-50 p-3">
                        <span className="text-sm font-medium">{agent}</span>
                        <span className="status-dot text-xs font-bold text-emerald-700">Running</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <article key={service.title} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <service.icon className="mb-4 text-[#2563EB]" size={24} />
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{service.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[0.75fr_1.25fr] lg:px-6">
          <div>
            <h2 className="font-display text-3xl font-bold text-[#0B1F3A]">Public website and private operating system in one foundation.</h2>
            <p className="mt-4 leading-7 text-slate-600">
              The platform starts as an internal command centre and is structured for a client-facing SaaS rollout.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((module) => (
              <div key={module} className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span className="text-sm font-semibold text-slate-800">{module}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-2 lg:px-6">
        <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">Database and security foundation</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Supabase Auth, protected routes, RBAC, RLS policy guidance, input validation, server actions, audit logs, and environment variables are scaffolded for the build.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {databaseTables.map((table) => (
              <span key={table} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {table}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-[#0B1F3A]">Role-based access</h2>
          <div className="mt-5 space-y-3">
            {roleMatrix.map(([role, access]) => (
              <div key={role} className="rounded-md bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">{role}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{access}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-[#0B1F3A] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[0.8fr_1.2fr] lg:px-6">
          <div>
            <h2 className="font-display text-3xl font-bold">Future SaaS readiness</h2>
            <p className="mt-4 leading-7 text-slate-300">
              The build is organized to extend into subscriptions, tenant-aware modules, client organizations, dashboards, integrations, and mobile expansion.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {readiness.map((item) => (
              <div key={item} className="rounded-md border border-white/10 bg-white/5 p-3 text-sm font-semibold">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[0.75fr_1.25fr] lg:px-6">
        <div>
          <h2 className="font-display text-3xl font-bold text-[#0B1F3A]">Book A Free Discovery Call</h2>
          <p className="mt-4 leading-7 text-slate-600">
            Capture a lead directly into Supabase and route it into the CRM pipeline.
          </p>
          <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            Calendly placeholder: connect the team scheduling link here.
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <LeadForm sourcePage="home" />
        </div>
      </section>

      <a
        href="https://wa.me/27000000000"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/25 transition hover:bg-emerald-600"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle size={22} />
      </a>
    </main>
  );
}
