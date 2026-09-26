"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";

const links = [
  ["/command-centre", "Today"],
  ["/command-centre/pipeline", "Pipeline"],
  ["/command-centre/outbox", "Outbox"],
  ["/command-centre/campaigns", "Campaigns"],
  ["/command-centre/social", "Social"],
  ["/command-centre/templates", "Templates"],
  ["/command-centre/summary", "Summary"],
  ["/command-centre/clients", "Clients"],
  ["/command-centre/jobs", "Jobs"],
  ["/command-centre/money", "Money"],
  ["/command-centre/settings", "Settings"],
] as const;

export function CrmFrame({
  children,
  setupError,
  sendingEnabled = false,
}: {
  children: ReactNode;
  setupError?: string | null;
  sendingEnabled?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#111827]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo compact />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Command centre</p>
              <p className="text-sm font-semibold text-slate-700">AI AutoTech Pty Ltd</p>
            </div>
          </div>
          <p
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              sendingEnabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
            }`}
          >
            {sendingEnabled ? "Sending is on" : "Sending is off"}
          </p>
        </div>
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 pb-3">
        <nav className="flex w-max gap-1">
          {links.map(([href, label]) => {
            const active = href === "/command-centre" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex h-10 shrink-0 items-center rounded-md px-3 text-sm font-semibold ${
                  active ? "bg-[#0B1F3A] text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6">
        {setupError ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{setupError}</p>
        ) : null}
        {!sendingEnabled ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Follow-ups are queued for you to read. Nothing is delivered to a lead until sending is switched on with a provider key.
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
