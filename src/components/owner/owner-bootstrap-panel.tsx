import { OwnerNoteForm } from "@/components/owner/owner-note-form";
import { loadDocumentedOwnerAuth } from "@/server/workers/owner-auth-status";
import { buildOwnerBootstrap, type OwnerBootstrapModel } from "@/lib/owner/bootstrap";

const tone: Record<string, string> = {
  configured: "bg-emerald-50 text-emerald-950",
  missing: "bg-amber-50 text-amber-950",
  fixture: "bg-amber-50 text-amber-950",
};

function label(status: string) {
  if (status === "configured") return "Configured";
  if (status === "missing") return "Missing";
  return "Fixture";
}

export async function OwnerBootstrapPanel({ tenantMode, orgSlug }: { tenantMode: string; orgSlug: string }) {
  const observed = await loadDocumentedOwnerAuth(tenantMode);
  const model = buildOwnerBootstrap({
    tenantMode,
    authUser: observed.authUser,
    membership: observed.membership,
  });
  return <OwnerBootstrapView model={model} orgSlug={orgSlug} />;
}

export function OwnerBootstrapView({ model, orgSlug }: { model: OwnerBootstrapModel; orgSlug: string }) {
  return (
    <section
      id="owner-bootstrap"
      data-testid="owner-bootstrap"
      data-mode={model.mode}
      data-write={model.write ? "true" : "false"}
      data-owner-emails={model.ownerEmails}
      data-auth-attach={model.authAttach}
      className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">Go-live attach</p>
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Owner bootstrap</h2>
        {model.lines.map((line) => (
          <p key={line} className="mt-2 text-sm text-slate-700">{line}</p>
        ))}
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">OWNER_EMAILS</dt>
          <dd className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone[model.ownerEmails]}`}>
            {label(model.ownerEmails)}
          </dd>
          <p className="mt-2 text-sm text-slate-700">
            Documented owner: {model.documentedEmail}. The list is not shown.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Auth attach</dt>
          <dd className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone[model.authAttach]}`}>
            {label(model.authAttach)}
          </dd>
          <p className="mt-2 text-sm text-slate-700">
            agency_owner on ai-autotech. This page does not create the Auth user.
          </p>
        </div>
      </dl>
      <div>
        <h3 className="font-display text-base font-bold text-[#0B1F3A]">owner-bootstrap.sql</h3>
        <p className="mt-1 text-sm text-slate-700">
          Read-only copy from {model.sqlFile}. Checksum {model.checksum}. Paste it in the SQL editor after the Auth user exists. Steps 20 through 33 are not applied. Step 34 is also unapplied.
        </p>
        <p className="mt-2 flex flex-wrap gap-3 text-sm">
          <a href={model.authUsersUrl} className="font-semibold text-[#2563EB]" rel="noreferrer" target="_blank">
            Open Authentication users
          </a>
          <a href={model.sqlEditorUrl} className="font-semibold text-[#2563EB]" rel="noreferrer" target="_blank">
            Open SQL editor
          </a>
        </p>
        <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">{model.sqlText}</pre>
      </div>
      <div>
        <h3 className="font-display text-base font-bold text-[#0B1F3A]">Sandbox note</h3>
        <p className="mt-1 text-sm text-slate-700">
          The note stores configured, missing, or fixture. It does not store an email or a secret. It does not create an Auth user and it does not run the SQL.
        </p>
        <div className="mt-3">
          <OwnerNoteForm
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
