"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import { createLead, type LeadActionState } from "@/app/actions/leads";

const initialState: LeadActionState = {
  ok: false,
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#2563EB] px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Send size={16} />
      {pending ? "Capturing lead..." : "Book A Free Discovery Call"}
    </button>
  );
}

export function LeadForm({ sourcePage = "website" }: { sourcePage?: string }) {
  const [state, formAction] = useActionState(createLead, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="source_page" value={sourcePage} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Full name
          <input
            name="full_name"
            required
            className="h-11 rounded-md border border-slate-200 bg-white px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
            placeholder="Your name"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Company
          <input
            name="company_name"
            required
            className="h-11 rounded-md border border-slate-200 bg-white px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
            placeholder="Company name"
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input
            name="email"
            type="email"
            required
            className="h-11 rounded-md border border-slate-200 bg-white px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
            placeholder="you@company.co.za"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Phone
          <input
            name="phone"
            required
            className="h-11 rounded-md border border-slate-200 bg-white px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
            placeholder="+27"
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Business type
          <input
            name="business_type"
            required
            className="h-11 rounded-md border border-slate-200 bg-white px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
            placeholder="SME, agency, clinic, logistics..."
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Service interest
          <select
            name="service_interest"
            required
            className="h-11 rounded-md border border-slate-200 bg-white px-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
            defaultValue=""
          >
            <option value="" disabled>
              Select one
            </option>
            <option>AI Agents</option>
            <option>Automation</option>
            <option>CRM Solutions</option>
            <option>Software Development</option>
            <option>Full Command Centre</option>
          </select>
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Message
        <textarea
          name="message"
          required
          rows={4}
          className="resize-none rounded-md border border-slate-200 bg-white px-3 py-3 outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
          placeholder="Tell us what you want to automate or build."
        />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton />
        {state.message ? (
          <p
            className={`text-sm font-medium ${
              state.ok ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
