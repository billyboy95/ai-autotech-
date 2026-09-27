import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProvisionChecklist } from "@/components/provision-checklist";
import { planLabel } from "@/lib/snapshots/catalog";
import { resolveWorkspace } from "@/lib/tenant/context";
import { findOrgBySlug, listStages } from "@/lib/tenant/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace checklist",
  robots: { index: false, follow: false },
};

export default async function WorkspaceSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const workspace = await resolveWorkspace(slug);
  if (workspace.mode === "preview") {
    return (
      <main className="min-h-screen bg-[#F3F4F6] px-4 py-8">
        <div className="mx-auto grid max-w-3xl gap-4">
          <Link href="/agency" className="text-sm font-semibold text-[#2563EB]">Back to agency</Link>
          <ProvisionChecklist
            name={workspace.active.name}
            sendingEnabled={false}
            planLabel="Preview"
            stages={[]}
            invitePath={null}
            settingsHref={`/agency/${slug}/settings`}
            templatesHref={`/agency/${slug}/templates`}
          />
        </div>
      </main>
    );
  }
  if (workspace.requiresLogin) redirect(`/login?next=${encodeURIComponent(`/agency/${slug}/setup`)}`);
  if (workspace.active.slug !== slug) notFound();

  const org = await findOrgBySlug(slug);
  if (!org) notFound();
  const stages = await listStages(org.id);
  const plan = await readPlan(org.id);
  const label = planLabel(plan);
  const invite = typeof query.invite === "string" && /^[0-9a-f]+$/i.test(query.invite) ? `/invite/${query.invite}` : null;

  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-8">
      <div className="mx-auto grid max-w-3xl gap-4">
        <Link href="/agency" className="text-sm font-semibold text-[#2563EB]">Back to agency</Link>
        <ProvisionChecklist
          name={org.name}
          sendingEnabled={org.sendingEnabled}
          planLabel={label}
          stages={stages}
          invitePath={invite}
          settingsHref={`/agency/${slug}/settings`}
          templatesHref={`/agency/${slug}/templates`}
        />
      </div>
    </main>
  );
}

async function readPlan(orgId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizations").select("plan_key").eq("id", orgId).maybeSingle();
  if (error || !data) return "";
  return String(data.plan_key ?? "");
}
