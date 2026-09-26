import { PublicPageShell } from "@/components/public-page-shell";
import { AUTOMATION_SUITE } from "@/lib/brand/catalog";

export default function AutomationPage() {
  return (
    <PublicPageShell
      title="Automation"
      description="The automation suite covers chatbots and sales assistants, WhatsApp with the CRM, client onboarding, dashboards, and custom web apps."
      sourcePage="automation"
      items={AUTOMATION_SUITE.map((name) => ({ title: name }))}
    />
  );
}
