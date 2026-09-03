import type { Metadata } from "next";
import { CommandCentreDashboard } from "@/components/command-centre-dashboard";
import { getDashboardData } from "@/lib/dashboard-data";

export const metadata: Metadata = {
  title: "Classic Command Centre",
  description: "The original AI AutoTech operating dashboard.",
};

export default async function ClassicCommandCentrePage() {
  const data = await getDashboardData();
  return <CommandCentreDashboard data={data} />;
}
