import type { Metadata } from "next";
import Link from "next/link";
import { AgencyView } from "@/components/agency-view";
import { previewWorkspaces, EDUCATION_BLUEPRINT, ECOMMERCE_BLUEPRINT } from "@/lib/tenant/blueprints";
import { zentrixStores } from "@/lib/shopify/catalog";
import { resolveWorkspace, loadOrganizations } from "@/lib/tenant/context";
import { clientMetrics } from "@/lib/tenant/data";
import { AGENCY_SLUG } from "@/lib/tenant/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agency",
  robots: { index: false, follow: false },
};

function SignInWall() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Agency</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">Sign in to see client workspaces</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          AI AutoTech Pty Ltd is the parent agency. Client workspaces such as EASTC stay behind a login.
          The company CRM at the agency workspace is still open, so existing leads are not locked away.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/login?next=/agency" className="h-10 rounded-md bg-[#2563EB] px-4 text-sm font-semibold leading-10 text-white">
            Sign in
          </Link>
          <Link href="/command-centre" className="h-10 rounded-md border border-slate-200 px-4 text-sm font-semibold leading-10 text-[#0B1F3A]">
            Open agency CRM
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function AgencyPage() {
  const workspace = await resolveWorkspace();
  if (workspace.mode === "preview") {
    const [agency, eastc, zentrix] = previewWorkspaces();
    return (
      <AgencyView
        agency={agency}
        preview
        signedInEmail={null}
        clients={[
          {
            workspace: eastc,
            leads: 0,
            pipelineValue: 0,
            revenue: 0,
            stores: 0,
            conversions: 0,
            won: 0,
            stages: EDUCATION_BLUEPRINT.stages.map((stage) => stage.name),
          },
          {
            workspace: zentrix,
            leads: 0,
            pipelineValue: 0,
            revenue: 0,
            stores: zentrixStores().length,
            conversions: 0,
            won: 0,
            stages: ECOMMERCE_BLUEPRINT.stages.map((stage) => stage.name),
          },
        ]}
      />
    );
  }
  if (!workspace.canManageAgency) return <SignInWall />;

  const orgs = (await loadOrganizations()) ?? [];
  const allowed = new Set(workspace.workspaces.map((item) => item.slug));
  const agency = orgs.find((org) => org.slug === AGENCY_SLUG) ?? orgs.find((org) => org.orgType === "agency") ?? workspace.active;
  const clients = orgs.filter((org) => org.orgType === "client" && allowed.has(org.slug));
  const metrics = await clientMetrics(clients);
  return <AgencyView agency={agency} clients={metrics} preview={false} signedInEmail={workspace.userEmail} />;
}
