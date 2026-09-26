"use client";

import { addClient, addInvoice, addJob, markInvoicePaid, setJobStatus } from "@/app/actions/crm";
import { LEGACY_JOB_KINDS, OFFER_PACKAGES, OFFER_SERVICES } from "@/lib/brand/catalog";
import type { CrmData } from "@/lib/crm-store";

const jobStatuses = ["Open", "Doing", "Done"] as const;

function Field({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
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

export function CompanySection({ data, section }: { data: CrmData; section: "clients" | "jobs" | "money" }) {
  if (section === "clients") {
    return (
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
    );
  }

  if (section === "jobs") {
    return (
      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <form action={addJob} className="grid h-fit gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">New job</h2>
          <Field name="client" label="Client" placeholder="EASTC Holdings" />
          <Field name="title" label="What are we doing" placeholder="WhatsApp inbox" />
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Type
            <select name="kind" className="h-10 rounded-md border border-slate-200 px-3 text-sm" defaultValue="Professional Websites">
              <optgroup label="Services">
                {OFFER_SERVICES.map((item) => (
                  <option key={item.name}>{item.name}</option>
                ))}
              </optgroup>
              <optgroup label="Packages">
                {OFFER_PACKAGES.map((item) => (
                  <option key={item.name}>{item.name}</option>
                ))}
              </optgroup>
              <optgroup label="Earlier labels">
                {LEGACY_JOB_KINDS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </optgroup>
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
    );
  }

  const unpaid = data.invoices.filter((invoice) => invoice.status === "Unpaid");
  return (
    <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <form action={addInvoice} className="grid h-fit gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Invoice</h2>
        <p className="text-xs text-slate-500">Record it here. Collect on Yoco. {unpaid.length} unpaid.</p>
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
                <p className="text-sm text-slate-500">
                  {invoice.client} · {invoice.status}
                </p>
              </div>
              {invoice.status === "Unpaid" ? (
                <form action={markInvoicePaid.bind(null, invoice.id)}>
                  <button className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white">Paid on Yoco</button>
                </form>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
