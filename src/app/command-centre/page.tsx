import type { Metadata } from "next";
import { CommandCentreDashboard } from "@/components/command-centre-dashboard";
import { getDashboardData } from "@/lib/dashboard-data";

export const metadata: Metadata = {
  title: "Command Centre",
  description: "Private AI AutoTech operating dashboard for CRM, projects, proposals, invoices, agents, tickets, and reports.",
};

export default async function CommandCentrePage() {
  const data = await getDashboardData();

  return <CommandCentreDashboard data={data} />;
}
