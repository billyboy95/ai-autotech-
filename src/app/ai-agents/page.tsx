import { PublicPageShell } from "@/components/public-page-shell";

export default function AiAgentsPage() {
  return (
    <PublicPageShell
      title="AI Agents"
      description="Role-specific agents for sales, support, operations, marketing, finance, and executive reporting."
      sourcePage="ai-agents"
      items={[
        "Sales Agent",
        "Support Agent",
        "Operations Agent",
        "Marketing Agent",
        "Finance Agent",
        "Executive Agent",
      ]}
    />
  );
}
