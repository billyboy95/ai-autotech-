import { PublicPageShell } from "@/components/public-page-shell";

export default function AutomationPage() {
  return (
    <PublicPageShell
      title="Automation"
      description="Map repetitive work, connect business tools, and ship reliable workflows across sales, finance, service, and delivery."
      sourcePage="automation"
      items={[
        "Lead routing",
        "Follow-up sequences",
        "Proposal workflows",
        "Invoice reminders",
        "Support triage",
        "Operations reporting",
      ]}
    />
  );
}
