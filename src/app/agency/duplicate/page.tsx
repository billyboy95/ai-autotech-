import type { Metadata } from "next";
import Link from "next/link";
import { CommandShell } from "@/components/crm/command-shell";
import { DuplicateWorkspaceForm, type DuplicateSourceOption } from "@/components/templates/duplicate-workspace";
import { seededSnapshotOptions } from "@/lib/snapshots/catalog";
import { burgerJointProof } from "@/lib/snapshots/fixture";
import { listSnapshotOptions } from "@/lib/snapshots/store";
import { workspaceTemplatesMode } from "@/lib/snapshots/swap";
import { RESTAURANT_SNAPSHOT_ID } from "@/lib/snapshots/templates-v2";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWorkspace } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Duplicate workspace",
  robots: { index: false, follow: false },
};

const SAMPLE_WORKSPACE = "a2c00000-0000-4000-8000-0000000000aa";

export default async function DuplicateWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  const params = await searchParams;
  const workspace = await resolveWorkspace();
  const mode = workspaceTemplatesMode({
    tenantMode: workspace.mode,
    forceFixture: params.fixture === "1",
  });
  const blocked = workspace.mode === "member" && !workspace.canManageAgency;
  const proof = burgerJointProof();
  const snapshots = mode === "sandbox" && !blocked ? await listSnapshotOptions() : seededSnapshotOptions();
  const sources: DuplicateSourceOption[] = snapshots.map((item) => ({
    kind: "snapshot",
    id: item.id,
    name: item.name,
  }));

  if (mode === "sandbox" && !blocked) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("organizations").select("id, name, org_type").eq("org_type", "client").order("name");
    for (const row of data ?? []) {
      sources.push({ kind: "workspace", id: String(row.id), name: String(row.name) });
    }
  } else {
    sources.push({ kind: "workspace", id: SAMPLE_WORKSPACE, name: "Sample restaurant workspace" });
  }

  return (
    <CommandShell setupError={null} sendingEnabled={workspace.active.sendingEnabled}>
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6">
        <Link href="/agency" className="text-sm font-semibold text-[#2563EB]">
          Back to agency
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Templates</p>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Duplicate a workspace</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Pick a template or a workspace, swap the business details, and preview the result. Two burger joints can start from the same restaurant template. Sending stays off.
          </p>
        </div>
        {blocked ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Sign in as an agency owner or staff member first.{" "}
            <Link className="font-semibold text-[#2563EB]" href="/login?next=/agency/duplicate">
              Sign in
            </Link>
          </p>
        ) : (
          <DuplicateWorkspaceForm
            mode={mode}
            sources={sources}
            barn={proof.barn}
            second={proof.second}
            defaultSource={`snapshot:${RESTAURANT_SNAPSHOT_ID}`}
          />
        )}
      </div>
    </CommandShell>
  );
}
