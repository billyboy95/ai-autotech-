import type { Metadata } from "next";
import { CompanyCrm } from "@/components/company-crm";
import { readCrm } from "@/lib/crm-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Classic Command Centre",
  description: "The original AI AutoTech company CRM.",
};

export default async function ClassicCommandCentrePage() {
  const data = await readCrm();
  return <CompanyCrm data={data} />;
}
