import type { Metadata } from "next";
import Link from "next/link";
import { CreateWorkspaceForm } from "@/components/create-workspace-form";
import { resolveWorkspace } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New client workspace",
  robots: { index: false, follow: false },
};

export default async function NewWorkspacePage() {
  const workspace = await resolveWorkspace();
  const blocked = workspace.mode !== "preview" && !workspace.canManageAgency;

  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-8">
      <div className="mx-auto grid max-w-xl gap-4">
        <Link href="/agency" className="text-sm font-semibold text-[#2563EB]">
          Back to agency
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">New workspace</p>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Create a client workspace</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Copies pipeline stages, follow-up steps, and message templates from the template you pick.
            The new workspace only sees its own leads.
          </p>
        </div>
        {blocked ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Sign in as an agency owner or staff member first. <Link className="font-semibold text-[#2563EB]" href="/login?next=/agency/new">Sign in</Link>
          </p>
        ) : (
          <CreateWorkspaceForm />
        )}
      </div>
    </main>
  );
}
