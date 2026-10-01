import { OpsSecretsNoteForm } from "@/components/ops/ops-secrets-note-form";
import { buildOpsSecrets, type OpsSecretsModel, type Presence } from "@/lib/ops/secrets";

const tone: Record<Presence, string> = {
  configured: "bg-emerald-50 text-emerald-950",
  missing: "bg-amber-50 text-amber-950",
  fixture: "bg-amber-50 text-amber-950",
};

function label(status: Presence) {
  if (status === "configured") return "Configured";
  if (status === "missing") return "Missing";
  return "Fixture";
}

const checks: Array<{ key: "cron" | "email" | "whatsapp" | "sms" | "payfast"; label: string }> = [
  { key: "cron", label: "CRON_SECRET" },
  { key: "email", label: "Email provider" },
  { key: "whatsapp", label: "WhatsApp / Meta" },
  { key: "sms", label: "SMS provider" },
  { key: "payfast", label: "PayFast sandbox keys" },
];

export function OpsSecretsPanel({ tenantMode, orgSlug }: { tenantMode: string; orgSlug: string }) {
  const model = buildOpsSecrets({ tenantMode });
  return <OpsSecretsView model={model} orgSlug={orgSlug} />;
}

export function OpsSecretsView({ model, orgSlug }: { model: OpsSecretsModel; orgSlug: string }) {
  return (
    <section
      id="ops-secrets"
      data-testid="ops-secrets"
      data-mode={model.mode}
      data-write={model.write ? "true" : "false"}
      data-cron={model.cron}
      data-email={model.email}
      data-whatsapp={model.whatsapp}
      data-sms={model.sms}
      data-payfast={model.payfast}
      data-registered={model.registered ? "true" : "false"}
      className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Go-live</p>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Ops secrets</h2>
        {model.lines.map((line) => (
          <p key={line} className="mt-2 text-sm text-slate-700">{line}</p>
        ))}
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {checks.map((check) => {
          const status = model[check.key];
          return (
            <div key={check.key} className="rounded-md border border-slate-200 px-3 py-2" data-check={check.key}>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{check.label}</dt>
              <dd className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone[status]}`}>
                {label(status)}
              </dd>
              <p className="mt-2 text-sm text-slate-700">Presence only. The value is not shown.</p>
            </div>
          );
        })}
      </dl>
      <div>
        <h3 className="font-display text-base font-bold text-[#0B1F3A]">Cron dry-run</h3>
        <p className="mt-1 text-sm text-slate-700">
          Names only. These jobs would be registered once CRON_SECRET exists. This page does not register them. Leave AI_REPLY_CRON_ENABLED unset.
        </p>
        <ul className="mt-3 grid gap-1 text-sm text-slate-700" data-testid="cron-dry-run">
          {model.cronJobs.map((name) => (
            <li key={name} data-cron-job={name}>{name}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-display text-base font-bold text-[#0B1F3A]">Sandbox note</h3>
        <p className="mt-1 text-sm text-slate-700">
          The note stores configured, missing, or fixture, plus the cron names above. It does not store a secret and it does not register a cron.
        </p>
        <div className="mt-3">
          <OpsSecretsNoteForm
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
