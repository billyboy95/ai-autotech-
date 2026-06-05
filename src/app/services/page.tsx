import { PublicPageShell } from "@/components/public-page-shell";

export default function ServicesPage() {
  return (
    <PublicPageShell
      title="Services"
      description="Automation, AI, CRM, and software delivery services packaged for South African SMEs that need practical digital transformation."
      sourcePage="services"
      items={[
        "Automation audits",
        "AI workflow design",
        "CRM implementation",
        "Client portal builds",
        "Proposal and invoice systems",
        "Managed optimization retainers",
      ]}
    />
  );
}
