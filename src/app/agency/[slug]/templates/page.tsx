import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TemplateEditor } from "@/components/template-editor";
import { EDUCATION_PAYLOAD } from "@/lib/snapshots/catalog";
import { listSnapshotTemplates } from "@/lib/snapshots/store";
import { resolveWorkspace } from "@/lib/tenant/context";
import { findOrgBySlug } from "@/lib/tenant/data";
import { isAgencyRole } from "@/lib/tenant/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace templates",
  robots: { index: false, follow: false },
};

export default async function WorkspaceTemplatesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await resolveWorkspace(slug);

  if (workspace.mode === "preview") {
    return (
      <main className="min-h-screen bg-[#F3F4F6] px-4 py-8">
        <div className="mx-auto grid max-w-3xl gap-4">
          <Link href={`/agency/${slug}/setup`} className="text-sm font-semibold text-[#2563EB]">Back to checklist</Link>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Templates</h1>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Preview only. These WhatsApp follow-ups are templates and are not sent.
          </p>
          {EDUCATION_PAYLOAD.message_templates.map((template) => (
            <article key={template.asset_key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-[#0B1F3A]">{template.name}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{template.body}</p>
            </article>
          ))}
        </div>
      </main>
    );
  }

  if (workspace.requiresLogin) redirect(`/login?next=${encodeURIComponent(`/agency/${slug}/templates`)}`);
  if (workspace.active.slug !== slug) notFound();
  const org = await findOrgBySlug(slug);
  if (!org) notFound();
  const templates = await listSnapshotTemplates(org.id);
  const canEdit = workspace.role === "client_admin" || isAgencyRole(workspace.role);

  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-8">
      <div className="mx-auto grid max-w-3xl gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/agency/${slug}/setup`} className="text-sm font-semibold text-[#2563EB]">Back to checklist</Link>
          <Link href={`/agency/${slug}/settings`} className="text-sm font-semibold text-[#0B1F3A]">Settings</Link>
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">{org.name} templates</h1>
          <p className="mt-2 text-sm text-slate-600">Saving a template does not send it. A later snapshot push skips templates you change here.</p>
        </div>
        {templates.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No snapshot templates yet. Apply `supabase/migrations/20261016120000_phase2c_snapshots.sql`, then create the workspace from a snapshot.
          </p>
        ) : null}
        {templates.map((template) => (
          <TemplateEditor key={template.id} slug={slug} canEdit={canEdit} template={template} />
        ))}
      </div>
    </main>
  );
}
