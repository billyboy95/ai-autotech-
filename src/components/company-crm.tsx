"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import {
  addClient,
  addInvoice,
  addJob,
  addLead,
  markInvoicePaid,
  setJobStatus,
  setLeadStage,
} from "@/app/actions/crm";
import type { CrmData } from "@/lib/crm-store";

const tabs = ["Today", "Leads", "Clients", "Jobs", "Money"] as const;
type Tab = (typeof tabs)[number];

const stages = ["New", "Talking", "Quoted", "Won", "Lost"] as const;
const jobStatuses = ["Open", "Doing", "Done"] as const;

function Field({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
      {label}
      <input
        name={name}
        placeholder={placeholder}
        className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

export function CompanyCrm({ data }: { data: CrmData }) {
  const [tab, setTab] = useState<Tab>("Today");
  const openJobs = data.jobs.filter((job) => job.status !== "Done");
  const unpaid = data.invoices.filter((invoice) => invoice.status === "Unpaid");
  const newLeads = data.leads.filter((lead) => lead.stage === "New" || lead.stage === "Talking");

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#111827]">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo compact />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">CRM</p>
              <p className="text-sm font-semibold text-slate-700">AI AutoTech Pty Ltd</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">Yours. Not rented.</p>
        </div>
        <nav className="mx-auto mt-4 flex max-w-5xl gap-1 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`h-10 shrink-0 rounded-md px-4 text-sm font-semibold ${
                tab === item ? "bg-[#0B1F3A] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
        {tab === "Today" ? (
          <section className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">People to chase</p>
              <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">{newLeads.length}</p>
              <p className="mt-1 text-sm text-slate-500">New or talking leads</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Open jobs</p>
              <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">{openJobs.length}</p>
              <p className="mt-1 text-sm text-slate-500">Work not done yet</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unpaid</p>
              <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">{unpaid.length}</p>
              <p className="mt-1 text-sm text-slate-500">Waiting on Yoco</p>
            </article>
            <article className="sm:col-span-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">What needs you</h2>
              <ul className="mt-3 grid gap-2 text-sm">
                {newLeads.slice(0, 5).map((lead) => (
                  <li key={lead.id} className="rounded-md bg-slate-50 px-3 py-2">
                    Lead: {lead.name} {lead.company ? `· ${lead.company}` : ""} · {lead.stage}
                  </li>
                ))}
                {openJobs.slice(0, 5).map((job) => (
                  <li key={job.id} className="rounded-md bg-slate-50 px-3 py-2">
                    Job: {job.title} for {job.client} · {job.status}
                  </li>
                ))}
                {unpaid.map((invoice) => (
                  <li key={invoice.id} className="rounded-md bg-slate-50 px-3 py-2">
                    Invoice: R{invoice.amount} · {invoice.client} · unpaid
                  </li>
                ))}
                {!newLeads.length && !openJobs.length && !unpaid.length ? (
                  <li className="text-slate-500">Nothing waiting. Add a lead or a job.</li>
                ) : null}
              </ul>
            </article>
          </section>
        ) : null}

        {tab === "Leads" ? (
          <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <form action={addLead} className="grid h-fit gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">New lead</h2>
              <Field name="name" label="Name" placeholder="Thabo" />
              <Field name="company" label="Business" placeholder="Thabo Dental" />
              <Field name="phone" label="Phone / WhatsApp" placeholder="064…" />
              <Field name="notes" label="Note" placeholder="Asked about WhatsApp inbox" />
              <button className="h-10 rounded-md bg-[#2563EB] text-sm font-semibold text-white">Save lead</button>
            </form>
            <div className="grid gap-2">
              {data.leads.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                  No leads yet. Put the first one in.
                </p>
              ) : (
                data.leads.map((lead) => (
                  <article key={lead.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">{lead.name}</p>
                        <p className="text-sm text-slate-500">
                          {lead.company || "No business name"} {lead.phone ? `· ${lead.phone}` : ""}
                        </p>
                        {lead.notes ? <p className="mt-1 text-sm text-slate-600">{lead.notes}</p> : null}
                      </div>
                      <select
                        defaultValue={lead.stage}
                        onChange={(event) => {
                          void setLeadStage(lead.id, event.target.value as (typeof stages)[number]);
                        }}
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                      >
                        {stages.map((stage) => (
                          <option key={stage}>{stage}</option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        {tab === "Clients" ? (
          <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <form action={addClient} className="grid h-fit gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">New client</h2>
              <Field name="name" label="Business" placeholder="EASTC Holdings" />
              <Field name="person" label="Who you talk to" placeholder="CEO" />
              <Field name="phone" label="Phone" placeholder="011…" />
              <Field name="whatsapp" label="WhatsApp" placeholder="082…" />
              <Field name="notes" label="Note" placeholder="What we do for them" />
              <button className="h-10 rounded-md bg-[#2563EB] text-sm font-semibold text-white">Save client</button>
            </form>
            <div className="grid gap-2">
              {data.clients.map((client) => (
                <article key={client.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="font-semibold text-[#0B1F3A]">{client.name}</p>
                  <p className="text-sm text-slate-500">
                    {client.person || "No contact name"}
                    {client.phone ? ` · ${client.phone}` : ""}
                    {client.whatsapp ? ` · WA ${client.whatsapp}` : ""}
                  </p>
                  {client.notes ? <p className="mt-1 text-sm text-slate-600">{client.notes}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "Jobs" ? (
          <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <form action={addJob} className="grid h-fit gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">New job</h2>
              <Field name="client" label="Client" placeholder="EASTC Holdings" />
              <Field name="title" label="What are we doing" placeholder="WhatsApp inbox" />
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Type
                <select name="kind" className="h-10 rounded-md border border-slate-200 px-3 text-sm">
                  <option>Website</option>
                  <option>WhatsApp</option>
                  <option>AI Employee</option>
                  <option>Other</option>
                </select>
              </label>
              <button className="h-10 rounded-md bg-[#2563EB] text-sm font-semibold text-white">Save job</button>
            </form>
            <div className="grid gap-2">
              {data.jobs.map((job) => (
                <article key={job.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#0B1F3A]">{job.title}</p>
                      <p className="text-sm text-slate-500">
                        {job.client} · {job.kind}
                      </p>
                    </div>
                    <select
                      defaultValue={job.status}
                      onChange={(event) => {
                        void setJobStatus(job.id, event.target.value as (typeof jobStatuses)[number]);
                      }}
                      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                    >
                      {jobStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "Money" ? (
          <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <form action={addInvoice} className="grid h-fit gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Invoice</h2>
              <p className="text-xs text-slate-500">Record it here. Collect on Yoco.</p>
              <Field name="client" label="Client" placeholder="EASTC Holdings" />
              <Field name="amount" label="Amount in rand" placeholder="8999" />
              <button className="h-10 rounded-md bg-[#2563EB] text-sm font-semibold text-white">Save invoice</button>
            </form>
            <div className="grid gap-2">
              {data.invoices.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                  No invoices yet. When Yoco gets paid, mark it here.
                </p>
              ) : (
                data.invoices.map((invoice) => (
                  <article key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div>
                      <p className="font-semibold text-[#0B1F3A]">R{invoice.amount}</p>
                      <p className="text-sm text-slate-500">{invoice.client} · {invoice.status}</p>
                    </div>
                    {invoice.status === "Unpaid" ? (
                      <form action={markInvoicePaid.bind(null, invoice.id)}>
                        <button className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white">
                          Paid on Yoco
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
