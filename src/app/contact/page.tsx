import { PublicPageShell } from "@/components/public-page-shell";

export default function ContactPage() {
  return (
    <PublicPageShell
      title="Contact"
      description="Share your business goals, service interest, and workflow challenges. AI AutoTech will capture the lead into the CRM pipeline."
      sourcePage="contact"
      items={[
        "Discovery call booking",
        "WhatsApp follow-up",
        "Service fit assessment",
        "CRM lead capture",
        "Project scoping",
        "Proposal preparation",
      ]}
    />
  );
}
