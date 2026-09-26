import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { CrmFrame } from "@/components/crm/frame";
import { recordAgencyView, rememberActiveOrg, safeResolveWorkspace } from "@/lib/tenant/context";
import { isAgencyRole } from "@/lib/tenant/types";

export async function CommandShell({
  children,
  setupError,
  sendingEnabled = false,
  requestedSlug,
}: {
  children: ReactNode;
  setupError?: string | null;
  sendingEnabled?: boolean;
  requestedSlug?: string | null;
}) {
  const tenant = await safeResolveWorkspace(requestedSlug);
  if (tenant.requiresLogin && tenant.requestedSlug) {
    redirect(`/login?next=${encodeURIComponent(`/command-centre?org=${tenant.requestedSlug}`)}`);
  }
  if (tenant.mode === "member" && !tenant.role) {
    redirect("/login?next=/command-centre");
  }

  if (tenant.mode === "member" && tenant.scoped && !tenant.active.id.startsWith("preview-")) {
    await rememberActiveOrg(tenant.active.id);
    if (tenant.role && isAgencyRole(tenant.role) && tenant.active.orgType === "client") {
      await recordAgencyView(tenant.active.id, tenant.active.name);
    }
  }

  const migrationsPending =
    tenant.mode === "owner" && !tenant.scoped && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const wrongWorkspace = Boolean(tenant.requestedSlug && tenant.requestedSlug !== tenant.active.slug);
  const note = migrationsPending
    ? "Agency workspace tables are not in this database yet. Showing the single agency book."
    : tenant.mode === "preview"
      ? "Preview workspace. Connect Supabase to load live leads for this workspace."
      : wrongWorkspace
        ? "That workspace is outside your account. Showing one you can open."
        : null;
  const agencyBanner =
    tenant.mode === "member" && tenant.role && isAgencyRole(tenant.role) && tenant.active.orgType === "client"
      ? `Viewing ${tenant.active.name} as agency`
      : null;

  return (
    <CrmFrame
      setupError={setupError}
      sendingEnabled={sendingEnabled}
      chrome={{
        activeSlug: tenant.active.slug,
        activeName: tenant.active.name,
        primaryColor: tenant.active.primaryColor,
        workspaces: tenant.workspaces,
        signedIn: tenant.mode === "member",
        showAgencyLink: tenant.canManageAgency,
        userEmail: tenant.userEmail,
        note,
        agencyBanner,
      }}
    >
      {children}
    </CrmFrame>
  );
}
