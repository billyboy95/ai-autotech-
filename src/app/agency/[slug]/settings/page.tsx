import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";
import { zentrixStores } from "@/lib/shopify/catalog";
import { blueprintForSlug } from "@/lib/tenant/blueprints";
import { previewWorkspaces } from "@/lib/tenant/blueprints";
import { resolveWorkspace } from "@/lib/tenant/context";
import { findOrgBySlug, listMembers, listShopifyStores, listStages } from "@/lib/tenant/data";
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
    const stages = blueprintForSlug(org.slug).stages.map((stage) => stage.name);
    const stores = org.slug === "zentrix" ? zentrixStores() : [];
    return (
      <main className="min-h-screen bg-[#F3F4F6] px-4 py-8">
        <div className="mx-auto grid max-w-4xl gap-4">
          <Link href="/agency" className="text-sm font-semibold text-[#2563EB]">Back to agency</Link>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">{org.name} settings</h1>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Preview only. Settings save after Supabase Auth and the tenancy migration are in place.
          </p>
          <WorkspaceSettingsForm workspace={org} stages={stages} members={[]} stores={stores} canEdit={false} canToggleSending={false} />
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
  const [stages, members, stores] = await Promise.all([
    listStages(org.id),
    listMembers(org.id),
    listShopifyStores(org.id),
  ]);
  const canEdit = workspace.role === "client_admin" || isAgencyRole(workspace.role);

  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-8">
      <div className="mx-auto grid max-w-4xl gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/agency" className="text-sm font-semibold text-[#2563EB]">Back to agency</Link>
          <Link href={`/command-centre?org=${slug}`} className="text-sm font-semibold text-[#0B1F3A]">Open CRM</Link>
        </div>
        <h1 className="font-display text-2xl font-bold" style={{ color: org.primaryColor }}>{org.name} settings</h1>
        <WorkspaceSettingsForm
          workspace={org}
          stages={stages}
          members={members}
          stores={stores}
          canEdit={canEdit}
          canToggleSending={workspace.role === "agency_owner"}
        />
      </div>
    </main>
  );
}
