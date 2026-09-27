import type { ReactNode } from "react";
import { requireCrmSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  await requireCrmSession("/agency");
  return children;
}
