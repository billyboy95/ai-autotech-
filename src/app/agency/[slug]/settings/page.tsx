import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";
import { previewWorkspaces, EDUCATION_BLUEPRINT, AGENCY_BLUEPRINT } from "@/lib/tenant/blueprints";
import { resolveWorkspace } from "@/lib/tenant/context";
import { findOrgBySlug, listMembers, listStages } from "@/lib/tenant/data";
import { isAgencyRole } from "@/lib/tenant/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace settings",
  robots: { index: false, follow: false },
};

export default async function WorkspaceSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await resolveWorkspace(slug);

  if (workspace.mode === "preview") {
    const org = previewWorkspaces().find((item) => item.slug === slug);
    if (!org) notFound();
    const stages = (org.slug === "eastc" ? EDUCATION_BLUEPRINT : AGENCY_BLUEPRINT).stages.map((stage) => stage.name);
    return (
      <main className="min-h-screen bg-[#F3F4F6] px-4 py-8">
        <div className="mx-auto grid max-w-3xl gap-4">
          <Link href="/agency" className="text-sm font-semibold text-[#2563EB]">Back to agency</Link>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">{org.name} settings</h1>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Preview only. Settings save after Supabase Auth and the tenancy migration are in place.
          </p>
          <WorkspaceSettingsForm workspace={org} stages={stages} members={[]} canEdit={false} />
        </div>
      </main>
    );
  }

  if (workspace.requiresLogin) {
    redirect(`/login?next=${encodeURIComponent(`/agency/${slug}/settings`)}`);
  }
  if (workspace.active.slug !== slug) notFound();

  const org = await findOrgBySlug(slug);
  if (!org) notFound();
  const [stages, members] = await Promise.all([listStages(org.id), listMembers(org.id)]);
  const canEdit = workspace.role === "client_admin" || isAgencyRole(workspace.role);

  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-8">
      <div className="mx-auto grid max-w-3xl gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/agency" className="text-sm font-semibold text-[#2563EB]">Back to agency</Link>
          <Link href={`/command-centre?org=${slug}`} className="text-sm font-semibold text-[#0B1F3A]">Open CRM</Link>
        </div>
        <h1 className="font-display text-2xl font-bold" style={{ color: org.primaryColor }}>{org.name} settings</h1>
        <WorkspaceSettingsForm workspace={org} stages={stages} members={members} canEdit={canEdit} />
      </div>
    </main>
  );
}
