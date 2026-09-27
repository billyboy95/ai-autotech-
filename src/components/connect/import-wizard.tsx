"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { importContactsToSandbox } from "@/app/actions/connect";
import { previewContactImport } from "@/lib/connect/import-csv";

const buttonClass = "inline-flex h-11 items-center rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] disabled:cursor-not-allowed disabled:bg-slate-300";
const fieldClass = "rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800";

const SAMPLE = "name,phone,email,consent_basis\nThabo Molefe,0825550101,thabo@example.com,consent";

export function ImportWizard({
  orgSlug,
  notice,
  previewMode,
}: {
  orgSlug: string;
  notice?: string | null;
  previewMode: boolean;
}) {
  const [csv, setCsv] = useState("");
  const preview = useMemo(() => previewContactImport(csv), [csv]);
  const shown = preview.rows.slice(0, 8);

  return (
    <div data-testid="import-contacts" className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Import contacts</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-700">
          Upload a consent-ready CSV. Columns map to name, phone, email, and consent_basis.
          POPIA: a blank consent is not imported, and this page does not send a consent request.
          Import to sandbox stores a draft only. Nothing is sent and nothing is charged.
        </p>
      </div>
      {previewMode ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Fixture mode. The dry run still runs here. Import to sandbox stays a stub until step 24 is applied.
        </p>
      ) : null}
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</p> : null}

      <form action={importContactsToSandbox} className="grid gap-4">
        <input type="hidden" name="slug" value={orgSlug} />
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">CSV</h2>
          <p className="text-sm text-slate-700">Expected shape:</p>
          <pre className="overflow-x-auto rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-800">{SAMPLE}</pre>
          <label className="grid gap-1 text-sm font-semibold text-slate-700" htmlFor="import-file">
            Upload CSV
            <input
              id="import-file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              className="text-sm font-normal"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then((text) => setCsv(text));
              }}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700" htmlFor="import-csv">
            Or paste CSV
            <textarea id="import-csv" name="csv" value={csv} onChange={(event) => setCsv(event.target.value)} rows={6} className={fieldClass} />
          </label>
        </section>

        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Column mapping</h2>
          {preview.columns.length ? (
            <ul className="grid gap-1 text-sm text-slate-700">
              {preview.columns.map((column) => (
                <li key={`${column.header}-${column.field}`}>{column.header} → {column.field}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-700">Paste a CSV to map name, phone, email, and consent_basis.</p>
          )}
        </section>

        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Dry run</h2>
          {preview.error ? <p className="text-sm text-slate-700">{preview.error}</p> : null}
          {csv.trim() && !preview.error ? (
            <p className="text-sm text-slate-700">
              {preview.ready} ready, {preview.blocked} blocked, {preview.skipped} skipped. Nothing is sent.
            </p>
          ) : null}
          {shown.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Phone</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Consent</th>
                    <th className="py-2">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={`${row.name}-${row.email}-${row.phone}`} className="border-t border-slate-100">
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 pr-3">{row.phone}</td>
                      <td className="py-2 pr-3">{row.email}</td>
                      <td className="py-2 pr-3">{row.consentBasis || "blank"}</td>
                      <td className="py-2">{row.issues.length ? row.issues.join(" ") : "Ready"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <button className={`${buttonClass} w-fit`} disabled={!csv.trim() || Boolean(preview.error) || preview.ready < 1}>
            Import to sandbox
          </button>
        </section>
      </form>
      <p className="text-sm text-slate-700">
        <Link href="/command-centre/connect-accounts" className="font-semibold text-[#2563EB]">Connect accounts</Link>
        {" "}for the full team. Nothing is sent.
      </p>
    </div>
  );
}
