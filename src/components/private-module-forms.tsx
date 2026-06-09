"use client";

import { useMemo, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { UploadCloud } from "lucide-react";
import { upsertPrivateModule, type ModuleActionState } from "@/app/actions/private-modules";
import { uploadDocument, type UploadActionState } from "@/app/actions/documents";

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

export function PrivateModuleForms() {
  const [activeModule, setActiveModule] = useState(modules[0].id);
  const [moduleState, moduleAction] = useActionState(upsertPrivateModule, initialModuleState);
  const [uploadState, uploadAction] = useActionState(uploadDocument, initialUploadState);
  const current = useMemo(
    () => modules.find((module) => module.id === activeModule) ?? modules[0],
    [activeModule],
  );

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
          <SubmitButton label={`Save ${current.label}`} />
          {moduleState.message ? (
            <p className={`text-sm font-semibold ${moduleState.ok ? "text-emerald-700" : "text-rose-700"}`}>
              {moduleState.message}
            </p>
          ) : null}
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
      </div>
    </section>
  );
}
