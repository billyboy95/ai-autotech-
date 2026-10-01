import type { ReactNode } from "react";
import { PwaRegister } from "@/components/pwa/register";
import { requireCrmSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CommandCentreLayout({ children }: { children: ReactNode }) {
  await requireCrmSession("/command-centre");
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
