import Link from "next/link";
import { GoliveNoteForm } from "@/components/golive/golive-note-form";
import { buildGoliveChecklist, type DisplayStatus, type GoliveChecklistModel } from "@/lib/golive/checklist";

const tone: Record<DisplayStatus, string> = {
  configured: "bg-emerald-50 text-emerald-950",
  missing: "bg-amber-50 text-amber-950",
  pending: "bg-slate-100 text-slate-700",
  fixture: "bg-amber-50 text-amber-950",
  blocked: "bg-rose-50 text-rose-950",
};

function label(status: DisplayStatus, sendingOff: boolean) {
  if (status === "blocked" && sendingOff) return "OFF · Blocked";
  if (status === "blocked") return "Blocked";
  if (status === "configured") return "Configured";
  if (status === "missing") return "Missing";
  if (status === "pending") return "Pending";
  return "Fixture";
}

export function GoliveChecklistPanel({
  tenantMode,
  orgSlug,
  workspaceSendingEnabled,
  educationApplied,
  zentrixApplied,
}: {
  tenantMode: string;
  orgSlug: string;
  workspaceSendingEnabled: boolean;
  educationApplied: boolean;
  zentrixApplied: boolean;
}) {
  const model = buildGoliveChecklist({
    tenantMode,
    workspaceSendingEnabled,
    educationApplied,
    zentrixApplied,
  });
  return <GoliveChecklistView model={model} orgSlug={orgSlug} />;
}

export function GoliveChecklistView({ model, orgSlug }: { model: GoliveChecklistModel; orgSlug: string }) {
  const byId = Object.fromEntries(model.rows.map((row) => [row.id, row.status]));
  return (
    <section
      id="golive-checklist"
      data-testid="golive-checklist"
      data-mode={model.mode}
      data-write={model.write ? "true" : "false"}
      data-flag={model.flag}
      data-migrations={byId.migrations}
      data-setup={byId.setup_wizard}
      data-owner={byId.owner_bootstrap}
      data-ops={byId.ops_secrets}
      data-education={byId.education_pack}
      data-zentrix={byId.zentrix_pack}
      data-pwa={byId.pwa_install}
      data-sending={byId.sending}
      data-sending-off={model.sendingOff ? "true" : "false"}
      className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Go-live</p>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Go-live checklist</h1>
        <p className="mt-2 text-sm text-slate-700">
          Status only. Nothing is sent, nothing is spent, and no secret value is shown. This page does not run SQL and does not click Apply.
        </p>
        {model.lines.map((line) => (
          <p key={line} className="mt-2 text-sm text-slate-700">{line}</p>
        ))}
      </div>
      <ol className="grid gap-2">
        {model.rows.map((row) => (
          <li key={row.id} className="rounded-md border border-slate-200 px-3 py-2" data-check={row.id} data-status={row.status} data-snapshot={row.snapshot}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#0B1F3A]">{row.label}</h2>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone[row.status]}`}>
                {label(row.status, row.id === "sending" && model.sendingOff)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{row.detail}</p>
            {row.parts ? (
              <ul className="mt-2 grid gap-1 text-sm text-slate-700">
                {row.parts.map((part) => (
                  <li key={part.id} data-ops-part={part.id} data-status={part.status}>
                    {part.label} is {part.status}. The value is not shown.
                  </li>
                ))}
              </ul>
            ) : null}
            {row.href ? (
              <p className="mt-2 text-sm">
                <Link href={row.href} className="font-semibold text-[#2563EB]">{row.hrefLabel}</Link>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      <div>
        <h2 className="font-display text-base font-bold text-[#0B1F3A]">Sandbox note</h2>
        <p className="mt-1 text-sm text-slate-700">
          The note stores pending, ready, blocked, or fixture. sending stays blocked. It does not store a secret, run SQL, or click Apply.
        </p>
        <div className="mt-3">
          <GoliveNoteForm
            mode={model.mode}
            write={model.write}
            hint={model.lines[model.lines.length - 1] ?? ""}
            orgSlug={orgSlug}
          />
        </div>
      </div>
    </section>
  );
}
