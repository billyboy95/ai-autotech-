import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PwaRegister } from "@/components/pwa/register";
import { requireCrmSession } from "@/lib/auth/session";
import { clientPlatformDecision } from "@/lib/membership/access";
import { safeResolveWorkspace } from "@/lib/tenant/context";
import { readOrgMembershipStatus } from "@/server/workers/membership-status";

export const dynamic = "force-dynamic";

export default async function CommandCentreLayout({ children }: { children: ReactNode }) {
  await requireCrmSession("/command-centre");
  const tenant = await safeResolveWorkspace();
  if (tenant.mode === "member" && (tenant.role === "client_admin" || tenant.role === "client_user")) {
    const status = await readOrgMembershipStatus(tenant.active.id);
    const decision = clientPlatformDecision({ role: tenant.role, status });
    if (!decision.allowed) redirect("/membership?access=required");
  }
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
