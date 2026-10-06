import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { CrmFrame } from "@/components/crm/frame";
import { presentWorkspace } from "@/lib/brand/present";
import { loadBillingNote } from "@/lib/billing/load";
import { loadNotificationUnread } from "@/lib/funnel/load";
import { loadInboxUnread } from "@/lib/inbox/load";
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
  if (tenant.requiresLogin) {
    const next = tenant.requestedSlug
      ? `/command-centre?org=${encodeURIComponent(tenant.requestedSlug)}`
      : "/command-centre";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (tenant.mode === "member" && !tenant.role) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F3F4F6] px-4">
        <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Command centre</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-[#0B1F3A]">This login is not on a workspace yet</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {tenant.userEmail ? `${tenant.userEmail} is signed in. ` : ""}
            A membership is required before customer records can load. If you are the agency owner, add your email to OWNER_EMAILS and sign in again, or run supabase/owner-bootstrap.sql.
          </p>
        </section>
      </main>
    );
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

  const brand = presentWorkspace(tenant.active);
  const inboxUnread = await loadInboxUnread();
  const alerts = await loadNotificationUnread({ tenantMode: tenant.mode, orgId: tenant.active.id });
  const billingNote =
    tenant.mode === "member" && tenant.scoped && !tenant.active.id.startsWith("preview-")
      ? await loadBillingNote(tenant.active.id)
      : null;

  return (
    <CrmFrame
      setupError={setupError}
      sendingEnabled={sendingEnabled}
      inboxUnread={inboxUnread}
      alertUnread={alerts.unread}
      alertsFixture={alerts.fixture}
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
        billingBanner: billingNote?.text ?? null,
        billingTone: billingNote?.tone ?? null,
        productName: brand.productName,
        logoUrl: brand.logoUrl,
        showPlatformName: brand.showPlatformName,
      }}
    >
      {children}
    </CrmFrame>
  );
}
