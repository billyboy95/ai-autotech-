import { PublicPageShell } from "@/components/public-page-shell";

export default function SoftwareDevelopmentPage() {
  return (
    <PublicPageShell
      title="Software Development"
      description="Custom SaaS foundations, dashboards, portals, server actions, database schemas, and deployment-ready web applications."
      sourcePage="software-development"
      items={[
        "Next.js applications",
        "Supabase backends",
        "Client portals",
        "Dashboards and reporting",
        "Proposal generators",
        "Invoice tracking systems",
      ]}
    />
  );
}
