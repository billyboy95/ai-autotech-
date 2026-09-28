import Link from "next/link";
import { opsStatusLabel, type OpsCheck } from "@/lib/ops/readiness";

const tone: Record<OpsCheck["status"], string> = {
  ok: "bg-emerald-50 text-emerald-950",
  blocked: "bg-rose-50 text-rose-950",
  needs_billy: "bg-amber-50 text-amber-950",
  pending: "bg-slate-100 text-slate-700",
};

export function OpsReadinessPanel({ checks }: { checks: OpsCheck[] }) {
  return (
    <section id="ops-readiness" data-testid="ops-readiness" className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Go-live blockers</p>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Ops readiness</h2>
        <p className="mt-1 text-sm text-slate-700">
          Read-only checklist. It does not write secrets, call Vercel, send a message, or spend money. sending_enabled stays false.
        </p>
      </div>
      <ul className="grid gap-2">
        {checks.map((check) => (
          <li key={check.id} data-check={check.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[#0B1F3A]">{check.label}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[check.status]}`}>{opsStatusLabel(check.status)}</span>
            </div>
            <p className="mt-1 text-slate-700">{check.detail}</p>
            {check.href && check.hrefLabel ? (
              <p className="mt-1">
                <Link href={check.href} className="font-semibold text-[#2563EB]">
                  {check.hrefLabel}
                </Link>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
