"use client";

import { useActionState } from "react";
import { duplicateWorkspace, type DuplicateState } from "@/app/actions/workspace-templates";
import type { DuplicatePreviewCard } from "@/lib/snapshots/swap";

const initial: DuplicateState = { ok: false, created: false, mode: "fixture", message: "", slug: "" };

export type DuplicateSourceOption = {
  kind: "snapshot" | "workspace";
  id: string;
  name: string;
};

function ProofCard({ card, testId }: { card: DuplicatePreviewCard; testId: string }) {
  return (
    <article data-testid={testId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: card.accent }}>
        {card.slug}
      </p>
      <h2 className="mt-1 font-display text-xl font-bold text-[#0B1F3A]">{card.businessName}</h2>
      <p className="mt-2 text-sm text-slate-600">{card.address}</p>
      <p className="text-sm text-slate-600">{card.hours}</p>
      <p className="text-sm text-slate-600">{card.phone}</p>
      <p className="text-sm text-slate-600">{card.email}</p>
      <p className="mt-2 text-sm font-semibold text-[#0B1F3A]">{card.bookingUrl}</p>
      <ul className="mt-3 grid gap-1 text-sm text-slate-700">
        {card.services.map((item) => (
          <li key={`${item.name}-${item.price_label}`}>
            {item.name} <span className="font-semibold">{item.price_label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Stages</p>
      <p className="text-sm text-slate-700">{card.stages.join(" · ")}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Workflows</p>
      <ul className="text-sm text-slate-700">
        {card.workflows.map((item) => (
          <li key={item.name}>
            {item.name} · {item.active ? "active" : "inactive draft"}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-6 text-slate-600">{card.templateExcerpt}</p>
      <p className="mt-2 text-xs text-slate-500">Sending is off. AI replies are {card.aiMode}.</p>
    </article>
  );
}

export function DuplicateWorkspaceForm({
  mode,
  sources,
  barn,
  second,
  defaultSource,
}: {
  mode: "fixture" | "sandbox";
  sources: DuplicateSourceOption[];
  barn: DuplicatePreviewCard;
  second: DuplicatePreviewCard;
  defaultSource: string;
}) {
  const [state, action, pending] = useActionState(duplicateWorkspace, initial);

  return (
    <div className="grid gap-4">
      {mode === "fixture" ? (
        <p data-testid="fixture-banner" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          Fixture only. WORKSPACE_TEMPLATES_ENABLED is not the string true, so nothing is created. Sending stays off. Nothing is charged.
        </p>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
          This creates an isolated workspace. Templates, sequences, and workflows stay inactive. Sending stays off. Nothing is charged.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ProofCard card={barn} testId="proof-burger-barn" />
        <ProofCard card={second} testId="proof-second-joint" />
      </div>

      <form action={action} data-testid="duplicate-form" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="forceFixture" value={mode === "fixture" ? "1" : "0"} />
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Swap the details</h2>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Source
          <select name="source" defaultValue={defaultSource} className="h-11 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900">
            {sources.map((source) => (
              <option key={`${source.kind}:${source.id}`} value={`${source.kind}:${source.id}`}>
                {source.kind === "snapshot" ? "Template" : "Workspace"} · {source.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Business name
          <input name="name" defaultValue="Second Joint" required className="h-11 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Slug
          <input name="slug" defaultValue="second-joint" className="h-11 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Primary colour
            <input name="primary_colour" type="color" defaultValue="#0B1F3A" className="h-11 w-full rounded-md border border-slate-200 bg-white" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Accent colour
            <input name="accent_colour" type="color" defaultValue="#C2410C" className="h-11 w-full rounded-md border border-slate-200 bg-white" />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Logo URL
          <input name="logo_url" defaultValue="https://example.com/second-joint-logo.png" className="h-11 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Phone
          <input name="phone" defaultValue="0100000002" className="h-11 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Email
          <input name="email" type="email" defaultValue="hello@second-joint.example" className="h-11 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Address
          <input name="address" defaultValue="8 Lake Road, Benoni" className="h-11 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Hours
          <input name="hours" defaultValue="12:00 to 22:00" className="h-11 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Booking URL
          <input name="booking_url" defaultValue="/book/second-joint-table" className="h-11 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Services and prices
          <textarea
            name="services"
            rows={4}
            defaultValue={"Smash burger | R95\nChips | R35"}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
          />
        </label>
        <p className="text-xs leading-5 text-slate-500">One service per line: name, a vertical bar, then the price. Leave this blank to keep the template menu.</p>
        <button type="submit" disabled={pending} className="h-11 rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Working…" : mode === "fixture" ? "Preview duplicate" : "Create workspace"}
        </button>
        {state.message ? (
          <p data-testid="duplicate-result" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800">
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
