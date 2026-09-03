import type { Metadata } from "next";
import { CompanyCrm } from "@/components/company-crm";
import { readCrm } from "@/lib/crm-store";

export const metadata: Metadata = {
  title: "AI AutoTech Pty Ltd CRM",
  description: "Company CRM for AI AutoTech Pty Ltd.",
};

export default async function CommandCentrePage() {
  const data = await readCrm();
  return <CompanyCrm data={data} />;
}
