import type { Metadata } from "next";
import Link from "next/link";
import { SnapshotPushForm } from "@/components/snapshot-push-form";
import { seededSnapshotOptions } from "@/lib/snapshots/catalog";
import { listSnapshotOptions } from "@/lib/snapshots/store";
import { resolveWorkspace } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Snapshots",
  robots: { index: false, follow: false },
};

export default async function SnapshotsPage() {
  const workspace = await resolveWorkspace();
  const blocked = workspace.mode !== "preview" && !workspace.canManageAgency;
  const snapshots = workspace.mode === "preview" ? seededSnapshotOptions() : await listSnapshotOptions();

  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-8">
      <div className="mx-auto grid max-w-3xl gap-4">
        <Link href="/agency" className="text-sm font-semibold text-[#2563EB]">Back to agency</Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Snapshots</p>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Workspace snapshots</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            A push writes catalogue updates into workspaces that already loaded the snapshot.
            Assets a client has edited are skipped. Contacts, messages, and secrets are not in the payload, and sending stays off.
          </p>
        </div>
        {workspace.mode === "preview" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Preview of the two seed snapshots. Push runs after Supabase and the phase 2c migration are applied.
          </p>
        ) : null}
        {blocked ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Sign in as an agency owner or staff member first. <Link className="font-semibold text-[#2563EB]" href="/login?next=/agency/snapshots">Sign in</Link>
          </p>
        ) : (
          snapshots.map((snapshot) => (
            <article key={snapshot.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">{snapshot.name}</h2>
              <p className="text-sm text-slate-600">{snapshot.description}</p>
              {workspace.mode === "preview" ? null : <SnapshotPushForm snapshotId={snapshot.id} snapshotName={snapshot.name} />}
            </article>
          ))
        )}
      </div>
    </main>
  );
}
