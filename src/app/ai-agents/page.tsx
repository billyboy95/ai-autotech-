import { PublicPageShell } from "@/components/public-page-shell";
import { AGENT_DEPARTMENTS } from "@/lib/brand/catalog";

export default function AiAgentsPage() {
  return (
    <PublicPageShell
      title="AI Agents"
      description="The planned workforce is Executive, Sales, Voice, Research, Website, Automation, Client Success, Finance, Content, and Admin. Voice routes sales to Sales, strategy to Executive, automation to Automation, website to Website, and content to Content."
      sourcePage="ai-agents"
      items={AGENT_DEPARTMENTS.map((name) => ({ title: name }))}
    />
  );
}
