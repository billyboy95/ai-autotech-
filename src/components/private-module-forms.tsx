"use client";

import { useMemo, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { FileDown, Trash2, UploadCloud } from "lucide-react";
import { upsertPrivateModule, type ModuleActionState } from "@/app/actions/private-modules";
import { deleteDocument, uploadDocument, type UploadActionState } from "@/app/actions/documents";
import type { StoredDocument } from "@/lib/documents";

const modules = [
  {
    id: "leads",
    label: "CRM Lead",
    fields: [
      ["full_name", "Full name"],
      ["company_name", "Company"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["business_type", "Business type"],
      ["service_interest", "Service interest"],
      ["lead_status", "Lead status"],
      ["message", "Message"],
    ],
  },
  {
    id: "clients",
    label: "Client",
    fields: [
      ["company_name", "Company name"],
      ["industry", "Industry"],
      ["status", "Status"],
    ],
  },
  {
    id: "projects",
    label: "Project",
    fields: [
      ["name", "Project name"],
      ["stage", "Stage"],
      ["progress", "Progress"],
      ["deadline", "Deadline"],
      ["client_visible_update", "Client-visible update"],
    ],
  },
  {
    id: "proposals",
    label: "Proposal",
    fields: [
      ["title", "Proposal title"],
      ["status", "Status"],
      ["total", "Total"],
    ],
  },
  {
    id: "invoices",
    label: "Invoice",
    fields: [
      ["invoice_number", "Invoice number"],
      ["status", "Status"],
      ["total", "Total"],
      ["due_date", "Due date"],
    ],
  },
  {
    id: "agents",
    label: "AI Agent",
    fields: [
      ["name", "Agent name"],
      ["agent_type", "Agent type"],
      ["status", "Status"],
      ["performance_score", "Performance score"],
      ["connected_tools", "Connected tools"],
    ],
  },
  {
    id: "support_tickets",
    label: "Support Ticket",
    fields: [
      ["title", "Ticket title"],
      ["priority", "Priority"],
      ["status", "Status"],
      ["client_visible_update", "Client-visible update"],
    ],
  },
];

const initialModuleState: ModuleActionState = { ok: false, message: "" };
const initialUploadState: UploadActionState = { ok: false, message: "" };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-md bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

function UploadButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white transition hover:bg-[#14345f] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <UploadCloud size={16} />
      {pending ? "Uploading..." : "Upload document"}
    </button>
  );
}

export function PrivateModuleForms({ documents }: { documents: StoredDocument[] }) {
  const [activeModule, setActiveModule] = useState(modules[0].id);
  const [recordId, setRecordId] = useState("");
  const [moduleState, moduleAction] = useActionState(upsertPrivateModule, initialModuleState);
  const [uploadState, uploadAction] = useActionState(uploadDocument, initialUploadState);
  const [deleteState, deleteAction] = useActionState(deleteDocument, initialUploadState);
  const current = useMemo(
    () => modules.find((module) => module.id === activeModule) ?? modules[0],
    [activeModule],
  );
  const pdfHref =
    recordId && (activeModule === "proposals" || activeModule === "invoices")
      ? `/api/${activeModule}/${recordId}/pdf`
      : null;

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Create and Edit Private Modules</h2>
          <p className="mt-1 text-sm text-slate-500">
            Save CRM, client, project, proposal, invoice, agent, and ticket records into tenant-scoped Supabase tables.
          </p>
        </div>
        <select
          value={activeModule}
          onChange={(event) => setActiveModule(event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
        >
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.label}
            </option>
          ))}
        </select>
      </div>

      <form action={moduleAction} className="mt-5 grid gap-4">
        <input type="hidden" name="module" value={current.id} />
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Record ID for edit
          <input
            name="id"
            value={recordId}
            onChange={(event) => setRecordId(event.target.value)}
            className="h-10 rounded-md border border-slate-200 px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
            placeholder="Leave blank to create a new record"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          {current.fields.map(([name, label]) => (
            <label key={name} className="grid gap-2 text-sm font-medium text-slate-700">
              {label}
              <input
                name={name}
                type={name.includes("date") || name === "deadline" ? "date" : name.includes("total") || name.includes("score") || name === "progress" ? "number" : "text"}
                className="h-10 rounded-md border border-slate-200 px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
                placeholder={name === "connected_tools" ? "CRM, WhatsApp, Email" : label}
              />
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton label={`Save ${current.label}`} />
            {pdfHref ? (
              <Link
                href={pdfHref}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-[#2563EB] hover:text-[#2563EB]"
              >
                <FileDown size={16} />
                View PDF
              </Link>
            ) : null}
          </div>
          {moduleState.message ? <p className={`text-sm font-semibold ${moduleState.ok ? "text-emerald-700" : "text-rose-700"}`}>{moduleState.message}</p> : null}
        </div>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="font-display text-base font-bold text-[#0B1F3A]">Document Uploads</h3>
        <form action={uploadAction} className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Document title
              <input
                name="title"
                className="h-10 rounded-md border border-slate-200 px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
                placeholder="Signed proposal, invoice proof, project brief..."
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              File
              <input
                name="file"
                type="file"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input name="client_visible" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            Client-visible document
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <UploadButton />
            {uploadState.message ? (
              <p className={`text-sm font-semibold ${uploadState.ok ? "text-emerald-700" : "text-rose-700"}`}>
                {uploadState.message}
              </p>
            ) : null}
          </div>
        </form>

        <div className="mt-6 grid gap-3">
          <h4 className="text-sm font-semibold text-[#0B1F3A]">Recent documents</h4>
          {documents.length === 0 ? (
            <p className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No documents uploaded or generated yet for the active organization.
            </p>
          ) : (
            documents.map((document) => (
              <article key={document.id} className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{document.title}</p>
                  <p className="text-xs text-slate-500">
                    {document.file_name ?? "Unnamed file"}
                    {document.version_number ? ` · v${document.version_number}` : ""}
                    {document.record_type ? ` · ${document.record_type}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/api/documents/${document.id}/download`}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-[#2563EB] hover:text-[#2563EB]"
                  >
                    <FileDown size={15} />
                    Download
                  </Link>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={document.id} />
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  </form>
                </div>
              </article>
            ))
          )}
          {deleteState.message ? <p className={`text-sm font-semibold ${deleteState.ok ? "text-emerald-700" : "text-rose-700"}`}>{deleteState.message}</p> : null}
        </div>
      </div>
    </section>
  );
}
