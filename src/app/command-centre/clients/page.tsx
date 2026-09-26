import type { Metadata } from "next";
import { CrmFrame } from "@/components/crm/frame";
import { CompanySection } from "@/components/company-crm";
import { loadCommandData } from "@/lib/automation/page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients | AI AutoTech CRM",
  robots: { index: false, follow: false },
};

export default async function ClientsPage() {
  const { workspace, classic, sendingEnabled } = await loadCommandData();
  return (
    <CrmFrame setupError={workspace.setupError} sendingEnabled={sendingEnabled}>
      <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Clients</h1>
      <CompanySection data={classic} section="clients" />
    </CrmFrame>
  );
}
