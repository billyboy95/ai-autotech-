"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import type { WorkspaceOption } from "@/lib/tenant/types";

export function WorkspaceSwitcher({
  activeSlug,
  activeName,
  workspaces,
  signedIn,
  showAgencyLink,
  userEmail,
}: {
  activeSlug: string;
  activeName: string;
  workspaces: WorkspaceOption[];
  signedIn: boolean;
  showAgencyLink: boolean;
  userEmail: string | null;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="grid gap-1 text-xs font-semibold text-slate-500">
        Workspace
        <select
          aria-label="Workspace"
          value={activeSlug}
          onChange={(event) => {
            const slug = event.target.value;
            router.push(`/command-centre?org=${slug}`);
          }}
          className="h-10 min-w-48 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0B1F3A]"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.slug} value={workspace.slug}>
              {workspace.name}
              {workspace.orgType === "agency" ? " · agency" : ""}
            </option>
          ))}
        </select>
      </label>
      {showAgencyLink ? (
        <a href="/agency" className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold leading-10 text-[#0B1F3A]">
          Agency view
        </a>
      ) : null}
      {signedIn ? (
        <form action={signOut}>
          <button className="h-10 rounded-md px-3 text-sm font-semibold text-slate-500" type="submit">
            Sign out{userEmail ? ` · ${userEmail}` : ""}
          </button>
        </form>
      ) : (
        <a href={`/login?next=${encodeURIComponent(`/command-centre?org=${activeSlug}`)}`} className="h-10 rounded-md bg-[#0B1F3A] px-3 text-sm font-semibold leading-10 text-white">
          Sign in
        </a>
      )}
      <span className="sr-only">{activeName}</span>
    </div>
  );
}
