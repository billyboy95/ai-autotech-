"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import {
  agents,
  dashboardNav,
  kpis,
  pipeline,
  projects,
  reports,
  revenueData,
  roleMatrix,
  tickets,
} from "@/lib/platform-data";
import { Bell, ChevronDown, CirclePlus, Search, Settings, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function StatusChip({ value }: { value: string }) {
  const colors: Record<string, string> = {
    Running: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    Reviewing: "bg-amber-50 text-amber-700 ring-amber-100",
    Scheduled: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    Open: "bg-rose-50 text-rose-700 ring-rose-100",
    "In Progress": "bg-blue-50 text-blue-700 ring-blue-100",
    "Waiting On Client": "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
        colors[value] ?? "bg-slate-50 text-slate-700 ring-slate-100"
      }`}
    >
      {value}
    </span>
  );
}

export function CommandCentreDashboard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#111827]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-[#0B1F3A] p-5 text-white lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#38BDF8] text-[#0B1F3A]">
              <ShieldCheck size={21} />
            </div>
            <div>
              <p className="font-display text-base font-bold">AI AutoTech</p>
              <p className="text-xs text-cyan-100">Zentrix Online</p>
            </div>
          </div>
          <nav className="space-y-1">
            {dashboardNav.map((item, index) => (
              <button
                key={item.label}
                className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                  index === 0
                    ? "bg-white text-[#0B1F3A]"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon size={17} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-8 rounded-md border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold">Future SaaS Readiness</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Multi-tenancy, subscriptions, client organizations, white-label dashboards, and API integrations are mapped in the schema.
            </p>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2563EB]">
                  Command Centre
                </p>
                <h1 className="font-display text-2xl font-bold text-[#0B1F3A] md:text-3xl">
                  Executive Operating System
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500 md:flex">
                  <Search size={16} />
                  Search leads, clients, projects...
                </div>
                <button className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700">
                  <Bell size={17} />
                </button>
                <button className="flex h-10 items-center gap-2 rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold text-white">
                  Super Admin
                  <ChevronDown size={15} />
                </button>
              </div>
            </div>
          </header>

          <section className="space-y-6 p-4 md:p-6">
            <motion.div
              initial="hidden"
              animate="visible"
              transition={{ staggerChildren: 0.05 }}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              {kpis.map((item) => (
                <motion.article
                  variants={fadeUp}
                  key={item.label}
                  className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {item.label}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="font-display text-2xl font-bold text-[#0B1F3A]">{item.value}</p>
                    <p className={`text-sm font-semibold ${item.tone}`}>{item.delta}</p>
                  </div>
                </motion.article>
              ))}
            </motion.div>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Revenue and Lead Velocity</h2>
                    <p className="text-sm text-slate-500">MRR, ARR, and lead generation trend.</p>
                  </div>
                  <button className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                    <Settings size={15} />
                    Configure
                  </button>
                </div>
                <div className="h-72">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData}>
                        <defs>
                          <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `R${Number(value) / 1000}k`} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Area type="monotone" dataKey="revenue" stroke="#2563EB" fill="url(#revenue)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="grid h-full place-items-center rounded-md bg-slate-50 text-sm font-medium text-slate-500">
                      Loading revenue chart...
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Lead Pipeline</h2>
                <p className="mb-5 text-sm text-slate-500">Stages from New Lead to Onboarding.</p>
                <div className="h-72">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pipeline} layout="vertical" margin={{ left: 18 }}>
                        <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="stage" type="category" width={104} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value, name) => (name === "value" ? formatCurrency(Number(value)) : value)} />
                        <Bar dataKey="count" fill="#38BDF8" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="grid h-full place-items-center rounded-md bg-slate-50 text-sm font-medium text-slate-500">
                      Loading pipeline chart...
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 p-5">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Active Projects</h2>
                    <p className="text-sm text-slate-500">Discovery, planning, design, build, testing, review, launch, support.</p>
                  </div>
                  <button className="flex h-9 items-center gap-2 rounded-md bg-[#2563EB] px-3 text-sm font-semibold text-white">
                    <CirclePlus size={15} />
                    Project
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Client</th>
                        <th className="px-5 py-3">Project</th>
                        <th className="px-5 py-3">Stage</th>
                        <th className="px-5 py-3">Progress</th>
                        <th className="px-5 py-3">Owner</th>
                        <th className="px-5 py-3">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projects.map((project) => (
                        <tr key={project.project} className="hover:bg-slate-50">
                          <td className="px-5 py-4 font-semibold text-slate-900">{project.client}</td>
                          <td className="px-5 py-4 text-slate-700">{project.project}</td>
                          <td className="px-5 py-4"><StatusChip value={project.stage} /></td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-28 rounded-full bg-slate-100">
                                <div className="h-2 rounded-full bg-[#2563EB]" style={{ width: `${project.progress}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-500">{project.progress}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-600">{project.owner}</td>
                          <td className="px-5 py-4 text-slate-600">{project.due}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">AI Agent Dashboard</h2>
                <p className="mb-4 text-sm text-slate-500">Sales, support, operations, marketing, finance, and executive agents.</p>
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <article key={agent.name} className="rounded-md border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{agent.name}</p>
                          <p className="text-xs text-slate-500">{agent.type} · {agent.tools}</p>
                        </div>
                        <StatusChip value={agent.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-md bg-slate-50 p-2">
                          <p className="text-xs text-slate-500">Assigned tasks</p>
                          <p className="font-display text-lg font-bold text-[#0B1F3A]">{agent.tasks}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 p-2">
                          <p className="text-xs text-slate-500">Performance</p>
                          <p className="font-display text-lg font-bold text-emerald-700">{agent.score}%</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Support Tickets</h2>
                <div className="mt-4 space-y-3">
                  {tickets.map((ticket) => (
                    <div key={ticket.title} className="rounded-md border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{ticket.title}</p>
                          <p className="text-xs text-slate-500">{ticket.client} · {ticket.priority} priority</p>
                        </div>
                        <StatusChip value={ticket.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Reporting Centre</h2>
                <div className="mt-4 grid gap-2">
                  {reports.map((report) => (
                    <button key={report} className="flex h-10 items-center justify-between rounded-md border border-slate-200 px-3 text-left text-sm font-semibold text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB]">
                      {report}
                      <span className="text-slate-400">Open</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">RBAC Foundation</h2>
                <div className="mt-4 space-y-2">
                  {roleMatrix.map(([role, access]) => (
                    <div key={role} className="rounded-md bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">{role}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{access}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
