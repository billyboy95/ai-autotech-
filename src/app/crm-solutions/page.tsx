import { PublicPageShell } from "@/components/public-page-shell";

export default function CrmSolutionsPage() {
  return (
    <PublicPageShell
      title="CRM Solutions"
      description="Lead management, pipeline stages, owner assignment, notes, follow-ups, source tracking, and UTM attribution."
      sourcePage="crm-solutions"
      items={[
        "New Lead",
        "Qualified",
        "Discovery Booked",
        "Proposal Sent",
        "Negotiation",
        "Won, Lost, and Onboarding",
      ]}
    />
  );
}
