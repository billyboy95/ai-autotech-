import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChannelConnectForm, type ChannelConnectionView } from "@/components/channel-connect-form";
import { WorkspaceBillingPanel } from "@/components/workspace-billing-panel";
import { WorkspaceSettingsForm } from "@/components/workspace-settings-form";
import { loadBillingPage } from "@/lib/billing/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
          <AiReplySettingsLink slug={org.slug} />
          <WorkspaceBillingPanel billing={await loadBillingPage({ orgId: null, orgName: org.name, slug: org.slug, email: "", role: null, preview: true })} />
          <ChannelConnectForm slug={org.slug} canEdit={false} connections={[]} />
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
  const billing = await loadBillingPage({
    orgId: org.id,
    orgName: org.name,
    slug: org.slug,
    email: workspace.userEmail || "",
    role: workspace.role,
  });

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
          readOnly={billing.readOnly}
        />
        <WorkspaceBillingPanel billing={billing} />
        <AiReplySettingsLink slug={org.slug} />
        <ChannelConnectForm slug={org.slug} canEdit={canEdit && !billing.readOnly} connections={await listConnections(org.id)} />
      </div>
    </main>
  );
}

function AiReplySettingsLink({ slug }: { slug: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Conversation AI</h2>
      <p className="mt-1 text-sm text-slate-600">
        Draft replies in the inbox. This stays off until an agency owner or client admin enables it. It does not turn sending on.
      </p>
      <Link href={`/command-centre/ai-replies?org=${slug}`} className="mt-3 inline-flex text-sm font-semibold text-[#2563EB]">
        Open Conversation AI settings
      </Link>
    </section>
  );
}

async function listConnections(orgId: string): Promise<ChannelConnectionView[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const listed = await supabase
      .from("channel_connections")
      .select("id, channel, provider, identifier, display_name, status")
      .eq("org_id", orgId);
    if (listed.error) return [];
    return (listed.data ?? []).map((row) => ({
      id: String(row.id),
      channel: String(row.channel),
      provider: String(row.provider),
      identifier: String(row.identifier),
      displayName: String(row.display_name || ""),
      status: String(row.status || ""),
    }));
  } catch {
    return [];
  }
}
