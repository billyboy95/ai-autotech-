import { MigrationDryRunForm } from "@/components/migrations/dry-run-form";
import { buildPageMigrationRunner, migrationStatusLabel } from "@/lib/migrations/runner";

export function PendingSqlPanel({ tenantMode, orgSlug }: { tenantMode: string; orgSlug: string }) {
  const model = buildPageMigrationRunner({ tenantMode });
  return (
    <section
      id="migration-runner"
      data-testid="migration-runner"
      data-mode={model.mode}
      data-source={model.source}
      data-write={model.write ? "true" : "false"}
      data-db={model.dbUrl}
      className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Pending SQL</p>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Migration runner</h2>
        {model.lines.map((line) => (
          <p key={line} className="mt-2 text-sm text-slate-700">{line}</p>
        ))}
      </div>
      <ol className="grid gap-2">
        {model.steps.map((step) => (
          <li
            key={step.file}
            data-step={step.step}
            data-status={step.status}
            data-checksum={step.checksum}
            className="min-w-0 rounded-md border border-slate-200 px-3 py-2 text-sm"
          >
            <p className="font-semibold text-[#0B1F3A]">
              {step.step}. {step.name}
            </p>
            <p className="mt-1 break-all text-slate-700">{step.file}</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700">{step.checksum}</p>
            <p className="mt-1 text-slate-700">{migrationStatusLabel(step.status)}. Do not claim applied.</p>
          </li>
        ))}
      </ol>
      <div>
        <h3 className="font-display text-base font-bold text-[#0B1F3A]">Sandbox dry-run</h3>
        <p className="mt-1 text-sm text-slate-700">
          The dry-run stores the step, filename, and checksum for this list. charged stays false. It does not apply SQL.
        </p>
        <div className="mt-3">
          <MigrationDryRunForm
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
