import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import type { ClientMetric, WorkspaceSummary } from "@/lib/tenant/types";

export function AgencyView({
  agency,
  clients,
  preview,
  signedInEmail,
}: {
  agency: WorkspaceSummary;
  clients: ClientMetric[];
  preview: boolean;
  signedInEmail: string | null;
}) {
  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#111827]">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Agency</p>
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">{agency.name}</h1>
            <p className="text-sm text-slate-500">{agency.location} · client workspaces stay separate</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/command-centre" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold leading-10 text-[#0B1F3A]">
              Open CRM
            </Link>
            <Link href="/agency/new" className="h-10 rounded-md bg-[#2563EB] px-3 text-sm font-semibold leading-10 text-white">
              Create client workspace
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
        {preview ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Local preview of the agency layout. Apply the tenancy migration and set Supabase keys to load live numbers.
            {signedInEmail ? ` Signed in as ${signedInEmail}.` : ""}
          </p>
        ) : null}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Client workspaces</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">{clients.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Leads</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">
              {clients.reduce((sum, client) => sum + client.leads, 0)}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Open pipeline</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">
              {formatCurrency(clients.reduce((sum, client) => sum + client.pipelineValue, 0))}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Shopify revenue</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#0B1F3A]">
              {formatCurrency(clients.reduce((sum, client) => sum + client.revenue, 0))}
            </p>
          </article>
        </section>
        <div className="grid gap-3">
          {clients.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No client workspaces yet. EASTC and Zentrix Online are created by the tenancy migrations.
            </p>
          ) : (
            clients.map((client) => (
              <article key={client.workspace.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: client.workspace.primaryColor }} />
                      <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{client.workspace.name}</h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {client.workspace.legalName || client.workspace.name}
                      {client.workspace.location ? ` · ${client.workspace.location}` : ""}
                      {client.workspace.domain ? ` · ${client.workspace.domain}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/command-centre?org=${client.workspace.slug}`}
                      className="h-9 rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold leading-9 text-white"
                    >
                      Open
                    </Link>
                    <Link
                      href={`/agency/${client.workspace.slug}/settings`}
                      className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold leading-9 text-[#0B1F3A]"
                    >
                      Settings
                    </Link>
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Leads</dt>
                    <dd className="text-xl font-bold text-[#0B1F3A]">{client.leads}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pipeline value</dt>
                    <dd className="text-xl font-bold text-[#0B1F3A]">{formatCurrency(client.pipelineValue)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Revenue</dt>
                    <dd className="text-xl font-bold text-[#0B1F3A]">{formatCurrency(client.revenue)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Conversions</dt>
                    <dd className="text-xl font-bold text-[#0B1F3A]">{client.conversions}%</dd>
                  </div>
                </dl>
                {client.stores ? (
                  <p className="mt-3 text-sm text-slate-600">{client.stores} Shopify stores</p>
                ) : null}
                {client.stages.length ? (
                  <p className="mt-3 text-sm text-slate-600">Pipeline: {client.stages.join(" → ")}</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
