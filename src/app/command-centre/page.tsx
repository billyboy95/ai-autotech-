import type { Metadata } from "next";
import { CommandCentreDashboard } from "@/components/command-centre-dashboard";

export const metadata: Metadata = {
  title: "Command Centre",
  description: "Private AI AutoTech operating dashboard for CRM, projects, proposals, invoices, agents, tickets, and reports.",
};

export default function CommandCentrePage() {
  return <CommandCentreDashboard />;
}
