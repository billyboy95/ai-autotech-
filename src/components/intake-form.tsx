"use client";

import { useState } from "react";

export function IntakeForm({ formKey }: { formKey: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-5 grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage("");
        try {
          const response = await fetch(`/api/public/intake/${formKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.get("name"),
              email: form.get("email"),
              phone: form.get("phone"),
              company: form.get("company"),
              message: form.get("message"),
              hp: form.get("hp"),
            }),
          });
          const body = (await response.json()) as { ok?: boolean; error?: string };
          setMessage(body.ok ? "Saved. This enquiry is in this workspace only." : body.error || "Could not save.");
          if (body.ok) event.currentTarget.reset();
        } catch {
          setMessage("Could not reach the intake endpoint.");
        } finally {
          setPending(false);
        }
      }}
    >
      <input name="hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <input name="name" required placeholder="Name" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      <input name="email" type="email" placeholder="Email" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      <input name="phone" placeholder="Phone" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      <input name="company" placeholder="School or company" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      <textarea name="message" placeholder="How can we help?" className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm" />
      <button disabled={pending} className="h-10 rounded-md bg-[#0B1F3A] text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Sending…" : "Send enquiry"}
      </button>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </form>
  );
}
